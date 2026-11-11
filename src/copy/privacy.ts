/**
 * Privacy page copy. Facts are limited to what the app and the production
 * project settings actually do. See the page component for layout.
 */

const text = (value: string) => ({ kind: "text" as const, text: value });
const link = (href: string, value: string) => ({ kind: "link" as const, href, text: value });
const paragraph = (...spans: Span[]) => ({ kind: "p" as const, spans });
const subhead = (value: string) => ({ kind: "h" as const, text: value });
const bullets = (...items: Span[][]) => ({ kind: "list" as const, items });

type Span = ReturnType<typeof text> | ReturnType<typeof link>;

export const privacyCopy = {
  metaTitle: "Privacy",
  metaDescription:
    "What RoleRefine stores, where it is processed, who else handles it, and how to export or delete an account.",
  title: "Privacy",
  updated: "Updated November 11, 2026",
  note: "This page describes what RoleRefine does with personal information. It is a plain-language account of the product, not a legal opinion.",
  intro: [
    paragraph(
      text(
        "RoleRefine keeps an experience library, tailors a resume and cover letter for each job from that library, and tracks the applications. This page says what information that takes, who else handles it, and how to get a copy or delete an account.",
      ),
    ),
  ],
  requests: {
    id: "requests",
    heading: "Privacy requests",
    blocks: [
      paragraph(
        text(
          "RoleRefine is operated from Ottawa, Ontario, Canada. The founder is responsible for privacy requests. There is no public privacy mailbox yet.",
        ),
      ),
      paragraph(
        text("Signed in, send a privacy question with Feedback. On a phone it is in the account menu. On a larger screen it is in the sidebar. A copy of the account, and deletion, are under "),
        link("/settings?tab=data", "Settings → Data"),
        text("."),
      ),
      paragraph(
        text("People in Canada can also raise a concern with the "),
        link("https://www.priv.gc.ca/en/report-a-concern/", "Office of the Privacy Commissioner of Canada"),
        text("."),
      ),
    ],
  },
  glanceTitle: "At a glance",
  glance: [
    {
      title: "Account records",
      spans: [
        text(
          "The production database that stores your account, library, jobs, and generated documents is in Canada (Montreal).",
        ),
      ],
    },
    {
      title: "AI",
      spans: [
        text(
          "Resume, library, and job-posting text is sent to Anthropic for the step you ask for. That processing can take place outside Canada.",
        ),
      ],
    },
    {
      title: "The application",
      spans: [
        text(
          "The site runs on Vercel in Washington, D.C. A request is handled there even though the database is in Canada.",
        ),
      ],
    },
    {
      title: "Your controls",
      spans: [
        text("Signed in, "),
        link("/settings?tab=data", "Settings → Data"),
        text(" downloads a copy or deletes the account. Marketing email waits for a checkbox."),
      ],
    },
  ],
  tocLabel: "On this page",
  sections: [
    {
      id: "who",
      heading: "Who operates RoleRefine",
      blocks: [
        paragraph(
          text(
            "RoleRefine is operated from Ottawa, Ontario, Canada, by its founder. That person is responsible for questions about this page and for requests to see, correct, or delete personal information.",
          ),
        ),
        paragraph(
          text(
            "A dedicated privacy address is not available yet. Until one is, the path is Feedback while you are signed in, and Settings → Data for a copy or deletion. The Contact section on the About page says the same thing: there is no public mailbox.",
          ),
        ),
      ],
    },
    {
      id: "collect",
      heading: "Information we collect",
      blocks: [
        paragraph(
          text(
            "Some of this you type or upload. Some of it is recorded because you use the site. Resumes, job notes, offers, and contacts can include sensitive details, and details about other people. Add another person’s information only when you mean to keep it here.",
          ),
        ),
        subhead("Information you provide"),
        bullets(
          [
            text(
              "Account. The email address from a sign-in link or from Google. The application database does not store a password.",
            ),
          ],
          [
            text(
              "Profile, if you add it. Name, headline, phone, location, links, and a summary. These can appear on a resume or letter.",
            ),
          ],
          [
            text(
              "Experience library. Roles, education, projects, dates, employers, bullets, skills, and wording you save or accept.",
            ),
          ],
          [
            text(
              "A resume you upload or paste, so the text can be read into the library. The file is handled in memory and is not kept. A PDF is sent to Anthropic to be read. A DOCX is turned into text on the server first, and that text is sent.",
            ),
          ],
          [
            text(
              "Jobs and the search around them. Posting text, title, company, location, a URL you save, salary figures, notes, status, interviews, contacts, reminders, and offers.",
            ),
          ],
          [
            text(
              "Generated resumes and cover letters, including the library snapshot saved with a version.",
            ),
          ],
          [
            text(
              "Settings. Timezone, whether you want reminder email and a weekly summary, and, if you opt in, the time and the exact wording of marketing consent. Reminder and weekly emails are not sent yet. The switches save the choice.",
            ),
          ],
          [
            text(
              "Billing. The plan, billing interval, currency, and the subscription status Stripe sends. Stripe holds the card and any billing address it collects. The full card number is not stored in RoleRefine.",
            ),
          ],
          [
            text(
              "Feedback you send, and a testimonial you choose to submit, including the name you want shown and the consent line you tick.",
            ),
          ],
          [
            text(
              "Waitlist, newsletter, and the keyword checker’s email field. The address, the time and wording of the consent box, and how you arrived. The keyword report itself is not stored.",
            ),
          ],
        ),
        subhead("Information collected as you use the site"),
        bullets(
          [
            text(
              "Sign-in cookies, so the session stays signed in.",
            ),
          ],
          [
            text(
              "A first-touch cookie, only when the address you arrived on includes a source, campaign, referral, or an outside site. That can be saved on the account as how you first arrived.",
            ),
          ],
          [
            text(
              "A currency cookie when you choose USD or CAD. Before a choice, the price can default from a country hint the host supplies. The country is not saved on the account.",
            ),
          ],
          [
            text(
              "A daily hash of the network address, for rate limits on sign-in links, the keyword checker, and public forms. The address itself is not stored in that log.",
            ),
          ],
          [
            text(
              "Product analytics and operational logs, described below. An AI log stores the kind of call, token counts, duration, and an estimated cost. It does not store the prompt or the resume text.",
            ),
          ],
        ),
        paragraph(
          text(
            "The account and profile exist so you can sign in and put your name on a document. The library, jobs, and generated documents exist so a resume can be tailored and the search can be tracked. Billing fields exist so the plan on the account matches the subscription. Preferences and consent exist so a message is sent only on the terms below. Technical data exists to run the service and to see which parts are used.",
          ),
        ),
      ],
    },
    {
      id: "use",
      heading: "How we use information",
      blocks: [
        paragraph(text("RoleRefine uses the information for the product you are using:")),
        bullets(
          [
            text("To create the account and keep you signed in."),
          ],
          [
            text("To import a resume into the library and to store the experience you edit."),
          ],
          [
            text("To read a job description and keep the application, including interviews, contacts, reminders, and offers."),
          ],
          [
            text("To tailor a resume, suggest wording, and write a cover letter from the library when you ask for that step."),
          ],
          [
            text(
              "To run the public keyword checker. The posting is sent to Anthropic. The pasted resume is compared on the server and is not saved, and it is not sent to Anthropic. The bullet-strength checker runs in the browser. Those bullets are not saved.",
            ),
          ],
          [
            text("To charge for Pro through Stripe and to show the plan on the account."),
          ],
          [
            text("To send the sign-in link and the welcome note."),
          ],
          [
            text(
              "To send product updates only after you opt in. Those updates are not being sent. The choice is still stored if you tick the box.",
            ),
          ],
          [
            text("To keep the service working and to see which screens and actions are used."),
          ],
        ),
        paragraph(
          text(
            "These are separate uses. Signing in and using the library is what runs the account. An AI step runs when you start that step. Marketing email waits for its own checkbox. Using the product is not the same as agreeing to product-update email.",
          ),
        ),
      ],
    },
    {
      id: "ai",
      heading: "AI processing",
      blocks: [
        paragraph(
          text(
            "The model is Anthropic’s Claude, called through Anthropic’s commercial API. RoleRefine uses it for resume import, job analysis, resume tailoring, wording suggestions, and cover letters. The public keyword checker uses it for the job posting only.",
          ),
        ),
        paragraph(text("What is sent depends on the step:")),
        bullets(
          [
            text("Import. The PDF, or the text of a DOCX or a paste."),
          ],
          [
            text("Job analysis. The posting text."),
          ],
          [
            text(
              "Tailoring. Library text, the job title and company, the posting, and options you set, such as length and emphasis.",
            ),
          ],
          [
            text(
              "A cover letter. The library, the posting, the job, your name if the profile has one, a recipient if you enter one, and any note you write about why you want the role.",
            ),
          ],
          [
            text("Wording. The library context for a headline, a summary, or a bullet."),
          ],
        ),
        paragraph(
          text(
            "That content can include personal information, including information about other people named in a resume, a posting, or a note. Send that only when it belongs in the request.",
          ),
        ),
        paragraph(
          text("Anthropic can process these requests outside Canada. On November 11, 2026, Anthropic’s "),
          link("https://www.anthropic.com/legal/commercial-terms", "commercial terms"),
          text(" say Anthropic may not train models on customer content from the services. Anthropic’s "),
          link(
            "https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training",
            "notice on model training",
          ),
          text(
            " says inputs and outputs from commercial products, including the API, are not used to train models by default. Anthropic’s ",
          ),
          link(
            "https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data",
            "notice on retention",
          ),
          text(
            " says standard API inputs and outputs are deleted within 30 days, except when Anthropic keeps them longer to enforce its usage policy, when the law requires it, or when a different arrangement applies.",
          ),
        ),
        paragraph(
          text(
            "A shorter zero-retention arrangement is a separate Anthropic option. It is not confirmed for this API account. Deleting a RoleRefine account does not, by itself, delete a copy Anthropic still holds under its own notice.",
          ),
        ),
        paragraph(
          text(
            "RoleRefine then stores the resume, letter, or wording you keep, in the account, for as long as the account is open. That copy is separate from the API request. Each call also writes a usage row: the kind of call, the model, token counts, duration, an estimated cost, whether it succeeded, an error code, and a reference id. The prompt and the generated text are not in that row. A rating you give a document is stored on the document. It is not sent to Anthropic.",
          ),
        ),
      ],
    },
    {
      id: "hosting",
      heading: "Where information is processed",
      blocks: [
        paragraph(
          text(
            "The production database is Supabase, on Amazon Web Services in Canada (ca-central-1, Montreal). Checked on November 11, 2026, from the production project’s database address. That database holds the account, the library, jobs, generated documents, and the other records tied to the account. Sign-in is Supabase Auth on that same project.",
          ),
        ),
        paragraph(
          text(
            "The application is hosted on Vercel. The project’s serverless region is Washington, D.C., United States (iad1). Importing a resume, tailoring, and the other requests are handled there, then saved to the database in Canada when a save happens.",
          ),
        ),
        paragraph(
          text(
            "Primary account storage in Canada does not mean every copy stays in Canada. Anthropic, Stripe, PostHog, Resend, Google (if you use Google sign-in), and Cloudflare (the bot check on public forms) can process, store, or transmit information outside Canada. Information handled in another country can be subject to that country’s laws, including lawful access by authorities there.",
          ),
        ),
        paragraph(
          text(
            "RoleRefine is the service you deal with for the account. This page does not describe the product as Canadian-only.",
          ),
        ),
      ],
    },
    {
      id: "providers",
      heading: "Service providers",
      blocks: [
        paragraph(
          text("Each provider receives what it needs for its role. Their own privacy terms describe their handling."),
        ),
        bullets(
          [
            link("https://supabase.com/privacy", "Supabase"),
            text(
              " stores the database and runs sign-in. It receives the account email, session information, and, through the database, the records described above.",
            ),
          ],
          [
            link("https://vercel.com/legal/privacy-policy", "Vercel"),
            text(
              " hosts the site and runs the application in Washington, D.C. A request, including resume or posting text being processed, passes through that hosting. Vercel also supplies the country hint used to default the price currency.",
            ),
          ],
          [
            link("https://www.anthropic.com/legal/privacy", "Anthropic"),
            text(" receives the AI inputs described above and returns the structured result."),
          ],
          [
            link("https://stripe.com/privacy", "Stripe"),
            text(
              " processes subscriptions on Stripe’s checkout page. RoleRefine sends your email and account id to create or reuse a Stripe customer. Stripe collects the payment method and, when tax requires it, a billing address. RoleRefine stores the customer id, subscription id, plan, interval, currency, and status. It does not store the full card number.",
            ),
          ],
          [
            link("https://posthog.com/privacy", "PostHog"),
            text(
              " receives product analytics. The production project sends events to PostHog in the United States (us.i.posthog.com). Details are under Cookies and analytics.",
            ),
          ],
          [
            link("https://resend.com/legal/privacy-policy", "Resend"),
            text(
              " delivers email. It receives the recipient address, the sender, the subject, and the message. Today that is the sign-in link and the welcome note. The sign-in link is created by Supabase and sent by Resend.",
            ),
          ],
          [
            link("https://policies.google.com/privacy", "Google"),
            text(
              " handles Google sign-in if you choose it. RoleRefine stores the email address from that sign-in on the account.",
            ),
          ],
          [
            link("https://www.cloudflare.com/privacypolicy/", "Cloudflare"),
            text(
              " provides the Turnstile check on the waitlist, the newsletter, and the keyword checker. The check can include the network address.",
            ),
          ],
        ),
      ],
    },
    {
      id: "cookies",
      heading: "Cookies and analytics",
      blocks: [
        paragraph(
          text(
            "Sign-in uses cookies set by Supabase Auth. They keep the session. They are required for a signed-in account.",
          ),
        ),
        paragraph(
          text(
            "A separate cookie, rr_ft, remembers how you first arrived, for 30 days. It is set only when that visit includes a source, a campaign, a referral code, or the host of an outside site that linked here. It is not used as an advertising profile.",
          ),
        ),
        paragraph(
          text(
            "A cookie named rr-plan-currency stores USD or CAD for one year after you choose a currency on the pricing pages or at checkout.",
          ),
        ),
        paragraph(
          text(
            "Product analytics use PostHog. The browser library is set to cookieless mode, keeps its state in memory, and does not create a person profile. There is no analytics cookie from that setup, and there is no analytics switch in Settings.",
          ),
        ),
        paragraph(
          text(
            "Cookieless mode still sends events. PostHog can receive the page address and the network address used to deliver the event. The events RoleRefine itself defines use ids, counts, and categories: for example a button location, a tool name, a pricing interval, or an export. Those defined events do not include your email, a resume, or a job posting.",
          ),
        ),
        paragraph(
          text(
            "The browser library’s click tracking is left on. A click can include the text of the element you clicked. On a page that shows a resume, a posting, or a bullet, that text can be part of the click. RoleRefine does not add that text on purpose. It has not turned the click tracking off.",
          ),
        ),
      ],
    },
    {
      id: "retention",
      heading: "How long information is kept",
      blocks: [
        paragraph(
          text(
            "While the account is open, the profile, library, jobs, generated documents, and settings stay until you remove them in the product or delete the account. An uploaded PDF or DOCX is not kept as a file. The text you save is.",
          ),
        ),
        paragraph(
          text(
            "Wording you save is kept with the account and removed when the account is deleted. It is not included in the export file today.",
          ),
        ),
        paragraph(
          text(
            "Anthropic’s handling of an API request is the retention described above. It is separate from the copy in your account, and this page does not set a RoleRefine deadline for Anthropic’s copy.",
          ),
        ),
        paragraph(
          text(
            "Stripe keeps the customer, payment method, and invoices under Stripe’s own practices. RoleRefine’s copy of the plan and subscription status is removed with the account. The Stripe customer is not deleted by account deletion.",
          ),
        ),
        paragraph(
          text(
            "Marketing consent on the account stays until you untick it or delete the account. Consent stored for a waitlist, newsletter, or keyword-checker email stays with that email record. There is no self-serve deletion for that email yet.",
          ),
        ),
        paragraph(
          text(
            "A send log records the template name, a recipient key, and the provider’s message id. It does not store the message body. Account deletion does not remove it. Analytics events already sent to PostHog, and operational logs on Vercel, follow those services’ own retention. This project does not set those periods. A database backup may still hold a deleted account for a period that is not published here.",
          ),
        ),
        paragraph(
          text(
            "Feedback you sent, and a testimonial you submitted, stay after the account is deleted. The link to the account is removed. The name you chose for a testimonial stays on that note.",
          ),
        ),
      ],
    },
    {
      id: "rights",
      heading: "Your choices",
      blocks: [
        paragraph(
          text("Signed in, you can do the following in the product. People outside Canada may have other rights under their own laws. This section describes the controls RoleRefine provides and how to reach the operator."),
        ),
        bullets(
          [
            text("Access. "),
            link("/settings?tab=data", "Settings → Data"),
            text(
              " downloads rolerefine-export.json. The file includes the profile, experience entries, skills, jobs, application history, generated resumes and letters, contacts, reminders, offers, and AI usage metadata. It does not include waitlist records, the email send log, Stripe’s payment records, or saved wording.",
            ),
          ],
          [
            text(
              "Correction. Edit the profile, the library, and the job records in the product. Those edits replace what is stored.",
            ),
          ],
          [
            text(
              "Deletion. Settings → Data asks you to type DELETE. A stored Stripe subscription is cancelled first. If that cancellation cannot be confirmed, the account is left in place. Otherwise the account and the records tied to it are removed, the sign-in user is deleted, and you are signed out. If deleting the sign-in user fails, the account data is already removed and the sign-in identity can remain until it is removed.",
            ),
          ],
          [
            text("Marketing consent. "),
            link("/settings?tab=preferences", "Settings → Preferences"),
            text(
              " has the product-updates box. Unticking it clears the time and the exact wording stored on the account.",
            ),
          ],
          [
            text(
              "A question or a complaint. Use Feedback while signed in. People in Canada can also contact the Office of the Privacy Commissioner of Canada, linked above.",
            ),
          ],
        ),
        paragraph(
          text(
            "Some information can remain where a provider still holds it, or where a record has to be kept for a legal obligation. Payment records at Stripe are the clearest case. This page does not name a number of years for that.",
          ),
        ),
      ],
    },
    {
      id: "safeguards",
      heading: "Safeguards",
      blocks: [
        paragraph(
          text(
            "The production site is served over HTTPS. Sign-in is a one-time email link or Google, through Supabase Auth. Application queries for your records are limited to the signed-in account. Database credentials and API keys are kept in the hosting environment, not in the public site.",
          ),
        ),
        paragraph(
          text(
            "An uploaded resume is checked for type and size. PDF and DOCX only, up to 5 MB. The file is read in memory and is not stored as a file.",
          ),
        ),
        paragraph(
          text(
            "These are ordinary safeguards for this setup. This page does not describe end-to-end encryption, an independent security certification, or a penetration test.",
          ),
        ),
      ],
    },
    {
      id: "email",
      heading: "Email",
      blocks: [
        paragraph(
          text(
            "Account messages and marketing messages are different. The sign-in link and the welcome note are account messages. They are sent because you are signing in or because the account was just created. Each one includes a link to email preferences. They are not the product-updates list.",
          ),
        ),
        paragraph(
          text(
            "Product updates are commercial email. The box in Settings → Preferences starts unticked. Ticking it stores the time and the exact sentence you agreed to. The application refuses to send that mail without the stored consent, and without a mailing address on the message. Those updates are not being sent today.",
          ),
        ),
        paragraph(
          text(
            "A commercial message has to identify the sender, include a mailing address, and include a way to unsubscribe. A street address or PO box is not published on this page. One has to be in place before those messages go out. Reminder email and the weekly summary are not sent yet. The preferences only save the choice.",
          ),
        ),
        paragraph(
          text(
            "The waitlist, the newsletter, and the keyword checker’s email field use their own unticked consent box and store the time and the wording. There is no public unsubscribe page for that address yet. For an account, withdraw the product-updates choice under Settings → Preferences.",
          ),
        ),
      ],
    },
    {
      id: "changes",
      heading: "Changes to this page",
      blocks: [
        paragraph(
          text(
            "This page can change as the product changes. The date under the title is the date of this version. A material change is posted here with a new date. Where that change affects information you already provided, and RoleRefine has your email address, you will also get a note.",
          ),
        ),
      ],
    },
  ],
};
