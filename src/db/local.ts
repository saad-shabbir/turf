import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { storageError, type StorageStage } from "./storage-error";
import {
  emptyState,
  mayCapture,
  type Closure,
  type Observation,
} from "../domain/model";

let opening: Promise<SQLite.SQLiteDatabase> | undefined;
let recovering = false;
async function databaseName() {
  const selected = await SecureStore.getItemAsync("turf.db.active").catch(e => { throw storageError("KEY_READ", e); });
  if (selected && !/^turf-recovery-[a-f0-9-]{36}\.db$/.test(selected)) throw storageError("KEY_FORMAT");
  return selected ?? "turf.db";
}
// Separate SQLite connection per transaction: unlike withExclusiveTransactionAsync,
// apply the cipher key to EACH connection before BEGIN. SQLite arbitrates writers
// across independent native task/UI runtimes. No UI state or memory-only lock.
let cipher: string | undefined;
async function key() {
  if (cipher) return cipher;
  const existing = await SecureStore.getItemAsync("turf.db.key").catch(e => { throw storageError("KEY_READ", e); });
  if (existing) {
    if (!/^[a-f0-9]{64}$/.test(existing)) throw storageError("KEY_FORMAT");
    cipher = existing;
    return existing;
  }
  const bytes = await Crypto.getRandomBytesAsync(32).catch(e => { throw storageError("KEY_CREATE", e); });
  const generated = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  await SecureStore.setItemAsync("turf.db.key", generated, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  }).catch(e => { throw storageError("KEY_SAVE", e); });
  cipher = generated;
  return generated;
}
async function connection(name?: string) {
  const k = await key();
  const db = await SQLite.openDatabaseAsync(name ?? await databaseName(), {
    useNewConnection: true,
  }).catch(e => { throw storageError("OPEN", e); });
  let stage: StorageStage = "UNLOCK";
  try {
    await db.execAsync(
      `PRAGMA key = "x'${k}'"; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;`,
    );
    stage = "CIPHER";
    const version = await db.getFirstAsync<Record<string, string>>(
      "PRAGMA cipher_version",
    );
    if (!version || !Object.values(version)[0])
      throw new Error("STORAGE_ERROR");
    stage = "READ";
    await db.getFirstAsync("SELECT count(*) FROM sqlite_master");
    return db;
  } catch (e) {
    await db.closeAsync().catch(() => {});
    throw storageError(stage, e);
  }
}
async function initialize(db: SQLite.SQLiteDatabase) {
    await db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox (event_id TEXT PRIMARY KEY,owner TEXT NOT NULL,platform_id TEXT NOT NULL,seq INTEGER NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',error TEXT,created_at TEXT NOT NULL,UNIQUE(owner,platform_id));
      CREATE TABLE IF NOT EXISTS closures(session_id TEXT PRIMARY KEY,owner TEXT NOT NULL,payload TEXT NOT NULL);
      INSERT OR IGNORE INTO kv VALUES('state','${JSON.stringify(emptyState)}');
      INSERT OR IGNORE INTO kv VALUES('seq','0');`).catch(async e => {
        await db.closeAsync().catch(() => {});
        throw storageError("SCHEMA", e);
      });
  return db;
}
export function database() {
  if (recovering) return Promise.reject(new Error("Storage recovery is in progress. Please wait."));
  opening ??= (async () => {
    // A new DB with a leftover key starts empty; no session is reconstructed from Keychain.
    return initialize(await connection());
  })().catch((e) => {
    opening = undefined;
    throw e;
  });
  return opening;
}
// Called only after the user confirms recovery. Keep the original database and
// all its journal files untouched. A Keychain pointer is switched only after
// a separate encrypted database has been created and successfully reopened.
export async function recoverUnreadableStorage() {
  if (recovering) throw new Error("Storage recovery is already in progress.");
  try {
    await database();
    throw new Error("Saved data is readable. Recovery is not needed.");
  } catch (e) {
    if (!(e instanceof Error && e.message === "STORAGE_ERROR:READ:KEY_MISMATCH")) throw e;
  }
  if (recovering) throw new Error("Storage recovery is already in progress.");
  recovering = true;
  try {
    const previous = await databaseName();
    const name = `turf-recovery-${Crypto.randomUUID()}.db`;
    const db = await initialize(await connection(name));
    try {
      await write("storage_previous_database", previous, db);
      // Old auth clients must not restore their cached session into fresh storage.
      await write("auth_epoch", Date.now(), db);
      await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
    } finally { await db.closeAsync(); }
    const verified = await connection(name);
    await verified.closeAsync();
    await SecureStore.setItemAsync("turf.db.active", name, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }).catch(e => { throw storageError("KEY_SAVE", e); });
    opening = undefined;
  } finally { recovering = false; }
}
export async function transaction<T>(
  work: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  await database();
  const db = await connection();
  try {
    await db.execAsync("BEGIN IMMEDIATE");
    const result = await work(db);
    await db.execAsync("COMMIT");
    return result;
  } catch (e) {
    await db.execAsync("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await db.closeAsync();
  }
}
export async function read<T>(
  key: string,
  fallback: T,
  db?: SQLite.SQLiteDatabase,
): Promise<T> {
  const row = await (db ?? (await database())).getFirstAsync<{ value: string }>(
    "SELECT value FROM kv WHERE key=?",
    key,
  );
  return row ? (JSON.parse(row.value) as T) : fallback;
}
export async function write(
  key: string,
  value: unknown,
  db?: SQLite.SQLiteDatabase,
) {
  await (db ?? (await database())).runAsync(
    "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    key,
    JSON.stringify(value),
  );
}
export const state = () => read("state", emptyState);
export const authStorage = {
  async getItem(key: string) {
    return read<string | null>("auth:" + key, null);
  },
  async setItem(key: string, value: string) {
    await transaction(async (db) => {
      if (await read("auth_blocked", false, db))
        throw new Error("AUTH_REQUIRED");
      const current = await read("state", emptyState, db);
      const incoming = JSON.parse(value) as { user?: { id?: string } };
      if (
        current.owner &&
        incoming.user?.id &&
        incoming.user.id !== current.owner
      )
        throw new Error("AUTH_REQUIRED");
      await write("auth:" + key, value, db);
    });
  },
  async removeItem(key: string) {
    await (
      await database()
    ).runAsync("DELETE FROM kv WHERE key=?", "auth:" + key);
  },
};
// Each Supabase client keeps the auth generation from its creation. An old
// in-flight refresh must never restore credentials after logout/account switch.
export function createAuthStorage() {
  const generation = read("auth_epoch", 0);
  return {
    async getItem(key: string) {
      const expected = await generation;
      return transaction(async (db) => {
        if ((await read("auth_epoch", 0, db)) !== expected)
          throw new Error("AUTH_REQUIRED");
        return read<string | null>("auth:" + key, null, db);
      });
    },
    async setItem(key: string, value: string) {
      const expected = await generation;
      await transaction(async (db) => {
        if (
          (await read("auth_epoch", 0, db)) !== expected ||
          (await read("auth_blocked", false, db))
        )
          throw new Error("AUTH_REQUIRED");
        const current = await read("state", emptyState, db);
        const incoming = JSON.parse(value) as { user?: { id?: string } };
        if (
          current.owner &&
          incoming.user?.id &&
          incoming.user.id !== current.owner
        )
          throw new Error("AUTH_REQUIRED");
        await write("auth:" + key, value, db);
      });
    },
    async removeItem(key: string) {
      const expected = await generation;
      await transaction(async (db) => {
        if ((await read("auth_epoch", 0, db)) === expected)
          await db.runAsync("DELETE FROM kv WHERE key=?", "auth:" + key);
      });
    },
  };
}
export async function bindOwner(owner: string) {
  await transaction(async (db) => {
    const current = await read("state", emptyState, db);
    if (
      (await read("auth_blocked", false, db)) ||
      (current.owner && current.owner !== owner)
    )
      throw new Error("AUTH_REQUIRED");
    await write("state", { ...current, owner }, db);
  });
}
export async function capture(
  identifier: string,
  platformId: string,
  kind: "ENTER" | "EXIT",
  observedAt: string,
  runtimeInitial = false,
) {
  return transaction(async (db) => {
    const current = await read("state", emptyState, db);
    if (!mayCapture(current, identifier) || !current.session || !current.owner)
      return false;
    const region = current.regions.find((r) => r.identifier === identifier)!;
    const prior = await db.getFirstAsync(
      "SELECT event_id FROM outbox WHERE owner=? AND platform_id=?",
      current.owner,
      platformId,
    );
    if (prior) return false;
    const seq = 1 + (await read("seq", 0, db));
    const event: Observation = {
      event_id: Crypto.randomUUID(),
      platform_event_id: platformId,
      session_id: current.session.id,
      device_id: current.session.device_id,
      place_id: region.place_id,
      client_seq: seq,
      kind,
      observed_at: observedAt,
      initial_state_possible:
        runtimeInitial ||
        !(await db.getFirstAsync(
          "SELECT event_id FROM outbox WHERE owner=? AND json_extract(payload,'$.session_id')=? AND json_extract(payload,'$.place_id')=?",
          current.owner,
          current.session.id,
          region.place_id,
        )),
    };
    await db.runAsync(
      "INSERT INTO outbox(event_id,owner,platform_id,seq,payload,created_at) VALUES(?,?,?,?,?,?)",
      event.event_id,
      current.owner,
      platformId,
      seq,
      JSON.stringify(event),
      observedAt,
    );
    await write("seq", seq, db);
    await write("last_callback", observedAt, db);
    return true;
  });
}
export async function pauseLocal(reason: Closure["reason"] = "paused") {
  return transaction(async (db) => {
    const current = await read("state", emptyState, db);
    if (current.session && current.owner) {
      const closure: Closure = {
        session_id: current.session.id,
        observed_end_at: new Date().toISOString(),
        reason,
      };
      await db.runAsync(
        "INSERT OR IGNORE INTO closures VALUES(?,?,?)",
        closure.session_id,
        current.owner,
        JSON.stringify(closure),
      );
    }
    await write(
      "state",
      { ...current, paused: true, session: null, regions: [] },
      db,
    );
    const epoch = 1 + (await read("epoch", 0, db));
    await write("epoch", epoch, db);
    if (reason === "logout" || reason === "deleted_data")
      await write("auth_blocked", true, db);
    return epoch;
  });
}
export async function purge() {
  await transaction(async (db) => {
    const epoch = 1 + (await read("epoch", 0, db));
    const authEpoch = 1 + (await read("auth_epoch", 0, db));
    if (await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='cs_outbox'")) await db.execAsync("DELETE FROM cs_outbox");
    if (await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='cs_outbox_holds'")) await db.execAsync("DELETE FROM cs_outbox_holds");
    await db.execAsync(
      "DELETE FROM outbox; DELETE FROM closures; DELETE FROM kv;",
    );
    await write("state", emptyState, db);
    await write("seq", 0, db);
    await write("auth_blocked", true, db);
    await write("epoch", epoch, db);
    await write("auth_epoch", authEpoch, db);
  });
  await (await database()).execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
}
export async function cleanupLocal() {
  const db = await database();
  await db.runAsync(
    "DELETE FROM outbox WHERE status='acknowledged' AND julianday(created_at)<julianday('now','-7 days')",
  );
  await db.runAsync(
    "DELETE FROM outbox WHERE julianday(created_at)<julianday('now','-30 days')",
  );
}
