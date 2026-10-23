# High-capability ensemble and inference cost policy

## Independent critics (proposed PR)

Standard: Kimi K2.6, GLM-5.3, GPT-OSS 120B.
Deep: Standard three plus DeepSeek V4 Pro 0813 and Nemotron 3 120B-A12B.
All three or five start concurrently, independently, from the same compact review packet. A reviewer's output is never shown to another reviewer. Model diversity and improved problem detection must be measured rather than assumed.

## Compatibility and reliability

Preserve the public review input and six original audit result fields. Preserve all per-model `perspectives` including unavailable statuses. The top-level issues field retains its legacy maximum of three items; per-model results are authoritative for observing all five independent criticisms. No majority voting and no silent substitution for failed reviewers.
Keep `AUDITOR_MODE=legacy` rollback. Remain a draft until live model outputs, structured parsing, actual latency, variable costs, and CI dependency-audit checks have been verified.

## Cost controls

Keep compact transport aliases `u,d,k,a,e,c,x` and all populated evidence/constraints, rejecting packets exceeding 2,400 compact characters before launching inference. Each model is capped at 200 output tokens and reports a single highest-value issue via `{v,t,f,q}`. The short response contract needs live validation per large model. Never log customer prompt or evidence. Usage-based USD amounts exclude free Neurons and unrelated charges. Monitor model failures and costs by model ID.

Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
