#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'Inspection requires macOS Apple tools'; exit 1; }
ipa="${1:?Usage: verify-ipa.sh path/to.ipa}"
temp="$(mktemp -d)"
trap 'rm -rf -- "$temp"' EXIT
unzip -q "$ipa" -d "$temp"
apps=("$temp"/Payload/*.app)
[[ ${#apps[@]} -eq 1 && -s "${apps[0]}/main.jsbundle" ]] || { echo 'Missing standalone app'; exit 1; }
repo="$(cd "$(dirname "$0")/.." && pwd)"
# HBC stores adjacent strings without delimiters. Decode their actual boundaries
# before credential scanning so separate constants cannot become a false key.
"$repo/node_modules/hermes-compiler/hermesc/osx-bin/hermesc" -b -dump-bytecode "${apps[0]}/main.jsbundle" > "$temp/hermes.txt"
python3 - "$temp" <<'PY'
import pathlib,plistlib,sys,re,base64,json
root=pathlib.Path(sys.argv[1]); apps=list((root/'Payload').glob('*.app'))
assert len(apps)==1,'Expected one app at Payload root'
app=apps[0]; p=plistlib.loads((app/'Info.plist').read_bytes())
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
  data=(root/'hermes.txt').read_bytes() if f.name=='main.jsbundle' else f.read_bytes()
  # Supabase itself includes the literal prefix in validation code. Match a
  # credential-shaped value, not that harmless library string.
  assert not re.search(rb'sb_secret_[A-Za-z0-9_-]{20,}',data),'Forbidden privileged credential'
  for token in re.findall(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',data):
   payload=token.split(b'.')[1]
   try: claims=json.loads(base64.urlsafe_b64decode(payload+b'='*((-len(payload))%4)))
   except (ValueError,UnicodeError): continue
   assert claims.get('role')!='service_role','Forbidden admin JWT'
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
