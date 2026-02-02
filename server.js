import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();

// Stripe usará la clave desde Render (NO se pega aquí)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// Crear intención de pago
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, description } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
