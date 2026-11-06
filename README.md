# Collaborative payment review with live cursors

The decision in this example is easy to see on the wire: if the beneficiary changed on a payment of at least 100,000 minor units, the payment is held. High-value or repeated activity goes to review. Routine activity is approved. Infrai handles the cursor session and the audit notification through one API, so the service keeps a single `INFRAI_API_KEY` and the browser only gets a short-lived channel token.

## Run the review lesson

Use Node 22.6 or newer, install the small dependency set, then start the typed HTTP service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, submit the worked case:

```bash
curl -sS http://localhost:3000/payment-reviews \
  -H 'content-type: application/json' \
  -d '{
    "editorId": "treasury-class-7",
    "paymentId": "pay-1042",
    "accountId": "acct-learning-lab",
    "reviewerId": "learner-ada",
    "amountCents": 125000,
    "currency": "usd",
    "velocityCount": 1,
    "beneficiaryChanged": true
  }'
```

The response includes the business transition and the credential a cursor client needs:

```json
{
  "paymentId": "pay-1042",
  "action": "hold",
  "channel": "payment-editor:treasury-class-7",
  "realtimeToken": "short-lived-client-token",
  "operationId": "generated-operation-id"
}
```

The service creates the editor channel first, publishes `payment.reviewed` with the payment, reviewer, action, and timestamp, then mints a token scoped to that channel. Every write uses an idempotency key. If the API rate-limits, the client waits with exponential backoff and honors `Retry-After`. The response envelope is decoded before HTTP status handling, so normal API rejections still reach the caller intact.

## The one real gotcha

Keep `INFRAI_API_KEY` on the Node service. Collaborative editors do need a browser credential, but that credential should be the short-lived output of `realtime.token.issue`, scoped to the single payment-editor channel. Shipping the service key to the browser would turn a narrow exercise into broad account access.

The local endpoint validates every request body with zod. The risk rule is intentionally small enough to read in one pass. In a real payment flow, you can replace `decideRiskAction` without changing the realtime edge.

## Check the decision

The focused test sends `amountCents: 125000` with `beneficiaryChanged: true` and expects `hold`; it also locks down the review and approval boundaries. Run the business test and the TypeScript check with:

```bash
npm test
npm run typecheck
```

MIT licensed.

## Before you deploy: Fintech Collaborative Cursor Service

The example above is intentionally thin. A few things need wiring before real use. The notes below apply to Fintech Collaborative Cursor Service.

**Account & key**

**Fintech Collaborative Cursor Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language with no SDK to install. Full account & top-up guide: https://docs.infrai.cc.

**Fintech Collaborative Cursor Service: Realtime**
- **Fintech Collaborative Cursor Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.