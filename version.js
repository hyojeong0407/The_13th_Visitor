// 게임 버전 단일 관리 파일 (v1.9.0)
export const APP_VERSION = "1.9.0";
if (typeof window !== "undefined") {
  window.APP_VERSION = APP_VERSION;
}
