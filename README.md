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

## Cost controls

- Primary panel: DeepSeek V4.1 Flash, Gemma 4, Mistral Small 3.1, Llama 4 Scout. Independent reserves: GLM-5.3 (frontier) and Qwen3.8 27B (economy).
- Four independent validated votes required: >=1 frontier and >=3 economy. Reserves start immediately on failure or after 5.5 seconds if their tier is short; at most six inference calls. Return at quorum without waiting for redundant slow calls, or return explicit partial coverage at the deadline. No model is retried; late completions cannot mutate a returned result. In-flight provider calls may still incur charges.
- Absolute request budget: 24.5s inference, 28s MCP; per-model cap 23s. Compact output, low reasoning on frontier models for both tiers, strict validation; no synthetic votes or averaging self-reported confidence.
- The schema-valid packet is retained in full; every obtained vote is available in model_reviews. Coverage failure never passes. Dissent among collected votes remains visible.

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


## Actual artifact visual audit (experimental)

Existing text review is unchanged. A separate authenticated MCP tool, review_visual_page, receives one PNG/JPEG render and a source artifact SHA-256, page number/count, requirements, and optional extracted text/structural findings. The tool advertises openai/fileParams; it accepts only trusted oaiusercontent.com HTTPS file URLs, no redirects, bounded size. Host support for transferring generated files must be verified. The authenticated POST /visual endpoint accepts the same metadata with image_base64 for a local producer; it uses the existing OAuth or owner API bearer, never the owner login passphrase. No image storage or extra fixed infrastructure.

Gemma 4 and Llama 4 Scout receive the actual image; Qwen is a bounded reserve for failures/slow calls. Other reviewers never receive the image. Two distinct valid visual votes are required, any observed revise blocks approval, and missing votes or unreadable content fail closed. Page hash is computed on received bytes. No visual review proves perfect correctness.

Local producer: install LibreOffice, Python packages pymupdf Pillow playwright and Chromium (playwright install chromium); then use scripts/audit-artifact.py with a valid AUDITOR_ACCESS_TOKEN environment variable, input file, --requirements and --output. PPTX hidden slides are exported and slide count is checked against rendered PDF; PDF/DOCX/ODT/ODP render automatically. HTML/SVG captures offline desktop/mobile; external resources require producer renders. XLSX/ODS use LibreOffice SinglePageSheets (ignores print ranges and hidden status) and verify sheet count; very large sheets require an explicitly verified range render manifest. PNG/JPEG and single-frame images are supported. Other formats can supply a trusted producer manifest. The manifest contains artifact_sha256, page_count, pages with sequential page, image path, image_sha256, extracted_text and structural_findings. For non-PPTX manifests, the producer must independently verify complete coverage. Office renderer/font differences remain possible. No automatic claim of support for inaccessible ChatGPT sandbox files.

Release 0.12.0 adds real multi-format render fixtures in CI and an authenticated production visual proof. The latter requires two independent models to read an image-only random code and flag a visible forbidden red rectangle. This is a basic smoke test, not a claim of perfect visual detection. The /health response advertises the visual audit capability.
