import { strings } from "@/copy/strings";

const copy = strings.marketing.home;
const billing = strings.marketing.pricing;

export const FAQ_IDS = [
  "make-up",
  "ats",
  "data",
  "start",
  "letters",
  "free",
  "cancel",
  "government",
  "tech",
] as const;

export const BILLING_FAQ_IDS = [
  "billing-free",
  "billing-pro",
  "billing-cancel",
  "billing-guarantee",
  "billing-weekly",
  "billing-founding",
  "billing-currency",
] as const;

export type FaqId = (typeof FAQ_IDS)[number];
export type BillingFaqId = (typeof BILLING_FAQ_IDS)[number];

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export function faqItems(freeTailor: number): FaqItem[] {
  return [
    { id: "make-up", question: copy.faq1Q, answer: copy.faq1A },
    { id: "ats", question: copy.faq2Q, answer: copy.faq2A },
    { id: "data", question: copy.faq3Q, answer: copy.faq3A },
    { id: "start", question: copy.faq4Q, answer: copy.faq4A },
    { id: "letters", question: copy.faq5Q, answer: copy.faq5A },
    { id: "free", question: copy.faq6Q, answer: copy.faq6A(freeTailor) },
    { id: "cancel", question: copy.faq7Q, answer: copy.faq7A },
    { id: "government", question: copy.faq8Q, answer: copy.faq8A },
    { id: "tech", question: copy.faq9Q, answer: copy.faq9A },
  ];
}

export function billingFaqItems(input: {
  freeTailor: number;
  foundingPercent: number;
}): FaqItem[] {
  return [
    {
      id: "billing-free",
      question: billing.faqFreeQ,
      answer: billing.faqFreeA(input.freeTailor),
    },
    { id: "billing-pro", question: billing.faqProQ, answer: billing.faqProA },
    {
      id: "billing-cancel",
      question: billing.faqCancelQ,
      answer: billing.faqCancelA,
    },
    {
      id: "billing-guarantee",
      question: billing.faqGuaranteeQ,
      answer: billing.faqGuaranteeA,
    },
    {
      id: "billing-weekly",
      question: billing.faqWeeklyQ,
      answer: billing.faqWeeklyA,
    },
    {
      id: "billing-founding",
      question: billing.faqFoundingQ,
      answer: billing.faqFoundingA(input.foundingPercent),
    },
    {
      id: "billing-currency",
      question: billing.faqCurrencyQ,
      answer: billing.faqCurrencyA,
    },
  ];
}

export function faqJsonLd(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
