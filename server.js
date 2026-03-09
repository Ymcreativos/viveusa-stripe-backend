import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    const finalAmount = Math.round(Number(amount)); // amount ya viene en centavos desde tu HTML

    if (!finalAmount || finalAmount < 50) {
      return res.status(400).json({ error: "Monto inválido" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
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
    console.error("ERROR creando pago:", error?.message || error);
    return res.status(500).json({
      error: error?.message || "No se pudo crear el pago",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
