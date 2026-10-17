/**
 * UI copy. Voice: plain, specific, encouraging — docs/10-BRAND.md.
 * Product vocabulary — docs/01-PRODUCT.md.
 */
export const strings = {
  brand: {
    name: "RoleRefine",
    tagline: "Tailored resumes. Every line traced to you.",
    shortDescriptor:
      "Tailor your resume to every job, using only your real experience.",
  },
  common: {
    cancel: "Cancel",
    continue: "Continue",
    delete: "Delete",
    edit: "Edit",
    save: "Save",
    close: "Close",
    loading: "Loading…",
  },
  nav: {
    dashboard: "Dashboard",
    library: "Library",
    jobs: "Jobs",
    contacts: "Contacts",
    insights: "Insights",
    settings: "Settings",
  },
  actions: {
    tailorResume: "Tailor resume",
    addJob: "Add job",
    exportPdf: "Export PDF",
    newJob: "New job",
  },
  status: {
    met: "Met",
    partial: "Partial",
    missing: "Missing",
  },
  strength: {
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
    excellent: "Excellent",
  },
  styleguide: {
    title: "Style guide",
    intro:
      "Brand tokens and UI components for RoleRefine. Toggle the theme to check light and dark.",
    themeLight: "Switch to light theme",
    themeDark: "Switch to dark theme",
    sectionColors: "Colours",
    sectionType: "Typography",
    sectionComponents: "Components",
    sampleHeading: "Page title in Source Serif 4",
    sampleBody:
      "Body copy uses Inter. Plain, specific, encouraging — like a sharp editor on your side.",
    toastDemo: "Show toast",
    toastMessage: "Saved. Your library is up to date.",
  },
  home: {
    title: "RoleRefine",
    body: "Tailored resumes. Every line traced to you.",
    styleguideLink: "Open style guide",
    signInLink: "Sign in",
  },
  signIn: {
    title: "Sign in",
    subtitle: "Magic link or Google — no password to remember.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    sendMagicLink: "Email me a sign-in link",
    or: "or",
    continueWithGoogle: "Continue with Google",
    checkEmailTitle: "Check your email",
    checkEmailBody:
      "We sent a sign-in link. It expires in about an hour.",
    errors: {
      auth: "Sign-in didn’t finish. Try again.",
      sendLink: "Couldn’t send the link. Check the address and try again.",
      google: "Google sign-in didn’t start. Try again.",
    },
  },
  dashboard: {
    title: "Dashboard",
    signedInBody: "You’re signed in. The full app shell lands in the next tasks.",
  },
} as const;
