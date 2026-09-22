import test from "node:test";
import assert from "node:assert/strict";
import { native } from "./native-harness.mjs";
const local = await import("../src/db/local.ts");
test("storage diagnostics distinguish cipher support and unreadable data without resetting stored records", async () => {
  await local.write("diagnostic-preservation", "keep me");
  try {
    native.missingCipher = true;
    await assert.rejects(local.transaction(async () => {}), /STORAGE_ERROR:CIPHER:FAILED/);
    native.missingCipher = false;
    native.unreadableDatabase = true;
    await assert.rejects(local.transaction(async () => {}), /STORAGE_ERROR:READ:KEY_MISMATCH/);
  } finally {
    native.missingCipher = false;
    native.unreadableDatabase = false;
  }
  assert.equal(await local.read("diagnostic-preservation", null), "keep me");
});
test("storage diagnostic messages never include native SQL, keys or paths", async () => {
  const { storageError } = await import("../src/db/storage-error.ts");
  const { safeMessage } = await import("../src/classstreak/model.ts");
  const privateError = new Error("PRAGMA key='synthetic-private-key'; /private/account.db file is not a database");
  const publicError = storageError("READ", privateError);
  assert.equal(publicError.message, "STORAGE_ERROR:READ:KEY_MISMATCH");
  assert.match(safeMessage(publicError), /code READ:KEY_MISMATCH/);
  assert.doesNotMatch(safeMessage(publicError), /synthetic-private-key|account.db|PRAGMA/);
});
