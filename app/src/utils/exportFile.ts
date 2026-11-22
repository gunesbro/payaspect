import {
  buildBackupJson,
  listAccounts,
  listAllCategories,
  listAllTransactions,
  transactionsToCsv,
} from "@payaspect/core";
import { File, Paths } from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getDatabase } from "../db";

export type ExportFormat = "csv" | "json";

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv",
  json: "application/json",
};

function baseName(): string {
  return `payaspect-${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Write an export to a user-accessible location without adding a share-sheet
 * dependency. Android uses the Storage Access Framework folder picker; iOS
 * writes to the app Documents folder, exposed via Files by app.json.
 */
export async function writeExportFile(
  content: string,
  format: ExportFormat,
): Promise<string> {
  const name = baseName();

  if (Platform.OS === "android") {
    const permission =
      await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Directory access was not granted");
    }
    const uri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      name,
      MIME_TYPES[format],
    );
    await LegacyFileSystem.writeAsStringAsync(uri, content);
    return `${name}.${format}`;
  }

  const file = new File(Paths.document, `${name}.${format}`);
  await file.write(content);
  return file.name;
}

/** Read every row from the encrypted DB and serialize it on-device. */
export async function createExport(format: ExportFormat): Promise<string> {
  const db = await getDatabase();
  const [accounts, categories, transactions] = await Promise.all([
    listAccounts(db),
    listAllCategories(db),
    listAllTransactions(db),
  ]);

  const content =
    format === "csv"
      ? transactionsToCsv(transactions)
      : buildBackupJson({ accounts, categories, transactions });

  return writeExportFile(content, format);
}
