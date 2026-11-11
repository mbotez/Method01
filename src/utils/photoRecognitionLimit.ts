/**
 * Utility for managing photo recognition rate limits and state.
 * - Unauthenticated users: limited to 1 scan total. After 1 scan, prompted to sign in or sign up.
 * - Authenticated users: limited to 5 scans per calendar day (local date).
 *   No counter is displayed anywhere. When exhausted, triggers the 'Feature currently not available' popup.
 */

const UNAUTH_KEY = 'canonic_photo_scan_unauth_count';
const AUTH_PREFIX = 'canonic_photo_scan_auth_';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getUnauthenticatedScanCount(): number {
  try {
    const raw = localStorage.getItem(UNAUTH_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function recordUnauthenticatedScan(): void {
  try {
    const current = getUnauthenticatedScanCount();
    localStorage.setItem(UNAUTH_KEY, String(current + 1));
  } catch (e) {
    console.warn('[Limit] Failed to update unauthenticated scan count:', e);
  }
}

export function getAuthenticatedDailyScans(userId: string): number {
  if (!userId) return 0;
  try {
    const key = `${AUTH_PREFIX}${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const today = getTodayDateString();
    if (parsed.date !== today) {
      return 0;
    }
    return typeof parsed.count === 'number' ? parsed.count : 0;
  } catch {
    return 0;
  }
}

export function recordAuthenticatedScan(userId: string): void {
  if (!userId) return;
  try {
    const key = `${AUTH_PREFIX}${userId}`;
    const today = getTodayDateString();
    const current = getAuthenticatedDailyScans(userId);
    localStorage.setItem(
      key,
      JSON.stringify({
        date: today,
        count: current + 1,
      })
    );
  } catch (e) {
    console.warn('[Limit] Failed to update authenticated scan count:', e);
  }
}

export interface PhotoScanCheckResult {
  allowed: boolean;
  reason?: 'REQUIRE_AUTH' | 'DAILY_LIMIT_EXHAUSTED';
}

export function checkPhotoRecognitionLimit(user: { id?: string } | null | undefined): PhotoScanCheckResult {
  if (!user || !user.id) {
    const count = getUnauthenticatedScanCount();
    if (count >= 1) {
      return { allowed: false, reason: 'REQUIRE_AUTH' };
    }
    return { allowed: true };
  }

  const count = getAuthenticatedDailyScans(user.id);
  if (count >= 5) {
    return { allowed: false, reason: 'DAILY_LIMIT_EXHAUSTED' };
  }
  return { allowed: true };
}

export function recordPhotoScanUsage(user: { id?: string } | null | undefined): void {
  if (!user || !user.id) {
    recordUnauthenticatedScan();
  } else {
    recordAuthenticatedScan(user.id);
  }
}
