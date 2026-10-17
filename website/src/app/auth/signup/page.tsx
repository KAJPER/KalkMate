import { redirect } from "next/navigation";
import { safeCallback } from "@/app/auth/callback";

// /auth/signup — alias do /auth/signin?mode=register
// Mail z notyfikacja po awarii bazy linkuje na /auth/signup, a faktyczny
// formularz siedzi w signin z toggle login/rejestracja. Redirect zalatwia
// sprawe bez duplikacji kodu.
type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignUpRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams({ mode: "register" });
  // Przekazujemy dalej tylko bezpieczna, lokalna sciezke (signin waliduje
  // ponownie) — nie forwardujemy javascript:/zewnetrznych adresow.
  const cb = safeCallback(sp.callbackUrl, "");
  if (cb) params.set("callbackUrl", cb);
  redirect(`/auth/signin?${params.toString()}`);
}
