import { parseReceiptText, type ParsedTransactionDraft } from "@payaspect/core";
import TextRecognition from "@react-native-ml-kit/text-recognition";
import * as ImagePicker from "expo-image-picker";

export type ScanResult =
  | { status: "cancelled" }
  | { status: "denied" }
  | { status: "ok"; draft: ParsedTransactionDraft };

/**
 * Capture a receipt and recognize its text fully on-device. The returned draft
 * is only a suggestion: the form still requires explicit user confirmation.
 */
export async function scanReceipt(): Promise<ScanResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: "denied" };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  if (result.canceled) return { status: "cancelled" };

  const uri = result.assets[0]?.uri;
  if (!uri) return { status: "cancelled" };

  const recognition = await TextRecognition.recognize(uri);
  return { status: "ok", draft: parseReceiptText(recognition.text) };
}
