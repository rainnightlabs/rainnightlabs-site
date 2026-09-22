const MAX_INSTALLATIONS = 3;

function credentials() {
  const url = String(
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ""
  ).replace(/\/$/, "");
  const token = String(
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ""
  );
  return url && token ? { url, token } : null;
}

async function redis(command) {
  const config = credentials();
  if (!config) {
    return { ok: false, configured: false };
  }

  let response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });
  } catch {
    return { ok: false, configured: true, unavailable: true };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error) {
    console.error("LICENSE_ACTIVATION_STORE_FAILED", JSON.stringify({
      status: response.status,
      error: payload?.error || "unknown"
    }));
    return { ok: false, configured: true, unavailable: true };
  }

  return { ok: true, configured: true, result: payload.result };
}

function activationKey(transactionId) {
  return `list2sheet:license:${transactionId}:installations`;
}

export function activationStoreConfigured() {
  return Boolean(credentials());
}

export function maxInstallations() {
  return MAX_INSTALLATIONS;
}

export async function registerInstallation(transactionId, installationId) {
  if (!activationStoreConfigured()) {
    return {
      ok: true,
      configured: false,
      allowed: true,
      used: null,
      limit: MAX_INSTALLATIONS
    };
  }

  const script = [
    "local existing = redis.call('ZSCORE', KEYS[1], ARGV[1])",
    "if existing then",
    "  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])",
    "  return {1, redis.call('ZCARD', KEYS[1])}",
    "end",
    "local count = redis.call('ZCARD', KEYS[1])",
    "if count >= tonumber(ARGV[3]) then return {0, count} end",
    "redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])",
    "return {1, count + 1}"
  ].join("\n");

  const result = await redis([
    "EVAL",
    script,
    1,
    activationKey(transactionId),
    installationId,
    Date.now(),
    MAX_INSTALLATIONS
  ]);

  if (!result.ok) return result;

  const values = Array.isArray(result.result) ? result.result : [];
  const allowed = Number(values[0]) === 1;
  const used = Number(values[1]);

  return {
    ok: true,
    configured: true,
    allowed,
    limitReached: !allowed,
    used: Number.isFinite(used) ? used : null,
    limit: MAX_INSTALLATIONS
  };
}

export async function releaseInstallation(transactionId, installationId) {
  if (!activationStoreConfigured()) {
    return {
      ok: true,
      configured: false,
      released: false
    };
  }

  const result = await redis([
    "ZREM",
    activationKey(transactionId),
    installationId
  ]);

  if (!result.ok) return result;

  return {
    ok: true,
    configured: true,
    released: Number(result.result) > 0
  };
}
