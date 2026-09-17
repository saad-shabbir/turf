# Sources and verification notes

Official documentation reviewed **September 16, 2026**. Product choices are specified by this package; technical/platform statements use the sources below. Package creation is not evidence that any build or phone test succeeded.

## S01 — Apple — Developer account overview

https://developer.apple.com/help/account/basics/about-your-developer-account/

Personal Team/free-provisioning limits; seven-day expiry.

## S02 — Apple — App Distribution, WWDC19 session 304

https://developer.apple.com/videos/play/wwdc2019/304/

Apple explicitly describes Personal Team capability limits including APNs. This is an older official explanation, not a claim of an iOS runtime test.

## S03 — SideStore — Prerequisites

https://docs.sidestore.io/docs/installation/prerequisites

Supported initial computer setup, Windows requirements, Wi-Fi and LocalDevVPN.

## S04 — SideStore — Install

https://docs.sidestore.io/docs/installation/install

iloader, developer trust/mode, initial refresh, and pairing-file repair.

## S05 — SideStore — FAQ

https://docs.sidestore.io/docs/faq

Personal signing, refresh behavior, three-app limit, and operational caveats.

## S06 — Expo — SDK reference

https://docs.expo.dev/versions/latest/

Current compatibility matrix: SDK 57 / RN 0.86 / React 19.2.3 / Node 22.13.x minimum / iOS 16.4+ / Xcode 26.4+. Recheck stable releases when scaffolding.

## S07 — Expo — Location

https://docs.expo.dev/versions/latest/sdk/location/

Geofencing setup, permissions, callback shape, initial state, platform limitations and region cap.

## S08 — Expo — TaskManager

https://docs.expo.dev/versions/latest/sdk/task-manager/

Module-scope task execution and task event identifiers.

## S09 — Expo — Continuous Native Generation

https://docs.expo.dev/workflow/continuous-native-generation/

Generate native iOS projects from app configuration and plugins.

## S10 — Expo — CLI

https://docs.expo.dev/more/expo-cli/

Release bundling and the distinction between simulator and physical-device outputs.

## S11 — GitHub — Hosted runners

https://docs.github.com/en/actions/reference/runners/github-hosted-runners

Standard macOS runner availability and environment characteristics.

## S12 — GitHub — Actions billing

https://docs.github.com/en/billing/concepts/product-billing/github-actions

Included private-repository quotas, storage, runner costs, and blocked usage without a payment method.

## S13 — Supabase — Pricing

https://supabase.com/pricing

Free-plan quotas and inactivity pausing; not an unlimited-usage guarantee.

## S14 — Supabase — Row Level Security

https://supabase.com/docs/guides/database/postgres/row-level-security

RLS policies, authorization hazards, views and privileged roles.

## S15 — Supabase — Database functions

https://supabase.com/docs/guides/database/functions

Database RPCs, function grants, definer versus invoker and fixed search paths.

## S16 — Supabase — React Native Auth

https://supabase.com/docs/guides/auth/quickstarts/react-native

Client Auth setup and app-lifecycle handling; Turf adds stronger storage requirements.

## S17 — Supabase — API keys

https://supabase.com/docs/guides/getting-started/api-keys

Publishable/client versus privileged server keys.

## S18 — Expo — SecureStore

https://docs.expo.dev/versions/latest/sdk/securestore/

Keychain accessibility, large-value errors and persistence behavior.

## S19 — Expo — SQLite

https://docs.expo.dev/versions/latest/sdk/sqlite/

Durable local database; SQLCipher option and native configuration.

## S20 — Apple — Region Monitoring and iBeacon (archived guide)

https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/LocationAwarenessPG/RegionMonitoring/RegionMonitoring.html

System region monitoring, boundary behavior and Background App Refresh caveats. Verify current-device behavior rather than assuming every historical detail is unchanged.

## S21 — OpenAI — AGENTS.md guidance

https://developers.openai.com/codex/guides/agents-md/

Repository-specific coding-agent instructions. The official URL may redirect to the current documentation site.

## S22 — OpenAI — Codex cloud

https://developers.openai.com/codex/cloud

Repository-connected development environments and review workflow.

## S23 — Supabase — Cron

https://supabase.com/docs/guides/cron

Backend scheduling for future deadline evaluation and retention, independent of phones being open.

## S24 — Supabase — Auth general configuration

https://supabase.com/docs/guides/auth/general-configuration

Public sign-up and email-confirmation configuration.

## S25 — Supabase — Column Level Security

https://supabase.com/docs/guides/database/postgres/column-level-security

Column privileges are distinct from row filtering.

## S26 — OpenAI — Codex pricing

https://developers.openai.com/codex/pricing

Coding-tool access is separate from the app infrastructure budget and subject to account limits.

## How to use these sources

Stable API behavior and billing conditions can change. Codex must verify the SDK/runner combination, lock dependency versions, and record any discrepancy in `docs/TOOLCHAIN.md`. Never replace failed native-device tests with assumptions from documentation. The custom unsigned packaging pipeline in this specification is a proposed implementation, not a vendor-provided end-to-end SideStore guarantee.
