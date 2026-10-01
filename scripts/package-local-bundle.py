"""Embed a local Expo Release bundle into the matching unsigned native IPA.

The Google Places key stays in local .env and the local app package. No native
binary, entitlement, Info.plist, extension, or framework may change here.
"""
import argparse
import hashlib
import json
import pathlib
import plistlib
import subprocess
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('native_ipa', type=pathlib.Path)
parser.add_argument('bundle_dir', type=pathlib.Path)
parser.add_argument('output', type=pathlib.Path)
parser.add_argument('--native-ref', required=True)
args = parser.parse_args()
repo = pathlib.Path(__file__).resolve().parents[1]
guards = ['package.json', 'package-lock.json', 'app.config.ts', 'plugins',
          'modules', 'assets/icon.png', 'assets/splash.png', 'babel.config.js',
          'metro.config.js', 'index.ts', '.github/workflows/build-ios.yml']
subprocess.run(['git', 'diff', '--exit-code', args.native_ref, '--', *guards],
               cwd=repo, check=True, stdout=subprocess.DEVNULL)
replacement = {}
for path in args.bundle_dir.rglob('*'):
    if path.is_file():
        name = path.relative_to(args.bundle_dir).as_posix()
        assert name == 'main.jsbundle' or name.startswith('assets/'), 'Unexpected bundle asset'
        replacement[name] = path.read_bytes()
assert len(replacement['main.jsbundle']) > 1000
sha = lambda data: hashlib.sha256(data).hexdigest()
native_hashes = {}
with zipfile.ZipFile(args.native_ipa) as original:
    app_plists = [n for n in original.namelist()
                  if n.startswith('Payload/') and n.endswith('.app/Info.plist') and n.count('/') == 2]
    assert len(app_plists) == 1, 'Expected exactly one app'
    app = app_plists[0].removesuffix('Info.plist')
    info = plistlib.loads(original.read(app_plists[0]))
    assert info['CFBundleIdentifier'] == 'com.turf.privatealpha'
    assert info['CFBundleDisplayName'] == 'ClassStreak'
    assert info['CFBundleSupportedPlatforms'] == ['iPhoneOS']
    assert not any(n.endswith('embedded.mobileprovision') for n in original.namelist())
    old_bundle = original.read(app + 'main.jsbundle')
    assert old_bundle[:12] == replacement['main.jsbundle'][:12], 'Hermes format/version mismatch'
    assert args.output.resolve() != args.native_ipa.resolve(), 'Keep the original native artifact'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    pending = {app + name: data for name, data in replacement.items()}
    with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED) as output:
        for entry in original.infolist():
            assert '..' not in pathlib.PurePosixPath(entry.filename).parts
            data = original.read(entry.filename)
            if entry.filename in pending:
                data = pending.pop(entry.filename)
            else:
                native_hashes[entry.filename] = sha(data)
            output.writestr(entry, data)
        for name, data in pending.items():
            output.writestr(name, data)
with zipfile.ZipFile(args.output) as output:
    assert output.testzip() is None, 'ZIP integrity failed'
    assert all(sha(output.read(name)) == value for name, value in native_hashes.items())
    assert sha(output.read(app + 'main.jsbundle')) == sha(replacement['main.jsbundle'])
native_ref = subprocess.check_output(['git', 'rev-parse', args.native_ref], cwd=repo, text=True).strip()
source_ref = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
metadata = dict(native_commit=native_ref, javascript_commit=source_ref,
                native_ipa_sha256=sha(args.native_ipa.read_bytes()),
                javascript_sha256=sha(replacement['main.jsbundle']),
                ipa_sha256=sha(args.output.read_bytes()), unchanged_native_entries=len(native_hashes),
                bundle_assets=len(replacement), physical_device_tested=False)
args.output.with_suffix('.provenance.json').write_text(json.dumps(metadata, indent=2)+'\n')
args.output.with_suffix('.ipa.sha256').write_text(metadata['ipa_sha256']+'  '+args.output.name+'\n')
print('PASS: matching Hermes version, unchanged native payload, bundle assets, ZIP integrity and provenance')
