type MembershipProfileLike = {
  sex?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  province_of_birth?: string | null;
  residential_address?: string | null;
  city_of_residence?: string | null;
  province_of_residence?: string | null;
};

export const MEMBERSHIP_REQUIRED_FIELDS = [
  { key: "birth_date", label: "Data di nascita" },
  { key: "sex", label: "Sesso anagrafico" },
  { key: "birth_place", label: "Luogo di nascita" },
  { key: "province_of_birth", label: "Provincia di nascita" },
  { key: "residential_address", label: "Indirizzo di residenza" },
  { key: "city_of_residence", label: "Città di residenza" },
  { key: "province_of_residence", label: "Provincia di residenza" },
] as const;

export const hasCompleteMembershipProfile = (profile: MembershipProfileLike | null | undefined) =>
  getMissingMembershipFields(profile).length === 0;

export const getMissingMembershipFields = (profile: MembershipProfileLike | null | undefined) =>
  MEMBERSHIP_REQUIRED_FIELDS.filter(({ key }) => {
    const value = profile?.[key];
    return typeof value !== "string" ? !value : value.trim().length === 0;
  });
