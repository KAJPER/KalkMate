"use client";

import { motion } from "framer-motion";

const groups = [
  {
    label: "Compute",
    rows: [
      ["MCU", "ESP32-WROVER-E"],
      ["Pamięć", "8 MB PSRAM · 4 MB Flash"],
      ["WiFi", "2.4 GHz 802.11 b/g/n"],
    ],
  },
  {
    label: "Optyka",
    rows: [
      ["Sensor", "OmniVision OV2640 · 2 MP"],
      ["Pole widzenia", "78°"],
      ["Autofocus", "Tak · 10–∞ cm"],
    ],
  },
  {
    label: "Wyświetlacz",
    rows: [
      ["Ekran", "OLED SSD1322"],
      ["Rozdzielczość", "256 × 64 px"],
      ["Kontrast", "10000:1"],
    ],
  },
  {
    label: "Zasilanie",
    rows: [
      ["Bateria", "LiPo 3.7 V · 1200 mAh"],
      ["Praca", "~6 h tryb mieszany"],
      ["Ładowanie", "USB-C · ~2 h"],
    ],
  },
];

export default function Specs() {
  return (
    <section id="hardware" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-7">
            <p className="km-mono-eyebrow text-[#D8FF3D]">[ 04 ] · Hardware</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              <span className="italic">Polski</span> sprzęt.<br />
              W każdym detalu.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              Płytka PCB projektowana, lutowana i testowana w Polsce. Każde urządzenie
              z numerem seryjnym i 24-miesięczną gwarancją.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {groups.map((g, i) => (
            <motion.div
              key={g.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="bg-[#0B0B0B] p-8 lg:p-10"
            >
              <div className="flex items-center justify-between border-b border-[rgba(242,237,227,0.10)] pb-3">
                <span className="km-mono-eyebrow text-[#D8FF3D]">/ {g.label}</span>
                <span className="km-mono-eyebrow text-[#F2EDE3]/35">
                  {String(i + 1).padStart(2, "0")} / {String(groups.length).padStart(2, "0")}
                </span>
              </div>
              <dl className="mt-5 divide-y divide-[rgba(242,237,227,0.08)]">
                {g.rows.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-12 py-3.5 gap-4">
                    <dt className="col-span-5 km-mono-eyebrow text-[#F2EDE3]/50">{k}</dt>
                    <dd className="col-span-7 text-[15px] text-[#F2EDE3]">{v}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>
          ))}
        </div>

        {/* Terminal block */}
        <div className="mt-12 border border-[rgba(242,237,227,0.10)] bg-[#0E0E0E] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(242,237,227,0.10)]">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#FF4D2E]" />
              <span className="w-2 h-2 rounded-full bg-[#F2EDE3]/30" />
              <span className="w-2 h-2 rounded-full bg-[#D8FF3D]" />
              <span className="km-mono-eyebrow text-[#F2EDE3]/40 ml-3">
                kalkmate@firmware ~ % esptool --port COM4 read_mac
              </span>
            </div>
            <span className="km-mono-eyebrow text-[#F2EDE3]/35 hidden md:inline">FW 0.6.4</span>
          </div>
          <div className="p-5 lg:p-6 font-mono text-[12.5px] leading-[1.7] text-[#F2EDE3]/65 overflow-x-auto km-no-scrollbar">
            <p><span className="text-[#F2EDE3]/35">[boot]</span> Chip is ESP32-D0WD-V3 (revision 3)</p>
            <p><span className="text-[#F2EDE3]/35">[boot]</span> Features: WiFi, BT, Dual Core, PSRAM 8 MB</p>
            <p><span className="text-[#F2EDE3]/35">[boot]</span> MAC: 24:62:ab:f1:9c:4a</p>
            <p><span className="text-[#D8FF3D]">[ok]</span> Camera OV2640 · 2 MP · ready</p>
            <p><span className="text-[#D8FF3D]">[ok]</span> Display SSD1322 256×64 · ready</p>
            <p><span className="text-[#D8FF3D]">[ok]</span> Keypad MCP23017 · 25 keys · ready</p>
            <p><span className="text-[#F2EDE3]/35">[ok]</span> Boost MT3608 @12.04 V · in regulation</p>
            <p className="mt-2">
              <span className="text-[#D8FF3D]">$</span> System gotowy.{" "}
              <span className="text-[#F2EDE3]/35 km-blink">_</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
