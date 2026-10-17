// Kompresja zdjęć po stronie przeglądarki przed wysłaniem do AI Chat.
//
// Zdjęcia z telefonu mają 2-5 MB (12+ Mpx). Serwer przyjmuje max ~2 MB base64
// na obraz (≈1.5 MB binarnie), a model i tak nie potrzebuje więcej niż ~1600 px
// na dłuższym boku, żeby przeczytać treść zadania. Zmniejszamy więc obraz na
// canvasie i kodujemy jako JPEG.

export const MAX_CHAT_IMAGES = 4;
/** Limit binarny po kompresji — 1.5 MB ≈ 2 MB w base64 (limit serwera). */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

const MAX_SIDE = 1600;
const FALLBACK_SIDE = 1200;
const QUALITY = 0.8;
const QUALITY_LOW = 0.6;

export class ImageCompressError extends Error {
  code: "decode" | "too_large" | "not_image";
  constructor(code: "decode" | "too_large" | "not_image", message?: string) {
    super(message || code);
    this.code = code;
  }
}

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decode(file: File): Promise<Decoded> {
  // createImageBitmap jest szybszy i (z imageOrientation) respektuje EXIF.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fallback niżej (np. starszy Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = "async";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageCompressError("decode"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e instanceof ImageCompressError ? e : new ImageCompressError("decode");
  }
}

function encode(d: Decoded, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(d.width, d.height));
  const w = Math.max(1, Math.round(d.width * scale));
  const h = Math.max(1, Math.round(d.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new ImageCompressError("decode"));
  // JPEG nie ma przezroczystości — białe tło zamiast czarnego dla PNG/zrzutów ekranu.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(d.source, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Zwolnij pamięć canvasa od razu (ważne na słabych telefonach).
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new ImageCompressError("decode"));
      },
      "image/jpeg",
      quality
    );
  });
}

function renameToJpg(name: string): string {
  const base = (name || "zdjecie").replace(/\.[^.]+$/, "");
  return `${base || "zdjecie"}.jpg`;
}

/**
 * Zwraca skompresowany plik JPEG (dłuższy bok ≤ 1600 px, jakość 0.8;
 * jeśli > 1.5 MB → jakość 0.6; jeśli nadal za duży → 1200 px).
 * Rzuca ImageCompressError, gdy obrazu nie da się zdekodować ani zmieścić w limicie.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new ImageCompressError("not_image");

  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    // Przeglądarka nie umie zdekodować (np. HEIC w Chrome) — jeśli plik i tak
    // mieści się w limicie i jest w formacie, który rozumie model, wyślij oryginał.
    if (file.size <= MAX_IMAGE_BYTES && /^image\/(jpeg|png|webp|gif)$/.test(file.type)) return file;
    throw new ImageCompressError("decode");
  }

  try {
    // Mały JPEG/PNG/WebP w rozsądnej rozdzielczości — nie przekodowuj (bez strat
    // jakości; zrzuty ekranu z tekstem zostają ostre).
    if (
      file.size <= 400 * 1024 &&
      Math.max(decoded.width, decoded.height) <= MAX_SIDE &&
      /^image\/(jpeg|png|webp)$/.test(file.type)
    ) {
      return file;
    }

    let blob = await encode(decoded, MAX_SIDE, QUALITY);
    if (blob.size > MAX_IMAGE_BYTES) blob = await encode(decoded, MAX_SIDE, QUALITY_LOW);
    if (blob.size > MAX_IMAGE_BYTES) blob = await encode(decoded, FALLBACK_SIDE, QUALITY_LOW);
    if (blob.size > MAX_IMAGE_BYTES) throw new ImageCompressError("too_large");

    return new File([blob], renameToJpg(file.name), { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    decoded.close();
  }
}

/** File → data URL (base64), w formacie oczekiwanym przez /api/chat. */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
