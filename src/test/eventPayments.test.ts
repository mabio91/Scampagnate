import { describe, expect, it } from "vitest";

import { getDepositPaymentLabel } from "@/lib/eventPayments";
import type { EventPricingLike, PriceOptionLike } from "@/lib/priceOptions";

const depositRegistration = {
  status: "deposit_paid",
  payment_status: "deposit_paid",
  balance_due_amount: 25,
};

const depositEvent: EventPricingLike = {
  payment_type: "deposit",
  price: 40,
  deposit: 15,
};

describe("deposit payment labels", () => {
  it("shows the deposit-paid registration label when the balance is due on site", () => {
    expect(
      getDepositPaymentLabel(
        depositRegistration,
        { ...depositEvent, balance_payment_mode: "on_site" },
      ),
    ).toBe("Iscritto - Acconto pagato");
  });

  it("shows the balance-due label when the remaining balance is online", () => {
    expect(
      getDepositPaymentLabel(
        depositRegistration,
        { ...depositEvent, balance_payment_mode: "online" },
      ),
    ).toBe("Iscritto - Da saldare");
  });

  it("falls back to the selected price option payment mode", () => {
    const priceOption: PriceOptionLike = {
      id: "early-bird",
      payment_type: "deposit",
      price: 40,
      deposit_amount: 15,
      balance_payment_mode: "on_site",
    };

    expect(
      getDepositPaymentLabel(
        { ...depositRegistration, balance_due_amount: 0 },
        { ...depositEvent, balance_payment_mode: "online" },
        priceOption,
      ),
    ).toBe("Iscritto - Acconto pagato");
  });

  it("does not override a fully paid online balance registration", () => {
    expect(
      getDepositPaymentLabel(
        { status: "paid", payment_status: "paid", balance_due_amount: 0 },
        { ...depositEvent, balance_payment_mode: "online" },
      ),
    ).toBeNull();
  });
});
