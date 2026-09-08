---
name: answer-auditor
description: Use an independent compact critic before finalizing every complex factual, analytical, research, troubleshooting, planning, recommendation, comparison, coding-plan, or consequential judgment task. Skip trivial chat, simple rewriting/translation, deterministic arithmetic, and purely creative requests.
---

# Answer Auditor

Use `review_strategy` once before committing to the final answer on complex tasks.

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

## Compact packet

Before the final answer, send only a compressed summary. Never send hidden reasoning or a transcript.

- `user_request`: one or two sentences.
- `proposed_direction`: the tentative conclusion/direction only.
- `key_claims`: at most six short claims that materially support the conclusion.
- `assumptions`: only assumptions that could change the result.
- `evidence`: short source/evidence summaries, not copied pages or long excerpts.
- `constraints`: only explicit constraints that matter.
- `uncertainties`: unresolved material points only.
- `review_level`: `standard` by default.

Use `deep` only when the decision is materially high-stakes, expensive/irreversible, legally or medically consequential, security-sensitive, or unusually disputed with weak evidence. Do not use `deep` merely because the task is long.

## After review

The critic is advisory, not a source of truth.

- Check each material criticism against actual evidence.
- Correct the answer when supported.
- Reject criticism contradicted by stronger evidence.
- If `verify` is returned, verify the named point when tools permit.
- Do not mention the critic unless useful to the user.
- Do not call the critic repeatedly just because it disagrees. One call per substantive answer is the default.

## Cost and scope controls

The external critic must never be used to draft the user's answer, write code, perform research, or solve the whole task. The primary model does the work; the critic only flags concise defects.

Do not send secrets, credentials, unnecessary personal data, large file contents, full codebases, long conversation history, or hidden chain-of-thought.
