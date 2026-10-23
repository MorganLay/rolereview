import { createElement } from "react";
import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EXAMPLE_MAILING_ADDRESS, publicMailingAddress } from "@/lib/email/address";
import { decideEmailSend } from "@/lib/email/decide";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

const { findFirst, create } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    emailLog: { findFirst, create },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "RoleRefine <hello@mail.rolerefine.ca>",
    MAILING_ADDRESS: "Your mailing address, Ottawa, ON, Canada",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    VERCEL_ENV: undefined,
  },
}));

import { sendEmail } from "@/lib/email/send";

const USER = "11111111-1111-4111-8111-111111111111";

describe("publicMailingAddress", () => {
  it("drops blank and the example line", () => {
    expect(publicMailingAddress(null)).toBeNull();
    expect(publicMailingAddress("  ")).toBeNull();
    expect(publicMailingAddress(EXAMPLE_MAILING_ADDRESS)).toBeNull();
    expect(publicMailingAddress(" PO Box 1, Ottawa, ON ")).toBe("PO Box 1, Ottawa, ON");
  });
});

describe("decideEmailSend", () => {
  it("sends welcome without consent or a street address", () => {
    expect(
      decideEmailSend({
        template: "welcome",
        alreadySent: false,
        marketingConsent: false,
        configured: true,
        hasMailingAddress: false,
      }),
    ).toBe("send");
  });

  it("refuses marketing without consent, then without an address", () => {
    expect(
      decideEmailSend({
        template: "product-updates",
        alreadySent: false,
        marketingConsent: false,
        configured: true,
        hasMailingAddress: true,
      }),
    ).toBe("no-consent");
    expect(
      decideEmailSend({
        template: "product-updates",
        alreadySent: false,
        marketingConsent: true,
        configured: true,
        hasMailingAddress: false,
      }),
    ).toBe("no-address");
  });

  it("skips a duplicate before it checks configuration", () => {
    expect(
      decideEmailSend({
        template: "welcome",
        alreadySent: true,
        marketingConsent: false,
        configured: false,
        hasMailingAddress: false,
      }),
    ).toBe("already-sent");
  });

  it("rejects an unknown template", () => {
    expect(
      decideEmailSend({
        template: "newsletter",
        alreadySent: false,
        marketingConsent: true,
        configured: true,
        hasMailingAddress: true,
      }),
    ).toBe("unknown-template");
  });

  it("skips Preview even when Resend is configured", () => {
    expect(
      decideEmailSend({
        template: "welcome",
        alreadySent: false,
        marketingConsent: false,
        configured: true,
        hasMailingAddress: false,
        preview: true,
      }),
    ).toBe("preview");
  });

  it("keeps already-sent ahead of Preview", () => {
    expect(
      decideEmailSend({
        template: "welcome",
        alreadySent: true,
        marketingConsent: false,
        configured: true,
        hasMailingAddress: false,
        preview: true,
      }),
    ).toBe("already-sent");
  });
});

describe("WelcomeEmail", () => {
  it("includes the library link and omits a placeholder address", async () => {
    const html = await render(
      createElement(WelcomeEmail, {
        libraryUrl: "http://localhost:3000/library/import",
        preferencesUrl: "http://localhost:3000/settings?tab=preferences",
        mailingAddress: null,
      }),
    );
    expect(html).toContain("http://localhost:3000/library/import");
    expect(html).toContain("http://localhost:3000/settings?tab=preferences");
    expect(html).toContain("Build your library");
    expect(html).not.toContain("Your mailing address");
    expect(html).not.toContain("{{{");
  });
});

describe("sendEmail", () => {
  const transport = { send: vi.fn() };

  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    transport.send.mockReset();
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "log" });
    transport.send.mockResolvedValue({ id: "msg_1" });
  });

  it("sends welcome once and writes EmailLog", async () => {
    const result = await sendEmail(
      {
        to: "person@example.com",
        template: "welcome",
        refKey: "signup",
        recipientKey: USER,
      },
      transport,
    );
    expect(result).toEqual({ status: "sent", providerMessageId: "msg_1" });
    expect(transport.send).toHaveBeenCalledOnce();
    const message = transport.send.mock.calls[0]?.[0];
    expect(message.idempotencyKey).toBe(`welcome:${USER}:signup`);
    expect(message.html).toContain("/library/import");
    expect(message.html).not.toContain(EXAMPLE_MAILING_ADDRESS);
    expect(create).toHaveBeenCalledWith({
      data: {
        recipientKey: USER,
        template: "welcome",
        refKey: "signup",
        providerMessageId: "msg_1",
      },
    });
  });

  it("does not send when that EmailLog row exists", async () => {
    findFirst.mockResolvedValue({ id: "log" });
    const result = await sendEmail(
      {
        to: "person@example.com",
        template: "welcome",
        refKey: "signup",
        recipientKey: USER,
      },
      transport,
    );
    expect(result).toEqual({ status: "skipped", reason: "already-sent" });
    expect(transport.send).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("does not send a marketing template without consent", async () => {
    const result = await sendEmail(
      {
        to: "person@example.com",
        template: "product-updates",
        refKey: "2026-10",
        recipientKey: USER,
      },
      transport,
    );
    expect(result).toEqual({ status: "skipped", reason: "no-consent" });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("does not write EmailLog when the provider returns an error", async () => {
    transport.send.mockResolvedValue({ error: "application_error" });
    const result = await sendEmail(
      {
        to: "person@example.com",
        template: "welcome",
        refKey: "signup",
        recipientKey: USER,
      },
      transport,
    );
    expect(result).toEqual({ status: "failed" });
    expect(create).not.toHaveBeenCalled();
  });
});
