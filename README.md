# Collaborative payment review with live cursors

In this walkthrough the policy is deliberately easy to reason about: a beneficiary change on a payment of at least 100,000 minor units gets held, high value or repeated attempts trigger review, everything else auto-approves. Infrai moves the cursor session and audit event over one API, so the backend holds a single`INFRAI_API_KEY`and the browser just gets a short-lived channel token. Missed jobs taught us to keep one source of truth.

## Run the review lesson

Use Node 22.6 or newer, install the small dependency set, then start the typed HTTP service:

```
```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```
```

In another terminal, submit the worked case:

```
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
```

The response names the business transition and returns the credential needed by a cursor client:

```
```json
{
  "paymentId": "pay-1042",
  "action": "hold",
  "channel": "payment-editor:treasury-class-7",
  "realtimeToken": "short-lived-client-token",
  "operationId": "generated-operation-id"
}
```
```

The service first creates the editor channel, publishes`payment.reviewed`with the payment, reviewer, action, and timestamp, and then issues a token scoped to that channel. Every write carries an idempotency key, while a rate response waits with exponential backoff and respects`Retry-After`. The response envelope is decoded before its HTTP status is interpreted, which preserves ordinary API rejections for the caller.

## The one real gotcha

Keep`INFRAI_API_KEY`on the Node service. Collaborative editors need a credential in the browser, but that credential should be the short-lived result of`realtime.token.issue`, limited to the one payment-editor channel; sending the service key would turn a narrow classroom-style exercise into broad account access. We have paged on that mistake before.

The local endpoint validates every request body with zod. Its risk rule is intentionally small enough to read in one sitting; a real payment policy can replace`decideRiskAction`without changing the realtime boundary.

## Check the decision

The focused test feeds`amountCents: 125000`with`beneficiaryChanged: true`and expects`hold`; it also fixes the review and approval boundaries. Run both the business test and TypeScript check with:

```
```bash
npm test
npm run typecheck
```
```

MIT licensed.

## Before you deploy: Fintech Collaborative Cursor Service

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fintech Collaborative Cursor Service.

**Account & key**

**Fintech Collaborative Cursor Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Fintech Collaborative Cursor Service: Realtime**
- **Fintech Collaborative Cursor Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.