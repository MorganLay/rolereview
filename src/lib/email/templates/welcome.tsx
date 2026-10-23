import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

import { strings } from "@/copy/strings";

const copy = strings.email.welcome;

/** Documented brand tokens. Email clients need hex; see docs/10-BRAND.md. */
const ink = "#142033";
const paper = "#FAF8F4";
const slate = "#566273";
const pine = "#1F6B57";

export type WelcomeEmailProps = {
  libraryUrl: string;
  preferencesUrl: string;
  mailingAddress: string | null;
};

export function WelcomeEmail({
  libraryUrl = "http://localhost:3000/library/import",
  preferencesUrl = "http://localhost:3000/settings?tab=preferences",
  mailingAddress = null,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={{ backgroundColor: paper, margin: 0, fontFamily: "Arial, sans-serif" }}>
        <Container style={{ padding: "32px 24px" }}>
          <Text style={{ color: ink, fontSize: "20px", fontWeight: 600, margin: "0 0 16px" }}>
            {strings.brand.name}
          </Text>
          <Text style={{ color: ink, fontSize: "16px", lineHeight: "24px", margin: "0 0 24px" }}>
            {copy.body}
          </Text>
          <Button
            href={libraryUrl}
            style={{
              backgroundColor: pine,
              borderRadius: "8px",
              color: "#ffffff",
              display: "inline-block",
              fontSize: "14px",
              padding: "12px 16px",
              textDecoration: "none",
            }}
          >
            {copy.cta}
          </Button>
          <Text style={{ color: slate, fontSize: "12px", lineHeight: "18px", margin: "32px 0 0" }}>
            <Link href={preferencesUrl} style={{ color: slate }}>
              {copy.preferences}
            </Link>
          </Text>
          <Text style={{ color: slate, fontSize: "12px", lineHeight: "18px", margin: "8px 0 0" }}>
            {mailingAddress ? `${copy.location} · ${mailingAddress}` : copy.location}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;
