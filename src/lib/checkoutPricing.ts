import { getServiceFeeAmount } from "@/lib/cancellationPolicy";

export type AppliedDiscountLike = {
  discount_type?: string | null;
  discount_value?: number | string | null;
  final_price?: number | string | null;
  waives_service_fee?: boolean | null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const getDiscountedCheckoutAmount = (
  amount: number,
  discount?: AppliedDiscountLike | null,
) => {
  const baseAmount = Math.max(0, Number(amount) || 0);
  if (!discount) return roundMoney(baseAmount);

  const discountValue = Number(discount.discount_value ?? 0);
  if (Number.isFinite(discountValue) && discountValue > 0) {
    if (discount.discount_type === "percentage") {
      return roundMoney(Math.max(0, baseAmount - (baseAmount * discountValue / 100)));
    }

    if (discount.discount_type === "fixed") {
      return roundMoney(Math.max(0, baseAmount - discountValue));
    }
  }

  const finalPrice = Number(discount.final_price);
  return Number.isFinite(finalPrice) ? roundMoney(Math.max(0, finalPrice)) : roundMoney(baseAmount);
};

export const getCheckoutServiceFeeAmount = (
  paymentType: string | null | undefined,
  isPaymentEvent: boolean,
  isWaitlist: boolean,
  discount?: AppliedDiscountLike | null,
) => {
  if (!isPaymentEvent || isWaitlist) return 0;
  if (discount?.waives_service_fee === true) return 0;
  return getServiceFeeAmount(paymentType);
};
