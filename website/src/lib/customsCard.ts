import { PDFDocument, StandardFonts } from "pdf-lib";
import { asciiText } from "./customsInvoice";

// Wypelnianie "Karty odprawy celnej eksportowej" UPS Polska (v.4 z 09.07.2021) —
// formularz PDF z Base Courier (basecourier.com/panel/export/docs). Wymagana przy
// wysylce UPS poza UE w wersji papierowej dokumentow celnych, obok faktury.
// Szablon jest w assets/ups/ (kopia — pola musza sie zgadzac z nazwami ponizej).
//
// Mapowanie pol (nazwy grup z PDF-a, polozenie sprawdzone na renderze):
//   Group1 (I. komunikat IE599):    Wybór2 = wymagane | Wybór1 = NIE jest wymagane (<=1000 EUR/1000 kg) | Wybór1a = po odprawie/tranzyt
//   Group2 (II. rodzaj odprawy):    Wybór3 = ostateczna | Wybór4 = uszlachetnianie bierne | Wybór5 = towary powracajace
//   Group3 (rodzaj transakcji):     Wybór7 = sprzedaz (Wybór8 probki, 9 prezent, 10 zwrot, 11 likwidacja, 12 inne)
//   Group4 (III. koszt transportu): Wybór17 = wliczony w cene | Wybór18 = NIE wliczony
//   Group5 (towary strategiczne):   Wybór15 = TAK | Wybór16 = NIE
// Oswiadczenia (art. 233 KK, IATA), data i podpis zostaja do wypelnienia recznie.
// Tekst tylko ASCII (czcionka standardowa PDF nie ma polskich znakow).

export interface CustomsCardInput {
  invoiceNo: string;        // numer faktury dolaczanej do paczki
  trackingNumber?: string;  // "Nr przesylki"
  currency: string;         // waluta faktury
  description: string;      // tlumaczenie faktury / opis zawartosci (po polsku)
  senderName: string;
  senderContact: string;    // telefon + e-mail
  ie599NotRequired: boolean; // zaznacz "NIE JEST WYMAGANE IE599" (tylko gdy <=1000 EUR)
}

export async function fillCustomsCard(template: Uint8Array, input: CustomsCardInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = doc.getForm();

  // Pola w szablonie nie maja wpisu /DA (domyslnej czcionki) — ustawiamy go sami (Helvetica, rozmiar).
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const text = (name: string, value: string, size: number) => {
    const f = form.getTextField(name);
    f.acroField.setDefaultAppearance(`/Helv ${size} Tf 0 g`);
    f.setText(value.split("\n").map(asciiText).join("\n")); // zachowujemy znaki nowej linii (asciiText zamienia je na "?")
  };

  if (input.trackingNumber) text("tracking number", input.trackingNumber, 10);
  text("opis towaru", input.description.slice(0, 500), 8);
  text("numery faktur", input.invoiceNo, 10);
  text("ilość faktur", "1", 10);
  text("waluta2", input.currency.toUpperCase(), 10);
  text("imię i nazwisko wysyłającego", input.senderName, 9);
  text("dane kontaktowe", input.senderContact, 8);

  if (input.ie599NotRequired) form.getRadioGroup("Group1").select("Wybór1");
  form.getRadioGroup("Group2").select("Wybór3"); // odprawa ostateczna
  form.getRadioGroup("Group3").select("Wybór7"); // sprzedaz
  form.getRadioGroup("Group4").select("Wybór18"); // koszt transportu NIE wliczony w cene towaru
  form.getRadioGroup("Group5").select("Wybór16"); // towary o znaczeniu strategicznym: NIE

  form.updateFieldAppearances(font);
  return doc.save();
}
