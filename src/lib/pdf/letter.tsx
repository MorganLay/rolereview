/**
 * Cover letter PDF. Templates differ by type size and the signature face.
 * docs/03-ARCHITECTURE.md → Exports. docs/10-BRAND.md → Exported documents.
 */

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import type { LetterPdfModel } from "./letter-model";
import type { ResumeTemplateId } from "./template";

type Metrics = {
  padY: number;
  padX: number;
  fontSize: number;
  lineHeight: number;
  blockGap: number;
  signatureSize: number;
};

const CLASSIC: Metrics = {
  padY: 54,
  padX: 72,
  fontSize: 11,
  lineHeight: 1.4,
  blockGap: 12,
  signatureSize: 11,
};

const MODERN: Metrics = {
  padY: 54,
  padX: 72,
  fontSize: 11,
  lineHeight: 1.42,
  blockGap: 12,
  signatureSize: 13,
};

const COMPACT: Metrics = {
  padY: 40,
  padX: 54,
  fontSize: 10,
  lineHeight: 1.32,
  blockGap: 9,
  signatureSize: 10,
};

const METRICS: Record<ResumeTemplateId, Metrics> = {
  classic: CLASSIC,
  modern: MODERN,
  compact: COMPACT,
};

const STYLES = {
  classic: buildStyles("classic"),
  modern: buildStyles("modern"),
  compact: buildStyles("compact"),
} as const;

function buildStyles(variant: ResumeTemplateId) {
  const metrics = METRICS[variant];
  const serif = variant === "modern";
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
    block: { marginTop: metrics.blockGap },
    first: { marginTop: 0 },
    signature: {
      fontFamily: serif ? "Source Serif 4" : "Inter",
      fontSize: metrics.signatureSize,
      fontWeight: 600,
    },
  });
}

export function LetterDocument({
  model,
  variant,
}: {
  model: LetterPdfModel;
  variant: ResumeTemplateId;
}) {
  const styles = STYLES[variant];
  const last = model.blocks.length - 1;

  return (
    <Document title="Cover letter">
      <Page size="LETTER" style={styles.page}>
        {model.blocks.map((block, index) => (
          <View key={`${index}-${block.slice(0, 24)}`} style={index === 0 ? styles.first : styles.block}>
            <Text style={index === last ? styles.signature : undefined}>{block}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
