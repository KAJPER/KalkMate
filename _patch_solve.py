#!/usr/bin/env python3
import sys
path = "src/app/api/device/solve/route.ts"
with open(path, "r") as f:
    s = f.read()

insertion = """    // Zapisz konwersacje do bazy (historia w panelu i na urzadzeniu)
    if (deviceId) {
      try {
        let claimedUserId = null;
        if (license && license.claimedByUserId) claimedUserId = license.claimedByUserId;
        await prisma.deviceSolve.create({
          data: {
            deviceId: deviceId,
            licenseCode: licenseKey.trim().toLowerCase(),
            userId: claimedUserId,
            mode: mode,
            question: mode === "text" ? text.slice(0, 1000) : "[image]",
            answer: solution.slice(0, 4000),
          },
        });
      } catch (e) {
        console.error("[device/solve] save conversation error:", e);
      }
    }

    """
target = "    return NextResponse.json({ ok: true, solution });"
if insertion not in s and target in s:
    s = s.replace(target, insertion + target, 1)
    with open(path, "w") as f:
        f.write(s)
    print("OK")
else:
    print("SKIP" if insertion in s else "TARGET NOT FOUND")
