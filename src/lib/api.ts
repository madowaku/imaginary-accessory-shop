const TIMEOUT_MS = 150_000;

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...init, headers, credentials: 'same-origin', signal: controller.signal });
    const data = await response.json().catch(() => ({})) as { error?: string; code?: string };
    if (!response.ok) throw new ApiError(data.error ?? '通信に失敗しました。', response.status, data.code);
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('生成に時間がかかっています。もう一度お試しください。', 408, 'timeout');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
