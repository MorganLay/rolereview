import { cn } from "@/lib/utils";
import { strings } from "@/copy/strings";

type WordmarkProps = {
  className?: string;
  /** Render as a plain link target without an outer `<a>` — wrap yourself. */
  title?: string;
};

/**
 * RoleRefine wordmark: Source Serif 4 Semibold, Ink.
 * Brand: docs/10-BRAND.md → Logo direction.
 */
export function Wordmark({
  className,
  title = strings.brand.name,
}: WordmarkProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 168 28"
      className={cn("h-7 w-auto text-ink", className)}
    >
      <title>{title}</title>
      <text
        x="0"
        y="21"
        fill="currentColor"
        style={{
          fontFamily: "var(--font-source-serif), ui-serif, Georgia, serif",
          fontWeight: 600,
          fontSize: 22,
        }}
      >
        {strings.brand.name}
      </text>
    </svg>
  );
}
