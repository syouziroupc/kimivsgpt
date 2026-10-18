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
  } else if (ts.isFunctionDeclaration(statement) && statement.name?.text === "runReviewEnsemble") {
    selections.set("runReviewEnsemble", statement.getText(ast));
  }
}
for (const key of ["STANDARD_ENSEMBLE", "DEEP_ENSEMBLE", "runReviewEnsemble"]) {
  assert.ok(selections.has(key), `Missing source declaration: ${key}`);
}
const compiled = ts.transpileModule(
  [...selections.values(), "module.exports = { runReviewEnsemble };"].join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const results = new Map();
const context = {
  module: { exports: {} },
  console: { info() {}, warn() {} },
  Promise,
  MAX_PACKET_CHARS: 5000,
  resultSchema: { parse: (x) => x },
  errorText: (x) => String(x),
  invokeEnsembleMember: async (_env, role) => {
    const value = results.get(role.model);
    if (value === "fail") throw new Error("mock upstream failure");
    return value;
  },
};
vm.runInNewContext(compiled, context);
const { runReviewEnsemble } = context.module.exports;

const qwen = "@cf/qwen/qwen3-30b-a3b-fp8";
const glm = "@cf/zai-org/glm-4.7-flash";
const gemma = "@cf/google/gemma-4-26b-a4b-it";
const gptoss = "@cf/openai/gpt-oss-20b";
const report = (verdict, risk, type = "evidence_gap") => ({
  verdict, risk, issues: verdict === "proceed" ? [] : [{ type, target: type, correction: "Action" }],
  verify: verdict === "verify" ? ["Verify source"] : [],
  next_step: "Investigate", confidence: 0.8,
});
const packet = { user_request: "Test", proposed_direction: "Test", review_level: "standard" };
results.set(qwen, report("proceed", 0));
results.set(glm, report("revise", 3, "missing_alternative"));
let res = await runReviewEnsemble({}, packet);
assert.equal(res.verdict, "revise");
assert.equal(res.risk, 3);
assert.equal(res.perspectives.length, 2);
assert.ok(res.perspectives.every((r) => r.status === "ok"));
assert.equal(res.issues.length, 1);

results.set(glm, "fail");
res = await runReviewEnsemble({}, packet);
assert.equal(res.verdict, "verify");
assert.equal(res.perspectives.filter((r) => r.status === "unavailable").length, 1);
assert.ok(res.issues.some((issue) => issue.type === "evidence_gap"));

results.set(qwen, "fail");
await assert.rejects(runReviewEnsemble({}, packet), /auditor_ensemble_all_models_failed/);

results.set(qwen, report("proceed", 0));
results.set(gemma, report("verify", 2, "unsupported"));
results.set(gptoss, report("revise", 2, "scope_drift"));
res = await runReviewEnsemble({}, { ...packet, review_level: "deep" });
assert.equal(res.verdict, "revise");
assert.equal(res.perspectives.length, 3);
assert.ok(res.perspectives.some((r) => r.model === gemma));
assert.ok(res.perspectives.some((r) => r.model === gptoss));
assert.ok(res.issues.some((r) => r.type === "unsupported"));
assert.ok(res.issues.some((r) => r.type === "scope_drift"));
console.log("ensemble behavior checks passed");
