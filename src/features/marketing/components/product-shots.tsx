import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";

const copy = strings.marketing.home;

export function ProductFrame({
  label,
  alt,
  children,
  className,
}: {
  label?: string;
  alt: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-card border border-line bg-surface text-left shadow-[0_1px_0_0_var(--color-line)]",
        className,
      )}
    >
      <div
        className="flex items-center gap-1.5 border-b border-line bg-paper px-3 py-2"
        aria-hidden
      >
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
        {label ? <span className="ml-2 truncate text-xs text-slate">{label}</span> : null}
      </div>
      <div className="p-3" role="img" aria-label={alt}>
        {children}
      </div>
    </figure>
  );
}

function Meter({ filled }: { filled: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 w-3 rounded-sm",
            index < filled ? "bg-marigold" : "bg-line",
          )}
        />
      ))}
    </span>
  );
}

export function ShotLibrary() {
  return (
    <ProductFrame label="Library" alt={copy.shotLibraryAlt}>
      <p className="text-xs font-medium text-ink">Product Designer</p>
      <p className="text-[11px] text-slate">North Harbour · 2022 — Present</p>
      <ul className="mt-2 space-y-2">
        <li className="rounded-button border border-line bg-paper px-2 py-1.5">
          <p className="text-[11px] leading-snug text-ink">
            Shipped a React checkout that cut drop-off by 18% across three product lines.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Meter filled={4} />
            <span className="text-[10px] text-slate">Strong</span>
          </div>
        </li>
        <li className="rounded-button border border-line px-2 py-1.5">
          <p className="text-[11px] leading-snug text-slate">
            Ran weekly research sessions with 24 customers.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Meter filled={3} />
            <span className="text-[10px] text-slate">Good</span>
          </div>
        </li>
      </ul>
    </ProductFrame>
  );
}

export function ShotJob() {
  return (
    <ProductFrame label="New job" alt={copy.shotJobAlt}>
      <p className="text-xs font-medium text-ink">Product Designer</p>
      <p className="text-[11px] text-slate">Civic Studio · Hybrid · Toronto</p>
      <ul className="mt-2 space-y-1.5 text-[11px]">
        <li className="flex gap-1.5">
          <span className="font-medium text-pine">Must</span>
          <span className="text-ink">Portfolio of shipped product work</span>
        </li>
        <li className="flex gap-1.5">
          <span className="font-medium text-pine">Must</span>
          <span className="text-ink">Figma and front-end pairing</span>
        </li>
        <li className="flex gap-1.5">
          <span className="font-medium text-marigold-700">Nice</span>
          <span className="text-ink">Public-sector experience</span>
        </li>
      </ul>
      <div className="mt-2 flex flex-wrap gap-1">
        {["React", "research", "accessibility"].map((word) => (
          <span
            key={word}
            className="rounded-full bg-marigold-100 px-2 py-0.5 text-[10px] text-ink"
          >
            {word}
          </span>
        ))}
      </div>
    </ProductFrame>
  );
}

export function ShotResume({ highlight = false }: { highlight?: boolean }) {
  return (
    <ProductFrame label="Resume v2" alt={copy.shotResumeAlt}>
      <p className="font-serif text-sm font-semibold text-ink">Jordan Hale</p>
      <p className="text-[11px] text-slate">Product designer · Toronto, ON</p>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate">
        Experience
      </p>
      <p className="text-[11px] font-medium text-ink">Product Designer · North Harbour</p>
      <ul className="mt-1 space-y-1.5">
        <li
          className={cn(
            "rounded-button px-2 py-1.5 text-[11px] leading-snug text-ink",
            highlight ? "bg-pine-50 ring-1 ring-pine/20" : "bg-paper",
          )}
        >
          Designed a React checkout used across three product lines, cutting drop-off 18%.
          <span className="mt-1 block text-[10px] text-pine">{copy.roleRefineSource}</span>
        </li>
        <li className="px-2 text-[11px] leading-snug text-slate">
          Led weekly research with 24 customers and shared findings with growth.
        </li>
      </ul>
    </ProductFrame>
  );
}

export function ShotMatch({
  score = 86,
  ticks = 3,
}: {
  score?: number;
  ticks?: number;
}) {
  const rows = [
    { mark: "✓", cls: "text-pine", text: "Shipped product work", state: 1 },
    { mark: "✓", cls: "text-pine", text: "Figma and React pairing", state: 2 },
    { mark: "◐", cls: "text-marigold-700", text: "Public-sector experience", state: 3 },
  ] as const;

  return (
    <ProductFrame label="Match" alt={copy.shotMatchAlt}>
      <p className="text-xs font-medium text-ink">
        {strings.jobs.documents.matchScore(score)}
      </p>
      <ul className="mt-2 space-y-1.5 text-[11px]">
        {rows.map((row) => (
          <li key={row.text} className="flex items-center gap-2">
            <span className={cn("font-medium", ticks >= row.state ? row.cls : "text-slate")}>
              {ticks >= row.state ? row.mark : "○"}
            </span>
            <span className="text-ink">{row.text}</span>
          </li>
        ))}
      </ul>
    </ProductFrame>
  );
}

export function ShotKeywords() {
  return (
    <ProductFrame label="Keywords" alt={copy.shotKeywordsAlt}>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-ink">{strings.jobs.workspace.keywordCoverage}</p>
        <p className="text-sm font-medium tabular-nums text-ink">78%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full w-[78%] rounded-full bg-pine" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {["React", "research", "checkout"].map((word) => (
          <span
            key={word}
            className="rounded-full bg-pine-50 px-2 py-0.5 text-[10px] text-pine"
          >
            {word}
          </span>
        ))}
        <span className="rounded-full bg-marigold-100 px-2 py-0.5 text-[10px] text-ink">
          accessibility
        </span>
      </div>
    </ProductFrame>
  );
}

export function ShotLetter() {
  return (
    <ProductFrame label="Cover letter" alt={copy.shotLetterAlt}>
      <p className="text-[11px] text-ink">Dear Hiring Manager,</p>
      <p className="mt-2 text-[11px] leading-snug text-ink">
        I’m applying because Civic Studio’s public-service work matches the checkout and
        research I shipped at North Harbour.
      </p>
      <span className="mt-2 inline-block rounded-full bg-pine-50 px-2 py-0.5 text-[10px] text-pine">
        Source: WHY
      </span>
    </ProductFrame>
  );
}

export function ShotBoard() {
  const columns = [
    { title: "Saved", cards: ["Harbour Health"] },
    { title: "Applied", cards: ["Civic Studio"] },
    { title: "Interviewing", cards: ["Northwind"] },
  ];
  return (
    <ProductFrame label="Jobs board" alt={copy.shotBoardAlt}>
      <div className="grid grid-cols-3 gap-1.5">
        {columns.map((column) => (
          <div key={column.title} className="min-w-0">
            <p className="text-[10px] font-medium text-slate">{column.title}</p>
            {column.cards.map((card) => (
              <div
                key={card}
                className="mt-1 rounded-button border border-line bg-paper px-1.5 py-1"
              >
                <p className="truncate text-[10px] font-medium text-ink">{card}</p>
                <p className="truncate text-[10px] text-slate">Product designer</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </ProductFrame>
  );
}

export function ShotReminders() {
  return (
    <ProductFrame label="Reminders" alt={copy.shotRemindersAlt}>
      <p className="text-xs font-medium text-ink">Follow up · Civic Studio</p>
      <p className="mt-1 text-[11px] text-slate">Due today · 7 days after you applied</p>
      <div className="mt-2 flex gap-1.5">
        <span className="rounded-button bg-pine px-2 py-1 text-[10px] text-white">Done</span>
        <span className="rounded-button border border-line px-2 py-1 text-[10px] text-ink">
          Snooze 1 day
        </span>
      </div>
    </ProductFrame>
  );
}

export function ShotInsights() {
  return (
    <ProductFrame label="Insights" alt={copy.shotInsightsAlt}>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ["Response rate", "33%"],
          ["Interview rate", "17%"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-button border border-line bg-paper px-2 py-1.5">
            <p className="text-[10px] text-slate">{label}</p>
            <p className="text-sm font-medium tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex h-12 items-end gap-1">
        {[40, 55, 35, 70, 60, 80].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-sm bg-pine-50"
            style={{ height: `${height}%` }}
            aria-hidden
          />
        ))}
      </div>
    </ProductFrame>
  );
}
