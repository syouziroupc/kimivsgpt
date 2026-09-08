---
name: answer-auditor
description: Automatically use the independent review_strategy critic exactly once before finalizing substantive complex work: multi-step factual analysis, research, troubleshooting, planning, recommendations, comparisons, architecture or coding-plan decisions, and consequential judgments. Do not wait for an @mention. Skip simple chat, single-answer lookups, deterministic arithmetic, straightforward rewriting/translation, and purely creative requests. Use standard by default; automatically use deep for materially high-stakes, expensive or irreversible, security-sensitive, unusually disputed, weak-evidence, or explicitly rigorous/deep-review tasks.
---

# Answer Auditor

Automatically review the proposed direction once before committing to the final answer whenever the task is substantively complex. The user should not need to mention or select this skill manually.

## Automatic trigger

Treat the skill as the default quality-control step when one or more of these apply:
- the answer requires multi-step analysis or several meaningful tool calls;
- current external facts materially affect the conclusion;
- multiple plausible explanations, options, tradeoffs, or failure modes exist;
- troubleshooting has more than one plausible cause;
- the answer makes a consequential recommendation or decision;
- the user asks for rigorous re-evaluation, verification, audit, deep review, thorough checking, or challenges a prior conclusion;
- a coding task requires architecture, implementation-plan, deployment, security, migration, or debugging judgment;
- a factual conclusion depends on combining several sources, estimates, definitions, or assumptions.

Do not wait for `@Kimi vs GPT Answer Auditor`, `@kimi-vs-gpt-auditor`, or another explicit invocation. If the task meets the trigger, invoke the auditor once before the final answer.

Do not invoke for greetings, casual conversation, one-step factual lookups with one unambiguous verified answer, deterministic calculations, straightforward rewriting/translation, or purely creative generation.

## Review level selection

Use `standard` for ordinary complex work.

Automatically use `deep` when any of these apply:
- the decision is materially high-stakes, expensive, difficult to reverse, or security-sensitive;
- evidence is weak, conflicting, stale, incomplete, or definitions materially differ;
- the issue is unusually disputed and a mistaken conclusion would materially affect the user;
- the user explicitly requests Kimi, deep review, rigorous audit, thorough verification, 徹底検証, 徹底監査, or equivalent wording.

Do not use `deep` merely because the task is long. Preserve the Worker's daily deep limit and never retry deep automatically after a model failure.

## External review when available

If `review_strategy` is available, call it exactly once before the final answer. The external critic is advisory, not an authority.

Before calling it, send only a compressed review packet. Never send hidden reasoning, chain-of-thought, or a transcript. Keep the entire packet comfortably below the Worker's 5,000-character hard limit.

- `user_request`: one or two short sentences.
- `proposed_direction`: the tentative conclusion/direction only.
- `key_claims`: at most five short claims that materially support the conclusion.
- `assumptions`: only assumptions that could change the result.
- `evidence`: short source/evidence summaries, not copied pages or long excerpts.
- `constraints`: only explicit constraints that matter.
- `uncertainties`: unresolved material points only.
- `review_level`: selected by the rules above.

## Fallback when the external tool is unavailable

If `review_strategy` is not available on the current conversation, product surface, or plan, do not block the user's task and do not pretend that an external model was consulted. Perform one brief internal counter-check instead:

1. Identify the tentative conclusion.
2. Ask what evidence could make it wrong.
3. Check the strongest plausible alternative.
4. Check explicit user constraints and unresolved factual uncertainty.
5. Revise only if the counter-check materially changes the answer.

Do not expose private chain-of-thought. This fallback is a quality-control instruction, not a second independent model.

When the external tool is unavailable, mention that fact only when the user explicitly requested Kimi/external auditing or when the missing independent review materially limits confidence. Do not add a noisy failure notice to every ordinary answer.

## After review

- Check each material criticism against actual evidence.
- Correct the answer when supported.
- Reject criticism contradicted by stronger evidence.
- If `verify` is returned, verify the named point when tools permit.
- Do not mention the critic unless useful to the user.
- Do not call the critic repeatedly just because it disagrees. One call per substantive answer is the default.

## Cost and scope controls

The external critic must never be used to draft the user's answer, write code, perform the primary research, or solve the whole task. The primary model does the work; the critic only flags concise defects.

Do not send secrets, credentials, unnecessary personal data, large file contents, full codebases, long conversation history, or hidden chain-of-thought.
