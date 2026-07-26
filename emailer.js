import { Resend } from "resend";

// Groq uses an OpenAI-compatible REST API, so a plain fetch call is enough —
// no extra SDK dependency needed.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
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

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const body = data.choices[0].message.content.trim();

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
