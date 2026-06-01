import { describe, expect, it } from "vitest";

import { getCheckoutServiceFeeAmount, getDiscountedCheckoutAmount } from "@/lib/checkoutPricing";

describe("checkout pricing helpers", () => {
  it("waives the fixed service fee when the applied discount is configured to do so", () => {
    expect(
      getCheckoutServiceFeeAmount("deposit", true, false, {
        discount_type: "percentage",
        discount_value: 100,
        waives_service_fee: true,
      }),
    ).toBe(0);
  });

  it("keeps the fixed service fee for normal online discounts", () => {
    expect(
      getCheckoutServiceFeeAmount("paid", true, false, {
        discount_type: "percentage",
        discount_value: 100,
        waives_service_fee: false,
      }),
    ).toBe(1);
  });

  it("recalculates discounts from the currently selected checkout amount", () => {
    expect(
      getDiscountedCheckoutAmount(45, {
        discount_type: "percentage",
        discount_value: 100,
        final_price: 0,
      }),
    ).toBe(0);

    expect(
      getDiscountedCheckoutAmount(45, {
        discount_type: "fixed",
        discount_value: 10,
        final_price: 0,
      }),
    ).toBe(35);
  });
});
