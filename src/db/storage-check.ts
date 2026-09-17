import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";

// Explicit native diagnostic using a separate random, synthetic test database.
// No location, auth tokens or attendance records enter this test.
export async function checkNativeEncryption() {
  const name = `turf-cipher-check-${Crypto.randomUUID()}.db`;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  const correct = await SQLite.openDatabaseAsync(name, {
    useNewConnection: true,
  });
  try {
    await correct.execAsync(
      `PRAGMA key="x'${key}'";CREATE TABLE marker(value TEXT);INSERT INTO marker VALUES('synthetic storage test');`,
    );
    const version = await correct.getFirstAsync<Record<string, string>>(
      "PRAGMA cipher_version",
    );
    if (!version || !Object.values(version)[0])
      throw new Error("STORAGE_ERROR");
  } finally {
    await correct.closeAsync();
  }
  try {
    for (const supplied of ["", `PRAGMA key="x'${"00".repeat(32)}'";`]) {
      const wrong = await SQLite.openDatabaseAsync(name, {
        useNewConnection: true,
      });
      let denied = false;
      try {
        if (supplied) await wrong.execAsync(supplied);
        await wrong.getFirstAsync("SELECT * FROM marker");
      } catch {
        denied = true;
      } finally {
        await wrong.closeAsync();
      }
      if (!denied) throw new Error("STORAGE_ERROR");
    }
    const reopen = await SQLite.openDatabaseAsync(name, {
      useNewConnection: true,
    });
    try {
      await reopen.execAsync(`PRAGMA key="x'${key}'";`);
      const row = await reopen.getFirstAsync<{ value: string }>(
        "SELECT * FROM marker",
      );
      if (row?.value !== "synthetic storage test")
        throw new Error("STORAGE_ERROR");
    } finally {
      await reopen.closeAsync();
    }
    return "PASS: this native SQLCipher library rejects absent/wrong keys and reopens with the correct key.";
  } finally {
    await SQLite.deleteDatabaseAsync(name);
  }
}
