import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/admin-auth";

const ADMIN_SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

    if (!sessionToken || sessionToken !== ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, data } = body;

    if (action === "updateSubscription") {
      // Update subscription status
      const subscription = await prisma.subscription.findUnique({
        where: { userId: id },
      });

      if (!subscription) {
        return NextResponse.json({ error: "No subscription found" }, { status: 404 });
      }

      const updated = await prisma.subscription.update({
        where: { userId: id },
        data: {
          status: data.status,
          ...(data.trialEndsAt && { trialEndsAt: new Date(data.trialEndsAt) }),
        },
      });

      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === "updateUser") {
      // Update user details
      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.email !== undefined && { email: data.email }),
        },
      });

      return NextResponse.json({ success: true, user: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

    if (!sessionToken || sessionToken !== ADMIN_SESSION_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Delete user (cascade will handle related data)
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
