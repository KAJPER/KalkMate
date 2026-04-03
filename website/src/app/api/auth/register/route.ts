import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    // Walidacja
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email i hasło są wymagane" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Hasło musi mieć minimum 6 znaków" },
        { status: 400 }
      );
    }

    // Sprawdź czy użytkownik już istnieje
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    // Jeśli użytkownik istnieje i ma już hasło, zwróć błąd
    if (existingUser && existingUser.password) {
      return NextResponse.json(
        { error: "Użytkownik z tym adresem email już istnieje. Zaloguj się." },
        { status: 400 }
      );
    }

    // Hashuj hasło
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    // Jeśli użytkownik istnieje ale nie ma hasła (stare konto), zaktualizuj hasło
    if (existingUser && !existingUser.password) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          name: name || existingUser.name,
        },
      });

      // Sprawdź czy ma już subskrypcję
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
      });

      // Jeśli nie ma subskrypcji, utwórz
      if (!existingSubscription) {
        // Sprawdź czy ma zamówienie
        const existingOrder = await prisma.order.findFirst({
          where: {
            customerEmail: email,
            status: "paid",
          },
        });

        const trialDays = existingOrder ? 30 : 1;
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

        await prisma.subscription.create({
          data: {
            userId: user.id,
            status: "trial",
            trialEndsAt,
            trialDays,
          },
        });
      }

      return NextResponse.json(
        {
          success: true,
          message: "Hasło zostało ustawione pomyślnie",
          userId: user.id,
        },
        { status: 200 }
      );
    }

    // Sprawdź czy użytkownik ma zamówienie (kupił kalkulator)
    const existingOrder = await prisma.order.findFirst({
      where: {
        customerEmail: email,
        status: "paid" // Tylko opłacone zamówienia
      },
    });

    // Utwórz nowego użytkownika
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    });

    // Jeśli użytkownik ma zamówienie, połącz je z jego kontem
    if (existingOrder) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: { userId: user.id },
      });
    }

    // Ustaw długość trialu w zależności od tego, czy kupił kalkulator
    const trialDays = existingOrder ? 30 : 1; // 30 dni dla kupujących, 1 dzień dla nowych
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: "trial",
        trialEndsAt,
        trialDays,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Konto zostało utworzone pomyślnie",
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas rejestracji" },
      { status: 500 }
    );
  }
}
