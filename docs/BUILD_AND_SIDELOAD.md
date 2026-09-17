# Turf — Build and SideStore runbook

**This is the required build design and user runbook. No Turf IPA has been compiled or installed as part of this handoff.** Codex must implement the scripts, verify the current toolchain, and report the actual results.

## 1. The separation that makes Windows viable

Windows is the development/setup computer. GitHub supplies a hosted macOS runner for Xcode compilation. The output is an **unsigned, physical-device, standalone Release IPA**. Each person uses SideStore to sign and install it on their own iPhone. An unsigned file is not installable by simply opening it in Safari or Files. [S03–S05, S09–S11]

This is a custom sideloading build path. It is not a free Apple distribution membership, and documentation alone does not establish that this exact project signs and runs successfully.

## 2. Account and cost setup

Use a private GitHub repository and standard macOS runner only. The current Free plan lists 2,000 included minutes and 500 MB artifact storage; macOS usage has different costs from Linux, so these are **not 2,000 free Mac minutes**. Check the account's actual allowance and settings. With no valid payment method, GitHub says usage is blocked after quota; with a payment method, explicitly disable/block overages as supported by the account rather than relying on a warning budget alone. [S12]

Use one Supabase Free project. Its listed allowances include 500 MB database storage and 5 GB egress; inactive projects may pause after a week. These are sufficient design targets for compact two-user observations, not a guarantee of unlimited operations. Do not upgrade compute, add a paid custom domain, paid branching, or backup subscriptions. [S13]

No Apple, Expo/EAS, Google Maps, OpenAI API, email, or payment-service credentials are required for the iOS build. Existing Codex access is a separate account entitlement, not included infrastructure supplied by this project. [S26]

## 3. Files Codex must create

- `.github/workflows/build-ios.yml`: manually invoked native build.
- `scripts/build-ios-unsigned.sh`: deterministic native-generation/compile/package process.
- `scripts/verify-ipa.sh`: inspect device platform, bundle and forbidden entitlements.
- `docs/TOOLCHAIN.md`: actual Node/npm/Expo/RN/Xcode/runner/CocoaPods versions, compatibility sources, and observed build result.
- `Gemfile`/lock and `native-locks/Podfile.lock` if used to lock native dependency resolution.

Prefer standard `macos-26` for the currently documented SDK 57 toolchain, selecting a **stable installed Xcode ≥26.4**. Confirm the image's actual installed Xcode versions; runner labels/images change. No larger/paid runner. If the required Xcode is unavailable, fail with the compatibility explanation instead of downloading untrusted toolchains or silently lowering the deployment target. [S06, S11]

## 4. Workflow contract

Required top-level properties (illustrative YAML, to be completed and tested by Codex):

```yaml
name: Build unsigned iOS IPA
on:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: turf-ios-manual
  cancel-in-progress: true
jobs:
  build:
    runs-on: macos-26
    timeout-minutes: 75
    # Checkout, pinned toolchain setup, tests/preflight, native build,
    # IPA verification and short-retention artifact upload follow.
```

Use official GitHub actions pinned to reviewed versions/commit SHAs. Do not include pseudo-SHAs that cannot execute. Configure app URL/publishable key through repository secrets or variables and put them in the **bundling** environment, not only the build-log environment. Treat them as public contents of the resulting app. Never expose service-role keys.

Make iOS builds manual rather than running on every edit. Set artifact retention to **1 day**, upload only the IPA, checksum and short toolchain summary, and delete old build artifacts when appropriate. Do not upload Pods, node_modules, DerivedData, private configs, database dumps, or signing material. Regular JS checks may run on a standard Linux runner to save the Mac allowance.

## 5. Build sequence

1. Check out the commit; print non-secret version information.
2. Install exact JS packages with `npm ci`; run typecheck/lint/tests and native configuration preflight.
3. Run `npx expo prebuild --platform ios --clean --no-install` from the app root. The Expo dependencies/config plugins generate the native project. Do not run this destructive native regeneration against hand-maintained native source. [S09]
4. Install CocoaPods using the reviewed toolchain. If a reviewed `native-locks/Podfile.lock` exists, copy it into `ios/` and enforce it. The first successful resolution must be captured and committed deliberately; do not fabricate a pre-tested lockfile.
5. Determine the generated workspace/shared scheme. For an app named Turf, expect `ios/Turf.xcworkspace` and scheme `Turf`, but validate rather than guessing silently.
6. Build for the iPhone device SDK with signing disabled. The following is the command contract, not a successful-build log:

```bash
set -euo pipefail

xcodebuild \
  -workspace ios/Turf.xcworkspace \
  -scheme Turf \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$PWD/build/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM='' \
  build
```

7. Inspect `build/DerivedData/Build/Products/Release-iphoneos/Turf.app`. Confirm the Release bundle actually embeds its JavaScript/Hermes bundle, assets and required native frameworks. A Release configuration supports standalone bundled execution; a simulator output or a development client waiting for Metro is not acceptable. [S10]
8. Copy that complete `.app` into a clean `Payload/Turf.app` directory. Package `Payload/` at the **root** of the ZIP-format IPA, preserving symlinks and executable permissions, e.g. with `ditto` for copying and `zip -r -y` for packaging. Do not zip an extra outer project folder.
9. Name the result `Turf-unsigned.ipa` and generate SHA-256. Do not invoke an App Store export workflow that asks for paid signing credentials.
10. Upload the verified file as the workflow artifact. Report build failure if any verification fails; merely creating a file with `.ipa` extension does not pass.

## 6. Required artifact inspection

Check actual contents, not just the filename:

- One main app under `Payload/`, valid `Info.plist`, executable present.
- `CFBundleSupportedPlatforms` includes iPhoneOS, not iPhoneSimulator. Inspect the executable's Mach-O build platform as well: arm64 alone does not distinguish a simulator binary.
- Compatible minimum iOS version; consistent bundle identifier/version/build number.
- Bundled runtime code/assets present; no Metro URL dependency for startup.
- Location permission text and intended background mode generated correctly.
- No APNs/Sign in with Apple/associated-domains/app-group capability requests and no embedded personal provisioning file. Required ordinary signing/keychain permissions are supplied by the signer; do not strip the app's privacy features to silence an unrelated error.
- No Supabase admin credentials, Apple credentials, real coordinates, private fixtures, database exports, or secrets in artifact contents/logs.
- Native SQLCipher key generation happens on the phone; no fixed encryption key compiled into the app.

Packaging without signing is expected. Only SideStore installation and device execution establish whether the resulting app is usable.

## 7. Saad's setup after M1 code exists

In Supabase, apply reviewed migrations first and then the two-user allowlist bootstrap. Create/confirm both email/password users through trusted admin tooling; disable public sign-up. Keep a secure record of your own project/account access. Migrations need not be run from the phone.

In GitHub, set the public Supabase URL and publishable key in the build configuration. Open **Actions → Build unsigned iOS IPA → Run workflow**. If the run succeeds, download its artifact ZIP, extract `Turf-unsigned.ipa`, and keep a local copy before retention expires. Download the same artifact for both users, rather than building again just for the friend.

On Windows, follow SideStore's official prerequisites for iTunes/device drivers and iloader. On the iPhone, install LocalDevVPN. Use only the official project/distribution links, not paid signing-certificate sellers or random profiles. [S03]

Connect the iPhone by USB, trust the computer, select it in iloader, sign in with your Apple Account and choose stable SideStore installation. On the phone, complete developer trust and Developer Mode as instructed for its iOS version. Connect LocalDevVPN, open SideStore, sign in with the matching account, and perform SideStore's initial refresh before installing Turf. [S04]

Save `Turf-unsigned.ipa` to Files, then use SideStore's import/install flow. Let it sign the application. Open the resulting **Turf** icon, sign into the Turf account, and continue setup. Do not confuse Turf's six-character friend invite with SideStore's device-pairing file.

## 8. Friend's installation

Send the same IPA to the friend privately. They install SideStore using **their own Apple Account**, then import the IPA and sign into their own Turf account. The same Windows computer can be used for the separate initial device setup. Do not share Apple passwords or copy device-pairing files between people.

Only after both installations work: create/accept Turf's invite, configure each person's own named place, grant background permission, and run the field checklist. The friend does not need to write code, host the backend, or buy a developer membership for this experiment.

## 9. Refresh, updates, and failures

Free signing lasts seven days. SideStore attempts refresh; verify that both SideStore and Turf remain refreshed. Wi-Fi/LocalDevVPN and occasional repair may be needed. Refreshing the signature is different from rebuilding a new app version. [S01, S03–S05]

For code changes, build a new IPA and install it as an update using the same phone's account and stable app identity. Test that login, local queue and geofence registration survive. Re-signing changes or reinstalling can affect local data/keychain access; never promise lossless updates without checking.

If an IPA won't install, distinguish incompatible iOS, unsupported entitlements, wrong device/simulator target, packaging error, signing problem, and SideStore setup failure. If it installs but does not track, distinguish permissions, storage availability, stale registration, background execution, and network/auth failures. Keep sanitized errors and exact versions. Do not respond to a failed test by claiming the app already works in the background.

## 10. No claimed results yet

Native compile: NOT RUN. Artifact inspection: NOT RUN. SideStore installation: NOT RUN. Background observation: NOT RUN. Two-device synchronization: NOT RUN. A Codex code commit may change only the first of these; the others require their actual checks.
