import test from "node:test";
import assert from "node:assert/strict";
import { decideRiskAction } from "../src/risk_decision.ts";

test("holds a large payment after its beneficiary changes", () => {
  assert.equal(
    decideRiskAction({
      amountCents: 125_000,
      currency: "USD",
      velocityCount: 1,
      beneficiaryChanged: true,
    }),
    "hold",
  );
});

test("routes repeated payment activity to a reviewer", () => {
  assert.equal(
    decideRiskAction({
      amountCents: 12_000,
      currency: "USD",
      velocityCount: 4,
      beneficiaryChanged: false,
    }),
    "require_review",
  );
});

test("approves a routine payment", () => {
  assert.equal(
    decideRiskAction({
      amountCents: 12_000,
      currency: "USD",
      velocityCount: 1,
      beneficiaryChanged: false,
    }),
    "approve",
  );
});
