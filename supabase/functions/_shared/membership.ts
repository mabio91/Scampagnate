export type MembershipProfile = Record<string, unknown> | null | undefined;

const REQUIRED_MEMBERSHIP_DATA_FIELDS = [
  "birth_date",
  "sex",
  "birth_place",
  "province_of_birth",
  "residential_address",
  "city_of_residence",
  "province_of_residence",
];

const hasValue = (value: unknown) =>
  typeof value === "string" ? value.trim().length > 0 : value != null;

const normalizedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();

const parseMembershipYear = (value: unknown) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : null;
};

const membershipExpiresAt = (year: number) =>
  new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

export const hasCompleteMembershipData = (profile: MembershipProfile) =>
  !!profile && REQUIRED_MEMBERSHIP_DATA_FIELDS.every((key) => hasValue(profile[key]));

export const hasCurrentYearActiveMembership = (
  profile: MembershipProfile,
  now = new Date(),
) => {
  if (!profile || normalizedString(profile.membership_status).toLowerCase() !== "active") {
    return false;
  }

  const membershipYear = parseMembershipYear(profile.membership_year);
  if (membershipYear != null) {
    return now.getTime() <= membershipExpiresAt(membershipYear).getTime();
  }

  const registrationDateValue = normalizedString(profile.membership_registration_date);
  if (!registrationDateValue) return true;

  const registrationDate = new Date(registrationDateValue);
  if (Number.isNaN(registrationDate.getTime())) return true;

  return now.getTime() <= membershipExpiresAt(registrationDate.getUTCFullYear()).getTime();
};

export const shouldRequireMembershipDataForEventCheckout = (
  profile: MembershipProfile,
  now = new Date(),
) => !hasCurrentYearActiveMembership(profile, now) && !hasCompleteMembershipData(profile);
