export type DevLoginArgs = {
  email?: string;
  next: string;
  origin: string;
};

const DEFAULT_ORIGIN = "http://localhost:3000";
const DEFAULT_NEXT = "/dev";

/** Parse `npm run dev:login` args. Email is optional when SEED_USER_ID can supply it. */
export function parseDevLoginArgs(argv: readonly string[]): DevLoginArgs | { error: string } {
  let email: string | undefined;
  let next = DEFAULT_NEXT;
  let origin = DEFAULT_ORIGIN;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;

    if (arg === "--next" || arg === "--origin") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        return { error: `${arg} needs a value.` };
      }
      index += 1;
      if (arg === "--next") next = value;
      else origin = value;
      continue;
    }

    if (arg.startsWith("--next=")) {
      next = arg.slice("--next=".length);
      continue;
    }
    if (arg.startsWith("--origin=")) {
      origin = arg.slice("--origin=".length);
      continue;
    }
    if (arg.startsWith("--")) {
      return { error: `Unknown option ${arg}.` };
    }
    if (email) return { error: "Pass one email." };
    email = arg;
  }

  const safeNext = safeDevNext(next);
  if (!safeNext) return { error: "--next must be a path on this app." };
  const safeOrigin = safeDevOrigin(origin);
  if (!safeOrigin) return { error: "--origin must be an http(s) origin." };

  return { email, next: safeNext, origin: safeOrigin };
}

export function safeDevNext(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return null;
  }
  return value;
}

export function safeDevOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.origin;
}

export function normalizeDevEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
