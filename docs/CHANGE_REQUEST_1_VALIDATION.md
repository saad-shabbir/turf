# Change request 1 validation

- TypeScript, repository lint and pinned configuration checks pass.
- 23 ClassStreak automated cases pass across the full suite and affected follow-up runs, including new custom activity/two-place setup, per-activity schedules, deferred goals, custom reaction toggle, comments, private demo boards, sanitized week details, radius-filtered location retention and per-activity reminder selection.
- Browser walkthrough at 320×710 and 390×844: Welcome → How it works → activities and Back; custom Climbing tile and schedule; save a second studio with Saved check; goals save confirmation; League row expansion; reaction on/off; custom emoji; comment insertion/count; aligned Profile columns and camera control. Weekly bars are deliberately static.
- Supabase incremental change deployed on 2026-09-21. Baseline: two Auth users, zero ClassStreak profiles, nine existing Turf public tables. After transaction: two Auth users, zero ClassStreak profiles, new schedules RLS enabled. No real account or session was created for testing.
- Browser uses isolated sample state and disposable database fixtures. It does not exercise camera, haptics, native emoji keyboard, HealthKit, widgets, Supabase sign-in, or background region callbacks.
- The final iPhone bundle is compiled in Release/Hermes mode and packaged into the previously verified native artifact only after unchanged-native-input checks. Physical iPhone/SideStore acceptance remains NOT TESTED.
- Existing pending setup decisions remain: new account signup, Auth redirect allowlist and public invite-page hosting. Existing Auth accounts are preserved. No pending access/hosting change was made during this request.
