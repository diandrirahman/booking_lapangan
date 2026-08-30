export interface FinancialCalculationInput {
  courtSubtotal: number;
  addonSubtotal: number;
  discountAmount: number;
  discountFunding: "OWNER" | "PLATFORM" | null;
  commissionRateBasisPoints: number;
  gatewayFee: number;
  gatewayFeeFunding: "OWNER" | "PLATFORM";
}

export interface FinancialCalculation {
  grossAmount: number;
  customerTotal: number;
  ownerDiscount: number;
  platformDiscount: number;
  commissionBase: number;
  platformCommission: number;
  ownerNet: number;
  platformMargin: number;
}

export function calculateFinancialSnapshot(
  input: FinancialCalculationInput,
): FinancialCalculation {
  const grossAmount = input.courtSubtotal + input.addonSubtotal;
  const discountAmount = Math.min(input.discountAmount, grossAmount);
  const ownerDiscount = input.discountFunding === "OWNER" ? discountAmount : 0;
  const platformDiscount = input.discountFunding === "PLATFORM" ? discountAmount : 0;
  const commissionBase = grossAmount - ownerDiscount;
  const platformCommission = Math.floor(
    (commissionBase * input.commissionRateBasisPoints) / 10_000,
  );
  const ownerGatewayFee = input.gatewayFeeFunding === "OWNER" ? input.gatewayFee : 0;
  const platformGatewayFee =
    input.gatewayFeeFunding === "PLATFORM" ? input.gatewayFee : 0;
  const ownerNet = commissionBase - platformCommission - ownerGatewayFee;
  if (ownerNet < 0) throw new Error("OWNER_NET_NEGATIVE");
  return {
    grossAmount,
    customerTotal: grossAmount - ownerDiscount - platformDiscount,
    ownerDiscount,
    platformDiscount,
    commissionBase,
    platformCommission,
    ownerNet,
    platformMargin: platformCommission - platformDiscount - platformGatewayFee,
  };
}
