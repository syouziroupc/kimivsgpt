# OpenAI public plugin submission checklist

Technical package target: **skills + MCP**

## Already prepared

- Public MCP URL: `https://kimivsgpt.syouziroupc.workers.dev/mcp`
- Skill bundle: `plugin/skills/answer-auditor/`
- Plugin manifest: `plugin/.codex-plugin/plugin.json`
- Remote MCP package config: `plugin/.mcp.json`
- Privacy policy: `PRIVACY.md`
- Terms: `TERMS.md`
- Support: `https://github.com/syouziroupc/kimivsgpt/issues`
- Positive/negative review cases: `submission/test-cases.md`
- Standard model cost controls and deep-review escalation are enforced server-side.

## Manual publisher steps still required

1. In OpenAI Platform, use the organization that will publish this plugin.
2. Confirm the submitter has **Apps Management: Write** permission. Organization owners already have the required access.
3. Complete **developer identity** or **business identity** verification in that same organization. The public publisher name, website, support contact, privacy policy, and terms must match the identity selected in the submission portal.
4. Open the plugin submission portal and choose **With MCP**.
5. Use MCP URL type **Universal** and enter:
   `https://kimivsgpt.syouziroupc.workers.dev/mcp`
6. The current MCP endpoint requires no end-user authentication. Do not provide demo credentials unless authentication is added before submission.
7. When the portal generates a domain verification token, configure the Worker to return exactly that token from:
   `https://kimivsgpt.syouziroupc.workers.dev/.well-known/openai-apps-challenge`
   The endpoint must return only the token, not JSON.
8. Select **Scan Tools** and verify `review_strategy` is discovered with accurate tool annotations:
   - `readOnlyHint: true`
   - `openWorldHint: false`
   - `destructiveHint: false`
9. Upload the final answer-auditor skill bundle.
10. Add starter prompts from the plugin manifest.
11. Enter at least five positive and three negative tests from `submission/test-cases.md`.
12. Select only countries/regions where support, privacy, and terms are ready.
13. Release note for initial submission:
   `Initial release of Kimi vs GPT Answer Auditor. Adds a compact independent pre-answer critique for complex analytical tasks, using a low-cost standard reviewer and optional deep reviewer. The critic is intentionally restricted from drafting the final answer, doing research, or generating complete code.`
14. Submit for review. Approval does not publish automatically; publish from the portal after approval.

## Final technical checks before submission

- `npm run audit`
- `npm run type-check`
- `npm run build-check`
- GET `/health`
- MCP `initialize`
- MCP `tools/list`
- One real `review_strategy` standard call
- Verify no obsolete Worker URL remains anywhere in the repository
- Verify privacy and terms text still matches the deployed behavior
