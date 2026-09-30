import { PDFDocument, PDFName, PDFDict, StandardFonts } from "pdf-lib";
import { asciiText } from "./customsInvoice";
import { loadSignatureImage, drawSignature, todayPl } from "./signature";

// Wypelnianie "Upowaznienia do dzialania w formie przedstawicielstwa posredniego"
// (UPS Polska, wzor osoba fizyczna, v.4 z 25-12-2022) — formularz z Base Courier
// (basecourier.com/panel/export/docs). Potrzebne tylko dla przesylek > 1000 EUR/1000 kg
// (do tej wartosci Karta odprawy celnej sama wystarcza — patrz customsCard.ts).
// Szablon w assets/ups/ (kopia — nazwy pol musza sie zgadzac).
//
// PESEL: przekazywany z process.env.OWNER_PESEL (ustawiony TYLKO w
// .env.production.local na serwerze — .gitignore ma "/.env*", wiec nigdy
// nie trafia do repo/GitHub). Group1 ("WYRAZAM zgody na udzielenie dalszego
// upowaznienia") — wlasciciel potwierdzil ze zawsze WYRAZAM (stan '0',
// lewy checkbox @120,326 w PDF — kolejnosc w tresci "WYRAZAM / NIE WYRAZAM").
// Radio grupy w tym PDF maja BLAD autorski: wszystkie opcje w danej grupie
// dziela ta sama nazwe eksportu ("Wybór1"/"Wybór2"), wiec pdf-lib.select()
// nie da sie uzyc (rzuca "must be one of Wybór2 or Wybór2 or Wybór2"). Realne,
// unikalne stany widgetow to "0"/"1"/"2" (sprawdzone w PDF-ie) — ustawiamy je
// bezposrednio przez /V i /AS zamiast przez wysokopoziomowe API.
function selectRawRadioState(doc: PDFDocument, groupName: string, rawState: string) {
  const group = doc.getForm().getRadioGroup(groupName);
  group.acroField.dict.set(PDFName.of("V"), PDFName.of(rawState));
  for (const widget of group.acroField.getWidgets()) {
    const apDict = doc.context.lookup(widget.dict.get(PDFName.of("AP")), PDFDict);
    const states = doc.context.lookup(apDict.get(PDFName.of("N")), PDFDict).keys().map((k) => k.asString());
    widget.dict.set(PDFName.of("AS"), PDFName.of(states.includes(`/${rawState}`) ? rawState : "Off"));
  }
}

export interface AuthorizationInput {
  city: string;             // miejscowosc wystawienia (siedziba nadawcy)
  fullName: string;
  address: string;          // adres zamieszkania / siedziby
  email: string;
  phone: string;
  pesel?: string;
  trackingNumber?: string;  // upowaznienie jednorazowe DO KONKRETNEJ przesylki
}

export async function fillCustomsAuthorization(template: Uint8Array, input: AuthorizationInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const text = (name: string, value: string, size = 10) => {
    const f = form.getTextField(name);
    f.acroField.setDefaultAppearance(`/Helv ${size} Tf 0 g`);
    f.setText(asciiText(value));
  };

  text("miejscowość", input.city);
  text("data", todayPl());
  text("Imię i nazwisko", input.fullName, 9);
  text("Adres zamieszkania", input.address, 8);
  text("Adres email", input.email, 8);
  text("TELEFON", input.phone, 9);
  if (input.pesel) text("pesel", input.pesel, 9);
  if (input.trackingNumber) text("nr przesyłki", input.trackingNumber, 8);

  // Zakres upowaznienia: "Jednorazowy do przesylki" (stan '2') — najwezszy,
  // ograniczony do tego jednego zlecenia; bezpieczny domyslny wybor zamiast
  // "Staly" (stan '0') czy terminowego (stan '1').
  selectRawRadioState(doc, "Group2", "2");
  // Zgoda na dalsze upowaznienie: WYRAZAM (stan '0').
  selectRawRadioState(doc, "Group1", "0");

  form.updateFieldAppearances(font);

  // Dolna linia podpisu ("czytelny podpis osoby udzielajacej upowaznienia")
  // to tekst kropkowany, NIE pole formularza — wspolrzedne wziete z PDF-a
  // (x 319-511, powyzej podpisu w ukladzie PDF, y~103+).
  const page = doc.getPage(0);
  const sig = await loadSignatureImage(doc);
  if (sig) drawSignature(page, sig, 330, 104, 170, 26);

  return doc.save();
}
