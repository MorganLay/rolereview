# 10 — Brand

> Name, voice, visual identity, and the design tokens Cursor should use. The product is **professional first**: calm, precise, trustworthy. It should feel like a sharp editor who's on your side, not a game and not a robot.

## Name

- **RoleRefine**: one word, capital R twice. Never "Role Refine", "Rolerefine", or "ROLEREFINE" (except in all-caps UI labels).
- Domains to secure: `rolerefine.com` and `rolerefine.ca`. If the `.com` is taken, use `rolerefine.ca` as primary plus `getrolerefine.com`. Grab the matching handles on LinkedIn, X, Instagram, TikTok, YouTube, and Reddit the same day.
- **Before committing money** (logo, ads): CIPO trademark search for "RoleRefine" and close variants in classes 9, 35, 42; Google/app-store/Product Hunt search; register the Ontario business name if operating as a sole proprietor; consider filing the trademark once confident. A trademark agent's clearance search is worth the fee. *(Not legal advice.)*

## Positioning

**For** job seekers applying to many roles **who** don't have time to rewrite their resume for every posting and don't trust AI tools that make things up, **RoleRefine** tailors your resume and cover letter to each job **using only your real experience** (every line traceable to its source) and keeps your whole search organized through to the offer.

- **Tagline:** *Tailored resumes. Every line traced to you.*
- **Short descriptor** (meta descriptions, app stores): *Tailor your resume to every job, using only your real experience.*
- **Proof points:** source-cited bullets · fabrication guard · requirement-by-requirement match score · live keyword coverage · free jobs board.

## Voice

Plain, specific, encouraging. Write like a good career advisor: honest about gaps, confident about strengths, never salesy.

| Do | Don't |
|---|---|
| "Tailor your resume to this role." | "Supercharge your career with AI magic! 🚀" |
| "3 requirements met, 2 partial, 1 missing." | "You're a 92% perfect match!!" |
| "We couldn't read that file. Try a PDF or paste the text." | "Oops! Something went wrong 😅" |
| "Add a number to make this bullet Strong." | "This bullet is bad." |
| "No response after 30 days? Mark it closed or follow up." | "You've been ghosted!" |
| "AI-assisted" / "with Claude" when relevant | "Revolutionary", "game-changing", "10x" |

- Second person ("you"), active voice, short sentences.
- Buttons are verbs: "Tailor resume", "Add job", "Export PDF".
- Spelling: "resume" without accents in UI and marketing (search terms); US spelling in product copy for reach (revisit with the French version).
- Celebrate real moments (first interview, offer) briefly and sincerely. No confetti for routine actions.

## Logo direction

- **Wordmark first:** "RoleRefine" set in the heading serif (Source Serif 4, Semibold), Ink colour. This is enough for the waitlist and beta.
- **Mark (later, after trademark clearance):** a monogram "R" whose leg is a single clean rule, or a document corner with one highlighted line. The idea: one line, refined. Must work at 16 px (favicon) and in one colour.
- **Avoid:** anvils, forges, circuit boards, robots, brains, sparkles, neon glows, teal/cyan gradients (all common in this space, and the closest competitor uses an anvil with cyan circuitry).
- Favicon for now: "R" in Paper on a Pine rounded square.

## Colour

Warm paper background, deep ink text, pine green as the single primary colour, marigold for highlights. Every text pair below passes WCAG AA (checked).

| Token | Hex | Use |
|---|---|---|
| `ink` | `#142033` | Primary text, dark surfaces, logo |
| `paper` | `#FAF8F4` | App and site background |
| `surface` | `#FFFFFF` | Cards, editor canvas |
| `line` | `#E4DFD6` | Borders, dividers |
| `slate` | `#566273` | Secondary text (5.8:1 on paper) |
| `pine` | `#1F6B57` | Primary buttons, links, focus rings, "met" (6.0:1 on paper; white text on it 6.4:1) |
| `pine-hover` | `#185645` | Hover/active |
| `pine-50` | `#E7F1EC` | Selected rows, success backgrounds |
| `marigold` | `#E0A33A` | Highlights: keyword chips, "new", strength meter fill (never for text) |
| `marigold-100` | `#FBEFD5` | Highlight backgrounds (ink text on it) |
| `marigold-700` | `#8A5A0B` | "Partial" text/icons (5.6:1) |
| `clay` | `#B0432C` | "Missing", errors, destructive (5.4:1) |
| **Dark mode** | | |
| `ink-bg` | `#0F1724` | Background |
| `ink-surface` | `#172133` | Cards |
| `paper-text` | `#ECE8E1` | Primary text (14.7:1) |
| `slate-dark` | `#9AA6B6` | Secondary text (7.3:1) |
| `pine-300` | `#6CC3A6` | Primary in dark mode (ink text on it 8.6:1) |

Status always pairs colour with an icon and a word: ✓ Met (pine) · ◐ Partial (marigold-700) · ✗ Missing (clay).

Bullet strength meter: 5 segments filled in marigold, with the label (Weak / Fair / Good / Strong / Excellent) as text beside it.

## Typography

| Role | Font | Notes |
|---|---|---|
| Marketing headlines, resume previews | **Source Serif 4** (Semibold 600) | Editorial, document-like; signals "writing done well" |
| UI, body, buttons, tables | **Inter** (400/500/600) | Highly legible at small sizes |
| Numbers in stats | Inter with `font-variant-numeric: tabular-nums` | Aligned columns |

Both are open-licence fonts from Google Fonts, loaded via `next/font`. Inside the app, use the serif only for page titles and the resume preview; everything else is Inter.

Scale (rem): 0.75 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 1.875 · 2.25 · 3 (hero). Line height 1.5 for body, 1.15 for headlines.

## UI style

- **Shape:** 10 px radius on cards and inputs, 8 px on buttons, full-round on chips.
- **Depth:** mostly borders (`line`), not shadows. One soft shadow for popovers and dialogs.
- **Density:** comfortable in the library and resume workspace; compact tables on the jobs list.
- **Icons:** lucide, 1.5 px stroke, 16/20 px.
- **Motion:** 150–200 ms ease-out for UI; match-score count-up and resume reveal ≤ 1.2 s; everything off under `prefers-reduced-motion`.
- **Empty states:** a short sentence + one action button + an optional small line illustration (ink on paper). No mascots.
- **Imagery (marketing):** real product screenshots in a simple browser frame, resume "paper" previews, subtle ruled-line backgrounds. No stock photos of handshakes or laptops.

## Exported documents

Resumes and cover letters are **neutral**: black text, white page, standard fonts (Inter or Source Sans 3 for Classic/Compact; Source Serif 4 headings for Modern), at most one thin rule. No RoleRefine branding or watermark on any exported document, on any plan. Modern may use pine for section rules only.

## Design tokens (Tailwind 4, `src/app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --color-ink: #142033;
  --color-paper: #FAF8F4;
  --color-surface: #FFFFFF;
  --color-line: #E4DFD6;
  --color-slate: #566273;
  --color-pine: #1F6B57;
  --color-pine-hover: #185645;
  --color-pine-50: #E7F1EC;
  --color-marigold: #E0A33A;
  --color-marigold-100: #FBEFD5;
  --color-marigold-700: #8A5A0B;
  --color-clay: #B0432C;

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-source-serif), ui-serif, Georgia, serif;

  --radius-card: 10px;
  --radius-button: 8px;
}
```

Map shadcn's CSS variables (`--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--destructive`, `--muted-foreground`…) to these tokens in `:root`, and to the dark-mode values under `.dark`. The app ships light mode by default with a dark-mode toggle; the marketing site is light.

## Email & social

- **Email:** paper background, white card, ink text, one pine button, wordmark at the top, plain footer (preferences, unsubscribe, mailing address).
- **OG image template** (`next/og`, 1200×630): paper background, wordmark top-left, page title in Source Serif 4, a pine rule, and the tagline. For product pages, a cropped real screenshot on the right.
- **Social avatar:** the favicon mark.
