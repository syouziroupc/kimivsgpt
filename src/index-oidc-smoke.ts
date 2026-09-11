import resilientHandler, { AuthState } from "./index-resilient";

export { AuthState };

const EXPECTED_ISSUER = "https://token.actions.githubusercontent.com";
const EXPECTED_AUDIENCE = "kimivsgpt-hotfix-smoke";
const EXPECTED_REPOSITORY = "syouziroupc/kimivsgpt";
const EXPECTED_REF = "refs/heads/main";

function b64urlBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function b64urlJson(value: string): any {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(value)));
}

async function verifyGitHubOidc(jwt: string): Promise<boolean> {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;
    const header = b64urlJson(parts[0]);
    const claims = b64urlJson(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return false;
    const now = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== EXPECTED_ISSUER || !aud.includes(EXPECTED_AUDIENCE)) return false;
    if (claims.repository !== EXPECTED_REPOSITORY || claims.ref !== EXPECTED_REF) return false;
    if (typeof claims.exp !== "number" || claims.exp < now || (typeof claims.nbf === "number" && claims.nbf > now + 30)) return false;

    const jwksResponse = await fetch("https://token.actions.githubusercontent.com/.well-known/jwks");
    if (!jwksResponse.ok) return false;
    const jwks = await jwksResponse.json() as { keys?: JsonWebKey[] };
    const jwk = jwks.keys?.find((key: any) => key.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      const oidc = request.headers.get("x-github-oidc") || "";
      if (oidc && await verifyGitHubOidc(oidc)) {
        const headers = new Headers(request.headers);
        headers.delete("x-github-oidc");
        headers.set("authorization", "Bearer github-oidc-smoke");
        const forwarded = new Request(request, { headers });
        return resilientHandler.fetch(forwarded, { ...env, AUDITOR_ACCESS_KEY: "github-oidc-smoke" }, ctx);
      }
    }
    return resilientHandler.fetch(request, env, ctx);
  },
};
