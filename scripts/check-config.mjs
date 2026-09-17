import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
for (const [name, version] of Object.entries({
  ...pkg.dependencies,
  ...pkg.devDependencies,
})) {
  assert.match(version, /^\d+\.\d+\.\d+$/, `Pin exact version: ${name}`);
  assert.equal(lock.packages["node_modules/" + name].version, version);
}
for (const forbidden of [
  "expo-dev-client",
  "expo-notifications",
  "expo-apple-authentication",
  "react-native-maps",
])
  assert.ok(!pkg.dependencies[forbidden]);
const entry = readFileSync("index.ts", "utf8");
assert.ok(
  entry.indexOf("./src/location/tasks") < entry.indexOf("expo-router/entry"),
);
const config = readFileSync("app.config.ts", "utf8");
for (const required of [
  "useSQLCipher: true",
  "isIosBackgroundLocationEnabled: true",
  "locationWhenInUsePermission",
  "locationAlwaysAndWhenInUsePermission",
])
  assert.ok(config.includes(required));
if (process.env.TURF_REQUIRE_BACKEND === "1") {
  assert.match(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/,
  );
  assert.match(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    /^sb_publishable_[A-Za-z0-9_-]+$/,
  );
}
console.log(
  "PASS: exact JS locks, entry ordering, required native configuration, M1 dependency boundary",
);
