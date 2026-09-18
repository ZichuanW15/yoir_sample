/** Where a diagnosis is kept, in a browser. See storage.ts. */

export async function readDiagnosis(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeDiagnosis(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or blocked site data: the diagnosis is simply not remembered.
  }
}
