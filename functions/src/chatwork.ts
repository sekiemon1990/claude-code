/**
 * Chatwork API への投稿ヘルパー。
 * 10 秒タイムアウト、失敗時は throw で呼び出し側 (Cloud Functions retry) に委ねる。
 */

const CHATWORK_API_BASE = 'https://api.chatwork.com/v2';
const REQUEST_TIMEOUT_MS = 10_000;

export async function postToRoom(
  roomId: string,
  body: string,
  token: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${CHATWORK_API_BASE}/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'X-ChatWorkToken': token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ body }).toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`chatwork http ${res.status}: ${text}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
