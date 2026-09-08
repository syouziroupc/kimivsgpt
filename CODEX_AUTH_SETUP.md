# Codex task: finish private owner-only Kimi vs GPT authentication

Use this runbook from a **local Windows Codex host** (Codex desktop/CLI/IDE), not from an untrusted remote shell. The goal is to make the remote MCP callable by this Windows user while keeping Workers AI inaccessible to everyone else.

## Non-negotiable constraints

- Do not publish the plugin while owner OAuth is unverified.
- Do not remove OAuth, the 401 challenge, rate limits, or daily caps to make setup easier.
- Never commit, print, echo, upload, or paste `OWNER_AUTH_SECRET` into GitHub, chat, logs, issue bodies, or config files.
- Standard review is allowed for the final smoke test. Do **not** run a deep/Kimi review merely as a test unless the user explicitly asks; deep calls cost more.
- Keep daily hard caps at or below 100 standard reviews/day and 5 deep reviews/day unless the user explicitly changes them.
- The MCP URL is `https://kimivsgpt.syouziroupc.workers.dev/mcp`.

## 1. Update and validate the repository

```powershell
git pull
npm install
npm run audit
npm run type-check
npm run build-check
```

Do not continue if validation fails. Fix the actual defect rather than bypassing checks.

## 2. Enroll the owner secret in Cloudflare

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-owner-auth.ps1
```

The script:

1. verifies Wrangler authentication and opens `wrangler login` when needed;
2. generates a cryptographically random 48-byte owner passphrase locally;
3. stores only a DPAPI-encrypted copy under the current Windows profile;
4. pipes the plaintext directly to `wrangler secret put OWNER_AUTH_SECRET --name kimivsgpt`;
5. verifies `/health` reports `owner_secret_configured: true`.

The plaintext must never be printed.

## 3. Install the shared MCP configuration

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-codex-mcp.ps1
```

This writes a managed block to `~/.codex/config.toml`:

```toml
[mcp_servers.kimivsgpt]
url = "https://kimivsgpt.syouziroupc.workers.dev/mcp"
auth = "oauth"
required = false
enabled_tools = ["review_strategy"]
default_tools_approval_mode = "approve"
tool_timeout_sec = 45
```

OpenAI documents that the ChatGPT desktop app, Codex CLI, and Codex IDE extension share MCP configuration on the same Codex host.

## 4. Complete OAuth login

Immediately before starting login, copy the DPAPI-protected owner passphrase to the Windows clipboard:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\copy-owner-secret.ps1
```

Then run:

```powershell
codex mcp login kimivsgpt
```

Expected flow:

1. Codex discovers the protected-resource and authorization-server metadata.
2. Codex dynamically registers a localhost/loopback callback client.
3. A browser opens the Kimi vs GPT owner login page.
4. Paste the owner passphrase from the clipboard into **that page only**.
5. OAuth redirects to the local Codex callback and stores OAuth credentials.
6. Clear the clipboard immediately:

```powershell
Set-Clipboard -Value ""
```

If the browser does not open automatically, inspect `codex mcp login kimivsgpt` output and use the authorization URL it provides. Do not substitute a static bearer token unless debugging the server locally.

## 5. Verify Codex connectivity without Kimi

Run:

```powershell
codex mcp list
```

Then open Codex and use `/mcp`. Confirm `kimivsgpt` is connected and exposes only `review_strategy`.

Perform **one standard review** on a short synthetic planning example. Confirm the returned result is compact structured critique. Do not use `review_level=deep` for this smoke test.

## 6. Verify isolation

From a shell with no stored OAuth credentials, confirm an unauthenticated MCP request returns HTTP 401 and a `WWW-Authenticate` challenge. Do not send the owner passphrase in headers or query parameters.

Verify `/health` still reports:

- version `0.5.x` or later;
- OAuth enabled;
- owner secret configured;
- PKCE `S256`;
- standard daily limit <= 100;
- deep daily limit <= 5.

## 7. Try the ChatGPT desktop shared-host path

Fully exit and restart ChatGPT Desktop after Codex OAuth succeeds. Open the MCP/plugin tooling available on that desktop build and check whether `kimivsgpt` is now visible from the shared Codex host configuration.

OpenAI's current MCP documentation states that ChatGPT desktop, Codex CLI, and the IDE extension share MCP configuration on the same host. If this specific ChatGPT Plus build still does not surface the server, record the exact app version and observed UI/log behavior and continue debugging the desktop integration. **Do not respond by publishing an unauthenticated plugin.**

## 8. Plugin behavior

The desired behavior is not “use Kimi for everything.” The primary model does the task. Before finalizing a substantive complex answer, `review_strategy` receives a compressed direction/claims/evidence packet and returns a terse adversarial check.

Default to `standard`. Use `deep` only for materially consequential, unusually disputed, or high-risk judgments. Never delegate coding, research, or full answer drafting to the auditor.

## Failure policy

If OAuth discovery, PKCE, DCR, token exchange, or ChatGPT/Codex integration fails:

1. inspect the exact protocol exchange;
2. fix the implementation or client configuration;
3. preserve owner-only authentication and cost caps;
4. rerun non-AI OAuth tests first;
5. use at most one standard AI call for the final end-to-end smoke test.
