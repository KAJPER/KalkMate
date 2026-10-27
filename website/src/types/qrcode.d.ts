// Minimalne typy dla "qrcode" (brak @types/qrcode) — tylko to, czego uzywamy.
declare module "qrcode" {
  const QRCode: { toDataURL: typeof toDataURL };
  export default QRCode;
  export function toDataURL(text: string, options?: { margin?: number; width?: number; errorCorrectionLevel?: "L" | "M" | "Q" | "H" }): Promise<string>;
}
