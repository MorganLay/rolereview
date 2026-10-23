/** Playwright reads `.env` via `playwright.config.ts`. Placeholders count as unset. */
export function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value.includes("<") || value.includes("...")) return undefined;
  return value;
}

export function happyPathReady(): boolean {
  return Boolean(
    envValue("ANTHROPIC_API_KEY") &&
      envValue("SUPABASE_SECRET_KEY") &&
      envValue("NEXT_PUBLIC_SUPABASE_URL") &&
      envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") &&
      envValue("DIRECT_URL"),
  );
}
