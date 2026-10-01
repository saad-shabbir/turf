# ClassStreak

An iPhone app built from the v4 brief and supplied designs. Turf is the historical application name; the installed bundle identifier remains com.turf.privatealpha.

See [the runbook](docs/CLASSSTREAK_RUNBOOK.md) for setup, .env, SideStore builds, database deployment and Debug. See [build evidence](BUILD_STATUS.md) for verified checks and remaining device acceptance. [Decisions](DECISIONS.md) records implementation choices.

The local phone package is `build/ClassStreak.ipa`: transfer it to your iPhone and select it in SideStore. It keeps the existing Turf bundle identifier so it can update that installation. The local package includes studio search; the GitHub native artifact uses the map-pin fallback.

Keep `EXPO_PUBLIC_GOOGLE_PLACES_KEY`, `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in ignored `.env`; `.env.example` contains no keys. Restrict the Google key in Google Cloud to iOS bundle identifier `com.turf.privatealpha` and the Places API only: an `EXPO_PUBLIC_` value is bundled into the app. Never add a Supabase service-role key to the client.

Debug: Profile → Account → tap the version five times. Demo data, simulation controls and inspection are available there; simulated sessions are labeled and do not enter studio boards.
