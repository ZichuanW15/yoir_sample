import * as SecureStore from 'expo-secure-store';

/**
 * Where a diagnosis is kept, on a device. The diagnosis has no backend yet, so it
 * lives with the app: it does not follow the person to another device. Failures
 * cost only the saved answers, never the app.
 */

export async function readDiagnosis(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writeDiagnosis(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Forgetting the answers means taking the diagnosis again, nothing worse.
  }
}
