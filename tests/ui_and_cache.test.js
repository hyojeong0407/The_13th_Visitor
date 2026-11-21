import { describe, it, expect, beforeEach } from "vitest";
import {
  escapeHtml,
  formatHighlightedDialogue,
  startTypewriter,
  isTypewriterActive,
  updateTypewriter,
  finishTypewriter
} from "../js/ui.js";
import {
  getCachedSprite,
  hasCachedSprite,
  clearSpriteCache,
  getSpriteCacheStats
} from "../js/spriteCache.js";

describe("UI 파서 · 타자기 엔진 · 오프스크린 스프라이트 캐시 검증", () => {
  beforeEach(() => {
    clearSpriteCache();
  });

  it("escapeHtml이 HTML 특수문자를 안전하게 이스케이프해야 한다", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe("&lt;script&gt;alert('x')&lt;/script&gt;");
  });

  it("formatHighlightedDialogue가 중첩 대괄호([[blue:[Space]]])와 핵심 키워드를 정상 변환해야 한다", () => {
    const out = formatHighlightedDialogue("[[blue:[Space]]] 키를 눌러 1304호의 단서를 확인하라.");
    expect(out).toContain('<span class="hl-blue">[Space]</span>');
    expect(out).toContain('<span class="hl-gold">1304호</span>');
  });

  it("타자기 엔진이 활성화·진행·즉시 완료(finishTypewriter) 상태를 정확히 관리해야 한다", () => {
    startTypewriter("nonexistent-target", "테스트 문장입니다.", "SYSTEM", 50);
    expect(isTypewriterActive("nonexistent-target")).toBe(true);
    updateTypewriter(0.1);
    finishTypewriter();
    expect(isTypewriterActive()).toBe(false);
  });

  it("spriteCache가 동일 키에 대해 캐시 히트를 반환하고 접두사 기반 초기화를 지원해야 한다", () => {
    let bakeCalls = 0;
    const drawFn = () => {
      bakeCalls++;
    };

    const s1 = getCachedSprite("hero:down:0:0", 40, 40, drawFn);
    const s2 = getCachedSprite("hero:down:0:0", 40, 40, drawFn);
    getCachedSprite("npc:park:0", 40, 40, drawFn);

    expect(s1).toBe(s2);
    expect(bakeCalls).toBe(2);
    expect(hasCachedSprite("hero:down:0:0")).toBe(true);

    const stats = getSpriteCacheStats();
    expect(stats.count).toBe(2);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);

    clearSpriteCache("hero:");
    expect(hasCachedSprite("hero:down:0:0")).toBe(false);
    expect(hasCachedSprite("npc:park:0")).toBe(true);
  });
});
