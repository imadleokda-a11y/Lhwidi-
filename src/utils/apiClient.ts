export interface ApiFetchResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export async function postApiJson<T extends Record<string, unknown>>(
  url: string,
  payload: unknown,
  options?: {
    timeoutMs?: number;
    retries?: number;
  }
): Promise<ApiFetchResult<T>> {
  const timeoutMs = options?.timeoutMs ?? 22000;
  const maxRetries = options?.retries ?? 1;
  const body = JSON.stringify(payload);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
        signal: controller.signal,
      });

      const raw = await res.text();
      window.clearTimeout(timer);

      if (res.status === 413) {
        throw new Error('حجم الصورة أو التسجيل كبير بزاف، عاود جرب بحجم أخف.');
      }

      const isGatewayRetryable = res.status === 502 || res.status === 503 || res.status === 504;

      let parsed: T | null = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw) as T;
        } catch {
          parsed = null;
        }
      } else {
        parsed = {} as T;
      }

      if (parsed === null || isGatewayRetryable) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 550 * (attempt + 1)));
          continue;
        }
        if (parsed === null) {
          throw new Error('تعذر قراءة الرد من الخادم بسبب ضعف الاتصال، عاود حاول.');
        }
      }

      return {
        ok: res.ok,
        status: res.status,
        data: parsed,
      };
    } catch (err: unknown) {
      window.clearTimeout(timer);
      const isAbort =
        err instanceof DOMException
          ? err.name === 'AbortError'
          : err instanceof Error && err.name === 'AbortError';

      lastError =
        err instanceof Error &&
        !isAbort &&
        err.message !== 'Failed to fetch' &&
        !err.message.includes('NetworkError')
          ? err
          : new Error('السيرفر تعطل شوية أو الانترنت ضعيف، عاود حاول دابا.');

      if (attempt < maxRetries && (isAbort || lastError.message.includes('ضعيف'))) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('تعذر الاتصال بالخادم، عاود حاول.');
}
