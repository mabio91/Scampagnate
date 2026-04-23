type MembershipProfileLike = {
  birth_date?: string | null;
  birth_place?: string | null;
  residential_address?: string | null;
};

export const MEMBERSHIP_REQUIRED_FIELDS = [
  { key: "birth_date", label: "Data di nascita" },
  { key: "birth_place", label: "Luogo di nascita" },
  { key: "residential_address", label: "Indirizzo di residenza" },
] as const;

export const hasCompleteMembershipProfile = (profile: MembershipProfileLike | null | undefined) =>
  getMissingMembershipFields(profile).length === 0;

export const getMissingMembershipFields = (profile: MembershipProfileLike | null | undefined) =>
  MEMBERSHIP_REQUIRED_FIELDS.filter(({ key }) => {
    const value = profile?.[key];
    return typeof value !== "string" ? !value : value.trim().length === 0;
  });
