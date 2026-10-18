# Model and cost policy

## Current default: independent heterogeneous ensemble

Standard: Qwen3-30B-A3B-FP8 (evidence/logic) + GLM-4.7-Flash
(alternatives). Deep: Qwen3-30B-A3B-FP8 + Gemma-4-26B-A4B-IT
(constraints/counterexamples) + GPT-OSS-20B (technical/security).

Models are Cloudflare Workers AI model IDs and are each called once in
parallel. The aggregation code is deterministic; there is no paid
synthesis-model call or automatic frontier-model fallback.

Every reviewer has a bounded output, and review packets are rejected above
5,000 serialized characters. All perspectives are kept as optional structured
data alongside the original six result fields. Missing opinions remain missing.

The legacy Kimi/GLM sequential approach is available *only* via
`AUDITOR_MODE=legacy`. The production entrypoint remains
`src/index-reliable.ts`. OAuth and MCP tool names are unchanged.

Do not equate output caps to actual billed output. Log actual token use
when available, monitor Cloudflare Neurons and measure paired quality
and cost before asserting a percentage saving.

Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
