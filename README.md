# Kimi vs GPT — Answer Auditor

A ChatGPT/Codex plugin that adds one compact second-opinion check before complex answers. The primary model still researches, reasons, writes, and codes; the external critic only flags material weaknesses such as anchoring, unsupported assumptions, missing alternatives, stale facts, violated constraints, scope drift, and overconfidence.

## Current status

- Plugin package version: `0.4.0`
- Canonical Worker: `https://kimivsgpt.syouziroupc.workers.dev`
- MCP: `https://kimivsgpt.syouziroupc.workers.dev/mcp`
- Canonical Cloudflare project: GitHub-linked `kimivsgpt`
- Duplicate Worker removed after migration verification
- Production Cloudflare credentials centralized in the CPCV repository `production` environment
- End-to-end verified on 2026-09-08: Worker health, MCP initialize, tools/list, all three tool annotations, and one real standard Workers AI review call

## Plugin composition

The plugin intentionally combines two layers:

1. `skills/answer-auditor/SKILL.md` decides when a complex task merits review and defines the compact review workflow.
2. `.mcp.json` points to the Cloudflare MCP server that executes the independent critic.

When the external `review_strategy` tool is unavailable on a product surface, the skill must not pretend an external review happened. It falls back to a short internal counter-check instead.

## Review policy

Review complex work such as multi-step analysis, research, troubleshooting with competing causes, planning, comparisons, consequential recommendations, challenged prior conclusions, and architecture/implementation-plan decisions.

Skip trivial chat, deterministic calculations, straightforward rewriting/translation, simple verified lookups, and purely creative generation.

The critic never writes the user's final answer, performs the primary research, generates a full code implementation, or receives hidden chain-of-thought.

## Independent multi-model review and cost controls

The active Worker entrypoint is `src/index-reliable.ts`, which delegates to
`src/index-resilient.ts`. The reviewer now uses **independent parallel reviews**
instead of returning the first valid result in a sequential expensive fallback chain.

- Standard: `@cf/qwen/qwen3-30b-a3b-fp8` (logic/evidence) and
  `@cf/zai-org/glm-4.7-flash` (alternatives and blind spots).
- Deep: `@cf/qwen/qwen3-30b-a3b-fp8`,
  `@cf/google/gemma-4-26b-a4b-it`, and
  `@cf/openai/gpt-oss-20b`.
- All reviewers receive the same bounded review packet, run once in parallel,
  and must produce compact structured feedback.
- Deterministic aggregation prioritizes material risks without letting
  reviewers read or influence one another's opinions.
- `perspectives` is an optional additive output field exposing each
  independent review and marking failed or unavailable members explicitly.
- An unavailable member never becomes a fictitious vote. Remaining results
  are marked partial; an all-failed run returns the existing safe fallback.
- No Kimi or other paid-frontier-model escalation on the default path.
  Set `AUDITOR_MODE=legacy` only for controlled comparison/rollback.
- Existing OAuth, `/mcp`, input packet, six standard output fields,
  packet-size validation and server request deadlines are preserved.
- The actual invoice depends on input/output tokens and model usage.
  Model-level telemetry records latency and available token usage without
  request contents. Verify price/quality against real production traces
  before claiming measured savings.

Relevant pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/

## Try as a local personal plugin on Windows

The repository contains:

- `install-local.cmd` — double-click wrapper
- `install-local.ps1` — installer

The installer copies the plugin into `%USERPROFILE%\.codex\plugins\kimi-vs-gpt-auditor` and creates/updates `%USERPROFILE%\.agents\plugins\marketplace.json` without deleting unrelated personal plugins.

After installation, fully quit ChatGPT Desktop and reopen it, then check Plugins for the personal marketplace / Kimi vs GPT Answer Auditor.

Local ChatGPT product support for bundled remote MCP execution can vary by product surface and plan. The plugin therefore includes the explicit internal-review fallback described above. Do not claim the external model ran unless `review_strategy` was actually available and called.

## Public plugin submission

The repository includes the material required to prepare a public **skills + MCP** plugin submission:

- `plugin/.codex-plugin/plugin.json`
- `plugin/.mcp.json`
- `plugin/skills/answer-auditor/`
- `PRIVACY.md`
- `TERMS.md`
- `submission/test-cases.md`
- `submission/submission-checklist.md`

The Worker also has a `/.well-known/openai-apps-challenge` route ready for the domain-verification token supplied by the OpenAI submission portal. Until a token is configured, that route returns 404.

Manual publisher steps that cannot be completed from this repository include selecting/verifying the OpenAI Platform publisher identity and submitting/publishing through the submission portal.

## Tool metadata

`review_strategy` is correctly declared as:

- `readOnlyHint: true`
- `openWorldHint: false`
- `destructiveHint: false`

It returns only a compact critique and does not modify external state.

## Development

```bash
npm install
npm run audit
npm run type-check
npm run build-check
npm run dev
```

The Worker uses the Workers AI binding `AI`; rate-limit bindings are declared in `wrangler.jsonc`.

Production deployment is owned by `syouziroupc/CPCV/.github/workflows/deploy-kimivsgpt.yml` and targets the canonical GitHub-linked `kimivsgpt` Worker.

## Security

`npm audit --omit=dev` reported zero production dependency vulnerabilities on 2026-09-08. CI validates dependency audit, TypeScript, Wrangler dry-run bundling, plugin JSON, and the Windows PowerShell installer syntax.
