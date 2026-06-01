import { describe, expect, it } from "vitest";
import { buildRegistrationChangeQuote } from "../../supabase/functions/_shared/registration-change";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<{ column: string; value: unknown; operator: "eq" | "neq" | "in" }> = [];

  constructor(
    private readonly tables: Record<string, Row[]>,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value, operator: "eq" });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, value, operator: "neq" });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, value, operator: "in" });
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({
      data: this.matchingRows(),
      error: null,
      count: this.matchingRows().length,
    }).then(onfulfilled, onrejected);
  }

  async single() {
    const row = this.matchingRows()[0] ?? null;
    return row ? { data: row, error: null } : { data: null, error: new Error("No rows") };
  }

  async maybeSingle() {
    return { data: this.matchingRows()[0] ?? null, error: null };
  }

  private rows() {
    this.tables[this.table] ||= [];
    return this.tables[this.table];
  }

  private matchingRows() {
    return this.rows().filter((row) => this.matches(row));
  }

  private matches(row: Row) {
    return this.filters.every(({ column, value, operator }) => {
      if (operator === "eq") return row[column] === value;
      if (operator === "neq") return row[column] !== value;
      return Array.isArray(value) && value.includes(row[column]);
    });
  }
}

const createFakeSupabase = (tables: Record<string, Row[]>) => ({
  from: (table: string) => new FakeQuery(tables, table),
});

const baseTables = (registration: Row, priceOptions: Row[], discountCodeUsage: Row[] = []) => ({
  event_registrations: [registration],
  events: [{
    id: "event_1",
    title: "Escursione test",
    date: "2099-06-01",
    time: "10:00",
    price: 0,
    deposit: 0,
    payment_type: "paid",
    balance_payment_mode: "online",
  }],
  event_price_options: priceOptions.map((option) => ({
    event_id: "event_1",
    has_dedicated_spots: false,
    dedicated_spots: null,
      ...option,
    })),
  discount_code_usage: discountCodeUsage,
});

describe("buildRegistrationChangeQuote", () => {
  it("charges only the price delta when a fully paid registration upgrades", async () => {
    const quote = await buildRegistrationChangeQuote(createFakeSupabase(baseTables({
      id: "reg_1",
      event_id: "event_1",
      user_id: "user_1",
      status: "paid",
      payment_status: "paid",
      price_option_id: "standard",
      amount_paid: 21,
      service_fee_amount: 1,
      total_price_amount: null,
      sport_level: "intermediate",
    }, [
      { id: "standard", name: "Standard", price: 20, payment_type: "paid" },
      { id: "premium", name: "Premium", price: 35, payment_type: "paid" },
    ])), {
      registrationId: "reg_1",
      eventId: "event_1",
      userId: "user_1",
      newPriceOptionId: "premium",
    });

    expect(quote).toMatchObject({
      oldTotalAmount: 20,
      newTotalAmount: 35,
      eventPaidBefore: 20,
      additionalPaymentAmount: 15,
      refundAmount: 0,
      newAmountPaid: 36,
      newPaymentStatus: "paid",
      newRegistrationStatus: "paid",
    });
  });

  it("quotes an automatic refund when a fully paid registration downgrades", async () => {
    const quote = await buildRegistrationChangeQuote(createFakeSupabase(baseTables({
      id: "reg_1",
      event_id: "event_1",
      user_id: "user_1",
      status: "paid",
      payment_status: "paid",
      price_option_id: "premium",
      amount_paid: 36,
      service_fee_amount: 1,
      total_price_amount: null,
      sport_level: "intermediate",
    }, [
      { id: "standard", name: "Standard", price: 20, payment_type: "paid" },
      { id: "premium", name: "Premium", price: 35, payment_type: "paid" },
    ])), {
      registrationId: "reg_1",
      eventId: "event_1",
      userId: "user_1",
      newPriceOptionId: "standard",
    });

    expect(quote).toMatchObject({
      oldTotalAmount: 35,
      newTotalAmount: 20,
      eventPaidBefore: 35,
      additionalPaymentAmount: 0,
      refundAmount: 15,
      newAmountPaid: 21,
      newPaymentStatus: "paid",
      newRegistrationStatus: "paid",
    });
  });

  it("keeps a deposit paid registration active when a cheaper deposit option still has a balance", async () => {
    const quote = await buildRegistrationChangeQuote(createFakeSupabase(baseTables({
      id: "reg_1",
      event_id: "event_1",
      user_id: "user_1",
      status: "deposit_paid",
      payment_status: "deposit_paid",
      price_option_id: "premium",
      amount_paid: 21,
      service_fee_amount: 1,
      total_price_amount: 80,
      balance_due_amount: 60,
      sport_level: "intermediate",
    }, [
      {
        id: "standard",
        name: "Standard",
        price: 50,
        payment_type: "deposit",
        deposit_amount: 10,
        balance_payment_mode: "online",
      },
      {
        id: "premium",
        name: "Premium",
        price: 80,
        payment_type: "deposit",
        deposit_amount: 20,
        balance_payment_mode: "online",
      },
    ])), {
      registrationId: "reg_1",
      eventId: "event_1",
      userId: "user_1",
      newPriceOptionId: "standard",
    });

    expect(quote).toMatchObject({
      oldTotalAmount: 80,
      newTotalAmount: 50,
      eventPaidBefore: 20,
      targetEventPaidAmount: 20,
      additionalPaymentAmount: 0,
      refundAmount: 0,
      newAmountPaid: 21,
      newBalanceDueAmount: 30,
      newDepositAmount: 10,
      newPaymentStatus: "deposit_paid",
      newRegistrationStatus: "deposit_paid",
    });
  });

  it("counts a discount-covered deposit as settled credit when changing formula", async () => {
    const quote = await buildRegistrationChangeQuote(createFakeSupabase(baseTables({
      id: "reg_1",
      event_id: "event_1",
      user_id: "user_1",
      status: "deposit_paid",
      payment_status: "deposit_paid",
      price_option_id: "deposit_base",
      amount_paid: 0,
      service_fee_amount: 0,
      total_price_amount: 45,
      balance_due_amount: 25,
      sport_level: "intermediate",
    }, [
      {
        id: "deposit_base",
        name: "Escursione",
        price: 45,
        payment_type: "deposit",
        deposit_amount: 20,
        balance_payment_mode: "online",
      },
      {
        id: "deposit_plus",
        name: "Escursione + degustazione",
        price: 85,
        payment_type: "deposit",
        deposit_amount: 20,
        balance_payment_mode: "online",
      },
    ], [
      {
        discount_code_id: "discount_1",
        event_id: "event_1",
        user_id: "user_1",
        original_price: 20,
        discounted_price: 0,
      },
    ])), {
      registrationId: "reg_1",
      eventId: "event_1",
      userId: "user_1",
      newPriceOptionId: "deposit_plus",
    });

    expect(quote).toMatchObject({
      oldTotalAmount: 45,
      newTotalAmount: 85,
      amountPaidBefore: 0,
      cashEventPaidBefore: 0,
      discountCreditBefore: 20,
      eventPaidBefore: 20,
      targetEventPaidAmount: 20,
      additionalPaymentAmount: 0,
      refundAmount: 0,
      newAmountPaid: 0,
      newBalanceDueAmount: 65,
      newPaymentStatus: "deposit_paid",
      newRegistrationStatus: "deposit_paid",
    });
  });

  it("does not refund cash when only a discount covered the previous payment", async () => {
    const quote = await buildRegistrationChangeQuote(createFakeSupabase(baseTables({
      id: "reg_1",
      event_id: "event_1",
      user_id: "user_1",
      status: "deposit_paid",
      payment_status: "deposit_paid",
      price_option_id: "premium",
      amount_paid: 0,
      service_fee_amount: 0,
      total_price_amount: 80,
      balance_due_amount: 60,
      sport_level: "intermediate",
    }, [
      {
        id: "standard",
        name: "Standard",
        price: 10,
        payment_type: "deposit",
        deposit_amount: 10,
        balance_payment_mode: "online",
      },
      {
        id: "premium",
        name: "Premium",
        price: 80,
        payment_type: "deposit",
        deposit_amount: 20,
        balance_payment_mode: "online",
      },
    ], [
      {
        discount_code_id: "discount_1",
        event_id: "event_1",
        user_id: "user_1",
        original_price: 20,
        discounted_price: 0,
      },
    ])), {
      registrationId: "reg_1",
      eventId: "event_1",
      userId: "user_1",
      newPriceOptionId: "standard",
    });

    expect(quote).toMatchObject({
      eventPaidBefore: 20,
      targetEventPaidAmount: 10,
      additionalPaymentAmount: 0,
      refundAmount: 0,
      newAmountPaid: 0,
      newBalanceDueAmount: 0,
      newPaymentStatus: "paid",
      newRegistrationStatus: "paid",
    });
  });
});
