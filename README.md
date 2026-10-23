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

The critics never write the user's final answer, performs the primary research, generates a full code implementation, or receives hidden chain-of-thought.

## Independent high-capability multi-model review (draft PR only)

This PR changes the proposed low-cost small-model roster into a **diverse high-capability ensemble**. It does not modify the deployed `main` Worker.

- Standard (three simultaneous independent critics): Kimi K2.6 (adversarial challenge), GLM-5.3 (alternatives), GPT-OSS 120B (technical/logical issues).
- Deep (five simultaneous independent critics): the three Standard models plus DeepSeek V4 Pro 0813 (evidence/counterargument) and Nemotron 3 120B-A12B (constraints/edge cases).
- The models receive the same compact original evidence and their peers' opinions are never forwarded. Individual `perspectives` are retained even if a reviewer fails. They are **not** votes and disagreement is not discarded.
- Existing one-call MCP API, authentication, legacy rollback mode, six-field response, input guard (2,400 compact characters), and per-model output cap (200 tokens) remain unchanged.
- Each critic reports at most one material issue, which is retained in `perspectives`. The legacy top-level response still has up to three issues; consumers needing all five must read `perspectives`.
- Token usage, latency and estimated variable inference cost are logged when available. Actual bills, latency and model critique accuracy require live tests. Heavy models may need tuning of timeouts and output protocol prior to release.
- **Do not merge or deploy until** live endpoint/schema tests, budget checks, no-loss perspective tests, and the existing vulnerable-dependency audit blocker pass.

Official model IDs and current prices: https://developers.cloudflare.com/workers-ai/platform/pricing/

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
