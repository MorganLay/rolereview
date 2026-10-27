/** Preview response header for suggested bullets. ASCII only, so it can travel as a header. */

export type FitSuggestionHeader = {
  id: string;
  text: string;
};

export function encodeFitSuggestions(items: readonly FitSuggestionHeader[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(items));
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

export function decodeFitSuggestions(value: string | null): FitSuggestionHeader[] {
  if (!value) return [];
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(parsed)) return [];
    const items: FitSuggestionHeader[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const id = "id" in item ? item.id : null;
      const text = "text" in item ? item.text : null;
      if (typeof id !== "string" || typeof text !== "string") continue;
      if (id.length === 0 || text.length === 0) continue;
      items.push({ id, text });
    }
    return items;
  } catch {
    return [];
  }
}
