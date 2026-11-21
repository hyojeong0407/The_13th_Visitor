/* =========================================================================
   5. 16비트 픽셀 렌더링 엔진 (고밀도 도트 리뉴얼 · 오프스크린 캐시 · 감소 모션 대응) (v1.9.0)
   ========================================================================= */
import { ROOMS, NPCS, PROPS, FIELD_ITEMS } from "./data.js";
import { TILE, FLICKER_DURATION, SANITY_CONFIG } from "./config.js";
import { state, GAME_MODE, GHOST_STATE } from "./state.js";
import { getCachedSprite, drawCachedSprite } from "./spriteCache.js";

const lightCanvas = document.createElement("canvas");
const lctx = lightCanvas.getContext("2d");

export function updateVisualTimers(dt) {
  state.elapsedTime += dt;

  if (state.screenShake > 0) {
    if (state.prefs.reducedMotion) {
      state.screenShake = 0;
    } else {
      state.screenShake *= Math.pow(0.0005, dt);
      if (state.screenShake < 0.25) state.screenShake = 0;
    }
  }

  if (state.lightState === "on") {
    state.currentLightOn = true;
  } else if (state.lightState === "out") {
    state.currentLightOn = false;
  } else if (state.lightState === "flicker") {
    if (state.prefs.reducedMotion) {
      state.currentLightOn = true;
    } else {
      const progress = 1 - Math.max(0, state.flickerTimer / FLICKER_DURATION);
      const t = state.elapsedTime * 60;
      const wave = Math.sin(t * 0.55) + Math.cos(t * 1.25);
      state.currentLightOn = wave > (-0.45 + progress * 0.95);
    }
  }
}

function getBakedRoomBase(roomName, r) {
  const mapW = r.cols * TILE;
  const mapH = r.rows * TILE;
  const isCursed = r.theme === "cursed";
  const key = `room-base-v2:${roomName}:${r.cols}x${r.rows}:${isCursed ? 1 : 0}`;

  return getCachedSprite(key, mapW, mapH, bctx => {
    bctx.fillStyle = r.bg;
    bctx.fillRect(0, 0, mapW, mapH);

    // 바닥 타일 + 16비트 픽셀 질감 및 음영
    for (let y = 1; y < r.rows - 1; y++) {
      for (let x = 1; x < r.cols - 1; x++) {
        const tx = x * TILE;
        const ty = y * TILE;
        const even = (x + y) % 2 === 0;
        bctx.fillStyle = even ? r.floorA : r.floorB;
        bctx.fillRect(tx, ty, TILE, TILE);

        // 타일 상단 미세 하이라이트 & 하단 음영
        bctx.fillStyle = "rgba(255,255,255,0.035)";
        bctx.fillRect(tx + 1, ty + 1, TILE - 2, 2);
        bctx.fillStyle = "rgba(0,0,0,0.16)";
        bctx.fillRect(tx, ty + TILE - 2, TILE, 2);
        bctx.fillRect(tx + TILE - 1, ty, 1, TILE);

        // 결정론적 미세 스크래치/균열 도트
        const hash = (x * 37 + y * 91) % 17;
        if (hash === 3 || (isCursed && hash % 5 === 0)) {
          bctx.fillStyle = isCursed ? "rgba(180, 48, 72, 0.18)" : "rgba(255, 255, 255, 0.04)";
          bctx.fillRect(tx + 8 + (hash % 14), ty + 12 + (hash % 10), 6, 2);
          bctx.fillRect(tx + 12 + (hash % 14), ty + 14 + (hash % 10), 4, 2);
        }
      }
    }

    // 외벽 + 상단 림 & 걸레받이(baseboard) 디테일
    bctx.fillStyle = r.wall;
    bctx.fillRect(0, 0, mapW, TILE);
    bctx.fillRect(0, (r.rows - 1) * TILE, mapW, TILE);
    bctx.fillRect(0, 0, TILE, mapH);
    bctx.fillRect((r.cols - 1) * TILE, 0, TILE, mapH);

    // 상단 벽면 몰딩 및 걸레받이
    bctx.fillStyle = "rgba(255,255,255,0.08)";
    bctx.fillRect(TILE, 4, mapW - TILE * 2, 3);
    bctx.fillStyle = isCursed ? "#3b1721" : "#111421";
    bctx.fillRect(TILE, TILE - 6, mapW - TILE * 2, 6);
    bctx.fillStyle = "rgba(0,0,0,0.45)";
    bctx.fillRect(TILE, TILE - 1, mapW - TILE * 2, 2);
  });
}

function drawDetailedFurniture(ctx, f) {
  const x = f.x * TILE;
  const y = f.y * TILE;
  const w = f.w * TILE;
  const h = f.h * TILE;
  const animPhase = f.style === "cctv" ? (Math.floor(state.elapsedTime * 4) % 2) : 0;
  const key = `furn-v2:${f.label}:${w}x${h}:${f.color}:${f.style || "default"}:${animPhase}`;

  const sprite = getCachedSprite(key, w, h + 5, bctx => {
    // 접지 그림자
    bctx.fillStyle = "rgba(0,0,0,0.46)";
    bctx.fillRect(3, h - 2, w - 4, 6);

    // 본체 & 입체 베벨(상단 하이라이트 / 하단 음영)
    bctx.fillStyle = f.color;
    bctx.fillRect(2, 2, w - 4, h - 4);
    bctx.fillStyle = "rgba(255,255,255,0.12)";
    bctx.fillRect(3, 3, w - 6, 4);
    bctx.fillStyle = "rgba(0,0,0,0.28)";
    bctx.fillRect(3, h - 8, w - 6, 4);

    bctx.strokeStyle = "rgba(0,0,0,0.82)";
    bctx.lineWidth = 1.5;
    bctx.strokeRect(2, 2, w - 4, h - 4);

    if (f.style === "car") {
      // 순찰차/차량 유리창, 루프 라인, 헤드라이트
      bctx.fillStyle = "#16202e";
      bctx.fillRect(14, 7, w - 28, h - 14);
      bctx.fillStyle = "rgba(143, 201, 255, 0.22)";
      bctx.fillRect(18, 9, 14, h - 18);
      bctx.fillStyle = "#f2d28b";
      bctx.fillRect(w - 7, 7, 4, 8);
      bctx.fillRect(w - 7, h - 15, 4, 8);
      bctx.fillStyle = "#c94a5a";
      bctx.fillRect(3, 8, 3, 7);
      bctx.fillRect(3, h - 15, 3, 7);
    } else if (f.style === "bed") {
      // 침대 베개, 이불 주름, 나무 프레임
      bctx.fillStyle = "#3a2924";
      bctx.fillRect(2, 2, 6, h - 4);
      bctx.fillStyle = "#e6e2ed";
      bctx.fillRect(9, 7, 16, h - 14);
      bctx.fillStyle = "rgba(0,0,0,0.24)";
      bctx.fillRect(28, 3, 3, h - 6);
      bctx.fillStyle = "rgba(255,255,255,0.07)";
      bctx.fillRect(34, 8, w - 40, 4);
    } else if (f.style === "cctv") {
      // 듀얼 CCTV 브라운관 모니터 & 스캔라인
      const screenCol = animPhase === 0 ? "#4f947f" : "#376b5b";
      bctx.fillStyle = "#0e131a";
      bctx.fillRect(6, 5, 25, 19);
      bctx.fillRect(35, 5, 25, 19);
      bctx.fillStyle = screenCol;
      bctx.fillRect(8, 7, 21, 15);
      bctx.fillRect(37, 7, 21, 15);
      bctx.fillStyle = "#F09BA8";
      bctx.fillRect(24, 21, 3, 2);
      bctx.fillRect(53, 21, 3, 2);
    } else if (f.style === "mirror") {
      // 낡은 거울 테두리, 유리 광택, 균열 및 붉은 기운
      bctx.fillStyle = "#3b2c25";
      bctx.fillRect(3, 3, w - 6, h - 6);
      bctx.fillStyle = "#8ea6bd";
      bctx.fillRect(6, 6, w - 12, h - 12);
      bctx.fillStyle = "rgba(255,255,255,0.25)";
      bctx.fillRect(9, 8, 5, h - 18);
      bctx.fillStyle = "rgba(240, 155, 168, 0.36)";
      bctx.fillRect(w / 2 - 6, 9, 12, 16);
    } else {
      // 일반 가구(우편함, 책상, 캐비닛 등) 서랍/칸막이 라인
      if (w >= 72) {
        const cols = Math.floor(w / 24);
        bctx.fillStyle = "rgba(0,0,0,0.28)";
        for (let i = 1; i < cols; i++) {
          bctx.fillRect(i * 24, 6, 2, h - 12);
        }
      }
      if (h >= 36) {
        bctx.fillStyle = "rgba(0,0,0,0.24)";
        bctx.fillRect(6, Math.floor(h / 2), w - 12, 2);
      }
    }

    bctx.font = "bold 10px sans-serif";
    bctx.textAlign = "center";
    bctx.fillStyle = "rgba(0,0,0,0.9)";
    bctx.fillText(f.label, w / 2 + 1, h / 2 + 4);
    bctx.fillStyle = "#FFFFFF";
    bctx.fillText(f.label, w / 2, h / 2 + 3);
    bctx.textAlign = "left";
  });

  drawCachedSprite(ctx, sprite, x, y);
}

function drawHidingSpot(ctx, s) {
  const x = s.x * TILE;
  const y = s.y * TILE;
  const urgent = state.lightState === "flicker" && !state.isHiding;
  const used = state.hidingUseCount[s.id] || 0;
  const key = `hide-v2:${urgent ? 1 : 0}:${used >= 2 ? 2 : 0}`;

  const sprite = getCachedSprite(key, TILE, TILE + 4, bctx => {
    bctx.fillStyle = "rgba(0,0,0,0.44)";
    bctx.fillRect(4, TILE - 2, TILE - 6, 5);

    bctx.fillStyle = urgent ? "#524626" : (used >= 2 ? "#4f3239" : "#354d46");
    bctx.fillRect(4, 4, TILE - 8, TILE - 8);
    // 캐비닛/기둥 문틈 디테일
    bctx.fillStyle = "rgba(0,0,0,0.28)";
    bctx.fillRect(19, 6, 2, TILE - 12);
    bctx.fillStyle = "rgba(255,255,255,0.1)";
    bctx.fillRect(6, 6, TILE - 12, 2);

    bctx.strokeStyle = urgent ? "#F2D28B" : (used >= 2 ? "#F09BA8" : "#8FC9FF");
    bctx.lineWidth = urgent ? 2 : 1.3;
    bctx.strokeRect(4, 4, TILE - 8, TILE - 8);

    bctx.font = "bold 9px sans-serif";
    bctx.textAlign = "center";
    bctx.fillStyle = "#000";
    bctx.fillText("숨기[H]", 21, 24);
    bctx.fillStyle = urgent ? "#F2D28B" : "#8FC9FF";
    bctx.fillText("숨기[H]", 20, 23);
    bctx.textAlign = "left";
  });

  drawCachedSprite(ctx, sprite, x, y);
}

function drawPixelHero(ctx, px, py, dir, moving, walkTimer, stepParity) {
  let stride = 0;
  let bobY = 0;
  if (moving) {
    const phase = (walkTimer * 8.5) % 1;
    if (phase < 0.5) {
      stride = stepParity === 0 ? -1 : 1;
      bobY = -1;
    }
  }

  const key = `hero-v2:${dir}:${stride}:${bobY}`;
  const sprite = getCachedSprite(key, TILE, TILE, bctx => {
    // 접지 타원형 도트 그림자
    bctx.fillStyle = "rgba(0,0,0,0.52)";
    bctx.fillRect(10, 34, 20, 4);
    bctx.fillRect(12, 33, 16, 6);
    const hy = bobY;

    if (dir === "down" || dir === "up") {
      const leftLegY = stride === -1 ? -2 : (stride === 1 ? 1 : 0);
      const rightLegY = stride === 1 ? -2 : (stride === -1 ? 1 : 0);

      // 바지 & 구두
      bctx.fillStyle = "#151a26";
      bctx.fillRect(12, hy + 28 + leftLegY, 6, 6 - Math.max(0, leftLegY));
      bctx.fillRect(22, hy + 28 + rightLegY, 6, 6 - Math.max(0, rightLegY));
      bctx.fillStyle = "#0b0d14";
      bctx.fillRect(12, hy + 33 + leftLegY, 6, 2);
      bctx.fillRect(22, hy + 33 + rightLegY, 6, 2);

      // 형사 트렌치/수트 자켓 & 팔 스윙
      bctx.fillStyle = "#263c5c";
      bctx.fillRect(10, hy + 16, 20, 14);
      bctx.fillStyle = "#1c2d47";
      bctx.fillRect(10, hy + 26, 20, 4);
      bctx.fillStyle = "#213452";
      bctx.fillRect(7, hy + 17 - stride, 3, 10);
      bctx.fillRect(30, hy + 17 + stride, 3, 10);
      // 손목 커프스/손
      bctx.fillStyle = "#e8bfa3";
      bctx.fillRect(7, hy + 26 - stride, 3, 2);
      bctx.fillRect(30, hy + 26 + stride, 3, 2);

      if (dir === "down") {
        // 셔츠 & 넥타이
        bctx.fillStyle = "#9fd2ff";
        bctx.fillRect(14, hy + 17, 12, 11);
        bctx.fillStyle = "#182336";
        bctx.fillRect(19, hy + 17, 2, 10);
        // 자켓 라펠 음영
        bctx.fillStyle = "#1a2940";
        bctx.fillRect(13, hy + 17, 2, 9);
        bctx.fillRect(25, hy + 17, 2, 9);

        // 얼굴 & 머리카락 하이라이트
        bctx.fillStyle = "#f2cbb0";
        bctx.fillRect(12, hy + 5, 16, 11);
        bctx.fillStyle = "#d9ad91";
        bctx.fillRect(12, hy + 14, 16, 2);

        bctx.fillStyle = "#161822";
        bctx.fillRect(11, hy + 2, 18, 5);
        bctx.fillRect(11, hy + 5, 2, 6);
        bctx.fillRect(27, hy + 5, 2, 6);
        bctx.fillStyle = "#2b3247";
        bctx.fillRect(14, hy + 3, 10, 2);

        // 눈 & 눈썹
        bctx.fillStyle = "#0e121c";
        bctx.fillRect(15, hy + 9, 2, 3);
        bctx.fillRect(23, hy + 9, 2, 3);
        bctx.fillStyle = "#ffffff";
        bctx.fillRect(15, hy + 9, 1, 1);
        bctx.fillRect(23, hy + 9, 1, 1);
      } else {
        // 뒷모습 (등 솔기 & 뒷머리)
        bctx.fillStyle = "#1b2b42";
        bctx.fillRect(19, hy + 17, 2, 12);
        bctx.fillStyle = "#161822";
        bctx.fillRect(11, hy + 2, 18, 14);
        bctx.fillStyle = "#2b3247";
        bctx.fillRect(14, hy + 4, 12, 2);
      }
    } else {
      const isLeft = dir === "left";
      const frontFootX = stride * 3;
      const backFootX = -stride * 3;

      bctx.fillStyle = "#111520";
      bctx.fillRect(16 + backFootX, hy + 28, 6, 7);
      bctx.fillStyle = "#1c2233";
      bctx.fillRect(16 + frontFootX, hy + 28, 6, 7);

      bctx.fillStyle = "#263c5c";
      bctx.fillRect(12, hy + 16, 16, 14);
      bctx.fillStyle = "#9fd2ff";
      bctx.fillRect(isLeft ? 12 : 24, hy + 17, 4, 10);

      // 측면 팔 & 손
      bctx.fillStyle = "#1e304a";
      bctx.fillRect(17 - stride * 2, hy + 17, 5, 9);
      bctx.fillStyle = "#e8bfa3";
      bctx.fillRect(17 - stride * 2, hy + 26, 5, 2);

      // 측면 두상
      bctx.fillStyle = "#f2cbb0";
      bctx.fillRect(13, hy + 5, 14, 11);
      bctx.fillStyle = "#161822";
      bctx.fillRect(12, hy + 2, 16, 5);
      bctx.fillRect(isLeft ? 22 : 12, hy + 5, 6, 10);
      bctx.fillStyle = "#2b3247";
      bctx.fillRect(15, hy + 3, 9, 2);

      bctx.fillStyle = "#0e121c";
      bctx.fillRect(isLeft ? 15 : 23, hy + 9, 2, 3);
    }
  });

  drawCachedSprite(ctx, sprite, px, py);
}

function drawPixelNPC(ctx, npc) {
  const px = npc.x * TILE;
  const py = npc.y * TILE;
  const idleBob = state.prefs.reducedMotion ? 0 : (Math.floor(state.elapsedTime * 2.2) % 2);
  const key = `npc-v2:${npc.id}:${idleBob}`;

  const sprite = getCachedSprite(key, TILE, TILE, bctx => {
    bctx.fillStyle = "rgba(0,0,0,0.48)";
    bctx.fillRect(10, 34, 20, 4);
    bctx.fillRect(12, 33, 16, 6);

    if (npc.id === "park") {
      // 경비원 박만식: 제복, 금장 뱃지·견장, 제복 모자
      bctx.fillStyle = "#192422";
      bctx.fillRect(13, 29, 5, 6);
      bctx.fillRect(22, 29, 5, 6);

      bctx.fillStyle = "#35544e";
      bctx.fillRect(10, 16 + idleBob, 20, 14);
      bctx.fillStyle = "#263d39";
      bctx.fillRect(19, 17 + idleBob, 2, 12);
      // 금장 명찰 & 견장
      bctx.fillStyle = "#f2d28b";
      bctx.fillRect(13, 19 + idleBob, 4, 2);
      bctx.fillRect(10, 16 + idleBob, 3, 2);
      bctx.fillRect(27, 16 + idleBob, 3, 2);

      bctx.fillStyle = "#e0b89d";
      bctx.fillRect(12, 7 + idleBob, 16, 9);
      // 제복 모자 & 금장 휘장
      bctx.fillStyle = "#223330";
      bctx.fillRect(10, 2 + idleBob, 20, 5);
      bctx.fillStyle = "#121c1a";
      bctx.fillRect(9, 6 + idleBob, 22, 2);
      bctx.fillStyle = "#F2D28B";
      bctx.fillRect(19, 3 + idleBob, 2, 2);

      bctx.fillStyle = "#111";
      bctx.fillRect(15, 10 + idleBob, 2, 2);
      bctx.fillRect(23, 10 + idleBob, 2, 2);
    } else if (npc.id === "han") {
      // 1204호 주민 한미정: 보라빛 가디건, 긴 웨이브 헤어 하이라이트
      bctx.fillStyle = "#241b24";
      bctx.fillRect(13, 29, 5, 6);
      bctx.fillRect(22, 29, 5, 6);

      bctx.fillStyle = "#6e4b6b";
      bctx.fillRect(10, 16 + idleBob, 20, 14);
      bctx.fillStyle = "#8a6286";
      bctx.fillRect(14, 17 + idleBob, 12, 11);

      bctx.fillStyle = "#291b23";
      bctx.fillRect(10, 3 + idleBob, 20, 15);
      bctx.fillStyle = "#422c38";
      bctx.fillRect(13, 4 + idleBob, 14, 2);

      bctx.fillStyle = "#f2cbb0";
      bctx.fillRect(13, 7 + idleBob, 14, 9);
      bctx.fillStyle = "#141013";
      bctx.fillRect(15, 10 + idleBob, 2, 2);
      bctx.fillRect(23, 10 + idleBob, 2, 2);
    } else if (npc.id === "yoonseo") {
      // 13층의 소녀 윤서: 창백한 원피스 주름, 긴 흑발, 영체 오라
      bctx.fillStyle = "rgba(143, 201, 255, 0.22)";
      bctx.fillRect(9, 4 + idleBob, 22, 29);

      bctx.fillStyle = "#e6ecf5";
      bctx.fillRect(11, 17 + idleBob, 18, 15);
      bctx.fillStyle = "#c2cee0";
      bctx.fillRect(14, 19 + idleBob, 2, 12);
      bctx.fillRect(24, 19 + idleBob, 2, 12);

      bctx.fillStyle = "#14131a";
      bctx.fillRect(10, 4 + idleBob, 20, 17);
      bctx.fillStyle = "#f5e6e8";
      bctx.fillRect(14, 8 + idleBob, 12, 8);
      bctx.fillStyle = "#4a1724";
      bctx.fillRect(16, 11 + idleBob, 2, 2);
      bctx.fillRect(22, 11 + idleBob, 2, 2);
    }
  });

  if (npc.id === "yoonseo") {
    const flicker = state.prefs.reducedMotion ? 0.85 : (0.76 + Math.sin(state.elapsedTime * 9.0) * 0.2);
    ctx.save();
    ctx.globalAlpha = flicker;
    drawCachedSprite(ctx, sprite, px, py);
    ctx.restore();
  } else {
    drawCachedSprite(ctx, sprite, px, py);
  }

  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.fillText(npc.name, px + 21, py - 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(npc.name, px + 20, py - 3);
  ctx.textAlign = "left";
}

function drawPixelGhost(ctx, px, py) {
  // 기괴한 프레임 스텝(일부러 끊기는 움직임) & 고개 꺾임 연출
  const twitchFrame = state.prefs.reducedMotion ? 0 : (Math.floor(state.elapsedTime * 7.5) % 4);
  const floatY = state.prefs.reducedMotion ? 0 : Math.sin(state.elapsedTime * 11.0) * 2.5;
  const key = `ghost-v2:${twitchFrame}`;

  const sprite = getCachedSprite(key, 64, 64, bctx => {
    // 붉은 그림자 오라
    bctx.fillStyle = "rgba(240, 155, 168, 0.24)";
    bctx.beginPath();
    bctx.arc(32, 32, 26, 0, Math.PI * 2);
    bctx.fill();

    // 망토/몸체 실루엣 (너울거리는 하단 옷자락)
    bctx.fillStyle = "#14070b";
    bctx.fillRect(20, 19, 24, 27);
    bctx.fillStyle = "#4a1522";
    bctx.fillRect(22, 24, 20, 18);
    // 너덜거리는 밑단 도트
    const hemShift = twitchFrame % 2 === 0 ? 0 : 2;
    bctx.fillStyle = "#14070b";
    bctx.fillRect(20, 45, 5, 4 - hemShift);
    bctx.fillRect(29, 45, 6, 2 + hemShift);
    bctx.fillRect(39, 45, 5, 4 - hemShift);

    // 기괴하게 꺾이는 머리 위치
    const headShiftX = twitchFrame === 1 ? -3 : (twitchFrame === 3 ? 3 : 0);
    const headShiftY = twitchFrame === 2 ? 2 : 0;
    bctx.fillStyle = "#1c090f";
    bctx.fillRect(22 + headShiftX, 11 + headShiftY, 20, 12);

    // 붉게 번뜩이는 안광
    bctx.fillStyle = "#F09BA8";
    bctx.fillRect(25 + headShiftX, 15 + headShiftY, 4, 3);
    bctx.fillRect(35 + headShiftX, 16 + headShiftY, 4, 2);
    bctx.fillStyle = "#ffffff";
    bctx.fillRect(26 + headShiftX, 16 + headShiftY, 1, 1);
    bctx.fillRect(36 + headShiftX, 16 + headShiftY, 1, 1);
  });

  const baseAlpha = state.ghost.entryDelay > 0 ? 0.55 : 0.95;

  // 추격 중 어두운 붉은 잔상(afterimage) 이펙트
  if (!state.prefs.reducedMotion && state.ghost.state === GHOST_STATE.CHASE) {
    const trailOffsetX = Math.cos(state.elapsedTime * 14.0) * 5;
    const trailOffsetY = Math.sin(state.elapsedTime * 11.0) * 4;
    ctx.save();
    ctx.globalAlpha = 0.24;
    drawCachedSprite(ctx, sprite, px - 12 - trailOffsetX, py - 12 - trailOffsetY + floatY);
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = baseAlpha;
  drawCachedSprite(ctx, sprite, px - 12, py - 12 + floatY);
  ctx.restore();
}

function drawMagnifierIndicator(ctx, hit) {
  if (!hit || state.mode !== GAME_MODE.PLAY || state.isHiding) return;
  const x = hit.x * TILE;
  const y = hit.y * TILE;
  const bob = state.prefs.reducedMotion ? 0 : Math.sin(state.elapsedTime * 9.5) * 2;

  ctx.save();
  ctx.strokeStyle = hit.type === "clue" || hit.type === "mirror" ? "#F2D28B" : "#8FC9FF";
  ctx.lineWidth = 1.6;
  const pad = 4;
  const len = 7;

  ctx.beginPath();
  ctx.moveTo(x + pad, y + pad + len); ctx.lineTo(x + pad, y + pad); ctx.lineTo(x + pad + len, y + pad);
  ctx.moveTo(x + TILE - pad - len, y + pad); ctx.lineTo(x + TILE - pad, y + pad); ctx.lineTo(x + TILE - pad, y + pad + len);
  ctx.moveTo(x + pad, y + TILE - pad - len); ctx.lineTo(x + pad, y + TILE - pad); ctx.lineTo(x + pad + len, y + TILE - pad);
  ctx.moveTo(x + TILE - pad - len, y + TILE - pad); ctx.lineTo(x + TILE - pad, y + TILE - pad); ctx.lineTo(x + TILE - pad, y + TILE - pad - len);
  ctx.stroke();

  const cx = x + TILE / 2;
  const cy = y - 10 + bob;
  ctx.fillStyle = "rgba(10, 13, 24, 0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#F2D28B";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(cx - 1.5, cy - 1.5, 4, 0, Math.PI * 2);
  ctx.moveTo(cx + 1.5, cy + 1.5);
  ctx.lineTo(cx + 5, cy + 5);
  ctx.stroke();

  ctx.restore();
}

function renderRoomLightingOverlay(ctx, canvas, screenPx, screenPy) {
  if (lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) {
    lightCanvas.width = canvas.width;
    lightCanvas.height = canvas.height;
  }

  lctx.save();
  lctx.globalCompositeOperation = "source-over";
  lctx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);

  const sanityFactor = state.sanity <= 30
    ? 0.68
    : (state.sanity <= SANITY_CONFIG.LOW_VISION_THRESHOLD ? 0.84 : 1.0);

  const roomInfo = ROOMS[state.currentRoom];
  const isCursed = roomInfo?.theme === "cursed";

  if (state.currentLightOn) {
    lctx.fillStyle = isCursed ? "rgba(5, 4, 10, 0.72)" : "rgba(6, 8, 15, 0.62)";
    lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    lctx.globalCompositeOperation = "destination-out";
    const flickerDim = (state.lightState === "flicker" && state.prefs.reducedMotion) ? 0.78 : 1.0;
    const normalRadius = Math.round(215 * sanityFactor * flickerDim);
    const grad = lctx.createRadialGradient(screenPx, screenPy, 36, screenPx, screenPy, normalRadius);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.65, "rgba(0,0,0,0.85)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(screenPx, screenPy, normalRadius, 0, Math.PI * 2);
    lctx.fill();

    if (state.lightState === "flicker") {
      lctx.globalCompositeOperation = "source-over";
      lctx.fillStyle = state.prefs.reducedMotion
        ? "rgba(242, 210, 139, 0.12)"
        : "rgba(210, 230, 255, 0.08)";
      lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
    }
  } else {
    const darkAlpha = state.lightState === "flicker" ? 0.88 : 0.94;
    lctx.fillStyle = `rgba(4, 5, 11, ${darkAlpha})`;
    lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    lctx.globalCompositeOperation = "destination-out";
    const visRadius = state.isHiding ? 50 : Math.round(78 * sanityFactor);
    const ambGrad = lctx.createRadialGradient(screenPx, screenPy, 14, screenPx, screenPy, visRadius);
    ambGrad.addColorStop(0, "rgba(0,0,0,1)");
    ambGrad.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = ambGrad;
    lctx.beginPath();
    lctx.arc(screenPx, screenPy, visRadius, 0, Math.PI * 2);
    lctx.fill();

    if ((state.ghost.state === GHOST_STATE.CHASE || state.ghost.state === GHOST_STATE.SEARCH) && state.ghost.room === state.currentRoom) {
      const gx = state.ghost.px + TILE / 2 - Math.round(state.camera.x);
      const gy = state.ghost.py + TILE / 2 - Math.round(state.camera.y);
      const gGrad = lctx.createRadialGradient(gx, gy, 8, gx, gy, 54);
      gGrad.addColorStop(0, "rgba(0,0,0,0.95)");
      gGrad.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = gGrad;
      lctx.beginPath();
      lctx.arc(gx, gy, 54, 0, Math.PI * 2);
      lctx.fill();
    }
  }

  lctx.restore();
  ctx.drawImage(lightCanvas, 0, 0);
}

function renderMinimap(ctx, canvas) {
  if (!state.showMinimap || state.mode === GAME_MODE.TITLE) return;
  const r = ROOMS[state.currentRoom];
  if (!r) return;

  const scale = 4;
  const mapW = r.cols * scale;
  const mapH = r.rows * scale;
  const pad = 6;
  const boxW = mapW + pad * 2;
  const boxH = mapH + pad * 2 + 12;
  const bx = canvas.width - boxW - 12;
  const by = 12;

  ctx.save();
  ctx.fillStyle = "rgba(8, 10, 18, 0.84)";
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = state.lightState === "out" ? "#F09BA8" : "#756e85";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx, by, boxW, boxH);

  ctx.font = "bold 9px sans-serif";
  ctx.fillStyle = state.lightState === "out" ? "#F09BA8" : "#F2D28B";
  ctx.fillText(state.lightState === "out" ? "BLACKOUT" : "MAP [M]", bx + pad, by + 10);

  const ox = bx + pad;
  const oy = by + 14;

  ctx.fillStyle = "#2b2f42";
  ctx.fillRect(ox, oy, mapW, mapH);
  ctx.strokeStyle = "#5c566e";
  ctx.strokeRect(ox, oy, mapW, mapH);

  ctx.fillStyle = "#4d536b";
  r.furniture.forEach(f => {
    ctx.fillRect(ox + f.x * scale, oy + f.y * scale, f.w * scale, f.h * scale);
  });

  r.hidingSpots.forEach(s => {
    ctx.fillStyle = "#9ce0b8";
    ctx.fillRect(ox + s.x * scale, oy + s.y * scale, scale, scale);
  });

  r.doors.forEach(d => {
    if (d.secret && !state.flags.secretOpen) return;
    ctx.fillStyle = "#F2D28B";
    ctx.fillRect(ox + d.x * scale, oy + d.y * scale, scale, scale);
  });

  if (state.lightState !== "out") {
    NPCS.filter(n => n.room === state.currentRoom).forEach(n => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(ox + n.x * scale, oy + n.y * scale, scale, scale);
    });
  }

  if (state.sanity <= SANITY_CONFIG.MINIMAP_DISTORT_THRESHOLD) {
    const jitterX = state.prefs.reducedMotion ? 2 : Math.sin(state.elapsedTime * 24.0) * 5;
    const jitterY = state.prefs.reducedMotion ? -2 : Math.cos(state.elapsedTime * 21.0) * 4;
    ctx.fillStyle = "#F09BA8";
    ctx.fillRect(ox + mapW * 0.5 + jitterX, oy + mapH * 0.5 + jitterY, scale, scale);
  }

  ctx.fillStyle = "#8FC9FF";
  ctx.fillRect(ox + (state.player.px / TILE) * scale, oy + (state.player.py / TILE) * scale, scale + 1, scale + 1);
  ctx.restore();
}

export function renderGame(ctx, canvas, getBestInteractTargetFn) {
  const r = ROOMS[state.currentRoom];
  if (!r) return;

  ctx.save();
  ctx.fillStyle = "#06070c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.screenShake > 0 && !state.prefs.reducedMotion) {
    const sx = (Math.random() - 0.5) * state.screenShake;
    const sy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(sx, sy);
  }

  ctx.save();
  ctx.translate(-Math.round(state.camera.x), -Math.round(state.camera.y));

  drawCachedSprite(ctx, getBakedRoomBase(state.currentRoom, r), 0, 0);

  r.doors.forEach(d => {
    if (d.secret && !state.flags.secretOpen) return;
    ctx.fillStyle = d.secret ? "#8c4a58" : "#8f6b4a";
    ctx.fillRect(d.x * TILE + 4, d.y * TILE + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = "#F2D28B";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(d.x * TILE + 4, d.y * TILE + 4, TILE - 8, TILE - 8);

    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    ctx.fillText(d.label, d.x * TILE + 21, d.y * TILE + 23);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(d.label, d.x * TILE + 20, d.y * TILE + 22);
    ctx.textAlign = "left";
  });

  PROPS.filter(p => p.room === state.currentRoom).forEach(p => {
    const done = state.examinedProps.includes(p.id);
    ctx.fillStyle = done ? "rgba(255,255,255,0.22)" : "rgba(220,232,255,0.62)";
    ctx.fillRect(p.x * TILE + 17, p.y * TILE + 17, 6, 6);
  });

  FIELD_ITEMS.filter(it => it.room === state.currentRoom && !state.pickedFieldItems.includes(it.id)).forEach(it => {
    ctx.fillStyle = "#8FC9FF";
    ctx.fillRect(it.x * TILE + 14, it.y * TILE + 14, 12, 12);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(it.x * TILE + 14, it.y * TILE + 14, 12, 12);
    ctx.fillStyle = "#000";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", it.x * TILE + 20, it.y * TILE + 23);
    ctx.textAlign = "left";
  });

  if (state.sanity <= SANITY_CONFIG.HALLUCINATION_THRESHOLD && state.hallucination.fakeClue) {
    const fc = state.hallucination.fakeClue;
    ctx.save();
    ctx.globalAlpha = state.prefs.reducedMotion ? 0.45 : (0.45 + Math.sin(state.elapsedTime * 18.0) * 0.25);
    ctx.fillStyle = "#F09BA8";
    ctx.fillRect(fc.x * TILE + 15, fc.y * TILE + 15, 10, 10);
    ctx.restore();
  }

  const renderables = [];

  r.furniture.forEach(f => {
    renderables.push({
      sortY: (f.y + f.h) * TILE,
      draw: () => drawDetailedFurniture(ctx, f)
    });
  });

  r.hidingSpots.forEach(s => {
    renderables.push({
      sortY: (s.y + 1) * TILE,
      draw: () => drawHidingSpot(ctx, s)
    });
  });

  NPCS.filter(n => n.room === state.currentRoom).forEach(n => {
    renderables.push({
      sortY: (n.y + 1) * TILE,
      draw: () => drawPixelNPC(ctx, n)
    });
  });

  renderables.push({
    sortY: state.player.py + TILE,
    draw: () => {
      if (!state.isHiding) {
        drawPixelHero(
          ctx,
          state.player.px,
          state.player.py,
          state.player.dir,
          state.player.moving,
          state.player.walkTimer,
          state.player.stepParity
        );
      } else {
        ctx.fillStyle = "#9ce0b8";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("은신 중...", state.player.px - 2, state.player.py - 4);
      }
    }
  });

  if ((state.ghost.state === GHOST_STATE.CHASE || state.ghost.state === GHOST_STATE.SEARCH) && state.ghost.room === state.currentRoom) {
    renderables.push({
      sortY: state.ghost.py + TILE,
      draw: () => drawPixelGhost(ctx, state.ghost.px, state.ghost.py)
    });
  }

  renderables.sort((a, b) => a.sortY - b.sortY);
  renderables.forEach(item => item.draw());

  drawMagnifierIndicator(ctx, getBestInteractTargetFn());

  ctx.restore();

  const screenPx = state.player.px + TILE / 2 - Math.round(state.camera.x);
  const screenPy = state.player.py + TILE / 2 - Math.round(state.camera.y);
  renderRoomLightingOverlay(ctx, canvas, screenPx, screenPy);
  renderMinimap(ctx, canvas);

  if (state.isHiding && state.breathHold.active) {
    const bw = 220;
    const bh = 16;
    const bx = (canvas.width - bw) / 2;
    const by = canvas.height - 68;

    ctx.save();
    ctx.fillStyle = "rgba(8, 10, 18, 0.9)";
    ctx.fillRect(bx - 10, by - 22, bw + 20, bh + 30);
    ctx.strokeStyle = "#F09BA8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 10, by - 22, bw + 20, bh + 30);

    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = "#F2D28B";
    ctx.textAlign = "center";
    ctx.fillText("숨 참기! [Space] 키를 연타하세요!", canvas.width / 2, by - 7);

    ctx.fillStyle = "#1b1e2e";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = state.breathHold.gauge > 35 ? "#9ce0b8" : "#F09BA8";
    ctx.fillRect(bx, by, (bw * state.breathHold.gauge) / 100, bh);
    ctx.strokeStyle = "#5c6482";
    ctx.strokeRect(bx, by, bw, bh);
    ctx.textAlign = "left";
    ctx.restore();
  }

  if (state.sanity < 45) {
    const pulse = state.prefs.reducedMotion ? 0 : Math.sin(state.elapsedTime * 15.0) * 0.05;
    const alpha = ((45 - state.sanity) / 45) * 0.32 + pulse;
    ctx.fillStyle = `rgba(160, 20, 45, ${Math.max(0.05, alpha)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state.mode === GAME_MODE.ENDED && state.endingType) {
    ctx.fillStyle = "rgba(8, 9, 15, 0.72)";
    ctx.fillRect(120, 125, 400, 110);
    ctx.strokeStyle = state.endingType === "BAD" ? "#F09BA8" : "#F2D28B";
    ctx.lineWidth = 2;
    ctx.strokeRect(120, 125, 400, 110);

    ctx.textAlign = "center";
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = state.endingType === "BAD" ? "#F09BA8" : "#F2D28B";
    ctx.fillText(`${state.endingType} ENDING`, 320, 172);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    const sub = state.endingType === "TRUE"
      ? "마지막 방문자와 사라진 가족의 진실"
      : (state.endingType === "NORMAL" ? "봉인된 미제 사건" : "13번째 방문자");
    ctx.fillText(sub, 320, 204);
    ctx.textAlign = "left";
  }

  ctx.restore();
}
