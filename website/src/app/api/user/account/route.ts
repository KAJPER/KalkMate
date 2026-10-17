import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions, deleteUserAccount } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// DELETE /api/user/account — samodzielne usuniecie konta (RODO art. 17).
// Body: { password }               — konta z haslem
//       { confirm: "USUŃ KONTO" }  — konta bez hasla (logowanie Google)
//
// Zakres jak przy usuwaniu z panelu admina (lib/auth.ts deleteUserAccount):
// konto, notatki, sprawdziany, rozmowy, historia z kalkulatora, zgody,
// tokeny z linkow. Zamowienia ZOSTAJA (obowiazek ksiegowy), odpiete od konta.
// Wszystkie sesje przestaja dzialac od razu (callback jwt nie znajduje konta).
// (nie eksportowac — route.ts w App Router moze eksportowac tylko handlery)
const DELETE_CONFIRM_PHRASE = "USUŃ KONTO";

// "usun konto" / "USUŃ  KONTO" tez przechodzi (bez polskich znakow, wielkosc liter).
const normalizePhrase = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, password: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: "Nie zalogowany" }, { status: 401 });

  const rl = rateLimit(`delete-account:${user.id}`, 5, 15 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Za dużo prób. Spróbuj za ${Math.ceil(rl.resetMs / 60000)} min.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (user.password) {
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password || !(await bcrypt.compare(password.slice(0, 200), user.password))) {
      return NextResponse.json({ ok: false, error: "Hasło jest nieprawidłowe" }, { status: 403 });
    }
  } else {
    const confirm = typeof body?.confirm === "string" ? body.confirm : "";
    if (normalizePhrase(confirm) !== normalizePhrase(DELETE_CONFIRM_PHRASE)) {
      return NextResponse.json(
        { ok: false, error: `Aby usunąć konto, wpisz: ${DELETE_CONFIRM_PHRASE}`, confirmPhrase: DELETE_CONFIRM_PHRASE },
        { status: 400 }
      );
    }
  }

  try {
    const result = await deleteUserAccount(user.id);
    if (!result.ok) return NextResponse.json({ ok: false, error: "Nie znaleziono konta" }, { status: 404 });
  } catch (e) {
    console.error("[user/account DELETE]", e);
    return NextResponse.json({ ok: false, error: "Nie udało się usunąć konta. Napisz do nas: kontakt@kalkmate.pl" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, deleted: true });
  // Cookie sesji NextAuth — i tak niewazne (konta nie ma), ale sprzatamy.
  for (const name of ["__Secure-next-auth.session-token", "next-auth.session-token"]) {
    if (req.cookies.get(name)) {
      res.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: name.startsWith("__Secure-") });
    }
  }
  return res;
}
