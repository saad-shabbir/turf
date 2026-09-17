# Turf — build handoff

**Version:** 1.0 · **Prepared:** September 16, 2026 · **Owner:** Saad

This folder contains the product requirements, technical contracts, and the exact first implementation task. It is a specification package, **not a built app, a working repository, or an IPA**. No iPhone installation, signing, background-location test, or cloud deployment has been performed for this package.

## Start here

1. Create a **private** GitHub repository named `turf`, or open a new local `turf` folder in your coding environment. Copy the *contents* of this package into its root. Keep `AGENTS.md` at the root.
2. Create one **Supabase Free** project. Disable public sign-up. Create two confirmed email/password users in its admin dashboard. Keep passwords out of the repository. Codex will produce the database migrations and an admin-only bootstrap procedure that allowlists these two user IDs.
3. Give Codex repository/folder access. For Codex cloud, connect the private repository and select its environment. For local Codex, open the project folder. Available Codex access and usage limits depend on the user's account; this package does not purchase a plan or require an OpenAI API key. [S21, S22, S26]
4. Paste `CODEX_MILESTONE_1_PROMPT.txt`. Tell Codex to implement **Milestone 1 only**.
5. Review the code and test report. Apply reviewed Supabase migrations and the two-user bootstrap using your own admin access. Configure the public Supabase URL/key locally and in GitHub's build environment.
6. Run the manual GitHub iOS build, retrieve `Turf-unsigned.ipa`, install it with SideStore, and follow `docs/FIELD_TEST_CHECKLIST.md` on both phones.

You can start coding before the cloud accounts are ready. Missing credentials should produce a clear configuration screen and an explicit blocked test, not fake success or fabricated users.

## Files

| File | Purpose |
|---|---|
| `PRD.md` | Full intended Turf product, with launch scope separated from later ideas |
| `TECH_SPEC.md` | Architecture, dependencies, background capture, synchronization, and safety contracts |
| `docs/DATABASE_AND_RLS.md` | Database schema, authorization rules, RPC contracts, and required security tests |
| `docs/BUILD_AND_SIDELOAD.md` | Windows/cloud-Mac build contract and installation runbook |
| `docs/MILESTONE_01.md` | Only the first implementation milestone, with deliverables and pass criteria |
| `CODEX_MILESTONE_1_PROMPT.txt` | Copy-paste task for Codex |
| `AGENTS.md` | Persistent project instructions for coding agents |
| `docs/DECISIONS.md` | What is settled, what is a proposed default, and corrections to older drafts |
| `docs/FIELD_TEST_CHECKLIST.md` | Real-iPhone test record; all results start as NOT TESTED |
| `docs/SOURCES.md` | Official technical references, checked September 16, 2026 |
| `.env.example` | Public app configuration placeholders; no credentials |
| `.gitignore` | Initial exclusions; Codex may extend them without exposing secrets |

## What $0 means

Use existing Windows/iPhone hardware, Supabase Free, GitHub's included standard-runner allowance, and free-account SideStore installation. Cloud build quotas and signing maintenance still apply. No paid map lookup, hosting subscription, Apple membership, SMS/email service, LLM API, or payment service is required for M1. No Mac must be owned locally: a hosted macOS runner compiles the iOS binary. [S03, S11–S13]

The free alpha excludes native remote push. Apple's Personal Team provisioning expires after seven days; SideStore attempts renewal but is a community sideloading path, not an Apple-supported distribution channel or a guarantee of uninterrupted tracking. [S01–S05]

**First proof:** a standalone signed installation on each phone records real region events with the screen locked and sends them to that user's private Supabase records. Do not build the full scoring game before this proof.
