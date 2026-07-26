import "dotenv/config";
import express from "express";
import Stripe from "stripe";
import { generateFollowUpEmail, sendFollowUpEmail } from "./emailer.js";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory store for now — swap for a real DB (Postgres/Supabase) once this works.
// Tracks how many follow-up attempts have been sent per invoice.
const invoiceState = new Map();

// Stripe requires the raw body for signature verification, so this route
// gets express.raw() instead of the global JSON parser.
app.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // These are the two events that matter for catching overdue invoices.
    if (
      event.type === "invoice.payment_failed" ||
      event.type === "invoice.overdue"
    ) {
      const invoice = event.data.object;
      await handleOverdueInvoice(invoice);
    }

    res.json({ received: true });
  }
);

// Everything else can use normal JSON parsing.
app.use(express.json());

async function handleOverdueInvoice(invoice) {
  const invoiceId = invoice.id;
  const amountDue = (invoice.amount_due / 100).toFixed(2);
  const customerEmail = invoice.customer_email;
  const clientContactName = invoice.customer_name || "there";
  const companyName = process.env.COMPANY_NAME || "Our Company";

  const state = invoiceState.get(invoiceId) || { attempts: 0 };
  state.attempts += 1;
  invoiceState.set(invoiceId, state);

  console.log(
    `Overdue invoice detected: ${invoiceId} — $${amountDue} — attempt #${state.attempts}`
  );

  try {
    const body = await generateFollowUpEmail({
      clientContactName,
      companyName,
      invoiceId,
      amountDue,
      daysOverdue: state.attempts * 3, // placeholder cadence until real date logic is added
      previousAttempts: state.attempts - 1,
    });

    await sendFollowUpEmail({
      to: customerEmail,
      companyName,
      invoiceId,
      body,
    });

    console.log(`Follow-up email sent for ${invoiceId} to ${customerEmail}`);
  } catch (err) {
    console.error(`Failed to send follow-up for ${invoiceId}:`, err);
  }
}

app.get("/", (req, res) => {
  res.send("Reclamo core is running.");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Reclamo core listening on port ${port}`);
});
