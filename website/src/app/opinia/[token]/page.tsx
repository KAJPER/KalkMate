// Strona opinii po dostawie — link z maila: /opinia/<token>.
// Token w URL jest sekretem: noindex, no-referrer, maska Clarity.

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getReviewRequestForPage } from "@/lib/reviews";
import { detectLocale } from "@/lib/email-templates";
import { localeHome } from "@/lib/i18n";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oceń KalkMate",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let req: Awaited<ReturnType<typeof getReviewRequestForPage>> = null;
  try {
    req = await getReviewRequestForPage(token);
  } catch (e) {
    console.error("[opinia] getReviewRequestForPage", e);
    req = null;
  }

  // nieznany token -> jezyk z przegladarki
  const lang = req?.lang ?? detectLocale((await headers()).get("accept-language"));

  return (
    // data-clarity-mask: URL zawiera sekretny token, nie nagrywamy tresci
    <div
      className="relative min-h-screen overflow-hidden bg-[#0B0B0B] text-[#F2EDE3]"
      data-clarity-mask="true"
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-[#D8FF3D] opacity-[0.05] blur-[140px]" />

      <div className="relative mx-auto w-full max-w-[560px] px-4 sm:px-6 py-10 sm:py-16">
        <Link
          href={localeHome(lang)}
          className="km-display text-[26px] text-[#F2EDE3] hover:text-[#D8FF3D] transition-colors"
        >
          KalkMate
        </Link>

        <main className="mt-8 border border-[rgba(242,237,227,0.12)] bg-[#111] p-6 sm:p-9">
          {req ? (
            <ReviewForm
              token={token}
              lang={req.lang}
              name={req.name}
              product={req.product}
              initialStatus={req.status}
            />
          ) : (
            <ReviewForm token="" lang={lang} name="" product="" initialStatus="invalid" />
          )}
        </main>
      </div>
    </div>
  );
}
