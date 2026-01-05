"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchJSON = fetchJSON;
exports.fixturesBetweenByTeam = fixturesBetweenByTeam;
// functions/src/sportmonks/client.ts
const promises_1 = require("node:timers/promises");
function withTimeout(signal, timeoutMs) {
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
function isRetryableStatus(status) {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
}
function jitter(ms) {
    // +/- 20%
    const delta = ms * 0.2;
    return ms + (Math.random() * 2 - 1) * delta;
}
async function fetchJSON(url, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 25_000;
    const retries = opts.retries ?? 5;
    const retryDelayBaseMs = opts.retryDelayBaseMs ?? 750;
    let lastErr;
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
                    await (0, promises_1.setTimeout)(waitMs);
                    continue;
                }
                throw new Error(msg);
            }
            return await res.json();
        }
        catch (e) {
            lastErr = e;
            // AbortError / transient network
            const isAbort = e?.name === "AbortError";
            if (attempt < retries && (isAbort || e instanceof TypeError)) {
                const waitMs = jitter(retryDelayBaseMs * Math.pow(2, attempt));
                await (0, promises_1.setTimeout)(waitMs);
                continue;
            }
            throw e;
        }
        finally {
            cleanup();
        }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
function fixturesBetweenByTeam(teamId, from, to, token, base) {
    return (`${base}/fixtures/between/${from}/${to}/${teamId}` +
        `?api_token=${encodeURIComponent(token)}` +
        `&include=state;scores;xgfixture;participants`);
}
//# sourceMappingURL=client.js.map