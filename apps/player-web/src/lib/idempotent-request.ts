const defaultTimeoutMs = 12_000;

export interface IdempotentRequestOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

function mergedSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return external ? AbortSignal.any([external, timeout]) : timeout;
}

/**
 * Sends a mutating BFF request with one stable idempotency key. Only transport
 * failures are retried; HTTP responses are authoritative and returned unchanged.
 */
export async function postIdempotent(
  url: string,
  body?: unknown,
  options: IdempotentRequestOptions = {},
): Promise<Response> {
  const key = crypto.randomUUID();
  const send = () => fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": key },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: mergedSignal(options.timeoutMs ?? defaultTimeoutMs, options.signal),
  });

  try {
    return await send();
  } catch (firstError) {
    if (options.signal?.aborted) throw firstError;
    return await send();
  }
}
