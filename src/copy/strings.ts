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
  },
} as const;
