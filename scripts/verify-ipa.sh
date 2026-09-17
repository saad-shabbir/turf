#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'Inspection requires macOS Apple tools'; exit 1; }
ipa="${1:?Usage: verify-ipa.sh path/to.ipa}"
temp="$(mktemp -d)"
trap 'rm -rf -- "$temp"' EXIT
unzip -q "$ipa" -d "$temp"
python3 - "$temp" <<'PY'
import pathlib,plistlib,sys
root=pathlib.Path(sys.argv[1]); apps=list((root/'Payload').glob('*.app'))
assert len(apps)==1,'Expected one app at Payload root'
app=apps[0]; p=plistlib.load(open(app/'Info.plist','rb'))
assert p['CFBundleSupportedPlatforms']==['iPhoneOS']
assert p['CFBundleIdentifier']=='com.turf.privatealpha'
assert p['CFBundleShortVersionString']=='1.0.0' and p['CFBundleVersion']=='1'
assert tuple(map(int,p['MinimumOSVersion'].split('.'))) >= (16,4)
assert (app/p['CFBundleExecutable']).is_file()
assert (app/'main.jsbundle').stat().st_size>1000
assert set(p.get('UIBackgroundModes',[]))=={'location'}
assert p.get('NSLocationWhenInUseUsageDescription') and p.get('NSLocationAlwaysAndWhenInUseUsageDescription')
assert not list(app.rglob('embedded.mobileprovision'))
assert not list(app.rglob('*.appex'))
assert list((app/'Frameworks').glob('*.framework')),'Missing native frameworks'
for f in app.rglob('*'):
 if f.is_file() and f.suffix not in ('.car','.png','.jpg'):
  data=f.read_bytes()
  assert b'sb_secret_' not in data and b'"role":"service_role"' not in data,'Forbidden privileged credential'
print(app)
PY
app=("$temp"/Payload/*.app)
exe="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "${app[0]}/Info.plist")"
xcrun vtool -show-build "${app[0]}/$exe" > "$temp/platform.txt"
grep -Eq 'platform[[:space:]]+IOS$' "$temp/platform.txt"
! grep -q IOSSIMULATOR "$temp/platform.txt"
if codesign -d --entitlements :- "${app[0]}" > "$temp/entitlements.plist" 2>/dev/null; then
  ! grep -Eq 'aps-environment|com.apple.developer.applesignin|associated-domains|application-groups' "$temp/entitlements.plist"
fi
echo 'PASS: IPA layout, device platform, runtime bundle, identity, permissions and forbidden capabilities'
