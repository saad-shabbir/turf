// Only fixed categories may cross the storage boundary. Native exceptions can
// contain SQL (including the encryption key), file paths or private values.
export type StorageStage = "KEY_READ" | "KEY_FORMAT" | "KEY_CREATE" | "KEY_SAVE" | "OPEN" | "UNLOCK" | "CIPHER" | "READ" | "SCHEMA";
export function storageError(stage: StorageStage, cause?: unknown) {
  const raw = cause instanceof Error ? cause.message : "";
  const reason = /database is locked|database is busy/i.test(raw) ? "BUSY"
    : /not a database|file is encrypted|hmac check failed/i.test(raw) ? "KEY_MISMATCH"
    : /disk is full|disk full/i.test(raw) ? "FULL"
    : /interaction.*not allowed|device.*locked/i.test(raw) ? "LOCKED"
    : /malformed|corrupt/i.test(raw) ? "DAMAGED" : "FAILED";
  return new Error(`STORAGE_ERROR:${stage}:${reason}`);
}
