# iPhone storage failure — diagnostic build

Reported on launch and sign-in: exact `STORAGE_ERROR`.

Cause is not yet established on the physical iPhone. The delivered native binary contains SQLCipher symbols; this is not proof that the installed database can be unlocked. No database, key, Auth user or server setting has been deleted or reset.

This build reports fixed stage/reason codes for Keychain read/create/save, native open, unlock, cipher capability, schema read and schema initialization. Raw native errors may contain encryption-key SQL and are never displayed or logged. Connection cleanup is best effort so it cannot replace the original diagnostic. A failed schema initialization now closes its connection before retry.

Two adapter tests pass: missing cipher versus unreadable database and preservation of an existing value; sanitization of SQL/key/path-bearing errors. Typecheck and scoped lint pass. These checks do not validate native SQLCipher or Keychain on a phone. The legacy local.test.mjs runner cannot currently load its old location-task imports through the newer Expo package; the focused storage tests use the same adapter without that unrelated import path.

Install ClassStreak-storage-diagnostic.ipa over the installed app without deleting it, then report the displayed code. Root-cause repair and physical acceptance remain pending that observation.
