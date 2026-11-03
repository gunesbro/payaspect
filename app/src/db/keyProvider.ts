import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { KeyProvider } from "@payaspect/core";

const KEY_NAME = "payaspect.db.key";

/**
 * Reads the encryption key from SecureStore (Keychain/Keystore) or creates a
 * fresh 256-bit random key on first launch. The key never leaves the device
 * and is never logged.
 */
export function createKeyProvider(): KeyProvider {
  return {
    async getOrCreateKey(): Promise<string> {
      const existing = await SecureStore.getItemAsync(KEY_NAME);
      if (existing) return existing;

      const bytes = await Crypto.getRandomBytesAsync(32);
      const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      await SecureStore.setItemAsync(KEY_NAME, key);
      return key;
    },
  };
}
