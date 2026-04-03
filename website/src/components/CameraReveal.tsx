"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function CameraReveal() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.min(Math.max(percentage, 0), 100));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleMove(e.clientX, rect);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handleMove(e.touches[0].clientX, rect);
  };

  const handleStart = () => setIsDragging(true);
  const handleEnd = () => setIsDragging(false);

  return (
    <section id="ukryta-kamera" className="py-24 bg-white dark:bg-[#2B2D31]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Ukryta kamera. Niewidoczna dla oka.
          </h2>
          <p className="mt-4 text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
            Przesuń suwak, aby zobaczyć gdzie znajduje się kamera. Jest zasłonięta naklejką znamionową
            kalkulatora. Tak dyskretna, że nikt jej nie zauważy.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="max-w-4xl mx-auto"
        >
          {/* Image Comparison Slider */}
          <div
            className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl select-none cursor-col-resize"
            onMouseMove={handleMouseMove}
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
          >
            {/* Image with camera revealed */}
            <div className="absolute inset-0">
              <Image
                src="/kalkulator-kalkmate-kamera-odkryta.png"
                alt="Kalkulator KalkMate z odkrytą kamerą - widoczna pozycja kamery"
                fill
                className="object-cover"
                quality={90}
                priority
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            </div>

            {/* Image without camera (overlay) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <Image
                src="/kalkulator-kalkmate-ukryta-kamera-zamknieta.png"
                alt="Kalkulator KalkMate z ukrytą kamerą - niewidoczna dla oka"
                fill
                className="object-cover"
                quality={90}
                priority
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            </div>

            {/* Slider handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-col-resize"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#2563EB]"
                >
                  <polyline points="15 18 9 12 15 6" />
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>

            {/* Labels */}
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm">
              Ukryta
            </div>
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm">
              Odkryta
            </div>

            {/* Mobile hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs backdrop-blur-sm md:hidden">
              Przesuń palcem ←→
            </div>
          </div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 grid md:grid-cols-3 gap-6"
          >
            <div className="text-center p-6 bg-[#F5F5F5] dark:bg-[#313338] rounded-xl">
              <div className="w-12 h-12 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#2563EB] dark:text-[#3B82F6]"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3 className="font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                Miniaturowy rozmiar
              </h3>
              <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                Kamera ma zaledwie 6mm średnicy. Zasłonięta naklejką znamionową kalkulatora.
              </p>
            </div>

            <div className="text-center p-6 bg-[#F5F5F5] dark:bg-[#313338] rounded-xl">
              <div className="w-12 h-12 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#2563EB] dark:text-[#3B82F6]"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h3 className="font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                30 naklejek w zestawie
              </h3>
              <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                Jedna naklejka starcza na ~5 tygodni. 30 sztuk wystarczy na minimum 3 lata użytkowania.
              </p>
            </div>

            <div className="text-center p-6 bg-[#F5F5F5] dark:bg-[#313338] rounded-xl">
              <div className="w-12 h-12 bg-[#2563EB]/10 dark:bg-[#3B82F6]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#2563EB] dark:text-[#3B82F6]"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 className="font-bold text-[#1a1a1a] dark:text-[#E0E0E0] mb-2">
                Jakość HD
              </h3>
              <p className="text-sm text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60">
                Pomimo małego rozmiaru, kamera robi ostre zdjęcia w HD.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
