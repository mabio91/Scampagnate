import { describe, expect, it } from "vitest";
import {
  hasCurrentYearActiveMembership,
  shouldRequireMembershipDataForEventCheckout,
} from "../../supabase/functions/_shared/membership.ts";

const completeProfile = {
  birth_date: "1990-01-01",
  sex: "M",
  birth_place: "Roma",
  province_of_birth: "RM",
  residential_address: "Via Roma 1",
  city_of_residence: "Roma",
  province_of_residence: "RM",
};

describe("event checkout membership policy", () => {
  const during2026 = new Date("2026-05-28T12:00:00Z");

  it("does not require membership profile data when the user is already an active member", () => {
    const profile = {
      ...completeProfile,
      membership_status: "Active",
      membership_year: 2026,
      sex: null,
    };

    expect(hasCurrentYearActiveMembership(profile, during2026)).toBe(true);
    expect(shouldRequireMembershipDataForEventCheckout(profile, during2026)).toBe(false);
  });

  it("requires membership profile data when checkout must activate membership", () => {
    const profile = {
      ...completeProfile,
      membership_status: "Inactive",
      membership_year: null,
      sex: "",
    };

    expect(hasCurrentYearActiveMembership(profile, during2026)).toBe(false);
    expect(shouldRequireMembershipDataForEventCheckout(profile, during2026)).toBe(true);
  });

  it("treats an active membership from a past year as expired", () => {
    const profile = {
      ...completeProfile,
      membership_status: "Active",
      membership_year: 2025,
    };

    expect(hasCurrentYearActiveMembership(profile, during2026)).toBe(false);
    expect(shouldRequireMembershipDataForEventCheckout(profile, during2026)).toBe(false);
  });
});
