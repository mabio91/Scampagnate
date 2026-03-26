/**
 * Membership is annual — valid until December 31 of the year it was activated.
 * A user is active if membership_status is 'Active' AND
 * the current date is within the membership year (i.e. before Dec 31 of that year).
 */

interface MembershipProfile {
  membership_status?: string | null;
  membership_year?: number | null;
  membership_registration_date?: string | null;
}

export function getMembershipExpiryDate(profile: MembershipProfile | null | undefined): Date | null {
  if (!profile?.membership_registration_date) return null;
  const regDate = new Date(profile.membership_registration_date);
  if (isNaN(regDate.getTime())) return null;
  // Expires on Dec 31 of the registration year
  const year = profile.membership_year || regDate.getFullYear();
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

export function isMembershipActive(profile: MembershipProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.membership_status !== 'Active') return false;
  // If no registration date is set yet, fall back to status-only check
  const expiry = getMembershipExpiryDate(profile);
  if (!expiry) return true;
  return new Date() < expiry;
}

export function isMembershipExpired(profile: MembershipProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.membership_status !== 'Active') return false;
  const expiry = getMembershipExpiryDate(profile);
  if (!expiry) return false;
  return new Date() >= expiry;
}

export function getMembershipExpiryYear(profile: MembershipProfile | null | undefined): number | null {
  const expiry = getMembershipExpiryDate(profile);
  if (!expiry) return null;
  return expiry.getFullYear();
}
