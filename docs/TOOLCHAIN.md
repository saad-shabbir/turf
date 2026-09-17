# Observed M1 toolchain

Local host: Windows, Node **24.19.0**, npm **11.6.1**.
Expo **57.0.23**, React Native **0.86.3**, React **19.2.3**.
Exact direct versions and transitive integrity hashes are in package.json and
package-lock.json. Native modules were selected by `expo install`, then pinned.
React DOM 19.2.3 and Worklets 0.10.1/Reanimated 4.5.1 satisfy Router's compatible
peer dependencies; no web or later-game product is implemented.

Compatibility references checked during implementation:
- https://docs.expo.dev/versions/latest/
- https://expo.dev/changelog/sdk-57
- https://docs.expo.dev/versions/v57.0.0/sdk/location/
- https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/
- https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md

Observed native toolchain: standard macos-26, Xcode **26.4.1**, iPhoneOS 26.4 SDK,
deployment target iOS 16.4, CocoaPods **1.17.0**, Ruby 3.4 on the runner.
The runner selected its newer CocoaPods despite installing 1.16.2; the build script
now explicitly pins/invokes the observed 1.17.0. The actual resolved Podfile.lock
from run 35183366492 is committed in native-locks and enforced with --deployment.

Local results: strict typecheck PASS; lint PASS; four native-adapter/validation tests
PASS; ten disposable PostgreSQL suites PASS; native config introspection PASS;
four synthetic packaging-inspector tests PASS.
The local dependency installation used `--ignore-scripts` because this sandbox
blocks npm child-process spawning. The cloud workflow runs normal `npm ci`.

Native compile and IPA inspection: **PASS** on run **35184213560** (commit 0725676),
with committed Podfile.lock and explicit CocoaPods 1.17.0. Ruby **3.4.10**.
Earlier inspection failures were caused by a harmless Supabase prefix and adjacent
Hermes strings; the final inspector decodes string boundaries before scanning.
Installed / field-tested: NOT TESTED. Native SQLCipher wrong-key test: NOT RUN;
the owner can run the separate synthetic storage diagnostic after installation.
