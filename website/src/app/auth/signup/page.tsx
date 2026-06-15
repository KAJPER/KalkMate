import { redirect } from "next/navigation";

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
  if (sp.callbackUrl) params.set("callbackUrl", sp.callbackUrl);
  redirect(`/auth/signin?${params.toString()}`);
}
