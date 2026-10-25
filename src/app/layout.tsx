import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { strings } from "@/copy/strings";
import { env } from "@/lib/env";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

/** Lets the on-screen keyboard shrink the page so a focused field can scroll into view. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: strings.brand.name,
    template: `%s · ${strings.brand.name}`,
  },
  description: strings.brand.shortDescriptor,
  applicationName: strings.brand.name,
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: strings.brand.name,
    title: strings.brand.name,
    description: strings.brand.shortDescriptor,
  },
  twitter: {
    card: "summary_large_image",
    title: strings.brand.name,
    description: strings.brand.shortDescriptor,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <PostHogProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
