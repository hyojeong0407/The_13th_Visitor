/* =========================================================================
   5. 16비트 픽셀 렌더링 엔진 (인접 돋보기, 축소 조명, 숨 참기 게이지, 정신력 환각)
   ========================================================================= */
import { ROOMS, NPCS, PROPS, FIELD_ITEMS } from "./data.js";
import { state, TILE, GAME_MODE, GHOST_STATE } from "./state.js";

const lightCanvas = document.createElement("canvas");
const lctx = lightCanvas.getContext("2d");

function drawDetailedFurniture(ctx, f) {
  const x = f.x * TILE;
  const y = f.y * TILE;
  const w = f.w * TILE;
  const h = f.h * TILE;

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(x + 3, y + h - 2, w - 4, 5);

  ctx.fillStyle = f.color;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + 3, y + 3, w - 6, 4);

  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

  if (f.style === "car") {
    ctx.fillStyle = "#1c2633";
    ctx.fillRect(x + 14, y + 8, w - 28, h - 16);
    ctx.fillStyle = "#f2d28b";
    ctx.fillRect(x + w - 7, y + 8, 4, 8);
    ctx.fillRect(x + w - 7, y + h - 16, 4, 8);
  } else if (f.style === "bed") {
    ctx.fillStyle = "#d9d4e0";
    ctx.fillRect(x + 6, y + 8, 18, h - 16);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x + 28, y + 4, 3, h - 8);
  } else if (f.style === "cctv") {
    ctx.fillStyle = (Math.floor(state.animTick / 15) % 2 === 0) ? "#4f8c7a" : "#386659";
    ctx.fillRect(x + 8, y + 6, 22, 16);
    ctx.fillRect(x + 36, y + 6, 22, 16);
  } else if (f.style === "mirror") {
    ctx.fillStyle = "#9fb3c7";
    ctx.fillRect(x + 6, y + 5, w - 12, h - 10);
    ctx.fillStyle = "rgba(240, 155, 168, 0.35)";
    ctx.fillRect(x + 12, y + 9, 14, 16);
  }

  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.fillText(f.label, x + w / 2 + 1, y + h / 2 + 4);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(f.label, x + w / 2, y + h / 2 + 3);
  ctx.textAlign = "left";
}

function drawHidingSpot(ctx, s) {
  const x = s.x * TILE;
  const y = s.y * TILE;
  const urgent = state.lightState === "flicker" && !state.isHiding;
  const used = state.hidingUseCount[s.id] || 0;

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(x + 4, y + TILE - 2, TILE - 6, 4);

  ctx.fillStyle = urgent ? "#4d4327" : (used >= 2 ? "#4a3338" : "#3a4f48");
  ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
  ctx.strokeStyle = urgent ? "#F2D28B" : (used >= 2 ? "#F09BA8" : "#8FC9FF");
  ctx.lineWidth = urgent ? 2 : 1.2;
  ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);

  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.fillText("숨기[H]", x + 21, y + 24);
  ctx.fillStyle = urgent ? "#F2D28B" : "#8FC9FF";
  ctx.fillText("숨기[H]", x + 20, y + 23);
  ctx.textAlign = "left";
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

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(px + 9, py + 33, 22, 5);
  const hy = py + bobY;

  if (dir === "down" || dir === "up") {
    const leftLegY = stride === -1 ? -2 : (stride === 1 ? 1 : 0);
    const rightLegY = stride === 1 ? -2 : (stride === -1 ? 1 : 0);

    ctx.fillStyle = "#181d2b";
    ctx.fillRect(px + 12, hy + 28 + leftLegY, 6, 7 - Math.max(0, leftLegY));
    ctx.fillRect(px + 22, hy + 28 + rightLegY, 6, 7 - Math.max(0, rightLegY));

    ctx.fillStyle = "#2b4263";
    ctx.fillRect(px + 10, hy + 16, 20, 14);
    ctx.fillStyle = "#233652";
    ctx.fillRect(px + 7, hy + 17 - stride, 3, 10);
    ctx.fillRect(px + 30, hy + 17 + stride, 3, 10);

    if (dir === "down") {
      ctx.fillStyle = "#8FC9FF";
      ctx.fillRect(px + 13, hy + 17, 14, 11);
      ctx.fillStyle = "#1b283d";
      ctx.fillRect(px + 19, hy + 17, 2, 10);

      ctx.fillStyle = "#f2cbb0";
      ctx.fillRect(px + 12, hy + 5, 16, 11);
      ctx.fillStyle = "#191b24";
      ctx.fillRect(px + 11, hy + 3, 18, 4);
      ctx.fillRect(px + 11, hy + 5, 2, 6);
      ctx.fillRect(px + 27, hy + 5, 2, 6);

      ctx.fillStyle = "#0e121c";
      ctx.fillRect(px + 15, hy + 9, 2, 3);
      ctx.fillRect(px + 23, hy + 9, 2, 3);
    } else {
      ctx.fillStyle = "#1f314a";
      ctx.fillRect(px + 19, hy + 18, 2, 11);
      ctx.fillStyle = "#191b24";
      ctx.fillRect(px + 11, hy + 3, 18, 13);
    }
  } else {
    const isLeft = dir === "left";
    const frontFootX = stride * 3;
    const backFootX = -stride * 3;

    ctx.fillStyle = "#121621";
    ctx.fillRect(px + 16 + backFootX, hy + 28, 6, 7);
    ctx.fillStyle = "#1d2333";
    ctx.fillRect(px + 16 + frontFootX, hy + 28, 6, 7);

    ctx.fillStyle = "#2b4263";
    ctx.fillRect(px + 12, hy + 16, 16, 14);
    ctx.fillStyle = "#8FC9FF";
    ctx.fillRect(isLeft ? px + 12 : px + 24, hy + 17, 4, 10);

    ctx.fillStyle = "#22344f";
    ctx.fillRect(px + 17 - stride * 2, hy + 17, 5, 10);

    ctx.fillStyle = "#f2cbb0";
    ctx.fillRect(px + 13, hy + 5, 14, 11);
    ctx.fillStyle = "#191b24";
    ctx.fillRect(px + 12, hy + 3, 16, 4);
    ctx.fillRect(isLeft ? px + 23 : px + 12, hy + 5, 5, 10);

    ctx.fillStyle = "#0e121c";
    ctx.fillRect(isLeft ? px + 15 : px + 23, hy + 9, 2, 3);
  }
}

function drawPixelNPC(ctx, npc) {
  const px = npc.x * TILE;
  const py = npc.y * TILE;
  const idleBob = Math.floor(state.animTick / 28) % 2;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(px + 9, py + 33, 22, 5);

  if (npc.id === "park") {
    ctx.fillStyle = "#1c2624";
    ctx.fillRect(px + 13, py + 29, 5, 6);
    ctx.fillRect(px + 22, py + 29, 5, 6);

    ctx.fillStyle = "#3c5954";
    ctx.fillRect(px + 10, py + 16 + idleBob, 20, 14);
    ctx.fillStyle = "#f2d28b";
    ctx.fillRect(px + 13, py + 19 + idleBob, 4, 2);

    ctx.fillStyle = "#e0b89d";
    ctx.fillRect(px + 12, py + 6 + idleBob, 16, 10);
    ctx.fillStyle = "#263835";
    ctx.fillRect(px + 10, py + 3 + idleBob, 20, 4);
    ctx.fillStyle = "#111";
    ctx.fillRect(px + 15, py + 10 + idleBob, 2, 2);
    ctx.fillRect(px + 23, py + 10 + idleBob, 2, 2);
  } else if (npc.id === "han") {
    ctx.fillStyle = "#241b24";
    ctx.fillRect(px + 13, py + 29, 5, 6);
    ctx.fillRect(px + 22, py + 29, 5, 6);

    ctx.fillStyle = "#6e4b6b";
    ctx.fillRect(px + 10, py + 16 + idleBob, 20, 14);
    ctx.fillStyle = "#2b1d24";
    ctx.fillRect(px + 10, py + 4 + idleBob, 20, 13);
    ctx.fillStyle = "#f2cbb0";
    ctx.fillRect(px + 13, py + 7 + idleBob, 14, 9);
    ctx.fillStyle = "#111";
    ctx.fillRect(px + 15, py + 10 + idleBob, 2, 2);
    ctx.fillRect(px + 23, py + 10 + idleBob, 2, 2);
  } else if (npc.id === "yoonseo") {
    const flicker = 0.75 + Math.sin(state.animTick * 0.15) * 0.2;
    ctx.save();
    ctx.globalAlpha = flicker;
    ctx.fillStyle = "#e6ecf5";
    ctx.fillRect(px + 11, py + 17 + idleBob, 18, 15);
    ctx.fillStyle = "#17161c";
    ctx.fillRect(px + 11, py + 5 + idleBob, 18, 14);
    ctx.fillStyle = "#f5e6e8";
    ctx.fillRect(px + 14, py + 8 + idleBob, 12, 8);
    ctx.fillStyle = "#3b1820";
    ctx.fillRect(px + 16, py + 11 + idleBob, 2, 2);
    ctx.fillRect(px + 22, py + 11 + idleBob, 2, 2);
    ctx.restore();
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
  const floatY = Math.sin(state.animTick * 0.2) * 3;
  ctx.save();
  ctx.globalAlpha = state.ghost.entryDelay > 0 ? 0.55 : 0.94;

  ctx.fillStyle = "rgba(240, 155, 168, 0.28)";
  ctx.beginPath();
  ctx.arc(px + 20, py + 20 + floatY, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a0b10";
  ctx.fillRect(px + 9, py + 6 + floatY, 22, 28);
  ctx.fillStyle = "#4a1522";
  ctx.fillRect(px + 11, py + 16 + floatY, 18, 16);

  ctx.fillStyle = "#F09BA8";
  ctx.fillRect(px + 14, py + 11 + floatY, 4, 3);
  ctx.fillRect(px + 22, py + 11 + floatY, 4, 3);

  ctx.restore();
}

/* [!] 표식 대신 인접 시에만 돋보기 아이콘 + 레티클을 표시 */
function drawMagnifierIndicator(ctx, hit) {
  if (!hit || state.mode !== GAME_MODE.PLAY || state.isHiding) return;
  const x = hit.x * TILE;
  const y = hit.y * TILE;
  const bob = Math.sin(state.animTick * 0.16) * 2;

  ctx.save();
  // 1. 타일 코너 레티클
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

  // 2. 인접 조사 가능 돋보기 아이콘 배지
  const cx = x + TILE / 2;
  const cy = y - 10 + bob;
  ctx.fillStyle = "rgba(10, 13, 24, 0.9)";
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#F2D28B";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 돋보기 렌즈 & 손잡이
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(cx - 1.5, cy - 1.5, 4, 0, Math.PI * 2);
  ctx.moveTo(cx + 1.5, cy + 1.5);
  ctx.lineTo(cx + 5, cy + 5);
  ctx.stroke();

  ctx.restore();
}

/* 평상시 조명 반경 축소(5칸) + 정신력에 따른 시야 협소화 */
function renderRoomLightingOverlay(ctx, canvas, screenPx, screenPy) {
  if (lightCanvas.width !== canvas.width || lightCanvas.height !== canvas.height) {
    lightCanvas.width = canvas.width;
    lightCanvas.height = canvas.height;
  }

  if (state.lightState === "on") {
    state.currentLightOn = true;
  } else if (state.lightState === "out") {
    state.currentLightOn = false;
  } else if (state.lightState === "flicker") {
    const progress = 1 - Math.max(0, state.flickerTimer / 10.0);
    const wave = Math.sin(state.animTick * 0.85) + Math.cos(state.animTick * 1.93);
    state.currentLightOn = wave > (-0.45 + progress * 0.95);
  }

  lctx.save();
  lctx.globalCompositeOperation = "source-over";
  lctx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);

  // 정신력 단계에 따른 시야 반경 보정
  const sanityFactor = state.sanity <= 30 ? 0.68 : (state.sanity <= 60 ? 0.84 : 1.0);

  if (state.currentLightOn) {
    // 평상시 점등도 방 전체가 환하지 않고 플레이어 주변 약 5칸(200px) 위주로 비춤
    lctx.fillStyle = state.currentRoom.includes("13") ? "rgba(5, 4, 10, 0.72)" : "rgba(6, 8, 15, 0.62)";
    lctx.fillRect(0, 0, lightCanvas.width, lightCanvas.height);

    lctx.globalCompositeOperation = "destination-out";
    const normalRadius = Math.round(215 * sanityFactor);
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
      lctx.fillStyle = "rgba(210, 230, 255, 0.08)";
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

/* 미니맵: 단서 위치와 추격자 점 제거 (정신력 20 이하 시 미니맵 노이즈 왜곡) */
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

  // 정신력 20 이하일 때 미니맵 좌표 왜곡 및 가짜 점 표시
  if (state.sanity <= 20) {
    const jitterX = Math.sin(state.animTick * 0.4) * 5;
    const jitterY = Math.cos(state.animTick * 0.35) * 4;
    ctx.fillStyle = "#F09BA8";
    ctx.fillRect(ox + mapW * 0.5 + jitterX, oy + mapH * 0.5 + jitterY, scale, scale);
  }

  ctx.fillStyle = "#8FC9FF";
  ctx.fillRect(ox + (state.player.px / TILE) * scale, oy + (state.player.py / TILE) * scale, scale + 1, scale + 1);
  ctx.restore();
}

export function renderGame(ctx, canvas, getBestInteractTargetFn) {
  state.animTick++;
  const r = ROOMS[state.currentRoom];
  if (!r) return;

  const mapW = r.cols * TILE;
  const mapH = r.rows * TILE;

  ctx.save();
  ctx.fillStyle = "#06070c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake;
    const sy = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(sx, sy);
    state.screenShake *= 0.85;
    if (state.screenShake < 0.3) state.screenShake = 0;
  }

  ctx.save();
  ctx.translate(-Math.round(state.camera.x), -Math.round(state.camera.y));

  ctx.fillStyle = r.bg;
  ctx.fillRect(0, 0, mapW, mapH);

  for (let y = 1; y < r.rows - 1; y++) {
    for (let x = 1; x < r.cols - 1; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? r.floorA : r.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  ctx.fillStyle = r.wall;
  ctx.fillRect(0, 0, mapW, TILE);
  ctx.fillRect(0, (r.rows - 1) * TILE, mapW, TILE);
  ctx.fillRect(0, 0, TILE, mapH);
  ctx.fillRect((r.cols - 1) * TILE, 0, TILE, mapH);

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

  // 환경 소품 (은은한 반짝임만 표시, [!] 없음)
  PROPS.filter(p => p.room === state.currentRoom).forEach(p => {
    const done = state.examinedProps.includes(p.id);
    ctx.fillStyle = done ? "rgba(255,255,255,0.22)" : "rgba(220,232,255,0.62)";
    ctx.fillRect(p.x * TILE + 17, p.y * TILE + 17, 6, 6);
  });

  // 현장 구급 아이템
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

  // 정신력 40 이하 시 가짜 단서(환각) 잔상 표시
  if (state.sanity <= 40 && state.hallucination.fakeClue) {
    const fc = state.hallucination.fakeClue;
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(state.animTick * 0.3) * 0.25;
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

  // 인접한 조사 가능 대상에만 돋보기 아이콘 표시
  drawMagnifierIndicator(ctx, getBestInteractTargetFn());

  ctx.restore();

  const screenPx = state.player.px + TILE / 2 - Math.round(state.camera.x);
  const screenPy = state.player.py + TILE / 2 - Math.round(state.camera.y);
  renderRoomLightingOverlay(ctx, canvas, screenPx, screenPy);
  renderMinimap(ctx, canvas);

  // 숨 참기 미니게임 HUD 게이지 (은신 수색 중일 때 캔버스 중앙 하단에 표시)
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
    const alpha = ((45 - state.sanity) / 45) * 0.32 + Math.sin(state.animTick * 0.25) * 0.05;
    ctx.fillStyle = `rgba(160, 20, 45, ${Math.max(0.05, alpha)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#000";
  ctx.fillText("은하아파트 · " + state.currentRoom, 17, 26);
  ctx.fillStyle = "#F2D28B";
  ctx.fillText("은하아파트 · " + state.currentRoom, 16, 25);

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
