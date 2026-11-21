// 게임 버전 단일 관리 파일 (Phase 3 - v1.5.0)
export const APP_VERSION = "1.5.0";
if (typeof window !== "undefined") {
  window.APP_VERSION = APP_VERSION;
}
