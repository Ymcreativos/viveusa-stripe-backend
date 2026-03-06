import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Webhook de Stripe: debe ir ANTES de express.json()
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }

    console.log("Webhook recibido:", event.type);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;

      const email =
        paymentIntent.receipt_email ||
        paymentIntent.metadata?.email ||
        null;

      const description =
        paymentIntent.description ||
        paymentIntent.metadata?.description ||
        paymentIntent.metadata?.descripcion ||
        "Publicidad ViveUSA Magazine";

      const amount = paymentIntent.amount; // ya viene en centavos
      const currency = paymentIntent.currency || "usd";

      if (email) {
        const customer = await stripe.customers.create({
          email,
          metadata: {
            fuente: "viveusa-web",
          },
        });

        await stripe.invoiceItems.create({
          customer: customer.id,
          currency,
          amount,
          description,
        });

        const invoice = await stripe.invoices.create({
          customer: customer.id,
          collection_method: "send_invoice",
          days_until_due: 0,
          auto_advance: false,
          metadata: {
            payment_intent_id: paymentIntent.id,
            fuente: "viveusa-web",
          },
        });

        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

        await stripe.invoices.pay(finalizedInvoice.id, {
          paid_out_of_band: true,
        });

        await stripe.invoices.sendInvoice(finalizedInvoice.id);

        console.log("Invoice creada y enviada a:", email);
      } else {
        console.log("Pago exitoso, pero sin email. No se pudo enviar invoice.");
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "error"}`);
  }
});

// Middleware para el resto de rutas
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get("/salud", (req, res) => {
  res.status(200).send("OK");
});

// Crear PaymentIntent
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, email, description, descripcion } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Falta amount" });
    }

    const finalDescription =
      description ||
      descripcion ||
      "Publicidad ViveUSA Magazine";

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount)), // IMPORTANTE: ya llega en centavos
      currency: "usd",
      description: finalDescription,
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
      metadata: {
        email: email || "",
        description: finalDescription,
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("ERROR creando pago:", error);
    return res.status(500).json({
      error: error?.message || "No se pudo crear el pago",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
