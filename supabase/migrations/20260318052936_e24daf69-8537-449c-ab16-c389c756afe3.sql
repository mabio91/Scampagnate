-- Backfill membership_registration_date for existing active members who are missing it
UPDATE profiles
SET membership_registration_date = created_at
WHERE membership_status = 'Active'
  AND membership_registration_date IS NULL;