from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing marker: {label}")
    return text.replace(old, new, 1)


auth_path = Path("src/auth.ts")
auth = auth_path.read_text()

if "REFRESH_REPLAY_TTL_MS" not in auth:
    auth = replace_once(
        auth,
        "const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;\n",
        "const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;\nconst REFRESH_REPLAY_TTL_MS = 30 * 1000;\n",
        "refresh replay ttl",
    )

if "interface RefreshReplayRecord" not in auth:
    old = '''export interface TokenPair {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}
'''
    new = old + '''
interface RefreshReplayRecord {
  client_id: string;
  resource: string;
  token_pair: TokenPair;
  expires_at: number;
}
'''
    auth = replace_once(auth, old, new, "refresh replay record")

if "private async buildTokenBundle" not in auth:
    old = '''  private async issueTokens(clientId: string, scope: string, resource: string): Promise<TokenPair> {
    const accessToken = randomToken(32);
    const refreshToken = randomToken(40);
    const now = Date.now();
    const access: AccessTokenRecord = {
      client_id: clientId,
      scope,
      resource,
      expires_at: now + ACCESS_TOKEN_TTL_MS,
    };
    const refresh: RefreshTokenRecord = {
      client_id: clientId,
      scope,
      resource,
      expires_at: now + REFRESH_TOKEN_TTL_MS,
    };
    await this.ctx.storage.put(await tokenKey("access", accessToken), access);
    await this.ctx.storage.put(await tokenKey("refresh", refreshToken), refresh);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope,
    };
  }
'''
    new = '''  private async buildTokenBundle(clientId: string, scope: string, resource: string): Promise<{
    pair: TokenPair;
    access_key: string;
    access_record: AccessTokenRecord;
    refresh_key: string;
    refresh_record: RefreshTokenRecord;
  }> {
    const accessToken = randomToken(32);
    const refreshToken = randomToken(40);
    const now = Date.now();
    const pair: TokenPair = {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope,
    };
    const access_record: AccessTokenRecord = {
      client_id: clientId,
      scope,
      resource,
      expires_at: now + ACCESS_TOKEN_TTL_MS,
    };
    const refresh_record: RefreshTokenRecord = {
      client_id: clientId,
      scope,
      resource,
      expires_at: now + REFRESH_TOKEN_TTL_MS,
    };
    const [access_key, refresh_key] = await Promise.all([
      tokenKey("access", accessToken),
      tokenKey("refresh", refreshToken),
    ]);
    return { pair, access_key, access_record, refresh_key, refresh_record };
  }

  private async issueTokens(clientId: string, scope: string, resource: string): Promise<TokenPair> {
    const bundle = await this.buildTokenBundle(clientId, scope, resource);
    await this.ctx.storage.put(bundle.access_key, bundle.access_record);
    await this.ctx.storage.put(bundle.refresh_key, bundle.refresh_record);
    return bundle.pair;
  }
'''
    auth = replace_once(auth, old, new, "issue token refactor")

if 'tokenKey("refresh-replay", input.refresh_token)' not in auth:
    old = '''  async refreshAccessToken(input: {
    refresh_token: string;
    client_id: string;
    resource: string;
  }): Promise<TokenPair> {
    const key = await tokenKey("refresh", input.refresh_token);
    const record = await this.ctx.storage.get(key) as RefreshTokenRecord | undefined;
    if (!record) throw new Error("invalid_grant");
    await this.ctx.storage.delete(key);
    if (record.expires_at <= Date.now()) throw new Error("invalid_grant");
    if (record.client_id !== input.client_id || record.resource !== input.resource) throw new Error("invalid_grant");
    return this.issueTokens(record.client_id, record.scope, record.resource);
  }
'''
    new = '''  async refreshAccessToken(input: {
    refresh_token: string;
    client_id: string;
    resource: string;
  }): Promise<TokenPair> {
    const key = await tokenKey("refresh", input.refresh_token);
    const replayKey = await tokenKey("refresh-replay", input.refresh_token);
    const now = Date.now();

    const cachedReplay = await this.ctx.storage.get(replayKey) as RefreshReplayRecord | undefined;
    if (cachedReplay && cachedReplay.expires_at > now) {
      if (cachedReplay.client_id !== input.client_id || cachedReplay.resource !== input.resource) {
        throw new Error("invalid_grant");
      }
      return cachedReplay.token_pair;
    }
    if (cachedReplay) await this.ctx.storage.delete(replayKey);

    const initial = await this.ctx.storage.get(key) as RefreshTokenRecord | undefined;
    if (!initial || initial.expires_at <= now) throw new Error("invalid_grant");
    if (initial.client_id !== input.client_id || initial.resource !== input.resource) throw new Error("invalid_grant");

    const bundle = await this.buildTokenBundle(initial.client_id, initial.scope, initial.resource);

    return this.ctx.storage.transaction(async (txn: any) => {
      const transactionNow = Date.now();
      const replay = await txn.get(replayKey) as RefreshReplayRecord | undefined;
      if (replay && replay.expires_at > transactionNow) {
        if (replay.client_id !== input.client_id || replay.resource !== input.resource) {
          throw new Error("invalid_grant");
        }
        return replay.token_pair;
      }
      if (replay) await txn.delete(replayKey);

      const record = await txn.get(key) as RefreshTokenRecord | undefined;
      if (!record || record.expires_at <= transactionNow) throw new Error("invalid_grant");
      if (record.client_id !== input.client_id || record.resource !== input.resource) throw new Error("invalid_grant");
      if (record.scope !== initial.scope) throw new Error("invalid_grant");

      const replayRecord: RefreshReplayRecord = {
        client_id: record.client_id,
        resource: record.resource,
        token_pair: bundle.pair,
        expires_at: transactionNow + REFRESH_REPLAY_TTL_MS,
      };

      await txn.delete(key);
      await txn.put(bundle.access_key, bundle.access_record);
      await txn.put(bundle.refresh_key, bundle.refresh_record);
      await txn.put(replayKey, replayRecord);
      return bundle.pair;
    });
  }
'''
    auth = replace_once(auth, old, new, "refresh rotation")

# Normalize formatting of quota release while touching this file.
auth = auth.replace(
'''  async releaseUsage(level: "standard" | "deep"): Promise<{ used: number; day: string }> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `usage:${day}:${level}`;
  const current = Number((await this.ctx.storage.get(key)) ?? 0);
  const next = Math.max(0, current - 1);
  if (next === 0) await this.ctx.storage.delete(key);
  else await this.ctx.storage.put(key, next);
  return { used: next, day };
}
''',
'''  async releaseUsage(level: "standard" | "deep"): Promise<{ used: number; day: string }> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `usage:${day}:${level}`;
    const current = Number((await this.ctx.storage.get(key)) ?? 0);
    const next = Math.max(0, current - 1);
    if (next === 0) await this.ctx.storage.delete(key);
    else await this.ctx.storage.put(key, next);
    return { used: next, day };
  }
''')
auth_path.write_text(auth)

index_path = Path("src/index.ts")
index = index_path.read_text()
index = index.replace('const VERSION = "0.5.4";', 'const VERSION = "0.5.5";', 1)

if "batched_review_calls_not_allowed" in index:
    old = '''  const messages = Array.isArray(body) ? body : [body];
  const levels = messages.map(reviewCallLevel).filter((level): level is "standard" | "deep" => level !== null);
  if (levels.length === 0) return null;
  if (levels.length > 1) {
    return Response.json({ error: "batched_review_calls_not_allowed" }, { status: 400 });
  }

  const level = levels[0];
  const limiter = level === "deep" ? env.DEEP_RATE_LIMITER : env.AUDIT_RATE_LIMITER;
  if (!limiter) return null;

  const { success } = await limiter.limit({ key: `review_strategy:${level}` });
  if (success) return null;

  return Response.json(
    { error: "rate_limit_exceeded", review_level: level },
    { status: 429, headers: { "Retry-After": "60" } },
  );
'''
    new = '''  const messages = Array.isArray(body) ? body : [body];
  const levels = messages.map(reviewCallLevel).filter((level): level is "standard" | "deep" => level !== null);
  if (levels.length === 0) return null;

  // MCP SDK v2 supports JSON-RPC batches. Meter every audit independently.
  for (const level of levels) {
    const limiter = level === "deep" ? env.DEEP_RATE_LIMITER : env.AUDIT_RATE_LIMITER;
    if (!limiter) continue;
    const { success } = await limiter.limit({ key: `review_strategy:${level}` });
    if (!success) {
      return Response.json(
        { error: "rate_limit_exceeded", review_level: level, batch_size: levels.length },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }
  return null;
'''
    index = replace_once(index, old, new, "batch rate limit")

index = index.replace(
'''      "WWW-Authenticate": `Bearer resource_metadata="${metadata}", scope="${OAUTH_SCOPE}"`,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Cache-Control": "no-store",
''',
'''      "WWW-Authenticate": `Bearer resource_metadata="${metadata}", scope="${OAUTH_SCOPE}"`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "WWW-Authenticate",
      "Cache-Control": "no-store",
''')

health_old = 'oauth: { enabled: true, owner_secret_configured: Boolean(env.OWNER_AUTH_SECRET), pkce: "S256" },'
health_new = 'oauth: { enabled: true, owner_secret_configured: Boolean(env.OWNER_AUTH_SECRET), pkce: "S256", refresh_replay_grace_seconds: 30 },\n        batch_review_calls: true,'
if "batch_review_calls: true" not in index:
    index = replace_once(index, health_old, health_new, "health concurrency flags")
index_path.write_text(index)

package_path = Path("package.json")
package = json.loads(package_path.read_text())
package["version"] = "0.5.5"
package.setdefault("scripts", {})["test:concurrency"] = "node scripts/verify-concurrency-contract.mjs"
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n")

lock_path = Path("package-lock.json")
lock = json.loads(lock_path.read_text())
lock["version"] = "0.5.5"
lock["packages"][""]["version"] = "0.5.5"
lock_path.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n")

contract_path = Path("scripts/verify-concurrency-contract.mjs")
contract_path.write_text('''import assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst auth = fs.readFileSync(new URL("../src/auth.ts", import.meta.url), "utf8");\nconst index = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");\n\nassert.match(auth, /REFRESH_REPLAY_TTL_MS = 30 \* 1000/);\nassert.match(auth, /tokenKey\\("refresh-replay", input\\.refresh_token\\)/);\nassert.match(auth, /storage\\.transaction\\(async \\(txn: any\\)/);\nassert.match(auth, /return replay\\.token_pair/);\nassert.doesNotMatch(index, /batched_review_calls_not_allowed/);\nassert.match(index, /batch_review_calls: true/);\nassert.match(index, /const VERSION = "0\\.5\\.5"/);\nconsole.log("concurrency contract checks passed");\n''')

ci_path = Path(".github/workflows/ci.yml")
ci = ci_path.read_text()
if "npm run test:concurrency" not in ci:
    ci = replace_once(
        ci,
        "      - run: npm run type-check\n",
        "      - run: npm run type-check\n      - run: npm run test:concurrency\n",
        "CI concurrency test",
    )
ci_path.write_text(ci)

print("concurrency patch applied")
