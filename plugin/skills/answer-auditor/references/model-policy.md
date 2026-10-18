# Model, input compression and inference cost policy

## Three independent critics

Standard: Qwen3-30B-A3B-FP8, GLM-4.7-Flash, Granite-4.0-H-Micro.
Deep: Qwen3-30B-A3B-FP8, Gemma-4-26B-A4B-IT, GPT-OSS-20B.
All three start concurrently, exactly once each, and see only the same
independent packet. Preserve individual perspectives; never imply consensus
when a reviewer is unavailable.

## Lossless transport compression

Client-facing `review_strategy` fields and result schema are unchanged.
The Worker converts supplied fields to shorter aliases (`u,d,k,a,e,c,x`)
and omits empty optional arrays before sending the packet to the three models.
It does not paraphrase, truncate or drop populated fields or use another model
to compress content.

The compressed packet has a hard **2,400-character pre-inference limit**.
An over-budget packet yields an explicit `verify` result with zero AI calls,
not a silently incomplete review. The original tool packet still must satisfy
its 5,000-character input validation.

Critics return at most one material issue in compact JSON `{v,t,f,q}`,
with a **200 output-token cap per model**. The Worker locally restores
the previous six-field response schema and adds optional `perspectives`.
Invalid or incomplete criticisms are marked unavailable rather than guessed.
The default path never automatically calls Kimi or another expensive model.
Manual `AUDITOR_MODE=legacy` keeps the old path for comparison.

Model-level usage logs include input/output tokens, latency and an estimated
variable inference amount using current price constants; logs omit prompt text.
A price estimate does not include Cloudflare free Neurons, extra Workers
charges, or future changes to model rates. Check the actual dashboard before
claiming a reduction.

Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
Prompt caching: https://developers.cloudflare.com/workers-ai/features/prompt-caching/
