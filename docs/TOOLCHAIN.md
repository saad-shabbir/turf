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

Planned native toolchain: standard macos-26, stable installed Xcode >=26.4,
CocoaPods 1.16.2. Exact runner/Ruby/Xcode versions are printed by the actual build.
No native Podfile.lock existed before the first Mac resolution; it is not fabricated.

Local results: strict typecheck PASS; lint PASS; two native-adapter/validation tests
PASS; seven disposable PostgreSQL suites PASS; native config introspection PASS.
The local dependency installation used `--ignore-scripts` because this sandbox
blocks npm child-process spawning. The cloud workflow runs normal `npm ci`.

Native compile / IPA inspection: pending first cloud run. Installed / field-tested:
NOT TESTED. SQLCipher wrong-key test on actual native library: NOT RUN.
