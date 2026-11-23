import { isSQLCipher, open, type DB } from "@op-engineering/op-sqlite";
import {
  buildEncryptedBackupJson,
  collectEncryptedBackup,
  parseEncryptedBackupJson,
  restoreEncryptedBackup,
  type EncryptedBackupData,
} from "@payaspect/core";
import { File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getDatabase } from "../db";

/**
 * Full-device backup as a passphrase-encrypted SQLCipher database file.
 *
 * The payload is written into a temporary encrypted database on the device and
 * then copied to a user-chosen location. Restore reverses the flow: the picked
 * file is copied to a cache database, opened with the passphrase, validated and
 * only then applied to the main database. The passphrase is never stored,
 * logged or sent anywhere.
 */

const CREATE_DB_NAME = "payaspect-backup.db";
const RESTORE_DB_NAME = "payaspect-restore.db";
const BACKUP_MIME = "application/octet-stream";
const MIN_PASSPHRASE_LENGTH = 8;

/** User dismissed the file picker or the restore confirmation. */
export class BackupCanceledError extends Error {}
/** Passphrase is too short to be a reasonable backup secret. */
export class BackupPassphraseError extends Error {}
/** Wrong passphrase, foreign file or corrupt payload. */
export class BackupInvalidFileError extends Error {}

function cacheFile(name: string): File {
  return new File(Paths.cache, name);
}

/** op-sqlite expects a native path, not an expo-file-system `file://` URI. */
function nativeLocation(directory: { uri: string }): string {
  return directory.uri.replace(/^file:\/\//, "");
}

function assertPassphrase(passphrase: string): void {
  if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) {
    throw new BackupPassphraseError("Passphrase is too short");
  }
}

function assertSqlCipher(): void {
  // Never risk writing a plaintext financial database.
  if (!isSQLCipher()) {
    throw new Error("SQLCipher is required for encrypted backups");
  }
}

function backupFileName(): string {
  return `payaspect-${new Date().toISOString().slice(0, 10)}.paeb`;
}

/** Remove the temporary database and any SQLite sidecar files. */
async function deleteTempFiles(name: string): Promise<void> {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = cacheFile(`${name}${suffix}`);
    if (file.exists) {
      try {
        file.delete();
      } catch {
        // Best effort: cache files are safe to leave behind on failure.
      }
    }
  }
}

/**
 * Copy the finished encrypted file to a user-accessible location. Android uses
 * the Storage Access Framework; iOS writes to the app Documents folder exposed
 * through the Files app (see app.json). No share-sheet dependency is needed.
 */
async function saveBackupFile(source: File, name: string): Promise<string> {
  if (Platform.OS === "android") {
    const permission =
      await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) throw new BackupCanceledError("Directory access was not granted");

    const uri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      name,
      BACKUP_MIME,
    );
    // SAF exposes a content:// URI, so copy binary bytes through the legacy API.
    const base64 = await LegacyFileSystem.readAsStringAsync(source.uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(uri, base64, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return name;
  }

  const destination = new File(Paths.document, name);
  await source.copy(destination, { overwrite: true });
  return destination.name;
}

/** Create a passphrase-encrypted backup and return its saved file name. */
export async function createEncryptedBackup(passphrase: string): Promise<string> {
  assertPassphrase(passphrase);
  assertSqlCipher();

  const db = await getDatabase();
  const data: EncryptedBackupData = await collectEncryptedBackup(db);
  const json = buildEncryptedBackupJson(data);

  let backupDb: DB | null = null;
  try {
    backupDb = open({
      name: CREATE_DB_NAME,
      location: nativeLocation(Paths.cache),
      encryptionKey: passphrase,
    });
    await backupDb.execute(
      "CREATE TABLE backup_payload (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL)",
    );
    await backupDb.execute("INSERT INTO backup_payload (id, payload) VALUES (1, ?)", [json]);
    backupDb.close();
    backupDb = null;

    return await saveBackupFile(cacheFile(CREATE_DB_NAME), backupFileName());
  } finally {
    backupDb?.close();
    await deleteTempFiles(CREATE_DB_NAME);
  }
}

/**
 * Pick an encrypted backup, verify the passphrase and validate the payload.
 * The caller must confirm the destructive replace before calling
 * `applyEncryptedBackup` with the returned data. Any wrong-file or wrong-key
 * case is reported before a single row of the main database is touched.
 */
export async function readEncryptedBackup(passphrase: string): Promise<EncryptedBackupData> {
  assertPassphrase(passphrase);
  assertSqlCipher();

  // Deliberately unfiltered: validating the decrypted payload is stricter than
  // relying on platform MIME mappings for a custom backup extension.
  const picked = await File.pickFileAsync();
  if (picked.canceled || !picked.result) {
    throw new BackupCanceledError("File selection was canceled");
  }

  const temp = cacheFile(RESTORE_DB_NAME);
  let restoreDb: DB | null = null;
  try {
    // A picked Android document is a content:// URI; copy it to a native path
    // so SQLCipher can open it with `failOnCreate` (never create a fresh DB).
    await LegacyFileSystem.copyAsync({ from: picked.result.uri, to: temp.uri });

    restoreDb = open({
      name: RESTORE_DB_NAME,
      location: nativeLocation(Paths.cache),
      encryptionKey: passphrase,
      failOnCreate: true,
    });
    const result = await restoreDb.execute("SELECT payload FROM backup_payload WHERE id = 1");
    const json = result.rows[0]?.payload;
    if (typeof json !== "string") throw new BackupInvalidFileError("Missing backup payload");
    return parseEncryptedBackupJson(json);
  } catch (cause) {
    if (cause instanceof BackupInvalidFileError) throw cause;
    throw new BackupInvalidFileError("Wrong passphrase or unsupported backup file");
  } finally {
    restoreDb?.close();
    await deleteTempFiles(RESTORE_DB_NAME);
  }
}

/** Apply a previously validated backup to the main database. */
export async function applyEncryptedBackup(data: EncryptedBackupData): Promise<void> {
  const db = await getDatabase();
  await restoreEncryptedBackup(db, data);
}
