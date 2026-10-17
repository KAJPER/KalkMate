import { redirect } from "next/navigation";

// Dawna osobna strona "Mój kalkulator" — nic do niej nie linkowało, a utrzymywała
// przestarzały Device.promptMode (tryb AI jest teraz per-user w zakładce "AI")
// i duplikowała notatki/sprawdziany bez obsługi błędów. Wszystko to jest w
// /panel, więc stare zakładki/linki przekierowujemy do zakładki Kalkulator.
export default function KalkulatorRedirect() {
  redirect("/panel?tab=calculator");
}
