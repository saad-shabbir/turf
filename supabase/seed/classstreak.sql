-- Run as an authenticated test user through cs_seed_demo, never with an invented Auth ID.
-- The Debug button calls this RPC using the signed-in user's bearer token.
select public.cs_seed_demo(false, '[]'::jsonb);
-- Cleanup is scoped to that same owner's demo friends and source='seed' sessions:
-- select public.cs_seed_demo(true, '[]'::jsonb);
