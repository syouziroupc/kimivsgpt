# Plugin review test cases

## Positive 1 — competing architecture options
**Prompt:** Compare two deployment architectures for a small production service and recommend the safer option. Consider cost, failure modes, and rollback.

**Expected behavior:** The answer-auditor skill triggers. The primary model forms its own tentative direction, then calls `review_strategy` exactly once with `review_level: standard`. The packet is compact and contains the main claims, assumptions, evidence summaries, constraints, and uncertainties. The critic does not design the architecture or write implementation code.

**Expected result shape:** Compact JSON critique with `verdict`, `risk`, up to three `issues`, up to two `verify` items, `next_step`, and `confidence`. The primary model evaluates the critique before producing its own final answer.

**Fixture:** None.

## Positive 2 — troubleshooting with competing causes
**Prompt:** A Windows application became slow after an update. CPU is normal, memory is normal, but disk latency sometimes spikes. Diagnose the most likely causes and give a testing order.

**Expected behavior:** The skill triggers because multiple plausible causes exist. One standard external review checks anchoring, missing alternatives, and unsupported assumptions before the final troubleshooting sequence is presented.

**Expected result shape:** Same compact critique schema; no full troubleshooting answer from the critic.

**Fixture:** None.

## Positive 3 — user challenges a prior conclusion
**Prompt:** Re-evaluate your previous conclusion. I think you committed too early to the first explanation. Check whether a materially better alternative exists before answering again.

**Expected behavior:** The skill triggers because the user explicitly requests rigorous re-evaluation. `review_strategy` is called once and should specifically look for anchoring and omitted alternatives.

**Expected result shape:** Compact critique only.

**Fixture:** None.

## Positive 4 — consequential procurement decision
**Prompt:** I have three vendor proposals with different prices, warranty terms, and delivery risks. Tell me which one to choose and explain the tradeoff.

**Expected behavior:** The skill triggers. Standard review is used unless the supplied context makes the decision unusually high-cost or irreversible. The critic must not choose the vendor itself; it only critiques the primary model's tentative choice.

**Expected result shape:** Compact critique only.

**Fixture:** Three short vendor summaries supplied in the test prompt.

## Positive 5 — coding architecture plan
**Prompt:** Before implementing this feature, decide whether it belongs in the existing service or a separate Worker. Consider deployment, coupling, latency, observability, and rollback. Do not write the full implementation yet.

**Expected behavior:** The skill triggers for architecture judgment. The primary model develops a tentative architecture and calls `review_strategy` once. The critic may challenge coupling, evidence gaps, or omitted alternatives but must not generate the codebase.

**Expected result shape:** Compact critique only.

**Fixture:** None.

## Positive 6 — deep review for high-stakes security migration
**Prompt:** We are about to irreversibly rotate production credentials and migrate access controls. Review the plan before we commit.

**Expected behavior:** The skill triggers and may select `review_level: deep` because the action is security-sensitive and potentially irreversible. The external critic remains limited to concise objections; it must not execute changes.

**Expected result shape:** Compact critique only.

**Fixture:** A short hypothetical migration plan.

## Negative 1 — deterministic arithmetic
**Prompt:** What is 17 × 23?

**Expected behavior:** Do not call `review_strategy`. Answer directly.

**Why:** Deterministic arithmetic does not benefit from an independent critique.

## Negative 2 — straightforward translation
**Prompt:** Translate "The meeting starts at three" into Japanese.

**Expected behavior:** Do not call `review_strategy`. Translate directly.

**Why:** This is a straightforward transformation with no material judgment.

## Negative 3 — purely creative request
**Prompt:** Write a four-line poem about rain on a station platform.

**Expected behavior:** Do not call `review_strategy` unless the user adds factual, analytical, or consequential constraints that require review.

**Why:** Pure creative generation does not require adversarial factual review.
