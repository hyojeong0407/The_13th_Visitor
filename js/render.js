/* =========================================================================
   5. 16비트 웹 쯔꾸르 픽셀 렌더링 엔진 (맵 라벨 제거 · 사물 전용 도트 · 말풍선 포커스) (v1.10.0)
   ========================================================================= */
import { ROOMS, NPCS, PROPS, FIELD_ITEMS, CLUES } from "./data.js";
import { TILE, FLICKER_DURATION, SANITY_CONFIG } from "./config.js";
import { state, GAME_MODE, GHOST_STATE } from "./state.js";
import { getCachedSprite, drawCachedSprite } from "./spriteCache.js";

const lightCanvas = document.createElement("canvas");
const lctx = lightCanvas.getContext("2d");

export function updateVisualTimers(dt) {
  state.elapsedTime += dt;

  if (state.roomFadeAlpha > 0) {
    state.roomFadeAlpha = Math.max(0, state.roomFadeAlpha - dt * 3.8);
  }

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
  const key = `room-base-v3:${roomName}:${r.cols}x${r.rows}:${isCursed ? 1 : 0}`;

  return getCachedSprite(key, mapW, mapH, bctx => {
    bctx.fillStyle = r.bg;
    bctx.fillRect(0, 0, mapW, mapH);

    for (let y = 1; y < r.rows - 1; y++) {
      for (let x = 1; x < r.cols - 1; x++) {
        const tx = x * TILE;
        const ty = y * TILE;
        const even = (x + y) % 2 === 0;
        bctx.fillStyle = even ? r.floorA : r.floorB;
        bctx.fillRect(tx, ty, TILE, TILE);

        bctx.fillStyle = "rgba(255,255,255,0.035)";
        bctx.fillRect(tx + 1, ty + 1, TILE - 2, 2);
        bctx.fillStyle = "rgba(0,0,0,0.16)";
        bctx.fillRect(tx, ty + TILE - 2, TILE, 2);
        bctx.fillRect(tx + TILE - 1, ty, 1, TILE);

        const hash = (x * 37 + y * 91) % 17;
        if (hash === 3 || (isCursed && hash % 5 === 0)) {
          bctx.fillStyle = isCursed ? "rgba(180, 48, 72, 0.2)" : "rgba(255, 255, 255, 0.045)";
          bctx.fillRect(tx + 8 + (hash % 14), ty + 12 + (hash % 10), 6, 2);
          bctx.fillRect(tx + 12 + (hash % 14), ty + 14 + (hash % 10), 4, 2);
        }
      }
    }

    // 외벽 + 상단 몰딩 & 하단 걸레받이
    bctx.fillStyle = r.wall;
    bctx.fillRect(0, 0, mapW, TILE);
    bctx.fillRect(0, (r.rows - 1) * TILE, mapW, TILE);
    bctx.fillRect(0, 0, TILE, mapH);
    bctx.fillRect((r.cols - 1) * TILE, 0, TILE, mapH);

    bctx.fillStyle = "rgba(255,255,255,0.09)";
    bctx.fillRect(TILE, 4, mapW - TILE * 2, 3);
    bctx.fillStyle = isCursed ? "#3b1721" : "#111421";
    bctx.fillRect(TILE, TILE - 6, mapW - TILE * 2, 6);
    bctx.fillStyle = "rgba(0,0,0,0.48)";
    bctx.fillRect(TILE, TILE - 1, mapW - TILE * 2, 2);
  });
}

function drawDetailedFurniture(ctx, f) {
  const x = f.x * TILE;
  const y = f.y * TILE;
  const w = f.w * TILE;
  const h = f.h * TILE;
  const animPhase = (f.style === "cctv" || f.style === "car") ? (Math.floor(state.elapsedTime * 3) % 2) : 0;
  const key = `furn-v3:${f.style || "default"}:${f.label}:${w}x${h}:${f.color}:${animPhase}`;

  const sprite = getCachedSprite(key, w, h + 5, bctx => {
    bctx.fillStyle = "rgba(0,0,0,0.48)";
    bctx.fillRect(3, h - 2, w - 4, 6);

    bctx.fillStyle = f.color;
    bctx.fillRect(2, 2, w - 4, h - 4);
    bctx.fillStyle = "rgba(255,255,255,0.12)";
    bctx.fillRect(3, 3, w - 6, 3);
    bctx.fillStyle = "rgba(0,0,0,0.3)";
    bctx.fillRect(3, h - 7, w - 6, 4);
    bctx.strokeStyle = "rgba(0,0,0,0.85)";
    bctx.lineWidth = 1.5;
    bctx.strokeRect(2, 2, w - 4, h - 4);

    if (f.style === "mailbox") {
      const cols = Math.max(3, Math.floor((w - 8) / 18));
      const cellW = Math.floor((w - 10) / cols);
      for (let i = 0; i < cols; i++) {
        const cx = 5 + i * cellW;
        bctx.fillStyle = "#2b241f";
        bctx.fillRect(cx + 1, 6, cellW - 3, h - 12);
        bctx.fillStyle = "#14110f";
        bctx.fillRect(cx + 3, 9, cellW - 7, 3);
        bctx.fillStyle = "#8c7a6b";
        bctx.fillRect(cx + 3, 15, cellW - 7, 2);
        if (i % 2 === 0) {
          bctx.fillStyle = "#e8e3d5";
          bctx.fillRect(cx + 4, 11, 7, 4);
        }
      }
    } else if (f.style === "board") {
      if (f.label.includes("분전함")) {
        bctx.fillStyle = "#232833";
        bctx.fillRect(6, 5, w - 12, h - 10);
        bctx.fillStyle = "#F2D28B";
        bctx.fillRect(Math.floor(w / 2) - 4, 9, 8, 10);
        bctx.fillStyle = "#14161f";
        bctx.fillRect(Math.floor(w / 2) - 1, 11, 2, 6);
      } else {
        bctx.fillStyle = "#6e5641";
        bctx.fillRect(5, 5, w - 10, h - 10);
        const notes = [
          { nx: 9, ny: 8, nw: 11, nh: 12, col: "#e6dec8", pin: "#F09BA8" },
          { nx: 24, ny: 9, nw: 13, nh: 11, col: "#d5e3f0", pin: "#8FC9FF" },
          { nx: 41, ny: 7, nw: 12, nh: 13, col: "#f0dfb4", pin: "#F09BA8" },
          { nx: 58, ny: 9, nw: 14, nh: 11, col: "#e3dcd2", pin: "#9ce0b8" }
        ];
        notes.forEach(n => {
          if (n.nx + n.nw <= w - 6) {
            bctx.fillStyle = n.col;
            bctx.fillRect(n.nx, n.ny, n.nw, n.nh);
            bctx.fillStyle = "rgba(0,0,0,0.28)";
            bctx.fillRect(n.nx + 2, n.ny + 4, n.nw - 4, 1);
            bctx.fillRect(n.nx + 2, n.ny + 7, n.nw - 5, 1);
            bctx.fillStyle = n.pin;
            bctx.fillRect(n.nx + Math.floor(n.nw / 2), n.ny + 1, 2, 2);
          }
        });
      }
    } else if (f.style === "car") {
      const isPolice = f.label.includes("순찰");
      bctx.fillStyle = isPolice ? "#dce3ed" : "#594848";
      bctx.fillRect(22, 5, w - 44, h - 10);
      bctx.fillStyle = "#16202e";
      bctx.fillRect(14, 8, w - 28, h - 16);
      bctx.fillStyle = "rgba(143, 201, 255, 0.26)";
      bctx.fillRect(18, 10, 14, h - 20);
      bctx.fillRect(w - 30, 10, 12, h - 20);
      if (isPolice) {
        bctx.fillStyle = animPhase === 0 ? "#8FC9FF" : "#2d4c6e";
        bctx.fillRect(Math.floor(w / 2) - 5, 10, 4, 8);
        bctx.fillStyle = animPhase === 1 ? "#F09BA8" : "#6e2935";
        bctx.fillRect(Math.floor(w / 2) + 1, 10, 4, 8);
      }
      bctx.fillStyle = isPolice ? "#f2d28b" : "#6e6552";
      bctx.fillRect(w - 6, 8, 3, 8);
      bctx.fillRect(w - 6, h - 16, 3, 8);
      bctx.fillStyle = "#c94a5a";
      bctx.fillRect(3, 8, 3, 8);
      bctx.fillRect(3, h - 16, 3, 8);
    } else if (f.style === "bed") {
      bctx.fillStyle = "#3a2621";
      bctx.fillRect(2, 2, 7, h - 4);
      bctx.fillStyle = "#ebe7f2";
      bctx.fillRect(11, 7, 15, h - 14);
      bctx.fillStyle = "#c9c3d4";
      bctx.fillRect(22, 8, 3, h - 16);
      bctx.fillStyle = "rgba(255,255,255,0.14)";
      bctx.fillRect(28, 3, 5, h - 6);
      bctx.fillStyle = "rgba(0,0,0,0.22)";
      bctx.fillRect(33, 3, 2, h - 6);
    } else if (f.style === "cctv") {
      const screenCol = animPhase === 0 ? "#559e88" : "#3a7060";
      bctx.fillStyle = "#0e131a";
      bctx.fillRect(6, 5, 28, 21);
      bctx.fillRect(42, 5, 28, 21);
      bctx.fillStyle = screenCol;
      bctx.fillRect(8, 7, 24, 17);
      bctx.fillRect(44, 7, 24, 17);
      bctx.fillStyle = "rgba(0,0,0,0.22)";
      bctx.fillRect(8, 11, 24, 1);
      bctx.fillRect(8, 17, 24, 1);
      bctx.fillRect(44, 13, 24, 1);
      bctx.fillStyle = "#F09BA8";
      bctx.fillRect(28, 22, 3, 2);
      bctx.fillRect(64, 22, 3, 2);
    } else if (f.style === "mirror") {
      bctx.fillStyle = "#3b2c25";
      bctx.fillRect(3, 3, w - 6, h - 6);
      bctx.fillStyle = "#8ea6bd";
      bctx.fillRect(6, 6, w - 12, h - 12);
      bctx.fillStyle = "rgba(255,255,255,0.32)";
      bctx.fillRect(9, 8, 4, h - 18);
      bctx.fillStyle = "rgba(240, 155, 168, 0.42)";
      bctx.fillRect(Math.floor(w / 2) - 5, 9, 10, 16);
    } else if (f.style === "hydrant") {
      bctx.fillStyle = "#8c2d38";
      bctx.fillRect(4, 4, w - 8, h - 8);
      bctx.fillStyle = "#1b1d26";
      bctx.fillRect(10, 8, 16, 14);
      bctx.fillStyle = "#F2D28B";
      bctx.fillRect(15, 12, 6, 6);
      bctx.fillRect(w - 18, 10, 8, 10);
    } else if (f.style === "panel") {
      bctx.fillStyle = "#262b36";
      bctx.fillRect(7, 8, w - 14, h - 16);
      for (let by = 14; by <= h - 28; by += 10) {
        bctx.fillStyle = "#8FC9FF";
        bctx.fillRect(13, by, 4, 4);
        bctx.fillRect(21, by, 4, 4);
      }
      bctx.fillStyle = "#F09BA8";
      bctx.fillRect(16, h - 18, 7, 6);
    } else if (f.style === "sofa") {
      bctx.fillStyle = "#473930";
      bctx.fillRect(3, 4, 8, h - 8);
      bctx.fillRect(w - 11, 4, 8, h - 8);
      bctx.fillRect(11, 4, w - 22, 8);
      const seatW = Math.floor((w - 24) / 3);
      bctx.fillStyle = "rgba(0,0,0,0.3)";
      bctx.fillRect(11 + seatW, 12, 2, h - 17);
      bctx.fillRect(11 + seatW * 2, 12, 2, h - 17);
    } else {
      if (w >= 72) {
        const cols = Math.floor(w / 28);
        bctx.fillStyle = "rgba(0,0,0,0.3)";
        for (let i = 1; i < cols; i++) {
          bctx.fillRect(i * 28, 6, 2, h - 12);
        }
      }
      if (h >= 48) {
        bctx.fillStyle = "rgba(0,0,0,0.28)";
        bctx.fillRect(6, Math.floor(h / 2), w - 12, 2);
      }
      bctx.fillStyle = "#e6dec8";
      bctx.fillRect(10, 8, 12, 9);
      bctx.fillStyle = "#8FC9FF";
      bctx.fillRect(12, 10, 7, 2);
      if (w >= 80) {
        bctx.fillStyle = "#F2D28B";
        bctx.fillRect(w - 20, 7, 7, 7);
      }
    }
  });

  drawCachedSprite(ctx, sprite, x, y);
}

function drawDetailedDoor(ctx, d) {
  if (d.secret && !state.flags.secretOpen) return;
  const x = d.x * TILE;
  const y = d.y * TILE;
  const isStairs = d.to === "지하 주차장" || d.label.includes("계단");
  const isElevator = d.to === "엘리베이터" || state.currentRoom === "엘리베이터";
  const kind = d.secret ? "secret" : (isStairs ? "stairs" : (isElevator ? "elevator" : "door"));
  const key = `door-v3:${kind}`;

  const sprite = getCachedSprite(key, TILE, TILE, bctx => {
    if (kind === "stairs") {
      bctx.fillStyle = "#181b24";
      bctx.fillRect(4, 3, TILE - 8, TILE - 6);
      for (let i = 0; i < 5; i++) {
        const sy = 5 + i * 6;
        bctx.fillStyle = i % 2 === 0 ? "#4a5166" : "#363b4d";
        bctx.fillRect(6, sy, TILE - 12, 4);
        bctx.fillStyle = "rgba(255,255,255,0.14)";
        bctx.fillRect(6, sy, TILE - 12, 1);
      }
      bctx.fillStyle = "#8c96b0";
      bctx.fillRect(4, 3, 2, TILE - 6);
      bctx.fillRect(TILE - 6, 3, 2, TILE - 6);
    } else if (kind === "elevator") {
      bctx.fillStyle = "#2c313d";
      bctx.fillRect(3, 2, TILE - 6, TILE - 4);
      bctx.fillStyle = "#697387";
      bctx.fillRect(6, 7, 13, TILE - 10);
      bctx.fillRect(21, 7, 13, TILE - 10);
      bctx.fillStyle = "#12151c";
      bctx.fillRect(19, 7, 2, TILE - 10);
      bctx.fillStyle = "#F09BA8";
      bctx.fillRect(17, 3, 6, 3);
    } else if (kind === "secret") {
      bctx.fillStyle = "#12090d";
      bctx.fillRect(4, 3, TILE - 8, TILE - 5);
      bctx.strokeStyle = "#8c4a58";
      bctx.lineWidth = 2;
      bctx.strokeRect(4, 3, TILE - 8, TILE - 5);
      bctx.fillStyle = "#3b232b";
      bctx.fillRect(8, 22, TILE - 16, 4);
      bctx.fillRect(8, 29, TILE - 16, 4);
    } else {
      bctx.fillStyle = "#3a291e";
      bctx.fillRect(4, 2, TILE - 8, TILE - 4);
      bctx.fillStyle = "#7a583b";
      bctx.fillRect(7, 5, TILE - 14, TILE - 8);
      bctx.fillStyle = "#5c4029";
      bctx.fillRect(10, 8, TILE - 20, 9);
      bctx.fillRect(10, 20, TILE - 20, 11);
      bctx.fillStyle = "#F2D28B";
      bctx.fillRect(TILE - 12, 18, 3, 3);
      bctx.fillStyle = "rgba(242, 210, 139, 0.35)";
      bctx.fillRect(7, TILE - 3, TILE - 14, 2);
    }
  });

  drawCachedSprite(ctx, sprite, x, y);
}

function drawHidingSpot(ctx, s) {
  const x = s.x * TILE;
  const y = s.y * TILE;
  const urgent = state.lightState === "flicker" && !state.isHiding;
  const used = state.hidingUseCount[s.id] || 0;
  const isWood = s.label.includes("장롱") || s.label.includes("붙박이") || s.label.includes("책장");
  const key = `hide-v3:${isWood ? "wood" : "locker"}:${urgent ? 1 : 0}:${used >= 2 ? 2 : 0}`;

  const sprite = getCachedSprite(key, TILE, TILE + 4, bctx => {
    bctx.fillStyle = "rgba(0,0,0,0.46)";
    bctx.fillRect(4, TILE - 2, TILE - 6, 5);

    const baseCol = isWood ? "#4f3a2c" : "#334747";
    const innerCol = isWood ? "#38281e" : "#223030";
    bctx.fillStyle = baseCol;
    bctx.fillRect(4, 3, TILE - 8, TILE - 6);
    bctx.fillStyle = innerCol;
    bctx.fillRect(7, 6, TILE - 14, TILE - 12);

    bctx.fillStyle = "#12161c";
    bctx.fillRect(19, 5, 2, TILE - 10);
    bctx.fillStyle = "#b8c2d4";
    bctx.fillRect(16, 18, 2, 4);
    bctx.fillRect(22, 18, 2, 4);

    if (!isWood) {
      bctx.fillStyle = "#141c1c";
      bctx.fillRect(9, 8, 8, 2);
      bctx.fillRect(9, 12, 8, 2);
      bctx.fillRect(23, 8, 8, 2);
      bctx.fillRect(23, 12, 8, 2);
    }

    bctx.strokeStyle = urgent ? "#F2D28B" : (used >= 2 ? "#8c4a58" : "#181d26");
    bctx.lineWidth = urgent ? 2 : 1.4;
    bctx.strokeRect(4, 3, TILE - 8, TILE - 6);
  });

  drawCachedSprite(ctx, sprite, x, y);
}

function drawPropSprite(ctx, p) {
  const x = p.x * TILE;
  const y = p.y * TILE;
  const done = state.examinedProps.includes(p.id);
  const pulse = !done && !state.prefs.reducedMotion && Math.sin(state.elapsedTime * 5.0 + p.x) > 0.35;
  const key = `prop-v3:${p.id}:${done ? 1 : 0}`;

  const sprite = getCachedSprite(key, TILE, TILE, bctx => {
    bctx.fillStyle = "rgba(0,0,0,0.42)";
    bctx.fillRect(10, 31, 20, 4);

    if (p.id === "clock_1f") {
      bctx.fillStyle = "#4d3829";
      bctx.fillRect(10, 6, 20, 24);
      bctx.fillStyle = "#e8e3d5";
      bctx.fillRect(13, 9, 14, 14);
      bctx.fillStyle = "#161821";
      bctx.fillRect(19, 11, 2, 6);
      bctx.fillRect(19, 15, 5, 2);
      bctx.fillStyle = "#F2D28B";
      bctx.fillRect(19, 25, 2, 4);
    } else if (p.id === "intercom_guard") {
      bctx.fillStyle = "#2d3340";
      bctx.fillRect(11, 10, 18, 18);
      bctx.fillStyle = "#161a22";
      bctx.fillRect(13, 12, 5, 14);
      bctx.fillStyle = "#F09BA8";
      bctx.fillRect(22, 14, 4, 3);
      bctx.fillStyle = "#8FC9FF";
      bctx.fillRect(21, 20, 6, 4);
    } else if (p.id === "warning_b1" || p.id === "notice_elev") {
      bctx.fillStyle = p.id === "notice_elev" ? "#F2D28B" : "#8c2d38";
      bctx.fillRect(11, 8, 18, 22);
      bctx.fillStyle = "#ebe6d8";
      bctx.fillRect(13, 10, 14, 18);
      bctx.fillStyle = "#2b2f3d";
      bctx.fillRect(15, 13, 10, 2);
      bctx.fillRect(15, 17, 8, 2);
      bctx.fillRect(15, 21, 10, 2);
    } else if (p.id === "door_1303") {
      bctx.fillStyle = "#3b3f4d";
      bctx.fillRect(8, 4, 24, 30);
      bctx.fillStyle = "#8c96b0";
      bctx.fillRect(9, 12, 22, 3);
      bctx.fillRect(9, 22, 22, 3);
      bctx.fillStyle = "#F2D28B";
      bctx.fillRect(18, 7, 4, 7);
    } else if (p.id === "phone_living") {
      bctx.fillStyle = "#1b1e29";
      bctx.fillRect(11, 15, 18, 13);
      bctx.fillStyle = "#2e3447";
      bctx.fillRect(9, 11, 22, 5);
      bctx.fillStyle = "#dcd8e6";
      bctx.beginPath();
      bctx.arc(20, 22, 4, 0, Math.PI * 2);
      bctx.fill();
    } else if (p.id === "calendar_master") {
      bctx.fillStyle = "#ebe6d8";
      bctx.fillRect(11, 8, 18, 22);
      bctx.fillStyle = "#8c2d38";
      bctx.fillRect(11, 8, 18, 5);
      bctx.strokeStyle = "#F09BA8";
      bctx.lineWidth = 1.5;
      bctx.strokeRect(16, 17, 6, 6);
    } else {
      bctx.fillStyle = "#9c7e68";
      bctx.fillRect(14, 10, 12, 10);
      bctx.fillRect(13, 20, 14, 11);
      bctx.fillStyle = "#141414";
      bctx.fillRect(16, 14, 2, 2);
      bctx.fillRect(22, 14, 2, 2);
      bctx.fillStyle = "#e8e3d5";
      bctx.fillRect(24, 24, 7, 6);
    }
  });

  drawCachedSprite(ctx, sprite, x, y);

  if (pulse) {
    ctx.fillStyle = "#F2D28B";
    ctx.fillRect(x + 27, y + 7, 2, 6);
    ctx.fillRect(x + 25, y + 9, 6, 2);
  }
}

function drawFieldItemSprite(ctx, it) {
  const x = it.x * TILE;
  const y = it.y * TILE;
  const bob = state.prefs.reducedMotion ? 0 : Math.round(Math.sin(state.elapsedTime * 5.5) * 1.5);

  const sprite = getCachedSprite("item-sedative-v3", TILE, TILE, bctx => {
    bctx.fillStyle = "rgba(0,0,0,0.45)";
    bctx.fillRect(12, 29, 16, 4);
    bctx.fillStyle = "#e8edf5";
    bctx.fillRect(12, 13, 16, 14);
    bctx.strokeStyle = "#141824";
    bctx.lineWidth = 1.5;
    bctx.strokeRect(12, 13, 16, 14);
    bctx.fillStyle = "#d94356";
    bctx.fillRect(19, 16, 2, 8);
    bctx.fillRect(16, 19, 8, 2);
  });

  drawCachedSprite(ctx, sprite, x, y + bob);
}

function drawClueGlint(ctx, clue) {
  const cx = clue.x * TILE + 20;
  const cy = clue.y * TILE + 20;
  const phase = state.prefs.reducedMotion ? 0.8 : (0.45 + 0.55 * Math.sin(state.elapsedTime * 6.5 + clue.x * 1.7));
  const arm = phase > 0.72 ? 5 : 3;

  ctx.save();
  ctx.globalAlpha = phase;
  ctx.fillStyle = "#F2D28B";
  ctx.fillRect(cx - 1, cy - arm, 2, arm * 2 + 1);
  ctx.fillRect(cx - arm, cy - 1, arm * 2 + 1, 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
  ctx.restore();
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
    bctx.fillStyle = "rgba(0,0,0,0.52)";
    bctx.fillRect(10, 34, 20, 4);
    bctx.fillRect(12, 33, 16, 6);
    const hy = bobY;

    if (dir === "down" || dir === "up") {
      const leftLegY = stride === -1 ? -2 : (stride === 1 ? 1 : 0);
      const rightLegY = stride === 1 ? -2 : (stride === -1 ? 1 : 0);

      bctx.fillStyle = "#151a26";
      bctx.fillRect(12, hy + 28 + leftLegY, 6, 6 - Math.max(0, leftLegY));
      bctx.fillRect(22, hy + 28 + rightLegY, 6, 6 - Math.max(0, rightLegY));
      bctx.fillStyle = "#0b0d14";
      bctx.fillRect(12, hy + 33 + leftLegY, 6, 2);
      bctx.fillRect(22, hy + 33 + rightLegY, 6, 2);

      bctx.fillStyle = "#263c5c";
      bctx.fillRect(10, hy + 16, 20, 14);
      bctx.fillStyle = "#1c2d47";
      bctx.fillRect(10, hy + 26, 20, 4);
      bctx.fillStyle = "#213452";
      bctx.fillRect(7, hy + 17 - stride, 3, 10);
      bctx.fillRect(30, hy + 17 + stride, 3, 10);
      bctx.fillStyle = "#e8bfa3";
      bctx.fillRect(7, hy + 26 - stride, 3, 2);
      bctx.fillRect(30, hy + 26 + stride, 3, 2);

      if (dir === "down") {
        bctx.fillStyle = "#9fd2ff";
        bctx.fillRect(14, hy + 17, 12, 11);
        bctx.fillStyle = "#182336";
        bctx.fillRect(19, hy + 17, 2, 10);
        bctx.fillStyle = "#1a2940";
        bctx.fillRect(13, hy + 17, 2, 9);
        bctx.fillRect(25, hy + 17, 2, 9);

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

        bctx.fillStyle = "#0e121c";
        bctx.fillRect(15, hy + 9, 2, 3);
        bctx.fillRect(23, hy + 9, 2, 3);
        bctx.fillStyle = "#ffffff";
        bctx.fillRect(15, hy + 9, 1, 1);
        bctx.fillRect(23, hy + 9, 1, 1);
      } else {
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

      bctx.fillStyle = "#1e304a";
      bctx.fillRect(17 - stride * 2, hy + 17, 5, 9);
      bctx.fillStyle = "#e8bfa3";
      bctx.fillRect(17 - stride * 2, hy + 26, 5, 2);

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
  const key = `npc-v3:${npc.id}:${idleBob}`;

  const sprite = getCachedSprite(key, TILE, TILE, bctx => {
    bctx.fillStyle = "rgba(0,0,0,0.48)";
    bctx.fillRect(10, 34, 20, 4);
    bctx.fillRect(12, 33, 16, 6);

    if (npc.id === "park") {
      bctx.fillStyle = "#192422";
      bctx.fillRect(13, 29, 5, 6);
      bctx.fillRect(22, 29, 5, 6);

      bctx.fillStyle = "#35544e";
      bctx.fillRect(10, 16 + idleBob, 20, 14);
      bctx.fillStyle = "#263d39";
      bctx.fillRect(19, 17 + idleBob, 2, 12);
      bctx.fillStyle = "#f2d28b";
      bctx.fillRect(13, 19 + idleBob, 4, 2);
      bctx.fillRect(10, 16 + idleBob, 3, 2);
      bctx.fillRect(27, 16 + idleBob, 3, 2);

      bctx.fillStyle = "#e0b89d";
      bctx.fillRect(12, 7 + idleBob, 16, 9);
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
}

function drawPixelGhost(ctx, px, py) {
  const twitchFrame = state.prefs.reducedMotion ? 0 : (Math.floor(state.elapsedTime * 7.5) % 4);
  const floatY = state.prefs.reducedMotion ? 0 : Math.sin(state.elapsedTime * 11.0) * 2.5;
  const key = `ghost-v2:${twitchFrame}`;

  const sprite = getCachedSprite(key, 64, 64, bctx => {
    bctx.fillStyle = "rgba(240, 155, 168, 0.24)";
    bctx.beginPath();
    bctx.arc(32, 32, 26, 0, Math.PI * 2);
    bctx.fill();

    bctx.fillStyle = "#14070b";
    bctx.fillRect(20, 19, 24, 27);
    bctx.fillStyle = "#4a1522";
    bctx.fillRect(22, 24, 20, 18);
    const hemShift = twitchFrame % 2 === 0 ? 0 : 2;
    bctx.fillStyle = "#14070b";
    bctx.fillRect(20, 45, 5, 4 - hemShift);
    bctx.fillRect(29, 45, 6, 2 + hemShift);
    bctx.fillRect(39, 45, 5, 4 - hemShift);

    const headShiftX = twitchFrame === 1 ? -3 : (twitchFrame === 3 ? 3 : 0);
    const headShiftY = twitchFrame === 2 ? 2 : 0;
    bctx.fillStyle = "#1c090f";
    bctx.fillRect(22 + headShiftX, 11 + headShiftY, 20, 12);

    bctx.fillStyle = "#F09BA8";
    bctx.fillRect(25 + headShiftX, 15 + headShiftY, 4, 3);
    bctx.fillRect(35 + headShiftX, 16 + headShiftY, 4, 2);
    bctx.fillStyle = "#ffffff";
    bctx.fillRect(26 + headShiftX, 16 + headShiftY, 1, 1);
    bctx.fillRect(36 + headShiftX, 16 + headShiftY, 1, 1);
  });

  const baseAlpha = state.ghost.entryDelay > 0 ? 0.55 : 0.95;

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

function drawInteractionBalloon(ctx, hit) {
  if (!hit || state.mode !== GAME_MODE.PLAY || state.isHiding) return;
  const x = hit.x * TILE;
  const y = hit.y * TILE;
  const bob = state.prefs.reducedMotion ? 0 : Math.sin(state.elapsedTime * 8.5) * 2;

  ctx.save();
  const isDoor = hit.type === "door" || hit.type === "elevator_panel";
  const isNpc = hit.type === "npc";
  const isHide = hit.type === "hiding";
  const accent = isNpc ? "#8FC9FF" : (isHide ? "#9ce0b8" : "#F2D28B");

  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  const pad = 4;
  const len = 6;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + pad + len); ctx.lineTo(x + pad, y + pad); ctx.lineTo(x + pad + len, y + pad);
  ctx.moveTo(x + TILE - pad - len, y + pad); ctx.lineTo(x + TILE - pad, y + pad); ctx.lineTo(x + TILE - pad, y + pad + len);
  ctx.moveTo(x + pad, y + TILE - pad - len); ctx.lineTo(x + pad, y + TILE - pad); ctx.lineTo(x + pad + len, y + TILE - pad);
  ctx.moveTo(x + TILE - pad - len, y + TILE - pad); ctx.lineTo(x + TILE - pad, y + TILE - pad); ctx.lineTo(x + TILE - pad, y + TILE - pad - len);
  ctx.stroke();

  const bx = x + 10;
  const by = y - 18 + bob;
  const bw = 20;
  const bh = 14;

  ctx.fillStyle = "rgba(10, 13, 22, 0.94)";
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = accent;
  ctx.fillRect(bx + 9, by + bh, 2, 3);

  if (isNpc) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(bx + 5, by + 6, 2, 2);
    ctx.fillRect(bx + 9, by + 6, 2, 2);
    ctx.fillRect(bx + 13, by + 6, 2, 2);
  } else if (isDoor) {
    ctx.fillStyle = "#F2D28B";
    ctx.fillRect(bx + 6, by + 6, 6, 2);
    ctx.fillRect(bx + 11, by + 4, 2, 6);
    ctx.fillRect(bx + 13, by + 6, 2, 2);
  } else if (isHide) {
    ctx.fillStyle = "#9ce0b8";
    ctx.fillRect(bx + 6, by + 5, 8, 4);
    ctx.fillStyle = "#0a0d16";
    ctx.fillRect(bx + 9, by + 6, 2, 2);
  } else {
    ctx.fillStyle = "#F2D28B";
    ctx.fillRect(bx + 9, by + 3, 2, 5);
    ctx.fillRect(bx + 9, by + 10, 2, 2);
  }

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

  r.doors.forEach(d => drawDetailedDoor(ctx, d));

  PROPS.filter(p => p.room === state.currentRoom).forEach(p => drawPropSprite(ctx, p));

  FIELD_ITEMS.filter(it => it.room === state.currentRoom && !state.pickedFieldItems.includes(it.id))
    .forEach(it => drawFieldItemSprite(ctx, it));

  CLUES.filter(c => c.room === state.currentRoom && !state.collected.includes(c.id))
    .forEach(c => drawClueGlint(ctx, c));

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

  drawInteractionBalloon(ctx, getBestInteractTargetFn());

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

  if (state.roomFadeAlpha > 0) {
    ctx.fillStyle = `rgba(4, 5, 10, ${state.roomFadeAlpha})`;
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
