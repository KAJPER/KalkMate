import { config } from "dotenv";
import { join } from "path";

// Załaduj zmienne środowiskowe przed importem innych modułów
config({ path: join(process.cwd(), ".env.local") });

import { resend, FROM_EMAIL } from "./src/lib/resend";
import {
  purchaseConfirmationEmail,
  statusInProgressEmail,
  statusShippedEmail,
  statusFulfilledEmail,
} from "./src/lib/email-templates";

const TEST_EMAIL = "gordulek@gmail.com";

console.log("RESEND_API_KEY loaded:", process.env.RESEND_API_KEY ? "✓" : "✗");

// Funkcja pomocnicza do opóźnienia
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendTestEmails() {
  console.log("Wysyłanie testowych maili...\n");

  // 1. Purchase Confirmation
  try {
    const confirmation = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: "TEST: Potwierdzenie zamówienia - KalkMate",
      html: purchaseConfirmationEmail({
        customerName: "Jan Kowalski",
        customerEmail: TEST_EMAIL,
        product: "KalkMate Pro",
        amount: 29900, // 299.00 zł
        pickupPoint: "KRA01M",
        pickupPointAddress: "ul. Floriańska 1, 31-019 Kraków",
        orderId: "TEST-12345",
      }),
    });
    console.log("✓ Purchase Confirmation wysłany:", JSON.stringify(confirmation, null, 2));
  } catch (error) {
    console.error("✗ Błąd wysyłki Purchase Confirmation:", JSON.stringify(error, null, 2));
  }

  await delay(600); // Opóźnienie 600ms między mailami

  // 2. Status In Progress
  try {
    const inProgress = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: "TEST: Zamówienie w realizacji - KalkMate",
      html: statusInProgressEmail({
        customerName: "Jan Kowalski",
        product: "KalkMate Pro",
        pickupPoint: "KRA01M",
        pickupPointAddress: "ul. Floriańska 1, 31-019 Kraków",
      }),
    });
    console.log("✓ Status In Progress wysłany:", JSON.stringify(inProgress, null, 2));
  } catch (error) {
    console.error("✗ Błąd wysyłki Status In Progress:", JSON.stringify(error, null, 2));
  }

  await delay(600); // Opóźnienie 600ms między mailami

  // 3. Status Shipped
  try {
    const shipped = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: "TEST: Paczka wysłana - KalkMate",
      html: statusShippedEmail({
        customerName: "Jan Kowalski",
        product: "KalkMate Pro",
        trackingNumber: "123456789012345",
        pickupPoint: "KRA01M",
        pickupPointAddress: "ul. Floriańska 1, 31-019 Kraków",
      }),
    });
    console.log("✓ Status Shipped wysłany:", JSON.stringify(shipped, null, 2));
  } catch (error) {
    console.error("✗ Błąd wysyłki Status Shipped:", JSON.stringify(error, null, 2));
  }

  await delay(600); // Opóźnienie 600ms między mailami

  // 4. Status Fulfilled
  try {
    const fulfilled = await resend.emails.send({
      from: FROM_EMAIL,
      to: TEST_EMAIL,
      subject: "TEST: Zamówienie zrealizowane - KalkMate",
      html: statusFulfilledEmail({
        customerName: "Jan Kowalski",
        product: "KalkMate Pro",
        pickupPoint: "KRA01M",
        pickupPointAddress: "ul. Floriańska 1, 31-019 Kraków",
      }),
    });
    console.log("✓ Status Fulfilled wysłany:", JSON.stringify(fulfilled, null, 2));
  } catch (error) {
    console.error("✗ Błąd wysyłki Status Fulfilled:", JSON.stringify(error, null, 2));
  }

  console.log("\nWszystkie testowe maile zostały wysłane!");
}

sendTestEmails();
