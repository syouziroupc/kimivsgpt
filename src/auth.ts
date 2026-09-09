import { DurableObject } from "cloudflare:workers";

export const OAUTH_SCOPE = "auditor:review";
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const CLIENT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface RegisteredClient {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  application_type: "native" | "web";
  created_at: number;
  expires_at: number;
}

interface AuthorizationCodeRecord {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource: string;
  expires_at: number;
}

interface AccessTokenRecord {
  client_id: string;
  scope: string;
  resource: string;
  expires_at: number;
}

interface RefreshTokenRecord {
  client_id: string;
  scope: string;
  resource: string;
  expires_at: number;
}

export interface TokenPair {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function randomToken(bytes = 32): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function tokenKey(prefix: string, token: string): Promise<string> {
  return `${prefix}:${await sha256Base64Url(token)}`;
}

function isAllowedRedirectUri(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol === "https:") return true;
    if (u.protocol !== "http:") return false;
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]" || u.hostname === "::1";
  } catch {
    return false;
  }
}

export class AuthState extends DurableObject {
  constructor(ctx: any, env: any) {
    super(ctx, env);
  }

  async registerClient(input: {
    client_name?: string;
    redirect_uris: string[];
    token_endpoint_auth_method?: string;
    application_type?: string;
  }): Promise<RegisteredClient> {
    const redirectUris = Array.from(new Set(input.redirect_uris ?? [])).slice(0, 10);
    if (redirectUris.length === 0 || redirectUris.some((uri) => !isAllowedRedirectUri(uri))) {
      throw new Error("invalid_redirect_uris");
    }
    if (input.token_endpoint_auth_method && input.token_endpoint_auth_method !== "none") {
      throw new Error("unsupported_token_endpoint_auth_method");
    }
    const applicationType = input.application_type === "web" ? "web" : "native";
    const now = Date.now();
    const client: RegisteredClient = {
      client_id: `mcp_${randomToken(24)}`,
      client_name: String(input.client_name ?? "MCP Client").slice(0, 120),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      application_type: applicationType,
      created_at: now,
      expires_at: now + CLIENT_TTL_MS,
    };
    await this.ctx.storage.put(`client:${client.client_id}`, client);
    return client;
  }

  async getClient(clientId: string): Promise<RegisteredClient | null> {
    const client = await this.ctx.storage.get(`client:${clientId}`) as RegisteredClient | undefined;
    if (!client) return null;
    if (client.expires_at <= Date.now()) {
      await this.ctx.storage.delete(`client:${clientId}`);
      return null;
    }
    return client;
  }

  async createAuthorizationCode(input: {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    scope: string;
    resource: string;
  }): Promise<string> {
    const code = randomToken(32);
    const record: AuthorizationCodeRecord = {
      ...input,
      expires_at: Date.now() + AUTH_CODE_TTL_MS,
    };
    await this.ctx.storage.put(await tokenKey("code", code), record);
    return code;
  }

  private async issueTokens(clientId: string, scope: string, resource: string): Promise<TokenPair> {
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

  async exchangeAuthorizationCode(input: {
    code: string;
    client_id: string;
    redirect_uri: string;
    code_verifier: string;
    resource: string;
  }): Promise<TokenPair> {
    const key = await tokenKey("code", input.code);
    const record = await this.ctx.storage.get(key) as AuthorizationCodeRecord | undefined;
    if (!record) throw new Error("invalid_grant");
    await this.ctx.storage.delete(key);
    if (record.expires_at <= Date.now()) throw new Error("invalid_grant");
    if (record.client_id !== input.client_id || record.redirect_uri !== input.redirect_uri) throw new Error("invalid_grant");
    if (record.resource !== input.resource) throw new Error("invalid_target");
    if (!input.code_verifier || input.code_verifier.length < 43 || input.code_verifier.length > 128) throw new Error("invalid_grant");
    const challenge = await sha256Base64Url(input.code_verifier);
    if (challenge !== record.code_challenge) throw new Error("invalid_grant");
    return this.issueTokens(record.client_id, record.scope, record.resource);
  }

  async refreshAccessToken(input: {
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

  async validateAccessToken(token: string, resource: string): Promise<boolean> {
    const key = await tokenKey("access", token);
    const record = await this.ctx.storage.get(key) as AccessTokenRecord | undefined;
    if (!record) return false;
    if (record.expires_at <= Date.now()) {
      await this.ctx.storage.delete(key);
      return false;
    }
    return record.resource === resource && record.scope.split(/\s+/).includes(OAUTH_SCOPE);
  }

  async checkUsage(level: "standard" | "deep", limit: number): Promise<{ allowed: boolean; used: number; limit: number; day: string }> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `usage:${day}:${level}`;
  const current = Number((await this.ctx.storage.get(key)) ?? 0);
  return { allowed: current < limit, used: current, limit, day };
}

  async consumeUsage(level: "standard" | "deep", limit: number): Promise<{ allowed: boolean; used: number; limit: number; day: string }> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `usage:${day}:${level}`;
    const current = Number((await this.ctx.storage.get(key)) ?? 0);
    if (current >= limit) return { allowed: false, used: current, limit, day };
    const next = current + 1;
    await this.ctx.storage.put(key, next);
    return { allowed: true, used: next, limit, day };
  }
}
