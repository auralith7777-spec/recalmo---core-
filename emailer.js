import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generates a context-aware follow-up email for an overdue invoice.
 * Tone stays professional and relationship-safe — never threatening,
 * always offers a concrete next step (pay, or set up a plan).
 */
export async function generateFollowUpEmail({
  clientContactName,
  companyName,
  invoiceId,
  amountDue,
  daysOverdue,
  previousAttempts,
}) {
  const prompt = `You are drafting a polite, professional accounts-receivable
follow-up email on behalf of ${companyName}, sent under their own billing
brand (this is FIRST-PARTY billing communication, not a third-party debt
collector — never use collections-agency language, never threaten legal
action or credit reporting).

Context:
- Recipient: ${clientContactName}
- Invoice: ${invoiceId}
- Amount due: $${amountDue}
- Days overdue: ${daysOverdue}
- Previous follow-up attempts: ${previousAttempts}

Write a short, warm, professional email that:
1. References the specific invoice and amount
2. Offers two clear next steps: pay now (placeholder link), or reply to
   discuss a payment plan
3. Escalates tone slightly based on daysOverdue and previousAttempts, but
   NEVER becomes threatening or robotic
4. Is signed simply as "The ${companyName} Billing Team"

Return ONLY the email body text, no subject line, no preamble.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const body = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return body;
}

export async function sendFollowUpEmail({ to, companyName, invoiceId, body }) {
  return resend.emails.send({
    from: process.env.FROM_EMAIL,
    to,
    subject: `Following up on invoice ${invoiceId} — ${companyName}`,
    text: body,
  });
}
