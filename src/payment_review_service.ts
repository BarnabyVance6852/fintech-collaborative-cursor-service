import { createServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.ts";
import { decideRiskAction } from "./risk_decision.ts";

const reviewRequest = z.object({
  editorId: z.string().min(1).max(80),
  paymentId: z.string().min(1).max(80),
  accountId: z.string().min(1).max(80),
  reviewerId: z.string().min(1).max(80),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  velocityCount: z.number().int().nonnegative(),
  beneficiaryChanged: z.boolean(),
});

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = new InfraiRealtime(apiKey);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/payment-reviews") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const input = reviewRequest.parse(await readJson(request));
    const action = decideRiskAction(input);
    const channel = `payment-editor:${input.editorId}`;
    const operationId = randomUUID();

    await infrai.createChannel(channel, `channel:${input.editorId}`);
    await infrai.publishAuditEvent(
      channel,
      input.accountId,
      {
        operationId,
        paymentId: input.paymentId,
        reviewerId: input.reviewerId,
        amountCents: input.amountCents,
        currency: input.currency,
        action,
        recordedAt: new Date().toISOString(),
      },
      `payment-review:${input.paymentId}:${operationId}`,
    );
    const session = await infrai.issueToken(
      input.reviewerId,
      channel,
      `review-session:${input.paymentId}:${operationId}`,
    );

    sendJson(response, 201, {
      paymentId: input.paymentId,
      action,
      channel,
      realtimeToken: session.token,
      operationId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(response, 400, { error: "invalid_request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, details: error.details });
      return;
    }
    sendJson(response, 500, { error: "request_failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Payment review service listening on http://localhost:${port}`);
});
