import oidcHandler, { AuthState } from "./index-oidc-smoke";

export { AuthState };

const VERSION = "0.8.0-reliable";
const MODEL_CALL_TIMEOUT_MS = 9000;
const INFERENCE_BUDGET_MS = 22000;
const MCP_REQUEST_DEADLINE_MS = 26000;

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
  const reliableEnv = Object.create(env) as Env;
  const timedOutModels = new Set<string>();

  // The review endpoint must never be rejected by our own application quota.
  // Authentication throttling remains intact because it does not limit valid reviews.
  reliableEnv.AUDIT_RATE_LIMITER = undefined;
  reliableEnv.DEEP_RATE_LIMITER = undefined;

  reliableEnv.AI = {
    run: async (model: string, input: Record<string, unknown>): Promise<unknown> => {
      if (timedOutModels.has(model)) {
        throw new Error(`auditor_skip_retry_after_timeout:${model}`);
      }

      const elapsed = Date.now() - startedAt;
      const remaining = INFERENCE_BUDGET_MS - elapsed;
      if (remaining <= 500) {
        throw new Error(`auditor_inference_budget_exhausted:${elapsed}ms`);
      }

      const timeoutMs = Math.max(500, Math.min(MODEL_CALL_TIMEOUT_MS, remaining - 250));
      try {
        return await withTimeout(
          env.AI.run(model, input),
          timeoutMs,
          `auditor_model_timeout:${model}`,
          () => timedOutModels.add(model),
        );
      } catch (error) {
        if (errorText(error).startsWith("auditor_model_timeout:")) {
          timedOutModels.add(model);
        }
        throw error;
      }
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
        application_quota: "none",
        review_rate_limit: "none",
        auth_rate_limit: "enabled",
        reliability: {
          per_model_timeout_ms: MODEL_CALL_TIMEOUT_MS,
          inference_budget_ms: INFERENCE_BUDGET_MS,
          mcp_request_deadline_ms: MCP_REQUEST_DEADLINE_MS,
          skip_same_model_retry_after_timeout: true,
          upstream_failover: true,
          schema_fallback: true,
          rpc_error_fallback: true,
        },
        response_guarantee: "bounded MCP response; schema-valid audit fallback after model failures",
      });
    }

    if (url.pathname !== "/mcp") {
      return oidcHandler.fetch(request, env, ctx);
    }

    const startedAt = Date.now();
    const bodyPromise = request.clone().json().catch(() => null);
    const reliableEnv = buildReliableEnv(env, startedAt);

    try {
      return await withTimeout(
        oidcHandler.fetch(request, reliableEnv, ctx),
        MCP_REQUEST_DEADLINE_MS,
        "auditor_mcp_request_timeout",
      );
    } catch (error) {
      return rpcFailureResponse(await bodyPromise, errorText(error));
    }
  },
} satisfies ExportedHandler<Env>;
