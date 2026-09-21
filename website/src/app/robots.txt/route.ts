import { headers } from "next/headers";
import { siteUrlFromHost } from "@/lib/i18n";

// Route handler zamiast konwencji app/robots.ts — ta ostatnia serializuje
// tylko { userAgent, allow, disallow, crawlDelay, sitemap, host } i nie ma
// jak dopisac linii spoza tego schematu (np. Content-Signal), wiec potrzebna
// jest pelna kontrola nad tekstem odpowiedzi.
export async function GET() {
  const siteUrl = siteUrlFromHost((await headers()).get("host"));
  const body = [
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes, ai-train=no",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /api/",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
  });
}
