import { NextRequest, NextResponse } from "next/server";
import { getFurgonetkaToken } from "@/lib/furgonetka";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authErr = await requireAdminAuth(req); if (authErr) return authErr;

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
