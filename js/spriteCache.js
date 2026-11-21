/* =========================================================================
   5-0. 오프스크린 스프라이트 캐시 파이프라인 (v1.8.0)
   - 정적 타일/가구/캐릭터 프레임을 오프스크린 캔버스에 1회 베이크(bake) 후 재사용
   - 브라우저 Canvas2D 및 헤드리스(Vitest/jsdom) 환경 폴백 동시 지원
   ========================================================================= */

const spriteStore = new Map();
const cacheStats = {
  hits: 0,
  misses: 0
};

function createOffscreenCanvas(width, height) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  let ctx = null;
  try {
    ctx = canvas.getContext("2d");
  } catch (e) {
    ctx = null;
  }
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * 키(key) 기준으로 오프스크린 스프라이트를 조회하거나 최초 1회 생성(bake)합니다.
 * @param {string} key 고유 캐시 키
 * @param {number} width 캔버스 너비(px)
 * @param {number} height 캔버스 높이(px)
 * @param {(ctx: CanvasRenderingContext2D) => void} drawFn 베이크 콜백
 * @returns {{ key: string, width: number, height: number, canvas: HTMLCanvasElement|null, drawFn: Function }}
 */
export function getCachedSprite(key, width, height, drawFn) {
  if (spriteStore.has(key)) {
    cacheStats.hits++;
    return spriteStore.get(key);
  }

  cacheStats.misses++;
  const offscreen = createOffscreenCanvas(width, height);
  if (offscreen) {
    drawFn(offscreen.ctx);
  }

  const entry = {
    key,
    width,
    height,
    canvas: offscreen ? offscreen.canvas : null,
    drawFn
  };
  spriteStore.set(key, entry);
  return entry;
}

/**
 * 캐싱된 스프라이트를 대상 컨텍스트의 (dx, dy) 좌표에 픽셀 선명도를 유지하며 출력합니다.
 */
export function drawCachedSprite(ctx, sprite, dx, dy) {
  if (!sprite) return;
  const rx = Math.round(dx);
  const ry = Math.round(dy);
  ctx.imageSmoothingEnabled = false;

  if (sprite.canvas) {
    ctx.drawImage(sprite.canvas, rx, ry);
  } else if (typeof sprite.drawFn === "function") {
    ctx.save();
    ctx.translate(rx, ry);
    sprite.drawFn(ctx);
    ctx.restore();
  }
}

export function hasCachedSprite(key) {
  return spriteStore.has(key);
}

export function clearSpriteCache(prefix = null) {
  if (!prefix) {
    spriteStore.clear();
    cacheStats.hits = 0;
    cacheStats.misses = 0;
    return;
  }
  for (const key of spriteStore.keys()) {
    if (key.startsWith(prefix)) {
      spriteStore.delete(key);
    }
  }
}

export function getSpriteCacheStats() {
  return {
    count: spriteStore.size,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    keys: Array.from(spriteStore.keys())
  };
}
