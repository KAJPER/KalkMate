"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  compressImage,
  ImageCompressError,
  MAX_CHAT_IMAGES,
} from "../_lib/compressImage";

// Pole wpisywania wiadomości AI Chat z WŁASNYM stanem tekstu i załączników.
//
// Dlaczego osobny komponent: wcześniej `userMessage` żył w PanelPage, więc każdy
// wciśnięty klawisz przerenderowywał cały panel razem z markdown+KaTeX
// wszystkich wiadomości — na słabych telefonach pisanie się zacinało. Teraz
// rodzic dostaje tekst i pliki dopiero przy wysyłce (onSend).
//
// Szkic (tekst + pliki) jest lustrzany do `draftRef` rodzica (bez re-renderu),
// żeby przełączenie zakładki nie kasowało wpisanego zadania, a rodzic mógł
// przywrócić treść po błędzie wysyłki (zapisuje draftRef i zmienia `key`).

export type ChatDraft = { text: string; files: File[] };

export type ChatInputLabels = {
  placeholder: string;
  attach: string;
  send: string;
  remove: string;
  processing: string;
  tooMany: (max: number) => string;
  onlyImages: string;
  decodeFailed: (name: string) => string;
  tooLarge: (name: string) => string;
};

interface ChatInputProps {
  draftRef: { current: ChatDraft };
  disabled: boolean;
  labels: ChatInputLabels;
  onSend: (text: string, files: File[]) => void;
}

// Stabilne klucze React dla obiektów File (bez mutowania samych plików).
const fileKeys = new WeakMap<File, number>();
let fileKeySeq = 0;
function keyOf(f: File): number {
  let k = fileKeys.get(f);
  if (!k) {
    k = ++fileKeySeq;
    fileKeys.set(f, k);
  }
  return k;
}

// Miniatura: object URL tworzony raz na plik (nie przy każdym renderze, jak
// wcześniej) i zwalniany przy usunięciu pliku / unmount. src ustawiamy wprost
// na elemencie — bez dodatkowego renderu i bezpiecznie w StrictMode.
function Thumb({ file }: { file: File }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    if (imgRef.current) imgRef.current.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      alt={file.name}
      decoding="async"
      className="w-10 h-10 object-cover bg-[#1A1A1A] border border-[#D8FF3D]/40"
    />
  );
}

function ChatInput({ draftRef, disabled, labels, onSend }: ChatInputProps) {
  const [text, setText] = useState(() => draftRef.current.text);
  const [files, setFiles] = useState<File[]>(() => draftRef.current.files);
  const [processing, setProcessing] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const filesRef = useRef(files);
  const processingRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Lustro szkicu do rodzica (ref — bez re-renderu rodzica).
  useEffect(() => {
    filesRef.current = files;
    draftRef.current = { text, files };
  }, [text, files, draftRef]);

  const addFiles = async (incoming: File[]) => {
    if (incoming.length === 0) return;
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    const msgs: string[] = [];
    if (images.length < incoming.length) msgs.push(labels.onlyImages);

    const free = MAX_CHAT_IMAGES - filesRef.current.length - processingRef.current;
    if (images.length > free) msgs.push(labels.tooMany(MAX_CHAT_IMAGES));
    const toProcess = images.slice(0, Math.max(0, free));
    setNotice(msgs.length ? msgs.join(" ") : null);
    if (toProcess.length === 0) return;

    processingRef.current += toProcess.length;
    setProcessing(processingRef.current);
    const done: File[] = [];
    // Po kolei, nie równolegle — dekodowanie kilku 12 Mpx zdjęć naraz potrafi
    // zabić kartę przeglądarki na słabym telefonie (brak pamięci).
    for (const f of toProcess) {
      try {
        done.push(await compressImage(f));
      } catch (e) {
        const code = e instanceof ImageCompressError ? e.code : "decode";
        msgs.push(code === "too_large" ? labels.tooLarge(f.name) : labels.decodeFailed(f.name));
      } finally {
        processingRef.current = Math.max(0, processingRef.current - 1);
        if (mountedRef.current) setProcessing(processingRef.current);
      }
    }

    if (mountedRef.current) {
      filesRef.current = [...filesRef.current, ...done].slice(0, MAX_CHAT_IMAGES);
      setFiles(filesRef.current);
      setNotice(msgs.length ? msgs.join(" ") : null);
    } else {
      // Komponent zniknął (zmiana zakładki) — dopisz do szkicu rodzica.
      draftRef.current = {
        ...draftRef.current,
        files: [...draftRef.current.files, ...done].slice(0, MAX_CHAT_IMAGES),
      };
    }
  };

  const removeFile = (f: File) => {
    setFiles((prev) => prev.filter((x) => x !== f));
    setNotice(null);
  };

  const canSend = !disabled && processing === 0 && (text.trim().length > 0 || files.length > 0);

  const send = () => {
    if (!canSend) return;
    const t = text;
    const fs = files;
    setText("");
    setFiles([]);
    setNotice(null);
    draftRef.current = { text: "", files: [] };
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSend(t, fs);
  };

  return (
    <div className="p-3 md:p-6 border-t border-[rgba(242,237,227,0.10)] bg-[#0E0E0E]">
      {/* Podgląd wybranych zdjęć */}
      {(files.length > 0 || processing > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {files.map((file) => (
            <div
              key={keyOf(file)}
              className="relative flex items-center gap-2 bg-[#D8FF3D]/10 border border-[#D8FF3D]/30 px-2 py-1.5"
            >
              <Thumb file={file} />
              <div className="flex flex-col leading-tight">
                <span className="text-xs text-[#F2EDE3] truncate max-w-[140px] sm:max-w-[180px]">{file.name}</span>
                <span className="km-mono-eyebrow text-[#F2EDE3]/45">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(file)}
                disabled={disabled}
                className="text-[#F2EDE3]/50 hover:text-[#FF4D2E] transition-colors p-1 disabled:opacity-40"
                title={labels.remove}
                aria-label={labels.remove}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {processing > 0 && (
            <div className="flex items-center gap-2 border border-[rgba(242,237,227,0.15)] px-3 py-1.5">
              <span className="w-3 h-3 border-2 border-[#D8FF3D] border-t-transparent rounded-full animate-spin" />
              <span className="km-mono-eyebrow text-[#F2EDE3]/60">{labels.processing}</span>
            </div>
          )}
        </div>
      )}
      {notice && <p className="mb-2 text-xs text-[#FFB800]">{notice}</p>}

      <div className="flex gap-2 md:gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              // Na telefonie (dotyk) Enter = nowa linia — nie ma tam Shift+Enter.
              if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return;
              e.preventDefault();
              send();
            }}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              const pasted: File[] = [];
              for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (it.kind === "file" && it.type.startsWith("image/")) {
                  const f = it.getAsFile();
                  if (f) {
                    const ext = (it.type.split("/")[1] || "png").split("+")[0];
                    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
                    pasted.push(
                      new File([f], f.name && f.name !== "image.png" ? f.name : `wklejone-${stamp}.${ext}`, {
                        type: it.type,
                      })
                    );
                  }
                }
              }
              if (pasted.length > 0) {
                e.preventDefault();
                void addFiles(pasted);
              }
            }}
            placeholder={labels.placeholder}
            className="flex-1 bg-[#0B0B0B] border border-[rgba(242,237,227,0.15)] px-3 md:px-4 py-2.5 md:py-3 text-base md:text-sm text-[#F2EDE3] placeholder:text-[#F2EDE3]/35 focus:outline-none focus:border-[#D8FF3D] resize-none transition-colors min-h-[3.5rem] md:min-h-[5.5rem]"
            rows={2}
            disabled={disabled}
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                e.target.value = "";
                void addFiles(picked);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || files.length + processing >= MAX_CHAT_IMAGES}
              className="inline-flex items-center gap-2 px-2 md:px-3 py-1.5 km-mono-eyebrow text-[#D8FF3D]/80 hover:text-[#D8FF3D] hover:bg-[#D8FF3D]/10 transition-colors disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              {labels.attach}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="self-end bg-[#D8FF3D] text-[#0B0B0B] px-4 md:px-7 py-3 km-mono-eyebrow hover:bg-[#F2EDE3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {labels.send} <span>→</span>
        </button>
      </div>
    </div>
  );
}

export default memo(ChatInput);
