import oidcHandler, { AuthState } from "./index-oidc-smoke";

export { AuthState };

import { candidateModels, PANEL, RESERVE_MODELS } from "./model-policy";
const VERSION = "0.12.0-artifact-audit";
const MODEL_CALL_TIMEOUT_MS = 23000;
const INFERENCE_BUDGET_MS = 24500;
const MCP_REQUEST_DEADLINE_MS = 28000;

type AiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

type Env = Record<string, any> & {
  AI: AiBinding;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  onTimeout?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(new Error(`${label}:${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function buildReliableEnv(env: Env, startedAt: number): Env {
  const reliableEnv = { ...env } as Env;
  // Per invocation absolute deadline; do not poison other calls in a JSON-RPC batch.
  reliableEnv.AUDITOR_DEADLINE_AT = startedAt + INFERENCE_BUDGET_MS;

  // The review endpoint must never be rejected by our own application quota.
  // Authentication throttling remains intact because it does not limit valid reviews.
  reliableEnv.AUDIT_RATE_LIMITER = undefined;
  reliableEnv.DEEP_RATE_LIMITER = undefined;

  reliableEnv.AI = {
    run: async (model: string, input: Record<string, unknown>): Promise<unknown> => {
      const elapsed = Date.now() - startedAt;
      const remaining = INFERENCE_BUDGET_MS - elapsed;
      if (remaining <= 500) {
        throw new Error(`auditor_inference_budget_exhausted:${elapsed}ms`);
      }

      const timeoutMs = Math.max(500, Math.min(MODEL_CALL_TIMEOUT_MS, remaining - 250));
      return withTimeout(env.AI.run(model,input),timeoutMs,`auditor_model_timeout:${model}`);
    },
  };

  return reliableEnv;
}

function rpcErrorFor(message: unknown, detail: string): Record<string, unknown> | null {
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const record = message as Record<string, unknown>;
  if (!("id" in record)) return null;
  return {
    jsonrpc: "2.0",
    id: record.id ?? null,
    error: {
      code: -32002,
      message: "Auditor request could not complete within the bounded server deadline. Retry is safe.",
      data: { detail: detail.slice(0, 180) },
    },
  };
}

function rpcFailureResponse(body: unknown, detail: string): Response {
  const payload = Array.isArray(body)
    ? body.map((item) => rpcErrorFor(item, detail)).filter(Boolean)
    : rpcErrorFor(body, detail);

  return Response.json(
    payload && (!Array.isArray(payload) || payload.length > 0)
      ? payload
      : {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32002, message: "Auditor request failed safely.", data: { detail: detail.slice(0, 180) } },
        },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "kimi-vs-gpt-auditor",
        version: VERSION,
        standard_models: candidateModels(env, "standard"),
        deep_models: candidateModels(env, "deep"),
        panel_models: PANEL,
        reserve_models: RESERVE_MODELS,
        required_coverage: {frontier:1,economy:3},
        application_quota: "none",
        review_rate_limit: "none",
        auth_rate_limit: "enabled",
        visual_audit: { enabled:true, required_votes:2, max_image_bytes:2097152, direct_endpoint:"/visual", mcp_tool:"review_visual_page" },
        reliability: {
          per_model_timeout_ms: MODEL_CALL_TIMEOUT_MS,
          inference_budget_ms: INFERENCE_BUDGET_MS,
          mcp_request_deadline_ms: MCP_REQUEST_DEADLINE_MS,
          hedged_failover: true,
          max_model_attempts: 6,
          parallel_panel: true,
          schema_fallback: true,
          rpc_error_fallback: true,
        },
        response_guarantee: "bounded MCP response; quorum of one frontier and three economy reviews or explicit partial status",
      });
    }

    if (url.pathname !== "/mcp" && url.pathname !== "/visual") {
      return oidcHandler.fetch(request, env, ctx);
    }

    const startedAt = Date.now();
    const bodyPromise = url.pathname === "/mcp" ? request.clone().json().catch(() => null) : Promise.resolve(null);
    const reliableEnv = buildReliableEnv(env, startedAt);

    try {
      return await withTimeout(
        oidcHandler.fetch(request, reliableEnv, ctx),
        MCP_REQUEST_DEADLINE_MS,
        "auditor_mcp_request_timeout",
      );
    } catch (error) {
      if (url.pathname === "/visual") return Response.json({verdict:"verify",error:"visual_deadline"},{status:504,headers:{"Cache-Control":"no-store"}});
      return rpcFailureResponse(await bodyPromise, errorText(error));
    }
  },
} satisfies ExportedHandler<Env>;
