const express = require("express");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");
const axios = require("axios");
const app = express();

const stripe = Stripe(process.env.STRIPE_WEBHOOK_SECRET);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature invalide:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;

      if (customerEmail) {
        try {
          const fileId = process.env.GOOGLE_DRIVE_FILE_ID;
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          const response = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
          });

          await transporter.sendMail({
            from: `"Ton Nom" <${process.env.GMAIL_USER}>`,
            to: customerEmail,
            subject: "Votre ebook - Merci pour votre achat !",
            html: `
              <h2>Merci pour votre achat !</h2>
              <p>Bonjour,</p>
              <p>Vous trouverez votre ebook en pièce jointe.</p>
              <p>Bonne lecture !</p>
            `,
            attachments: [
              {
                filename: "ebook.pdf",
                content: Buffer.from(response.data),
                contentType: "application/pdf",
              },
            ],
          });

          console.log(`Email envoyé à ${customerEmail}`);
        } catch (err) {
          console.error("Erreur envoi email:", err);
        }
      }
    }

    res.json({ received: true });
  }
);

app.get("/", (req, res) => res.send("Serveur en ligne ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));