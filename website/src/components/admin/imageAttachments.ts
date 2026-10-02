// Zdjecia/pliki dodawane w panelu admina (Poczta, Newsletter) — odczyt do
// base64 i zmniejszanie zdjec w przegladarce przed wyslaniem na serwer.

// Zalacznik dodany w formularzu (jeszcze niewyslany). data = base64 bez prefiksu.
export interface PendingAttachment {
  id: string;
  filename: string;
  contentType: string;
  data: string;
  size: number;
  previewUrl: string | null;
}

const MAX_IMAGE_SIDE = 1920;

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// Zdjecia z telefonu maja po 4-12 MB — zmniejszamy do 1920 px (JPEG), zeby
// mail nie wazyl kilkudziesieciu MB i nie odbil sie od limitu serwera.
// GIF zostaje bez zmian (animacja), a czego przegladarka nie umie zdekodowac
// (np. HEIC w Chrome) — idzie jak jest.
export async function shrinkImage(file: File, maxSide = MAX_IMAGE_SIDE): Promise<{ blob: Blob; filename: string; contentType: string }> {
  const original = { blob: file as Blob, filename: file.name, contentType: file.type };
  if (file.type === "image/gif" || !file.type.startsWith("image/")) return original;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1024 * 1024 && file.type !== "image/heic" && file.type !== "image/heif") {
      bitmap.close();
      return original;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.fillStyle = "#fff"; // PNG z przezroczystoscia -> biale tlo zamiast czarnego w JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return original;
    const base = (file.name || "zdjecie").replace(/\.[^.]+$/, "");
    return { blob, filename: `${base}.jpg`, contentType: "image/jpeg" };
  } catch {
    return original;
  }
}

export async function fileToAttachment(file: File, maxSide?: number): Promise<PendingAttachment> {
  const { blob, filename, contentType } = await shrinkImage(file, maxSide);
  const data = await blobToBase64(blob);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    filename: filename || "zalacznik",
    contentType: contentType || "application/octet-stream",
    data,
    size: blob.size,
    previewUrl: contentType.startsWith("image/") ? URL.createObjectURL(blob) : null,
  };
}
