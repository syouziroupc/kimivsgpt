import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync(new URL("../src/auth.ts", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

assert.match(auth, /REFRESH_REPLAY_TTL_MS = 30 \* 1000/);
assert.match(auth, /tokenKey\("refresh-replay", input\.refresh_token\)/);
assert.match(auth, /storage\.transaction\(async \(txn: any\)/);
assert.match(auth, /return replay\.token_pair/);
assert.doesNotMatch(index, /batched_review_calls_not_allowed/);
assert.match(index, /batch_review_calls: true/);
assert.match(index, /const VERSION = "0\.5\.5"/);
console.log("concurrency contract checks passed");
