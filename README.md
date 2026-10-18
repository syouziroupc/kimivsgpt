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

## Independent multi-model reviews and bounded inference cost

The active entrypoint remains `src/index-reliable.ts`; three independent
reviewers begin in parallel for both standard and deep modes. Reviewers do not
see or debate one another's output. Responses preserve the existing MCP
`review_strategy` six-field result and add optional per-model `perspectives`.

**Standard:** Qwen3-30B-A3B-FP8 (evidence), GLM-4.7 Flash (alternatives),
IBM Granite 4.0 H Micro (explicit constraints).
**Deep:** Qwen3-30B-A3B-FP8, Gemma 4 26B A4B IT, GPT-OSS 20B.

The cost-saving pipeline uses **no fourth model or secondary compression API**:

1. Accept the same public review packet; validate its original 5,000-character
   upper bound and keep every populated field unchanged.
2. Convert field names to short local aliases (`u,d,k,a,e,c,x`) and omit
   empty optional arrays. This operation preserves all supplied content.
3. Reject a compact packet exceeding **2,400 characters before launching any
   inference**. Do not silently cut claims, constraints, or evidence. Return
   an explicit no-inference cost-guard verdict.
4. Run three independent critics simultaneously. A brief system instruction
   requests one material finding using `{v,t,f,q}` and a **200-token maximum
   generated output per critic**.
5. Convert small-model responses locally into the original audit shape;
   missing/malformed output becomes an unavailable perspective, never a
   manufactured agreement. Do not automatically retry or escalate to Kimi.
6. Log model ID, reported input/output token usage, elapsed time and
   an estimated USD variable inference cost when usage data is provided.
   Never log user prompts or private evidence. Cloudflare daily free
   Neuron allowances and other service fees are outside this estimate.

The explicit `AUDITOR_MODE=legacy` switch remains for comparison/rollback;
it is not part of the normal low-cost review path. OAuth, `/mcp`, Worker
request deadlines, the original six fields, and the one-host-call workflow
are unchanged.

**Illustrative price comparison (NOT a measured bill).** If a review formerly
used 1,500 input/150 output tokens per critic and compression achieves 1,300/90,
Cloudflare model rates give standard $0.0003198 → $0.00024328 (23.9% lower),
and deep $0.00066675 → $0.00054045 (18.9% lower). Actual tokenization,
JSON completion rate, free allowances, and model quality still require
live observation. Neither a character cap nor `max_tokens` alone guarantees
a monetary amount.

Official unit prices: https://developers.cloudflare.com/workers-ai/platform/pricing/
Tests: `npm run test:ensemble:behavior`, `npm run test:compression`,
`npm run type-check`, `npm run build-check`.

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
