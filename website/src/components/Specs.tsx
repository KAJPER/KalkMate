"use client";

import { motion } from "framer-motion";

const specs = [
  { param: "Procesor", value: "ESP32-WROVER-E (240MHz, WiFi + BT)" },
  { param: "Pamięć", value: "8MB PSRAM" },
  { param: "Wyświetlacz", value: 'OLED 3.12" 256x64 SSD1322' },
  { param: "Kamera", value: "OV2640 2MP" },
  { param: "Klawiatura", value: "Membranowa 5x5 (25 klawiszy)" },
  { param: "Bateria", value: "LiPo 2000mAh, USB-C ładowanie" },
  { param: "Czas pracy", value: "~6 godzin (tryb mieszany)" },
  { param: "Łączność", value: "WiFi 2.4GHz (802.11 b/g/n)" },
  { param: "Wymiary", value: "136 x 100 mm" },
  { param: "Waga", value: "280g" },
  { param: "AI Backend", value: "Matematyka (podstawa + rozszerzenie), Biologia, Chemia, Fizyka" },
  { param: "Szyfrowanie", value: "HTTPS + Bearer token" },
  { param: "Obudowa", value: "Kalkulator Esperanza (polska produkcja)" },
  { param: "Produkcja", value: "Polska" },
];

export default function Specs() {
  return (
    <section id="specyfikacja" className="py-24 bg-[#F5F5F5] dark:bg-[#313338]">
      <div className="max-w-4xl mx-auto px-6">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-3xl lg:text-4xl font-bold text-center text-[#1a1a1a] dark:text-[#E0E0E0]"
        >
          Pod maską
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-12 bg-white dark:bg-[#2B2D31] rounded-xl border border-gray-100 dark:border-[#3F4147] overflow-hidden"
        >
          {specs.map((spec, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-6 py-4 ${
                i !== specs.length - 1 ? "border-b border-gray-100 dark:border-[#3F4147]" : ""
              }`}
            >
              <span className="text-sm font-medium text-[#1a1a1a]/70 dark:text-[#E0E0E0]/70">
                {spec.param}
              </span>
              <span className="text-sm font-mono text-[#1a1a1a] dark:text-[#E0E0E0] text-right">
                {spec.value}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
