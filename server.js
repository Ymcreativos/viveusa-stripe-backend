import express from "express";
import cors from "cors";
import Stripe from "stripe";

// 1) Stripe secret key desde Render Environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();

// 2) Webhook necesita el body "raw", por eso lo definimos ANTES del json()
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];

      // 3) Webhook secret desde Render Environment
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event;
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        // (No recomendado) si no configuras STRIPE_WEBHOOK_SECRET, Stripe igual enviará,
        // pero no podrás verificar la firma.
        event = JSON.parse(req.body.toString());
      }

      // 4) Cuando el pago se confirma, creamos y enviamos INVOICE profesional
      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;

        // Email del comprador (lo intentamos obtener)
        const email =
          paymentIntent.receipt_email ||
          paymentIntent.metadata?.email ||
          null;

        // Descripción (tu producto/servicio)
        const descripcion =
          paymentIntent.description ||
          paymentIntent.metadata?.descripcion ||
          "Publicidad ViveUSA Magazine";

        // Monto
        const amount = paymentIntent.amount; // en centavos
        const currency = paymentIntent.currency || "usd";

        // Si no hay email, no podemos enviar invoice por correo
        if (email) {
          // A) Crear/obtener Customer
          const customer = await stripe.customers.create({
            email,
            metadata: {
              fuente: "viveusa-web",
            },
          });

          // B) Crear un Invoice Item (línea de factura)
          await stripe.invoiceItems.create({
            customer: customer.id,
            currency,
            amount,
            description: descripcion,
          });

          // C) Crear Invoice (esto genera numeración automática de Stripe)
          const invoice = await stripe.invoices.create({
            customer: customer.id,
            collection_method: "send_invoice",
            days_until_due: 0, // pago ya hecho
            auto_advance: true, // Stripe finaliza la invoice
            metadata: {
              payment_intent_id: paymentIntent.id,
              fuente: "viveusa-web",
            },
          });

          // D) Finalizar Invoice (generar PDF y número)
          const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

          // E) Marcar como "paid" porque el pago ya sucedió (fuera de invoice)
          // Esto deja la invoice como pagada y Stripe puede enviarla.
          await stripe.invoices.pay(finalized.id, {
            paid_out_of_band: true,
          });

          // F) Enviar invoice por email al cliente (Stripe la manda)
          await stripe.invoices.sendInvoice(finalized.id);
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("WEBHOOK ERROR:", err?.message || err);
      return res.status(400).send(`Webhook Error: ${err?.message || "error"}`);
    }
  }
);

// 5) CORS y JSON para el resto de rutas
app.use(cors());
app.use(express.json());

// 6) Salud (para probar que Render está vivo)
app.get("/salud", (req, res) => {
  res.status(200).send("OK");
});

// 7) Endpoint para crear PaymentIntent (lo llama tu formulario)
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, email, descripcion } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Falta amount" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: "usd",
      description: descripcion || "Publicidad ViveUSA Magazine",
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
      metadata: {
        email: email || "",
        descripcion: descripcion || "Publicidad ViveUSA Magazine",
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("ERROR creando pago:", error);
    res.status(500).json({ error: "No se pudo crear el pago" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
    
