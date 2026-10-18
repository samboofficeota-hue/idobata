// パスワードや鍵の総当たりを防ぐため、IPごとに失敗回数を数える（広聴AIと同じ方式）
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export const createLockout = () => {
  const failures = new Map();

  const isLockedOut = (ip) => {
    const entry = failures.get(ip);
    if (!entry) return false;
    if (Date.now() - entry.since > FAILURE_WINDOW_MS) {
      failures.delete(ip);
      return false;
    }
    return entry.count >= MAX_FAILURES;
  };

  const recordFailure = (ip) => {
    const entry = failures.get(ip);
    if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS) {
      failures.set(ip, { count: 1, since: Date.now() });
    } else {
      entry.count += 1;
    }
  };

  const clear = (ip) => failures.delete(ip);

  return { isLockedOut, recordFailure, clear };
};
