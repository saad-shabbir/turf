"""Synthetic packaging-validator tests. Never physical-device build evidence."""
import contextlib
import io
import pathlib
import os
import plistlib
import sys
import tempfile
import unittest
import uuid
import shutil


class InspectionTest(unittest.TestCase):
    def setUp(self):
        root = pathlib.Path(os.environ.get('TURF_TEST_TMP', tempfile.gettempdir())).resolve()
        self.root = root / ('turf-inspection-' + str(uuid.uuid4()))
        assert self.root.resolve().is_relative_to(root)
        self.root.mkdir(mode=0o777)
        self.addCleanup(lambda: shutil.rmtree(self.root))
        self.app = self.root / 'Payload' / 'Turf.app'
        (self.app / 'Frameworks' / 'Fixture.framework').mkdir(parents=True)
        self.plist = dict(CFBundleSupportedPlatforms=['iPhoneOS'],
                          CFBundleIdentifier='com.turf.privatealpha',
                          CFBundleShortVersionString='2.0.0', CFBundleVersion='2', CFBundleDisplayName='ClassStreak',
                          MinimumOSVersion='16.4', CFBundleExecutable='Turf',
                          UIBackgroundModes=['location'],
                          NSLocationWhenInUseUsageDescription='Synthetic permission',
                          NSLocationAlwaysAndWhenInUseUsageDescription='Synthetic permission')
        (self.app / 'Turf').write_bytes(b'fixture, not a Mach-O executable')
        (self.app / 'main.jsbundle').write_bytes(b'harmless bundled code ' * 100)
        script = pathlib.Path('scripts/verify-ipa.sh').read_text()
        self.source = script.split("<<'PY'\n", 1)[1].split('\nPY', 1)[0]

    def inspect(self):
        # Python validator fixture uses decoded text. Actual HBC decoding is a
        # separate hermesc step in verify-ipa.sh and is checked on the Mac build.
        (self.root / 'hermes.txt').write_bytes((self.app / 'main.jsbundle').read_bytes())
        with (self.app / 'Info.plist').open('wb') as f:
            plistlib.dump(self.plist, f)
        previous = sys.argv
        sys.argv = ['inspection', str(self.root)]
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                exec(compile(self.source, 'artifact-check', 'exec'), {})
        finally:
            sys.argv = previous

    def test_library_prefix_is_not_a_credential(self):
        with (self.app / 'main.jsbundle').open('ab') as f:
            f.write(b"if(key.startsWith('sb_secret_')) reject();")
        self.inspect()

    def test_credential_shaped_value_is_rejected(self):
        with (self.app / 'main.jsbundle').open('ab') as f:
            f.write(b'sb_secret_' + b'SYNTHETIC' * 5)
        with self.assertRaisesRegex(AssertionError, 'privileged credential'):
            self.inspect()

    def test_simulator_and_extra_background_mode_rejected(self):
        self.plist['CFBundleSupportedPlatforms'] = ['iPhoneSimulator']
        with self.assertRaises(AssertionError):
            self.inspect()
        self.plist['CFBundleSupportedPlatforms'] = ['iPhoneOS']
        self.plist['UIBackgroundModes'] = ['location', 'fetch']
        with self.assertRaises(AssertionError):
            self.inspect()

    def test_provisioning_profile_rejected(self):
        (self.app / 'embedded.mobileprovision').write_text('synthetic')
        with self.assertRaises(AssertionError):
            self.inspect()


if __name__ == '__main__':
    unittest.main()
