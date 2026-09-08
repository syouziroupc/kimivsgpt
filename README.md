# Kimi vs GPT — Answer Auditor

A compact second-opinion layer for complex ChatGPT/Codex answers.

The primary model still researches, reasons, writes, and codes. This project gives it one short independent critique before the final answer, aimed at reducing anchoring and unsupported conclusions without paying for a second full solution.

## Live deployment

- Canonical Worker: `https://kimivsgpt.syouziroupc.workers.dev`
- MCP: `https://kimivsgpt.syouziroupc.workers.dev/mcp`
- Current Worker target version: `0.3.2`
- Canonical Cloudflare account: `Syouziroupc@gmail.com's Account`
- Canonical Cloudflare project is the GitHub-linked `kimivsgpt` Worker.
- Production Cloudflare credentials are centralized in the CPCV repository `production` environment.
- The duplicate `kimi-vs-gpt-auditor` Worker was removed after end-to-end MCP verification succeeded on the canonical Worker.

TalkSys and this auditor use the same CPCV `production` Cloudflare account. The CPCV workflow verifies the authenticated account name with `wrangler whoami` before deployment and aborts if it is not the canonical account.

## Architecture

1. ChatGPT/Codex prepares a compressed review packet.
2. The plugin calls the Cloudflare Worker over MCP (`/mcp`).
3. Standard review uses GLM-5.3 Flash.
4. High-stakes review can explicitly use Kimi K2.6.
5. The critic returns at most three short issues; it never writes the final answer or code.
6. The primary model checks those objections against evidence and finalizes its own answer.

## Cost controls

- Standard model: `@cf/zai-org/glm-5.3-flash`.
- Deep model: `@cf/moonshotai/kimi-k2.6`.
- `deep` is reserved for materially high-stakes or unusually disputed decisions.
- Completion cap: 360 tokens.
- Review packet hard cap: 5,000 characters.
- Individual input fields have strict size limits.
- One review call per substantive answer by default.
- No transcript dumps, codebase dumps, delegated coding, research, or replacement answers.
- Standard review uses one model call. Minor output-schema variation is normalized locally rather than retried.
- Kimi is not used merely because a task is long.
- Cloudflare rate limit: standard reviews 30/minute; deep/Kimi reviews 3/minute. MCP initialization and tool listing are not counted.

Cloudflare model overrides are available through Worker environment variables:

- `AUDITOR_MODEL_STANDARD`
- `AUDITOR_MODEL_DEEP`

## Local setup

```bash
npm install
npm run audit
npm run type-check
npm run build-check
npm run dev
```

The Worker needs the Workers AI binding named `AI`; rate-limit bindings are declared in `wrangler.jsonc`.

## Production deployment

Production deployment is owned by `syouziroupc/CPCV/.github/workflows/deploy-kimivsgpt.yml` and uses the CPCV `production` environment credentials. The target Worker name is `kimivsgpt`, matching the GitHub-linked Cloudflare project. Do not add a second Cloudflare API token/account ID or alternate production Worker to this repository.

The checked-in plugin dependency points to the canonical live MCP URL.

## Authentication

The Worker supports an optional temporary access-key guard. If the Cloudflare secret `AUDITOR_ACCESS_KEY` is configured, `/mcp` accepts either an `Authorization: Bearer <key>` header or a matching `?key=<key>` query parameter. If the secret is absent, `/mcp` is public.

The temporary key guard is intended only for controlled testing. The production target should ultimately use an MCP-compatible OAuth flow or another authentication mechanism supported by the ChatGPT MCP connection rather than embedding a long-lived secret in a public URL. Rate limiting remains enabled as a separate cost-abuse guard.

## Plugin behavior

The skill is intentionally broad for complex work: multi-step research, analysis, troubleshooting, planning, comparisons, consequential recommendations, and architecture/implementation-plan decisions should receive one compact review before the final answer. Simple chat, deterministic calculations, straightforward rewriting/translation, and purely creative tasks skip the external review.

Normal ChatGPT skill invocation is model-selected, so the skill can strongly encourage review across complex chats but cannot guarantee that every eligible response invokes the tool. A custom API orchestration can enforce the tool when strict invocation is required.

## Security and dependency checks

`npm audit --omit=dev` reported zero production dependency vulnerabilities on 2026-09-08. CI runs `npm audit`, TypeScript checking, and Wrangler dry-run validation on every push and pull request.
