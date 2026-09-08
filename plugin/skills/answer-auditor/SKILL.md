---
name: answer-auditor
description: Use a compact independent review before finalizing complex factual, analytical, research, troubleshooting, planning, recommendation, comparison, coding-plan, or consequential judgment tasks. Prefer the external review_strategy tool when available; otherwise perform a concise internal counter-check without claiming external review occurred. Skip trivial chat, simple rewriting/translation, deterministic arithmetic, and purely creative requests.
---

# Answer Auditor

For complex tasks, review the proposed direction once before committing to the final answer.

## Trigger

Treat a task as complex when one or more apply:
- it needs multi-step analysis or several tool calls;
- current external facts materially affect the answer;
- competing explanations, options, or tradeoffs exist;
- troubleshooting has multiple plausible causes;
- the answer recommends a consequential action;
- the user challenges a prior conclusion or asks for rigorous re-evaluation;
- a coding task requires architectural or implementation-plan judgment.

Do not invoke for greetings, simple factual lookups with one unambiguous verified answer, deterministic calculations, straightforward rewriting/translation, or purely creative generation.

## External review when available

If `review_strategy` is available, call it once before the final answer. The external critic is advisory, not an authority.

Before calling it, send only a compressed review packet. Never send hidden reasoning, chain-of-thought, or a transcript. Keep the entire packet comfortably below the Worker's 5,000-character hard limit.

- `user_request`: one or two short sentences.
- `proposed_direction`: the tentative conclusion/direction only.
- `key_claims`: at most five short claims that materially support the conclusion.
- `assumptions`: only assumptions that could change the result.
- `evidence`: short source/evidence summaries, not copied pages or long excerpts.
- `constraints`: only explicit constraints that matter.
- `uncertainties`: unresolved material points only.
- `review_level`: `standard` by default.

Use `deep` only when the decision is materially high-stakes, expensive or irreversible, legally or medically consequential, security-sensitive, or unusually disputed with weak evidence. Do not use `deep` merely because the task is long.

## Fallback when the external tool is unavailable

If `review_strategy` is not available on the current product surface or plan, do not block the user's task and do not pretend that an external model was consulted. Perform one brief internal counter-check instead:

1. Identify the tentative conclusion.
2. Ask what evidence could make it wrong.
3. Check the strongest plausible alternative.
4. Check explicit user constraints and unresolved factual uncertainty.
5. Revise only if the counter-check materially changes the answer.

Do not expose private chain-of-thought. This fallback is a quality-control instruction, not a second independent model.

## After review

- Check each material criticism against actual evidence.
- Correct the answer when supported.
- Reject criticism contradicted by stronger evidence.
- If `verify` is returned, verify the named point when tools permit.
- Do not mention the critic unless useful to the user.
- Do not call the critic repeatedly just because it disagrees. One call per substantive answer is the default.

## Cost and scope controls

The external critic must never be used to draft the user's answer, write code, perform research, or solve the whole task. The primary model does the work; the critic only flags concise defects.

Do not send secrets, credentials, unnecessary personal data, large file contents, full codebases, long conversation history, or hidden chain-of-thought.
