// functions/src/sportmonks/client.ts
import { setTimeout as sleep } from "node:timers/promises";

type FetchJSONOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayBaseMs?: number;
};

function withTimeout(signal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    },
  };
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function jitter(ms: number) {
  // +/- 20%
  const delta = ms * 0.2;
  return ms + (Math.random() * 2 - 1) * delta;
}

export async function fetchJSON(url: string, opts: FetchJSONOptions = {}) {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const retries = opts.retries ?? 5;
  const retryDelayBaseMs = opts.retryDelayBaseMs ?? 750;

  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const { signal, cleanup } = withTimeout(controller.signal, timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = `Fetch failed ${res.status} ${text.slice(0, 300)}`;

        if (attempt < retries && isRetryableStatus(res.status)) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter)
            ? retryAfter * 1000
            : jitter(retryDelayBaseMs * Math.pow(2, attempt));

          await sleep(waitMs);
          continue;
        }

        throw new Error(msg);
      }

      return await res.json();
    } catch (e) {
      lastErr = e;

      // AbortError / transient network
      const isAbort = (e as any)?.name === "AbortError";
      if (attempt < retries && (isAbort || e instanceof TypeError)) {
        const waitMs = jitter(retryDelayBaseMs * Math.pow(2, attempt));
        await sleep(waitMs);
        continue;
      }

      throw e;
    } finally {
      cleanup();
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function fixturesBetweenByTeam(
  teamId: number,
  from: string,
  to: string,
  token: string,
  base: string
) {
  return (
    `${base}/fixtures/between/${from}/${to}/${teamId}` +
    `?api_token=${encodeURIComponent(token)}` +
    `&include=state;scores;xgfixture;participants`
  );
}
