import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const ios = config._internal.modResults.ios;
assert.deepEqual(ios.infoPlist.UIBackgroundModes, ["location"]);
assert.equal(ios.podfileProperties["expo.sqlite.useSQLCipher"], "true");
assert.equal(ios.expoPlist.EXUpdatesEnabled, false);
assert.ok(ios.infoPlist.NSLocationWhenInUseUsageDescription);
assert.ok(ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription);
assert.equal(ios.entitlements['com.apple.developer.healthkit'],true);
assert.ok(ios.entitlements['com.apple.security.application-groups'].includes('group.com.turf.privatealpha'));
assert.equal(ios.entitlements['aps-environment'],undefined);
assert.ok(ios.infoPlist.NSHealthShareUsageDescription);
assert.equal(
  ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads,
  false,
);
console.log(
  "PASS: generated native configuration, SQLCipher, location-only modes, Health and widget app group, no APNs",
);
