import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/index-resilient.ts", "utf8");
const ast = ts.createSourceFile("index-resilient.ts", source, ts.ScriptTarget.ES2022, true);
const functions = new Set(["compactReviewPacket", "parseCompactAudit", "invokeEnsembleMember"]);
const variables = new Set(["COMPACT_AUDITOR_PROMPT"]);
const snippets = [];
for (const stmt of ast.statements) {
  if (ts.isFunctionDeclaration(stmt) && functions.has(stmt.name?.text)) {
    snippets.push(stmt.getText(ast));
  } else if (ts.isVariableStatement(stmt)) {
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && variables.has(decl.name.text)) {
        snippets.push(stmt.getText(ast));
      }
    }
  }
}
assert.equal(snippets.length, functions.size + variables.size);
const js = ts.transpileModule(
  [...snippets, "module.exports = { compactReviewPacket, parseCompactAudit, invokeEnsembleMember };"].join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const reports = [];
let sent;
let calls = 0;
const ctx = {
  module: { exports: {} },
  Date,
  JSON,
  console: { info: (...items) => reports.push(items) },
  resultSchema: { parse: (x) => x },
  asRecord: (x) => x !== null && typeof x === "object" && !Array.isArray(x) ? x : null,
  shortText: (x, max) => String(x ?? "").trim().slice(0, max),
  unwrapCandidate: (x) => (x && typeof x === "object" && "response" in x) ? x.response : x,
  parseJsonString: (x) => JSON.parse(x),
  parseAudit: (x) => x,
};
vm.runInNewContext(js, ctx);
const { compactReviewPacket, parseCompactAudit, invokeEnsembleMember } = ctx.module.exports;
const sample = {
  user_request: "売上高と粗利を混同しないでください。",
  proposed_direction: "A案を推奨。税別10,000円、手数料5%。",
  key_claims: ["C=10,000円", "条件にはAとBがある"],
  assumptions: [],
  evidence: ["国税庁(2026年)の表。", "請求書の項目「基本料」"],
  constraints: ["3モデルを同時に使うこと"],
  uncertainties: [],
};
const compact = compactReviewPacket(sample);
const roundTrip = JSON.parse(compact);
assert.equal(roundTrip.u, sample.user_request);
assert.equal(roundTrip.d, sample.proposed_direction);
assert.deepEqual(Array.from(roundTrip.k), sample.key_claims);
assert.deepEqual(Array.from(roundTrip.e), sample.evidence);
assert.deepEqual(Array.from(roundTrip.c), sample.constraints);
assert.equal(Object.hasOwn(roundTrip, "a"), false);
assert.equal(Object.hasOwn(roundTrip, "x"), false);
assert.ok(compact.length < JSON.stringify(sample).length);
const role = {
  model: "@cf/ibm-granite/granite-4.0-h-micro",
  instruction: "Check requirements",
  issueType: "constraint_violation",
  maxOutputTokens: 200,
  inputUSDPerMillion: 0.017,
  outputUSDPerMillion: 0.112,
};
const audit = parseCompactAudit({ response: '{"v":"r","t":"料金根拠が欠落","f":"正しい資料を示す","q":""}' }, role);
assert.equal(audit.verdict, "revise");
assert.equal(audit.issues[0].type, "constraint_violation");
assert.equal(audit.issues[0].target, "料金根拠が欠落");
assert.equal(audit.next_step, "正しい資料を示す");
const pass = parseCompactAudit('{"v":"p","t":"","f":"","q":""}', role);
assert.equal(pass.verdict, "proceed");
assert.equal(pass.issues.length, 0);
const verify = parseCompactAudit('{"v":"v","t":"","f":"","q":"原典と照合"}', role);
assert.equal(verify.verdict, "verify");
assert.equal(verify.verify[0], "原典と照合");
assert.throws(() => parseCompactAudit('{"v":"r","t":"誤記","f":""}', role), /auditor_compact_missing_issue/);
assert.throws(() => parseCompactAudit('{"v":"v","q":""}', role), /auditor_compact_missing_check/);
assert.throws(() => parseCompactAudit('{"v":"nonsense","t":"","f":""}', role), /auditor_compact_invalid_verdict/);
const mock = {
  AI: {
    run: async (model, input) => {
      calls++;
      sent = { model, input };
      return {
        response: '{"v":"r","t":"誤り","f":"数字を訂正","q":""}',
        usage: { prompt_tokens: 500, completion_tokens: 50 },
      };
    },
  },
};
const member = await invokeEnsembleMember(mock, role, compact);
assert.equal(calls, 1);
assert.equal(member.issues[0].correction, "数字を訂正");
assert.equal(sent.input.messages[1].content, compact);
assert.ok(sent.input.messages[0].content.length < 1000);
assert.equal(sent.input.max_completion_tokens, 200);
const costLog = reports.find((x) => x[0] === "auditor_ensemble_model");
assert.ok(costLog);
const data = JSON.parse(costLog[1]);
const expected = (500 * 0.017 + 50 * 0.112) / 1e6;
assert.ok(Math.abs(data.estimated_inference_usd - expected) < 1e-12);
assert.ok(!JSON.stringify(reports).includes(sample.user_request), "usage log must not retain the original prompt");
const qwenRole = { ...role, model: "@cf/qwen/qwen3-30b-a3b-fp8" };
await invokeEnsembleMember(mock, qwenRole, compact);
assert.ok(sent.input.messages[0].content.startsWith("/no_think\n"), "Qwen prompt should disable lengthy reasoning");
console.log("lossless compact protocol and cost telemetry OK");
