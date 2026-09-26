// Per-isolate circuit breaker. Edge Function isolates are reused across
// requests, so a provider that just returned 429 is skipped for a while
// instead of every request paying its latency again.

const cooldownUntil = new Map<string, number>();

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number | 'timeout' | 'network' | 'invalid',
    message?: string,
  ) {
    super(message ?? `${provider}: ${status}`);
  }
}

/** Rate limits back off longer than transient failures. */
export function cooldownMs(error: unknown): number {
  if (error instanceof ProviderError) {
    if (error.status === 429) return 60_000;
    if (error.status === 401 || error.status === 403) return 10 * 60_000; // misconfigured key
    if (error.status === 'invalid') return 0; // bad output for this input only
  }
  return 20_000;
}

export function isCoolingDown(id: string, now = Date.now()): boolean {
  return (cooldownUntil.get(id) ?? 0) > now;
}

export function trip(id: string, error: unknown, now = Date.now()): void {
  const ms = cooldownMs(error);
  if (ms > 0) cooldownUntil.set(id, now + ms);
}

export function reset(id?: string): void {
  if (id) cooldownUntil.delete(id);
  else cooldownUntil.clear();
}

export interface Attempt {
  provider: string;
  ok: boolean;
  ms: number;
  error?: string;
}

/**
 * Runs `providers` in order until one succeeds. Providers in cooldown are
 * skipped (unless every provider is cooling down, in which case all are tried).
 */
export async function runChain<P extends { id: string }, R>(
  providers: P[],
  run: (provider: P) => Promise<R>,
): Promise<{ result: R; provider: P; attempts: Attempt[] }> {
  const attempts: Attempt[] = [];
  const ready = providers.filter((p) => !isCoolingDown(p.id));
  const order = ready.length > 0 ? ready : providers;
  let lastError: unknown = new Error('no providers configured');
  for (const provider of order) {
    const started = Date.now();
    try {
      const result = await run(provider);
      attempts.push({ provider: provider.id, ok: true, ms: Date.now() - started });
      return { result, provider, attempts };
    } catch (error) {
      lastError = error;
      trip(provider.id, error);
      attempts.push({
        provider: provider.id,
        ok: false,
        ms: Date.now() - started,
        error: error instanceof Error ? error.message.slice(0, 160) : String(error),
      });
    }
  }
  console.warn('[providers] all failed', JSON.stringify(attempts));
  throw lastError;
}

/** fetch with a timeout, mapping failures to ProviderError. */
export async function providerFetch(
  provider: string,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ProviderError(provider, timedOut ? 'timeout' : 'network');
  }
  if (!response.ok) {
    const body = (await response.text().catch(() => '')).slice(0, 300);
    throw new ProviderError(provider, response.status, `${provider}: HTTP ${response.status} ${body}`);
  }
  return response;
}
