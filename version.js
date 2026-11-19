// 게임 버전 단일 관리 파일
export const APP_VERSION = "1.4.1";
if (typeof window !== "undefined") {
  window.APP_VERSION = APP_VERSION;
}