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
    submit: "Submit",
    openMenu: "Open menu",
  },
  nav: {
    dashboard: "Dashboard",
    library: "Library",
    jobs: "Jobs board",
    contacts: "Contacts",
    insights: "Insights",
    settings: "Settings",
    mainNav: "Main",
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
  shell: {
    placeholderBody: "This screen arrives in a later task.",
    usagePill: "{used} / {limit} tailored resumes",
    usagePillAria: "Usage: {used} of {limit} tailored resumes this period",
    remindersTitle: "Reminders",
    remindersEmpty:
      "Reminders will show up here once tracking is live.",
    remindersAria: "Reminders",
    userMenuAria: "Account menu",
    planAndBilling: "Plan & billing",
  },
  upgrade: {
    title: "Upgrade to Pro",
    body: "Pro unlocks higher limits and extra templates. Checkout arrives in a later task.",
    cta: "Got it",
  },
  feedback: {
    button: "Feedback",
    title: "Send feedback",
    description: "Bugs, ideas, or a quick note — it goes straight to us.",
    kindLabel: "Type",
    kinds: {
      BUG: "Bug",
      IDEA: "Idea",
      PRAISE: "Praise",
      OTHER: "Other",
    },
    messageLabel: "Message",
    messagePlaceholder: "What should we know?",
    ratingLabel: "Rating (optional)",
    ratingNone: "No rating",
    success: "Thanks — we got your note.",
    error: "Couldn’t send that. Try again.",
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
  pages: {
    dashboard: {
      title: "Dashboard",
      body: "Today’s reminders, pipeline snapshot, and getting started will live here.",
    },
    library: {
      title: "Library",
      body: "Your experience library — entries, bullets, and skills — lands next.",
    },
    libraryImport: {
      title: "Import resume",
      body: "Upload or paste a resume to seed your library.",
    },
    libraryTargets: {
      title: "Target profiles",
      body: "Target profiles arrive in a later release.",
    },
    jobs: {
      title: "Jobs board",
      body: "Track every application from Saved through Offer.",
    },
    jobsNew: {
      title: "New job",
      body: "Paste a posting to analyse requirements and start tracking.",
    },
    jobDetail: {
      title: "Job",
      body: "Overview, documents, timeline, and more for this role.",
    },
    resumeWorkspace: {
      title: "Resume workspace",
      body: "Edit a tailored resume with source chips and match score.",
    },
    letterWorkspace: {
      title: "Cover letter",
      body: "Write and export a cover letter for this job.",
    },
    contacts: {
      title: "Contacts",
      body: "People you’re talking to across your search.",
    },
    insights: {
      title: "Insights",
      body: "Funnel, weekly activity, and what’s working.",
    },
    milestones: {
      title: "Milestones",
      body: "Streak and milestones arrive in a later release.",
    },
    settings: {
      title: "Settings",
      body: "Profile, preferences, plan & billing, and data controls.",
    },
  },
  auth: {
    signOut: "Sign out",
  },
  admin: {
    title: "Admin",
    body: "Admin tools arrive in a later release.",
  },
} as const;
