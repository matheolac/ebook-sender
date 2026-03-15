const express = require("express");
const Stripe = require("stripe");
const axios = require("axios");
const app = express();

const stripe = Stripe(process.env.STRIPE_WEBHOOK_SECRET);

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

          const pdfBase64 = Buffer.from(response.data).toString("base64");

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "contact@lycee-invest.com",
              to: customerEmail,
              reply_to: "lyceeinvest@gmail.com",
              subject: "Ton ebook est là 📘 Investis tes 500 premiers euros en 7 jours",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; color: #1a1a1a;">
                  <h2 style="font-size: 22px; margin-bottom: 8px;">C'est parti 🚀</h2>
                  <p>En 7 jours tu vas passer de zéro à investisseur. Pas de théorie floue, pas de promesses de richesse rapide. Juste les bases solides que Mathéo aurait aimé avoir dès le départ, expliquées simplement et honnêtement.</p>
                  <p>Ton ebook est en pièce jointe. À l'intérieur tu vas apprendre à choisir la bonne enveloppe fiscale, ouvrir ton compte, comprendre et choisir ton premier ETF, passer ton premier ordre et mettre en place une routine qui travaille pour toi sur le long terme.</p>
                  <p style="background: #f4f4f4; padding: 16px; border-left: 4px solid #000; border-radius: 4px;">
                    <em>« Le meilleur moment pour investir était il y a 10 ans. Le deuxième meilleur moment c'est aujourd'hui. »</em>
                  </p>
                  <p>Bonne lecture, et si t'as des questions réponds directement à ce mail.</p>
                  <p>— Mathéo, fondateur de <a href="https://lycee-invest.com" style="color: #000;">Lycée Invest</a></p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="font-size: 12px; color: #999;"><a href="https://lycee-invest.com" style="color: #999;">lycee-invest.com</a></p>
                </div>
              `,
              attachments: [
                {
                  filename: "Investis-tes-500-premiers-euros-en-7-jours.pdf",
                  content: pdfBase64,
                },
              ],
            }),
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
