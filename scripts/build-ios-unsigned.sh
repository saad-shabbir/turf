#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'Requires hosted macOS and Xcode'; exit 1; }
cd "$(dirname "$0")/.."
export EXPO_NO_TELEMETRY=1
export CI=1
node scripts/check-config.mjs
# Select only a stable, installed Xcode meeting SDK 57 requirements.
selected=''
for candidate in /Applications/Xcode*.app; do
  [[ "$candidate" != *beta* && "$candidate" != *Beta* ]] || continue
  version="$(DEVELOPER_DIR="$candidate/Contents/Developer" xcodebuild -version | head -1 | awk '{print $2}')"
  if python3 -c 'import sys; v=tuple(map(int,sys.argv[1].split(".")));sys.exit(0 if v >= (26,4) else 1)' "$version"; then selected="$candidate/Contents/Developer"; break; fi
done
[[ -n "$selected" ]] || { echo 'No stable installed Xcode >=26.4. Check standard macos-26 image compatibility.'; exit 1; }
export DEVELOPER_DIR="$selected"
mkdir -p build
{ node --version; npm --version; xcodebuild -version; ruby --version; pod _1.17.0_ --version; } > build/toolchain.txt
[[ ! -d ios ]] || { echo 'Refusing to overwrite an existing native tree. Run in a fresh checkout.'; exit 1; }
npx --no-install expo prebuild --platform ios --clean --no-install
if [[ -f native-locks/Podfile.lock ]]; then
  cp native-locks/Podfile.lock ios/Podfile.lock
  (cd ios && pod _1.17.0_ install --deployment)
else
  echo 'FIRST NATIVE RESOLUTION: Podfile.lock must be reviewed and committed before claiming reproducibility.' | tee -a build/toolchain.txt
  (cd ios && pod _1.17.0_ install)
  shasum -a 256 ios/Podfile.lock >> build/toolchain.txt
  cp ios/Podfile.lock build/Podfile.lock
fi
[[ -d ios/ClassStreak.xcworkspace ]] || { echo 'Expected generated ClassStreak workspace missing'; exit 1; }
cp ios/Podfile.lock build/Podfile.lock
xcodebuild -list -json -workspace ios/ClassStreak.xcworkspace > build/workspace.json
python3 -c 'import json; assert "ClassStreak" in json.load(open("build/workspace.json"))["workspace"]["schemes"]'
xcodebuild -workspace ios/ClassStreak.xcworkspace -scheme ClassStreak -configuration Release -sdk iphoneos \
  -destination 'generic/platform=iOS' -derivedDataPath "$PWD/build/DerivedData" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' DEVELOPMENT_TEAM='' build
app="$PWD/build/DerivedData/Build/Products/Release-iphoneos/ClassStreak.app"
[[ -d "$app" && -s "$app/main.jsbundle" ]] || { echo 'Standalone Release app/bundle missing'; exit 1; }
package="$(mktemp -d "$PWD/build/package.XXXXXX")"
mkdir "$package/Payload"
ditto "$app" "$package/Payload/ClassStreak.app"
(cd "$package" && zip -q -r -y "$OLDPWD/build/ClassStreak-unsigned.ipa" Payload)
bash scripts/verify-ipa.sh build/ClassStreak-unsigned.ipa
(cd build && shasum -a 256 ClassStreak-unsigned.ipa > ClassStreak-unsigned.ipa.sha256)
echo 'Device Release packaged and inspected. SideStore and field acceptance remain NOT TESTED.'
