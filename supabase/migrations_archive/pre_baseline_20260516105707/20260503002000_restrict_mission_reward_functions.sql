REVOKE EXECUTE ON FUNCTION public.award_mission_rewards(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_missions_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_registration_mission_sync() FROM PUBLIC, anon, authenticated;
