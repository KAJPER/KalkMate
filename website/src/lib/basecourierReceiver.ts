import { needsStateCode, isValidStateCode, splitCityState } from "@/lib/basecourier";

// Wspolne dla POST .../basecourier (nadanie) i POST .../basecourier/save-receiver
// (sam zapis poprawek bez nadawania) — logika poprawek danych odbiorcy z panelu.

export function receiverFromOrder(o: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupPoint: string;
  customerAddressStreet: string | null;
  customerAddressPostcode: string | null;
  customerAddressCity: string | null;
  customerCountry: string | null;
}) {
  // US/CA: klient wpisuje stan w polu miasta ("New York, new york") — rozdzielamy.
  const cs = splitCityState(o.customerAddressCity, o.customerCountry);
  return {
    name: o.customerName,
    email: o.customerEmail,
    phone: o.customerPhone,
    lockerCode: (o.pickupPoint || "").trim().toUpperCase(),
    street: o.customerAddressStreet || undefined,
    postal: o.customerAddressPostcode || undefined,
    city: cs.city || undefined,
    state: cs.state,
  };
}

export type ReceiverBase = ReturnType<typeof receiverFromOrder>;
export type EditableKey = "name" | "email" | "phone" | "street" | "postal" | "city" | "state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Regula API Base Courier (odpowiedz walidacji 2026-09-25): "min. 9 cyfr,
// opcjonalny + na poczatku". Klient potrafi wpisac ucięty numer albo "+" w
// zlym miejscu — admin poprawia dane w panelu przed nadaniem.
const PHONE_RE = /^\+?\d{9,15}$/;

// Poprawki danych odbiorcy z panelu. patch = tylko pola, ktore faktycznie sie
// zmienily wzgledem zamowienia (uzywane do opcjonalnego zapisu w zamowieniu).
export function applyReceiverEdits(
  base: ReceiverBase,
  raw: unknown,
  international: boolean,
  country: string
): { ok: true; receiver: ReceiverBase; patch: Partial<Record<EditableKey, string>> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: true, receiver: base, patch: {} };
  const r = raw as Record<string, unknown>;
  const next: ReceiverBase = { ...base };
  const patch: Partial<Record<EditableKey, string>> = {};
  const errors: string[] = [];

  const take = (key: EditableKey, label: string, max: number, validate?: (s: string) => string | null) => {
    const v = r[key];
    if (typeof v !== "string") return;
    let s = v.trim().replace(/\s+/g, " ");
    if (key === "phone") s = s.replace(/[\s\-().]/g, "");
    if (key === "state") s = s.toUpperCase();
    if (!s) return void errors.push(`${label}: pole nie może być puste.`);
    if (s.length > max) return void errors.push(`${label}: za długie.`);
    const problem = validate?.(s);
    if (problem) return void errors.push(`${label}: ${problem}`);
    if (s !== (base[key] ?? "")) {
      next[key] = s;
      patch[key] = s;
    }
  };

  take("name", "Imię i nazwisko", 100);
  take("email", "E-mail", 120, (s) => (EMAIL_RE.test(s) ? null : "nieprawidłowy adres."));
  take("phone", "Telefon", 20, (s) => (PHONE_RE.test(s) ? null : "min. 9 cyfr, opcjonalny + na początku, bez innych znaków."));
  if (international) {
    take("street", "Ulica", 150);
    take("postal", "Kod pocztowy", 20);
    take("city", "Miasto", 80);
    if (needsStateCode(country)) {
      take("state", "Stan/prowincja", 3, (s) =>
        isValidStateCode(country, s) ? null : "podaj 2-literowy kod (USA: NY, CA, TX…; Kanada: ON, QC…)."
      );
    }
  }
  if (errors.length) return { ok: false, error: errors.join(" ") };
  return { ok: true, receiver: next, patch };
}

// Zamowienie nie ma kolumny na stan — przy zapisie poprawek dopisujemy go do miasta ("Austin, TX").
export function cityWithState(receiver: ReceiverBase) {
  return receiver.state ? `${receiver.city ?? ""}, ${receiver.state}` : receiver.city ?? "";
}

export function orderPatchFromReceiver(patch: Partial<Record<EditableKey, string>>, receiver: ReceiverBase) {
  const cityTouched = patch.city !== undefined || patch.state !== undefined;
  return {
    ...(patch.name !== undefined ? { customerName: patch.name } : {}),
    ...(patch.email !== undefined ? { customerEmail: patch.email } : {}),
    ...(patch.phone !== undefined ? { customerPhone: patch.phone } : {}),
    ...(patch.street !== undefined ? { customerAddressStreet: patch.street } : {}),
    ...(patch.postal !== undefined ? { customerAddressPostcode: patch.postal } : {}),
    ...(cityTouched ? { customerAddressCity: cityWithState(receiver) } : {}),
  };
}

// To samo w nazwach pol panelu (order.customer_*) — odpowiedz "saved" dla klienta.
export function savedForClient(patch: Partial<Record<EditableKey, string>>, receiver: ReceiverBase) {
  const { state: _state, ...rest } = patch;
  void _state;
  return patch.city !== undefined || patch.state !== undefined ? { ...rest, city: cityWithState(receiver) } : rest;
}
