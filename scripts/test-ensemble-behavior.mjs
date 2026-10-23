import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/index-resilient.ts", "utf8");
const ast = ts.createSourceFile("index-resilient.ts", source, ts.ScriptTarget.ES2022, true);
const selections = new Map();
for (const statement of ast.statements) {
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && ["STANDARD_ENSEMBLE", "DEEP_ENSEMBLE"].includes(declaration.name.text)) {
        selections.set(declaration.name.text, statement.getText(ast));
      }
    }
  } else if (ts.isFunctionDeclaration(statement) && ["runReviewEnsemble", "compactReviewPacket"].includes(statement.name?.text)) {
    selections.set(statement.name.text, statement.getText(ast));
  }
}
for (const key of ["STANDARD_ENSEMBLE", "DEEP_ENSEMBLE", "compactReviewPacket", "runReviewEnsemble"]) {
  assert.ok(selections.has(key), `Missing source declaration: ${key}`);
}
const compiled = ts.transpileModule(
  [...selections.values(), "module.exports = { runReviewEnsemble };"].join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const results = new Map();
let mockInvoke = null;
const context = {
  module: { exports: {} },
  console: { info() {}, warn() {} },
  Promise,
  MAX_PACKET_CHARS: 5000,
  resultSchema: { parse: (x) => x },
  errorText: (x) => String(x),
  invokeEnsembleMember: async (_env, role) => {
    if (mockInvoke) return mockInvoke(role);
    const value = results.get(role.model);
    if (value === "fail") throw new Error("mock upstream failure");
    return value;
  },
};
vm.runInNewContext(compiled, context);
const { runReviewEnsemble } = context.module.exports;

const kimi = "@cf/moonshotai/kimi-k2.6";
const glm = "@cf/zai-org/glm-5.3";
const deepseek = "@cf/deepseek-ai/deepseek-v4-pro-0813";
const gptoss = "@cf/openai/gpt-oss-120b";
const nemotron = "@cf/nvidia/nemotron-3-120b-a12b";
const report = (verdict, risk, type = "evidence_gap") => ({
  verdict, risk, issues: verdict === "proceed" ? [] : [{ type, target: type, correction: "Action" }],
  verify: verdict === "verify" ? ["Verify source"] : [],
  next_step: "Investigate", confidence: 0.8,
});
const packet = { user_request: "Test", proposed_direction: "Test", review_level: "standard" };
results.set(kimi, report("proceed", 0));
results.set(glm, report("revise", 3, "missing_alternative"));
results.set(gptoss, report("proceed", 0));
let res = await runReviewEnsemble({}, packet);
assert.equal(res.verdict, "revise");
assert.equal(res.risk, 3);
assert.equal(res.perspectives.length, 3);
assert.ok(res.perspectives.some((r) => r.model === gptoss));
assert.ok(res.perspectives.every((r) => r.status === "ok"));
assert.equal(res.issues.length, 1);

results.set(glm, "fail");
res = await runReviewEnsemble({}, packet);
assert.equal(res.verdict, "verify");
assert.equal(res.perspectives.filter((r) => r.status === "unavailable").length, 1);
assert.ok(res.issues.some((issue) => issue.type === "evidence_gap"));

results.set(kimi, "fail");
results.set(gptoss, "fail");
await assert.rejects(runReviewEnsemble({}, packet), /auditor_ensemble_all_models_failed/);

// Three models must be STARTED before any result becomes available.
// Test both standard and deep explicitly; this catches accidental sequential fallback.
for (const level of ["standard", "deep"]) {
  const starts = [];
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  mockInvoke = async (role) => {
    starts.push(role.model);
    await barrier;
    return report("proceed", 0);
  };
  const pending = runReviewEnsemble({}, { ...packet, review_level: level });
  const expected = level === "deep" ? 5 : 3;
  assert.equal(starts.length, expected, `Expected ${expected} simultaneous critics in ${level}`);
  assert.equal(new Set(starts).size, expected, "Critics must be different models");
  release();
  const audit = await pending;
  assert.equal(audit.verdict, "proceed");
  assert.equal(audit.perspectives.length, expected);
  assert.ok(audit.perspectives.every((r) => r.status === "ok"));
}
mockInvoke = null;

// Explicit preflight cost guard: preserve the input text but spend zero model tokens.
const largePacket = {
  ...packet,
  key_claims: Array(5).fill("K".repeat(240)),
  evidence: Array(5).fill("E".repeat(320)),
  constraints: Array(5).fill("C".repeat(220)),
};
let chargedCalls = 0;
mockInvoke = async () => { chargedCalls++; return report("proceed", 0); };
await assert.rejects(runReviewEnsemble({}, largePacket), /auditor_compact_packet_over_budget/);
assert.equal(chargedCalls, 0, "Rejected packets must not launch any AI call");
mockInvoke = null;

results.set(kimi, report("proceed", 0));
results.set(glm, report("proceed", 0));
results.set(gptoss, report("proceed", 0));
results.set(deepseek, report("verify", 2, "unsupported"));
results.set(nemotron, report("revise", 2, "scope_drift"));
res = await runReviewEnsemble({}, { ...packet, review_level: "deep" });
assert.equal(res.verdict, "revise");
assert.equal(res.perspectives.length, 5);
assert.ok(res.perspectives.some((r) => r.model === deepseek));
assert.ok(res.perspectives.some((r) => r.model === nemotron));
assert.ok(res.issues.some((r) => r.type === "unsupported"));
assert.ok(res.issues.some((r) => r.type === "scope_drift"));
console.log("ensemble behavior checks passed");
