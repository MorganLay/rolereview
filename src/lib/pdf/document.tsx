/**
 * Single-column resume. Templates differ by type size and rules only.
 * A 1-page tailor tightens spacing, then groups links, then steps type down
 * to the template minimum. docs/03-ARCHITECTURE.md → ATS rules.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import type { ResumePdfModel } from "./model";
import type { ResumeTemplateId } from "./template";

/** Brand pine. Modern section rules only. */
const PINE = "#1F6B57";
const SEPARATOR = " \u00b7 ";

export const PDF_DENSITIES = ["regular", "grouped", "tight", "tighter"] as const;
export type PdfDensity = (typeof PDF_DENSITIES)[number];

type Metrics = {
  padY: number;
  padX: number;
  fontSize: number;
  lineHeight: number;
  nameSize: number;
  headlineSize: number;
  contactSize: number;
  contactGap: number;
  linkGap: number;
  ruleGap: number;
  sectionGap: number;
  headingSize: number;
  headingGap: number;
  entryGap: number;
  metaSize: number;
  bulletGap: number;
};

type VariantStyle = ReturnType<typeof StyleSheet.create>;

const CLASSIC: Record<PdfDensity, Metrics> = {
  regular: {
    padY: 36,
    padX: 46,
    fontSize: 10,
    lineHeight: 1.28,
    nameSize: 16,
    headlineSize: 10.5,
    contactSize: 9,
    contactGap: 3,
    linkGap: 1,
    ruleGap: 6,
    sectionGap: 8,
    headingSize: 11,
    headingGap: 2,
    entryGap: 4,
    metaSize: 9,
    bulletGap: 1,
  },
  grouped: {
    padY: 36,
    padX: 46,
    fontSize: 10,
    lineHeight: 1.28,
    nameSize: 16,
    headlineSize: 10.5,
    contactSize: 9,
    contactGap: 3,
    linkGap: 1,
    ruleGap: 6,
    sectionGap: 8,
    headingSize: 11,
    headingGap: 2,
    entryGap: 4,
    metaSize: 9,
    bulletGap: 1,
  },
  tight: {
    padY: 28,
    padX: 40,
    fontSize: 9.5,
    lineHeight: 1.22,
    nameSize: 15,
    headlineSize: 10,
    contactSize: 8.5,
    contactGap: 2,
    linkGap: 1,
    ruleGap: 4,
    sectionGap: 6,
    headingSize: 10.5,
    headingGap: 1,
    entryGap: 3,
    metaSize: 8.5,
    bulletGap: 1,
  },
  tighter: {
    padY: 22,
    padX: 36,
    fontSize: 8.5,
    lineHeight: 1.15,
    nameSize: 13,
    headlineSize: 9,
    contactSize: 8,
    contactGap: 1,
    linkGap: 0,
    ruleGap: 3,
    sectionGap: 4,
    headingSize: 9.5,
    headingGap: 1,
    entryGap: 2,
    metaSize: 8,
    bulletGap: 0,
  },
};

const MODERN: Record<PdfDensity, Metrics> = {
  regular: {
    padY: 36,
    padX: 48,
    fontSize: 10,
    lineHeight: 1.28,
    nameSize: 18,
    headlineSize: 10.5,
    contactSize: 9,
    contactGap: 3,
    linkGap: 1,
    ruleGap: 6,
    sectionGap: 8,
    headingSize: 12,
    headingGap: 2,
    entryGap: 4,
    metaSize: 9,
    bulletGap: 1,
  },
  grouped: {
    padY: 36,
    padX: 48,
    fontSize: 10,
    lineHeight: 1.28,
    nameSize: 18,
    headlineSize: 10.5,
    contactSize: 9,
    contactGap: 3,
    linkGap: 1,
    ruleGap: 6,
    sectionGap: 8,
    headingSize: 12,
    headingGap: 2,
    entryGap: 4,
    metaSize: 9,
    bulletGap: 1,
  },
  tight: {
    padY: 28,
    padX: 42,
    fontSize: 9.5,
    lineHeight: 1.22,
    nameSize: 16,
    headlineSize: 10,
    contactSize: 8.5,
    contactGap: 2,
    linkGap: 1,
    ruleGap: 4,
    sectionGap: 6,
    headingSize: 11,
    headingGap: 1,
    entryGap: 3,
    metaSize: 8.5,
    bulletGap: 1,
  },
  tighter: {
    padY: 22,
    padX: 36,
    fontSize: 8.5,
    lineHeight: 1.15,
    nameSize: 14,
    headlineSize: 9,
    contactSize: 8,
    contactGap: 1,
    linkGap: 0,
    ruleGap: 3,
    sectionGap: 4,
    headingSize: 10,
    headingGap: 1,
    entryGap: 2,
    metaSize: 8,
    bulletGap: 0,
  },
};

const COMPACT: Record<PdfDensity, Metrics> = {
  regular: {
    padY: 32,
    padX: 40,
    fontSize: 9,
    lineHeight: 1.25,
    nameSize: 14,
    headlineSize: 9.5,
    contactSize: 8.5,
    contactGap: 2,
    linkGap: 1,
    ruleGap: 5,
    sectionGap: 7,
    headingSize: 10,
    headingGap: 2,
    entryGap: 4,
    metaSize: 8.5,
    bulletGap: 1,
  },
  grouped: {
    padY: 32,
    padX: 40,
    fontSize: 9,
    lineHeight: 1.25,
    nameSize: 14,
    headlineSize: 9.5,
    contactSize: 8.5,
    contactGap: 2,
    linkGap: 1,
    ruleGap: 5,
    sectionGap: 7,
    headingSize: 10,
    headingGap: 2,
    entryGap: 4,
    metaSize: 8.5,
    bulletGap: 1,
  },
  tight: {
    padY: 26,
    padX: 36,
    fontSize: 8.5,
    lineHeight: 1.18,
    nameSize: 13,
    headlineSize: 9,
    contactSize: 8,
    contactGap: 1,
    linkGap: 0,
    ruleGap: 3,
    sectionGap: 5,
    headingSize: 9.5,
    headingGap: 1,
    entryGap: 2,
    metaSize: 8,
    bulletGap: 0,
  },
  tighter: {
    padY: 20,
    padX: 32,
    fontSize: 8,
    lineHeight: 1.12,
    nameSize: 12,
    headlineSize: 8.5,
    contactSize: 7.5,
    contactGap: 1,
    linkGap: 0,
    ruleGap: 2,
    sectionGap: 3,
    headingSize: 9,
    headingGap: 1,
    entryGap: 2,
    metaSize: 7.5,
    bulletGap: 0,
  },
};

const METRICS: Record<ResumeTemplateId, Record<PdfDensity, Metrics>> = {
  classic: CLASSIC,
  modern: MODERN,
  compact: COMPACT,
};

/** Spacing from one density and type size from another. Numbers stay on the ladder. */
export type PdfLayout = {
  spacing: PdfDensity;
  type: PdfDensity;
  groupLinks: boolean;
};

const TYPE_FIELDS = [
  "fontSize",
  "nameSize",
  "headlineSize",
  "contactSize",
  "headingSize",
  "metaSize",
] as const;

/** `grouped` is regular type with links on one line. Other densities match their metrics. */
export function layoutFromDensity(density: PdfDensity): PdfLayout {
  return {
    spacing: density,
    type: density,
    groupLinks: density !== "regular",
  };
}

export function composeMetrics(variant: ResumeTemplateId, layout: PdfLayout): Metrics {
  const spacing = METRICS[variant][layout.spacing];
  const type = METRICS[variant][layout.type];
  const metrics: Metrics = { ...spacing };
  for (const field of TYPE_FIELDS) metrics[field] = type[field];
  return metrics;
}

/** Smallest body size already defined for this template. The fit ladder stops here. */
export function minimumFontSize(variant: ResumeTemplateId): number {
  let min = METRICS[variant].regular.fontSize;
  for (const density of PDF_DENSITIES) {
    min = Math.min(min, METRICS[variant][density].fontSize);
  }
  return min;
}

export function layoutFontSize(variant: ResumeTemplateId, layout: PdfLayout): number {
  return composeMetrics(variant, layout).fontSize;
}

const STYLES = {
  classic: stylesFor("classic"),
  modern: stylesFor("modern"),
  compact: stylesFor("compact"),
} as const;

function stylesFor(variant: ResumeTemplateId): Record<PdfDensity, VariantStyle> {
  return {
    regular: buildStyles(variant, METRICS[variant].regular),
    grouped: buildStyles(variant, METRICS[variant].grouped),
    tight: buildStyles(variant, METRICS[variant].tight),
    tighter: buildStyles(variant, METRICS[variant].tighter),
  };
}

const mixedStyles = new Map<string, VariantStyle>();

function stylesForLayout(variant: ResumeTemplateId, layout: PdfLayout): VariantStyle {
  if (layout.spacing === layout.type) return STYLES[variant][layout.spacing];
  const key = `${variant}:${layout.spacing}:${layout.type}`;
  const cached = mixedStyles.get(key);
  if (cached) return cached;
  const created = buildStyles(variant, composeMetrics(variant, layout));
  mixedStyles.set(key, created);
  return created;
}

function buildStyles(variant: ResumeTemplateId, metrics: Metrics): VariantStyle {
  const serif = variant === "modern";
  const ruleWidth = variant === "compact" ? 0.5 : variant === "classic" ? 0.6 : 0;
  return StyleSheet.create({
    page: {
      paddingTop: metrics.padY,
      paddingBottom: metrics.padY,
      paddingHorizontal: metrics.padX,
      fontFamily: "Inter",
      fontSize: metrics.fontSize,
      lineHeight: metrics.lineHeight,
      color: "#000000",
    },
    name: {
      fontFamily: serif ? "Source Serif 4" : "Inter",
      fontSize: metrics.nameSize,
      fontWeight: 600,
      lineHeight: 1.15,
    },
    headline: { fontSize: metrics.headlineSize, marginTop: 2 },
    contact: { fontSize: metrics.contactSize, marginTop: metrics.contactGap },
    link: { fontSize: metrics.contactSize, marginTop: metrics.linkGap },
    headerRule: {
      marginTop: metrics.ruleGap,
      ...(ruleWidth > 0
        ? { borderBottomWidth: ruleWidth, borderBottomColor: "#000000" }
        : {}),
    },
    section: { marginTop: metrics.sectionGap },
    sectionHeading: {
      fontFamily: serif ? "Source Serif 4" : "Inter",
      fontSize: metrics.headingSize,
      fontWeight: 600,
      marginBottom: metrics.headingGap,
      ...(serif
        ? {
            paddingBottom: 1,
            borderBottomWidth: 0.75,
            borderBottomColor: PINE,
          }
        : {}),
    },
    entry: { marginTop: metrics.entryGap },
    title: { fontWeight: 600 },
    meta: { fontSize: metrics.metaSize, marginTop: 1 },
    url: { fontSize: metrics.metaSize, marginTop: 1 },
    bullet: { marginTop: metrics.bulletGap },
    skill: { marginTop: metrics.bulletGap },
  });
}

export function ResumeDocument({
  model,
  variant,
  density = "regular",
  layout,
  producedAt,
}: {
  model: ResumePdfModel;
  variant: ResumeTemplateId;
  density?: PdfDensity;
  /** When set, spacing, type, and link grouping come from here instead of `density`. */
  layout?: PdfLayout;
  producedAt?: Date;
}) {
  const resolved = layout ?? layoutFromDensity(density);
  const styles = stylesForLayout(variant, resolved);
  const hasHeader = Boolean(
    model.name || model.headline || model.contact || model.links.length > 0,
  );
  const links = resolved.groupLinks ? groupedLinks(model.links) : model.links;

  return (
    <Document
      title={model.name ?? "Resume"}
      author={model.name ?? undefined}
      creationDate={producedAt}
      modificationDate={producedAt}
    >
      <Page size="LETTER" style={styles.page}>
        {model.name ? <Text style={styles.name}>{model.name}</Text> : null}
        {model.headline ? <Text style={styles.headline}>{model.headline}</Text> : null}
        {model.contact ? <Text style={styles.contact}>{model.contact}</Text> : null}
        {links.map((link) => (
          <Text key={link} style={styles.link}>
            {link}
          </Text>
        ))}
        {hasHeader ? <View style={styles.headerRule} /> : null}
        {model.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading} minPresenceAhead={16}>
              Summary
            </Text>
            <Text>{model.summary}</Text>
          </View>
        ) : null}
        {model.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading} minPresenceAhead={16}>
              {section.heading}
            </Text>
            {section.entries.map((entry, index) => (
              <View key={`${section.heading}-${index}`} style={styles.entry}>
                {entry.title ? <Text style={styles.title}>{entry.title}</Text> : null}
                {entry.meta ? <Text style={styles.meta}>{entry.meta}</Text> : null}
                {entry.url ? <Text style={styles.url}>{entry.url}</Text> : null}
                {entry.bullets.map((bullet, bulletIndex) => (
                  <Text key={bulletIndex} style={styles.bullet}>
                    {`- ${bullet}`}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ))}
        {model.skills.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading} minPresenceAhead={16}>
              Skills
            </Text>
            {model.skills.map((line, index) => (
              <Text key={index} style={styles.skill}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** One line of links, so a slightly long resume can stay on one page. */
function groupedLinks(links: string[]): string[] {
  if (links.length === 0) return [];
  return [links.join(SEPARATOR)];
}
