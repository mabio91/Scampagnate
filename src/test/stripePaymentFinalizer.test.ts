import { describe, expect, it } from "vitest";
import { finalizeEventCheckoutSession } from "../../supabase/functions/_shared/stripe-payment-finalizer";

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<{ column: string; value: unknown; operator: "eq" | "neq" }> = [];
  private updateValues: Row | null = null;
  private shouldDelete = false;

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

  update(values: Row) {
    this.updateValues = values;
    return this;
  }

  delete() {
    this.shouldDelete = true;
    return this;
  }

  async insert(values: Row) {
    this.rows().push({ ...values });
    return { data: null, error: null };
  }

  async single() {
    const row = this.matchingRows()[0] ?? null;
    return row ? { data: row, error: null } : { data: null, error: new Error("No rows") };
  }

  async maybeSingle() {
    return { data: this.matchingRows()[0] ?? null, error: null };
  }

  then<TResult1 = { data: null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    try {
      if (this.updateValues) {
        const rows = this.matchingRows();
        const updateError = rows.find((row) => row.__updateError && this.updateValues?.status !== "waitlist");
        if (updateError) {
          return Promise.resolve({
            data: null,
            error: new Error(String(updateError.__updateError)),
          }).then(onfulfilled as never, onrejected);
        }
        for (const row of rows) Object.assign(row, this.updateValues);
      }

      if (this.shouldDelete) {
        const keep = this.rows().filter((row) => !this.matches(row));
        this.tables[this.table] = keep;
      }

      return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }

  private rows() {
    this.tables[this.table] ||= [];
    return this.tables[this.table];
  }

  private matchingRows() {
    return this.rows().filter((row) => this.matches(row));
  }

  private matches(row: Row) {
    return this.filters.every(({ column, value, operator }) =>
      operator === "eq" ? row[column] === value : row[column] !== value,
    );
  }
}

const createFakeSupabase = (tables: Record<string, Row[]>) => ({
  from: (table: string) => new FakeQuery(tables, table),
  rpc: async () => ({ data: [], error: null }),
});

const createStripe = (balanceTransaction?: Row) => {
  const refunds: Row[] = [];
  return {
    client: {
      refunds: {
        create: async (params: Row) => {
          refunds.push(params);
          return {};
        },
      },
      paymentIntents: {
        retrieve: async () => ({
          latest_charge: balanceTransaction
            ? { balance_transaction: balanceTransaction }
            : null,
        }),
      },
    },
    refunds,
  };
};

describe("finalizeEventCheckoutSession", () => {
  it("records discount usage only after a paid checkout is finalized", async () => {
    const tables = {
      event_registrations: [{
        id: "reg_1",
        user_id: "user_1",
        event_id: "event_1",
        status: "pending_payment",
        payment_status: "pending",
        amount_paid: null,
        service_fee_amount: 0,
        total_price_amount: 20,
        deposit_amount: null,
        balance_due_amount: null,
        price_option_id: null,
      }],
      events: [{
        id: "event_1",
        status: "open",
        spots_total: 10,
        spots_taken: 0,
        title: "Evento test",
      }],
      discount_code_usage: [],
    };
    const stripe = createStripe();

    const result = await finalizeEventCheckoutSession({
      session: {
        payment_status: "paid",
        payment_intent: "pi_1",
        metadata: {
          registration_id: "reg_1",
          event_id: "event_1",
          user_id: "user_1",
          checkout_kind: "full",
          booking_amount_cents: "0",
          service_fee_cents: "0",
          discount_code_id: "coupon_1",
          discount_original_cents: "2000",
          discount_final_cents: "0",
        },
      },
      stripe: stripe.client,
      supabaseAdmin: createFakeSupabase(tables),
    });

    expect(result.success).toBe(true);
    expect(tables.event_registrations[0]).toMatchObject({
      status: "paid",
      payment_status: "paid",
      stripe_payment_intent_id: "pi_1",
      amount_paid: 0,
    });
    expect(tables.discount_code_usage).toEqual([{
      discount_code_id: "coupon_1",
      user_id: "user_1",
      event_id: "event_1",
      original_price: 20,
      discounted_price: 0,
    }]);
  });

  it("does not duplicate discount usage when finalization is retried", async () => {
    const tables = {
      event_registrations: [{
        id: "reg_1",
        user_id: "user_1",
        event_id: "event_1",
        status: "paid",
        payment_status: "paid",
        amount_paid: 0,
        service_fee_amount: 0,
        total_price_amount: 20,
        deposit_amount: null,
        balance_due_amount: null,
        price_option_id: null,
      }],
      discount_code_usage: [{
        id: "usage_1",
        discount_code_id: "coupon_1",
        user_id: "user_1",
        event_id: "event_1",
        original_price: 20,
        discounted_price: 0,
      }],
    };
    const stripe = createStripe();

    const result = await finalizeEventCheckoutSession({
      session: {
        payment_status: "paid",
        payment_intent: "pi_1",
        metadata: {
          registration_id: "reg_1",
          event_id: "event_1",
          user_id: "user_1",
          checkout_kind: "full",
          booking_amount_cents: "0",
          discount_code_id: "coupon_1",
          discount_original_cents: "2000",
          discount_final_cents: "0",
        },
      },
      stripe: stripe.client,
      supabaseAdmin: createFakeSupabase(tables),
    });

    expect(result.success).toBe(true);
    expect(tables.discount_code_usage).toHaveLength(1);
  });

  it("stores Stripe fee details on paid ledger rows when available", async () => {
    const tables = {
      event_registrations: [{
        id: "reg_1",
        user_id: "user_1",
        event_id: "event_1",
        status: "pending_payment",
        payment_status: "pending",
        amount_paid: null,
        service_fee_amount: 0,
        total_price_amount: 40,
        deposit_amount: null,
        balance_due_amount: null,
        price_option_id: null,
      }],
      events: [{
        id: "event_1",
        status: "open",
        spots_total: 10,
        spots_taken: 0,
        title: "Evento test",
      }],
      discount_code_usage: [],
      registration_payment_transactions: [],
      user_payment_transactions: [],
    };
    const stripe = createStripe({ id: "txn_1", fee: 120, net: 3980 });

    const result = await finalizeEventCheckoutSession({
      session: {
        id: "cs_1",
        payment_status: "paid",
        payment_intent: "pi_1",
        amount_total: 4100,
        metadata: {
          registration_id: "reg_1",
          event_id: "event_1",
          user_id: "user_1",
          checkout_kind: "full",
          booking_amount_cents: "4100",
          event_amount_cents: "4000",
          service_fee_cents: "100",
        },
      },
      stripe: stripe.client,
      supabaseAdmin: createFakeSupabase(tables),
    });

    expect(result.success).toBe(true);
    expect(tables.user_payment_transactions[0]).toMatchObject({
      stripe_payment_intent_id: "pi_1",
      stripe_fee_amount: 1.2,
      stripe_net_amount: 39.8,
      stripe_balance_transaction_id: "txn_1",
    });
  });

  it("refunds cancelled registrations without recording coupon usage", async () => {
    const tables = {
      event_registrations: [{
        id: "reg_1",
        user_id: "user_1",
        event_id: "event_1",
        status: "cancelled",
        payment_status: "pending",
        amount_paid: null,
        service_fee_amount: 0,
        total_price_amount: 20,
        deposit_amount: null,
        balance_due_amount: null,
        price_option_id: null,
      }],
      discount_code_usage: [],
    };
    const stripe = createStripe();

    const result = await finalizeEventCheckoutSession({
      session: {
        payment_status: "paid",
        payment_intent: "pi_1",
        metadata: {
          registration_id: "reg_1",
          event_id: "event_1",
          user_id: "user_1",
          checkout_kind: "full",
          booking_amount_cents: "2100",
          discount_code_id: "coupon_1",
          discount_original_cents: "2000",
          discount_final_cents: "0",
        },
      },
      stripe: stripe.client,
      supabaseAdmin: createFakeSupabase(tables),
    });

    expect(result.success).toBe(false);
    expect(result.auto_refunded).toBe(true);
    expect(stripe.refunds).toEqual([{ payment_intent: "pi_1", amount: 2100 }]);
    expect(tables.discount_code_usage).toEqual([]);
    expect(tables.event_registrations[0]).toMatchObject({
      status: "cancelled",
      payment_status: "refunded",
      refund_status: "completed",
    });
  });

  it("refunds and waitlists when the database capacity guard rejects finalization", async () => {
    const tables = {
      event_registrations: [{
        id: "reg_1",
        user_id: "user_1",
        event_id: "event_1",
        status: "pending_payment",
        payment_status: "pending",
        amount_paid: null,
        service_fee_amount: 0,
        total_price_amount: 20,
        deposit_amount: null,
        balance_due_amount: null,
        price_option_id: null,
        __updateError: "Questa formula non ha più posti dedicati disponibili.",
      }],
      events: [{
        id: "event_1",
        status: "open",
        spots_total: 10,
        spots_taken: 0,
        title: "Evento test",
      }],
      notifications: [],
      user_payment_transactions: [],
    };
    const stripe = createStripe();

    const result = await finalizeEventCheckoutSession({
      session: {
        id: "cs_1",
        payment_status: "paid",
        payment_intent: "pi_1",
        metadata: {
          registration_id: "reg_1",
          event_id: "event_1",
          user_id: "user_1",
          checkout_kind: "full",
          booking_amount_cents: "2100",
          service_fee_cents: "100",
        },
      },
      stripe: stripe.client,
      supabaseAdmin: createFakeSupabase(tables),
    });

    expect(result).toMatchObject({
      success: false,
      spot_taken: true,
      auto_refunded: true,
      eventId: "event_1",
    });
    expect(stripe.refunds).toEqual([{ payment_intent: "pi_1", amount: 2100 }]);
    expect(tables.event_registrations[0]).toMatchObject({
      status: "waitlist",
      payment_status: "refunded",
      refund_status: "completed",
    });
    expect(tables.notifications[0]).toMatchObject({
      user_id: "user_1",
      type: "waitlist_spot_lost",
      event_id: "event_1",
    });
  });
});
