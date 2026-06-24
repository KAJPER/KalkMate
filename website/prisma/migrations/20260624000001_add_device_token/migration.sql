-- Add per-device authentication token (C3/H1/H3 fix)
ALTER TABLE "Device" ADD COLUMN "deviceToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Device_deviceToken_key" ON "Device"("deviceToken");
