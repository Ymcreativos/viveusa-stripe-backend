import express from "express";
import cors from "cors";
import Stripe from "stripe";
const app = express();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
app.use(cors());
app.use(express.json());

app.get("/salud", (req, res) => {
  res.status(200).send("OK");
});
app.post("/crear-intencion-de-pago", async (req, res) => {
  try {
    const { amount, email, descripcion } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      description: descripcion || "Publicidad ViveUSA Magazine",
      receipt_email: email,
      automatic_payment_methods: { enabled: true }
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    });

  } catch (error) {
    console.error("Error creando pago:", error);
    res.status(500).send({ error: "No se pudo crear el pago" });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
