# Model and cost policy

## Current default: independent heterogeneous ensemble

Standard (three critics): Qwen3-30B-A3B-FP8 (evidence/logic) +
GLM-4.7-Flash (alternatives) + IBM Granite-4.0-H-Micro
(explicit constraints). Deep (three critics): Qwen3-30B-A3B-FP8 +
Gemma-4-26B-A4B-IT (constraints/counterexamples) +
GPT-OSS-20B (technical/security).

Each of the three independent reviewers uses a different Cloudflare Workers AI model ID. All three start concurrently (Promise.allSettled), never in a series or as a replacement for another review. The aggregation code is deterministic; there is no paid
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
