/**
 * Single-column resume. Templates differ by type size and rules only.
 * docs/03-ARCHITECTURE.md → ATS rules. docs/10-BRAND.md → Exported documents.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import type { ResumePdfModel } from "./model";
import type { ResumeTemplateId } from "./template";

/** Brand pine. Modern section rules only. */
const PINE = "#1F6B57";

type VariantStyle = ReturnType<typeof StyleSheet.create>;

const classic = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 46,
    fontFamily: "Inter",
    fontSize: 10,
    lineHeight: 1.28,
    color: "#000000",
  },
  name: { fontSize: 16, fontWeight: 600, lineHeight: 1.15 },
  headline: { fontSize: 10.5, marginTop: 2 },
  contact: { fontSize: 9, marginTop: 3 },
  link: { fontSize: 9, marginTop: 1 },
  headerRule: {
    borderBottomWidth: 0.6,
    borderBottomColor: "#000000",
    marginTop: 6,
  },
  section: { marginTop: 8 },
  sectionHeading: { fontSize: 11, fontWeight: 600, marginBottom: 2 },
  entry: { marginTop: 4 },
  title: { fontWeight: 600 },
  meta: { fontSize: 9, marginTop: 1 },
  url: { fontSize: 9, marginTop: 1 },
  bullet: { marginTop: 1 },
  skill: { marginTop: 1 },
});

const modern = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 48,
    fontFamily: "Inter",
    fontSize: 10,
    lineHeight: 1.28,
    color: "#000000",
  },
  name: {
    fontFamily: "Source Serif 4",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.15,
  },
  headline: { fontSize: 10.5, marginTop: 2 },
  contact: { fontSize: 9, marginTop: 3 },
  link: { fontSize: 9, marginTop: 1 },
  headerRule: { marginTop: 6 },
  section: { marginTop: 8 },
  sectionHeading: {
    fontFamily: "Source Serif 4",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 2,
    paddingBottom: 1,
    borderBottomWidth: 0.75,
    borderBottomColor: PINE,
  },
  entry: { marginTop: 4 },
  title: { fontWeight: 600 },
  meta: { fontSize: 9, marginTop: 1 },
  url: { fontSize: 9, marginTop: 1 },
  bullet: { marginTop: 1 },
  skill: { marginTop: 1 },
});

const compact = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 40,
    fontFamily: "Inter",
    fontSize: 9,
    lineHeight: 1.25,
    color: "#000000",
  },
  name: { fontSize: 14, fontWeight: 600, lineHeight: 1.15 },
  headline: { fontSize: 9.5, marginTop: 2 },
  contact: { fontSize: 8.5, marginTop: 2 },
  link: { fontSize: 8.5, marginTop: 1 },
  headerRule: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    marginTop: 5,
  },
  section: { marginTop: 7 },
  sectionHeading: { fontSize: 10, fontWeight: 600, marginBottom: 2 },
  entry: { marginTop: 4 },
  title: { fontWeight: 600 },
  meta: { fontSize: 8.5, marginTop: 1 },
  url: { fontSize: 8.5, marginTop: 1 },
  bullet: { marginTop: 1 },
  skill: { marginTop: 1 },
});

const STYLES: Record<ResumeTemplateId, VariantStyle> = {
  classic,
  modern,
  compact,
};

export function ResumeDocument({
  model,
  variant,
}: {
  model: ResumePdfModel;
  variant: ResumeTemplateId;
}) {
  const styles = STYLES[variant];
  const hasHeader = Boolean(
    model.name || model.headline || model.contact || model.links.length > 0,
  );

  return (
    <Document title={model.name ?? "Resume"} author={model.name ?? undefined}>
      <Page size="LETTER" style={styles.page}>
        {model.name ? <Text style={styles.name}>{model.name}</Text> : null}
        {model.headline ? <Text style={styles.headline}>{model.headline}</Text> : null}
        {model.contact ? <Text style={styles.contact}>{model.contact}</Text> : null}
        {model.links.map((link) => (
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
