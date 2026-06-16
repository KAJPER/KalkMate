import { NextRequest, NextResponse } from "next/server";
import { getFurgonetkaToken } from "@/lib/furgonetka";
import { COOKIE_NAME } from "@/lib/admin-auth";

function isAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token === process.env.ADMIN_SESSION_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const token = await getFurgonetkaToken();
    const res = await fetch(`${process.env.FURGONETKA_API_URL || "https://api.furgonetka.pl"}/services`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Furgonetka API error (${res.status}): ${body}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ services: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
