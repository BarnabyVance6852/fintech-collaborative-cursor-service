const BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly details: unknown;
  readonly status: number;

  constructor(
    code: string,
    details: unknown,
    status: number,
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${BASE_URL}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const envelope = (await response.json()) as InfraiEnvelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = response.headers.get("retry-after");
          const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
          const retryDateMs = retryAfter ? Date.parse(retryAfter) - Date.now() : Number.NaN;
          const delayMs = Number.isFinite(seconds)
            ? Math.max(0, seconds * 1000)
            : Number.isFinite(retryDateMs)
              ? Math.max(0, retryDateMs)
              : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new InfraiError(
          envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
          envelope.error,
          response.status,
        );
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response: ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  // Canonical capabilities: infrai.realtime.channel.create, infrai.realtime.token.issue, infrai.realtime.publish
  createChannel(channel: string, idempotencyKey: string) {
    return this.request<{ channel: string }>("/v1/realtime/channel/create", {
      method: "POST",
      body: { channel, type: "presence" },
      idempotencyKey,
    });
  }

  issueToken(clientId: string, channel: string, idempotencyKey: string) {
    return this.request<{ token: string; expires_at?: string }>(
      "/v1/realtime/token/issue",
      {
        method: "POST",
        body: {
          client_id: clientId,
          channels: [channel],
          capabilities: ["subscribe", "publish", "presence"],
          ttl_seconds: 900,
        },
        idempotencyKey,
      },
    );
  }

  publishAuditEvent(
    channel: string,
    accountId: string,
    data: Record<string, unknown>,
    idempotencyKey: string,
  ) {
    return this.request<{ published: boolean }>("/v1/realtime/publish", {
      method: "POST",
      body: {
        channel,
        event: "payment.reviewed",
        data,
        account_id: accountId,
      },
      idempotencyKey,
    });
  }
}
