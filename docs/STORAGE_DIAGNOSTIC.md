# iPhone storage failure — diagnostic build

Reported on launch and sign-in: exact `STORAGE_ERROR`.

Cause is not yet established on the physical iPhone. The delivered native binary contains SQLCipher symbols; this is not proof that the installed database can be unlocked. No database, key, Auth user or server setting has been deleted or reset.

This build reports fixed stage/reason codes for Keychain read/create/save, native open, unlock, cipher capability, schema read and schema initialization. Raw native errors may contain encryption-key SQL and are never displayed or logged. Connection cleanup is best effort so it cannot replace the original diagnostic. A failed schema initialization now closes its connection before retry.

Two adapter tests pass: missing cipher versus unreadable database and preservation of an existing value; sanitization of SQL/key/path-bearing errors. Typecheck and scoped lint pass. These checks do not validate native SQLCipher or Keychain on a phone. The legacy local.test.mjs runner cannot currently load its old location-task imports through the newer Expo package; the focused storage tests use the same adapter without that unrelated import path.

Install ClassStreak-storage-diagnostic.ipa over the installed app without deleting it, then report the displayed code. Root-cause repair and physical acceptance remain pending that observation.

## Recovery build

The phone reported `READ:KEY_MISMATCH`, establishing that the current stored key cannot read that database (the precise historical cause, including possible corruption, remains unknown).

The error banner now offers Recover local storage with an explicit confirmation. It stops native capture and pending reminders, then runs the native synthetic wrong-key/no-key/correct-key encryption check. Only if that passes does it create a separate encrypted `turf-recovery-<uuid>.db`, retain the current key, initialize an empty signed-out state with a new auth epoch, close and reopen it, and finally select it through `turf.db.active` in Keychain. The original `turf.db` and its journal files remain in place; no file is reset or deleted and no server data is changed. The previous filename is retained in the new encrypted database. Unsynced records in the unreadable original are not restored automatically.

Recovery is available only for the observed READ/KEY_MISMATCH failure and refuses a readable database. Failed pointer persistence leaves the original selection unchanged. Auth client and UI state are cleared after switching. The new adapter recovery test checks preservation of old records/key, failed pointer write, successful retry, empty auth, nonzero auth epoch, new writes and refusal to replace readable storage. All three focused storage tests, TypeScript and scoped lint pass. Phone recovery acceptance is still pending.
