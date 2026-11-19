/* =========================================================================
   0. 안전한 스토리지 래퍼 (사생활 보호 모드 / iframe / 용량 초과 폴백)
   ========================================================================= */
const memoryFallback = new Map();
let storageRestricted = false;

export function isStorageRestricted() {
  return storageRestricted;
}

export function safeGet(key) {
  try {
    const val = window.localStorage.getItem(key);
    if (val !== null) return val;
  } catch (e) {
    storageRestricted = true;
  }
  return memoryFallback.has(key) ? memoryFallback.get(key) : null;
}

export function safeSet(key, value) {
  const str = String(value);
  memoryFallback.set(key, str);
  try {
    window.localStorage.setItem(key, str);
    return true;
  } catch (e) {
    storageRestricted = true;
    return false;
  }
}

export function safeRemove(key) {
  memoryFallback.delete(key);
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (e) {
    storageRestricted = true;
    return false;
  }
}
