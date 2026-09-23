export type RiskAction = "approve" | "require_review" | "hold";

export type PaymentSignals = {
  amountCents: number;
  currency: string;
  velocityCount: number;
  beneficiaryChanged: boolean;
};

export function decideRiskAction(signals: PaymentSignals): RiskAction {
  if (signals.beneficiaryChanged && signals.amountCents >= 100_000) {
    return "hold";
  }
  if (signals.amountCents >= 50_000 || signals.velocityCount >= 4) {
    return "require_review";
  }
  return "approve";
}
