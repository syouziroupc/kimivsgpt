# Kimi vs GPT — Answer Auditor

A compact second-opinion layer for complex ChatGPT/Codex answers.

The primary model still researches, reasons, writes, and codes. This project only gives it a short independent critique before the final answer, aimed at reducing anchoring and unsupported conclusions without paying for a second full solution.

## Architecture

1. ChatGPT/Codex prepares a compressed review packet.
2. The plugin calls the Cloudflare Worker over MCP (`/mcp`).
3. Standard review uses GLM-5.3 Flash.
4. High-stakes review can explicitly use Kimi K2.6.
5. The critic returns at most four short issues; it never writes the final answer or code.
6. The primary model checks those objections against evidence and finalizes its own answer.

## Cost controls

- Standard model: `@cf/zai-org/glm-5.3-flash`.
- Deep model: `@cf/moonshotai/kimi-k2.6`.
- `deep` is reserved for materially high-stakes or unusually disputed decisions.
- Completion cap: 500 tokens.
- Input fields have strict size limits.
- One review call per substantive answer by default.
- No transcript dumps, codebase dumps, or delegated coding/research.

Cloudflare model overrides are available through Worker environment variables:

- `AUDITOR_MODEL_STANDARD`
- `AUDITOR_MODEL_DEEP`

## Local setup

```bash
npm install
npm run type-check
npm run dev
```

MCP endpoint: `http://localhost:8787/mcp` (or the port printed by Wrangler).
Health endpoint: `/health`.

## Cloudflare deploy

```bash
npm run deploy
```

The Worker needs the Workers AI binding named `AI`; this is already declared in `wrangler.jsonc`.

After deployment, set the real MCP URL in the plugin:

```bash
node configure-plugin.mjs https://<worker>.workers.dev/mcp
```

Then commit the updated `openai.yaml`.

## GitHub Actions

- `ci.yml` runs TypeScript checks on pushes/PRs.
- `deploy.yml` is manual only. To use it, add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, then run the workflow.

## Current security note

The MVP MCP endpoint is unauthenticated. Do not publish/deploy it broadly until an authentication layer or a suitably restrictive access control is added; otherwise anyone who discovers the endpoint could consume Workers AI usage. Authentication is intentionally the next deployment step rather than hard-coding a secret into this public repository.
