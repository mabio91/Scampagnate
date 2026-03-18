/**
 * Membership is annual — a user is considered an active member only if
 * their membership_status is 'Active' AND membership_year matches the current year.
 */

interface MembershipProfile {
  membership_status?: string | null;
  membership_year?: number | null;
}

export function isMembershipActive(profile: MembershipProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.membership_status !== 'Active') return false;
  const currentYear = new Date().getFullYear();
  return profile.membership_year === currentYear;
}

export function isMembershipExpired(profile: MembershipProfile | null | undefined): boolean {
  if (!profile) return false;
  return (
    profile.membership_status === 'Active' &&
    !!profile.membership_year &&
    profile.membership_year < new Date().getFullYear()
  );
}

export function getMembershipExpiryYear(profile: MembershipProfile | null | undefined): number | null {
  if (!profile?.membership_year) return null;
  return profile.membership_year;
}
