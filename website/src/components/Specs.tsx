"use client";

import { motion } from "framer-motion";
import { type Locale } from "@/lib/i18n";
import type { ReactNode } from "react";

type Group = {
  label: string;
  rows: [string, string][];
};

type Content = {
  eyebrow: string;
  heading: ReactNode;
  side: string;
  groups: Group[];
  systemReady: string;
};

const content: Record<Locale, Content> = {
  pl: {
    eyebrow: "[ 04 ] · Hardware",
    heading: (
      <>
        <span className="italic">Polski</span> sprzęt.<br />
        W każdym detalu.
      </>
    ),
    side:
      "Płytka PCB projektowana, lutowana i testowana w Polsce. Każde urządzenie z numerem seryjnym i 24-miesięczną gwarancją.",
    groups: [
      {
        label: "Compute",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Pamięć", "8 MB PSRAM · 16 MB Flash"],
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
          ["Bateria", "LiPo 3.7 V · 1500 mAh"],
          ["Praca", "~8 h tryb mieszany"],
          ["Ładowanie", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "System gotowy.",
  },
  en: {
    eyebrow: "[ 04 ] · Hardware",
    heading: (
      <>
        <span className="italic">Polish</span> hardware.<br />
        Down to the last detail.
      </>
    ),
    side:
      "PCB designed, soldered and tested in Poland. Every device carries a serial number and a 24-month warranty.",
    groups: [
      {
        label: "Compute",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Memory", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2.4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Optics",
        rows: [
          ["Sensor", "OmniVision OV2640 · 2 MP"],
          ["Field of view", "78°"],
          ["Autofocus", "Yes · 10–∞ cm"],
        ],
      },
      {
        label: "Display",
        rows: [
          ["Screen", "OLED SSD1322"],
          ["Resolution", "256 × 64 px"],
          ["Contrast", "10000:1"],
        ],
      },
      {
        label: "Power",
        rows: [
          ["Battery", "LiPo 3.7 V · 1500 mAh"],
          ["Runtime", "~8 h mixed use"],
          ["Charging", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "System ready.",
  },
  de: {
    eyebrow: "[ 04 ] · Hardware",
    heading: (
      <>
        <span className="italic">Polnische</span> Hardware.<br />
        Bis ins Detail.
      </>
    ),
    side:
      "Die Platine wird in Polen entworfen, gelötet und getestet. Jedes Gerät erhält eine Seriennummer und 24 Monate Garantie.",
    groups: [
      {
        label: "Compute",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Speicher", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2.4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Optik",
        rows: [
          ["Sensor", "OmniVision OV2640 · 2 MP"],
          ["Sichtfeld", "78°"],
          ["Autofokus", "Ja · 10–∞ cm"],
        ],
      },
      {
        label: "Display",
        rows: [
          ["Bildschirm", "OLED SSD1322"],
          ["Auflösung", "256 × 64 px"],
          ["Kontrast", "10000:1"],
        ],
      },
      {
        label: "Stromversorgung",
        rows: [
          ["Akku", "LiPo 3.7 V · 1500 mAh"],
          ["Laufzeit", "~8 h gemischt"],
          ["Laden", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "System bereit.",
  },
  cs: {
    eyebrow: "[ 04 ] · Hardware",
    heading: (
      <>
        <span className="italic">Polský</span> hardware.<br />
        Do posledního detailu.
      </>
    ),
    side:
      "Deska plošných spojů navržená, osazená a testovaná v Polsku. Každé zařízení má sériové číslo a záruku 24 měsíců.",
    groups: [
      {
        label: "Compute",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Paměť", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Optika",
        rows: [
          ["Snímač", "OmniVision OV2640 · 2 MP"],
          ["Zorné pole", "78°"],
          ["Autofokus", "Ano · 10–∞ cm"],
        ],
      },
      {
        label: "Displej",
        rows: [
          ["Obrazovka", "OLED SSD1322"],
          ["Rozlišení", "256 × 64 px"],
          ["Kontrast", "10000:1"],
        ],
      },
      {
        label: "Napájení",
        rows: [
          ["Baterie", "LiPo 3,7 V · 1500 mAh"],
          ["Výdrž", "~8 h smíšený provoz"],
          ["Nabíjení", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "Systém připraven.",
  },
  sk: {
    eyebrow: "[ 04 ] · Hardvér",
    heading: (
      <>
        <span className="italic">Poľský</span> hardvér.<br />
        Do posledného detailu.
      </>
    ),
    side:
      "Doska plošných spojov navrhnutá, osadená a testovaná v Poľsku. Každé zariadenie má sériové číslo a 24-mesačnú záruku.",
    groups: [
      {
        label: "Compute",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Pamäť", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Optika",
        rows: [
          ["Snímač", "OmniVision OV2640 · 2 MP"],
          ["Zorné pole", "78°"],
          ["Autofokus", "Áno · 10–∞ cm"],
        ],
      },
      {
        label: "Displej",
        rows: [
          ["Obrazovka", "OLED SSD1322"],
          ["Rozlíšenie", "256 × 64 px"],
          ["Kontrast", "10000:1"],
        ],
      },
      {
        label: "Napájanie",
        rows: [
          ["Batéria", "LiPo 3,7 V · 1500 mAh"],
          ["Výdrž", "~8 h zmiešaná prevádzka"],
          ["Nabíjanie", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "Systém pripravený.",
  },
  lt: {
    eyebrow: "[ 04 ] · Įranga",
    heading: (
      <>
        <span className="italic">Lenkiška</span> įranga.<br />
        Iki menkiausios detalės.
      </>
    ),
    side:
      "Spausdintinė plokštė suprojektuota, sulituota ir išbandyta Lenkijoje. Kiekvienas įrenginys turi serijos numerį ir 24 mėnesių garantiją.",
    groups: [
      {
        label: "Skaičiavimas",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Atmintis", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Optika",
        rows: [
          ["Jutiklis", "OmniVision OV2640 · 2 MP"],
          ["Matymo laukas", "78°"],
          ["Autofokusas", "Taip · 10–∞ cm"],
        ],
      },
      {
        label: "Ekranas",
        rows: [
          ["Tipas", "OLED SSD1322"],
          ["Raiška", "256 × 64 px"],
          ["Kontrastas", "10000:1"],
        ],
      },
      {
        label: "Maitinimas",
        rows: [
          ["Baterija", "LiPo 3,7 V · 1500 mAh"],
          ["Veikimo laikas", "~8 h mišriu režimu"],
          ["Įkrovimas", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "Sistema paruošta.",
  },
  be: {
    eyebrow: "[ 04 ] · Абсталяванне",
    heading: (
      <>
        <span className="italic">Польскае</span> абсталяванне.<br />
        Да апошняй дэталі.
      </>
    ),
    side:
      "Друкаваная плата распрацавана, запаяна і пратэставана ў Польшчы. Кожная прылада мае серыйны нумар і гарантыю 24 месяцы.",
    groups: [
      {
        label: "Вылічэнні",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Памяць", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Оптыка",
        rows: [
          ["Сэнсар", "OmniVision OV2640 · 2 MP"],
          ["Поле зроку", "78°"],
          ["Аўтафокус", "Так · 10–∞ см"],
        ],
      },
      {
        label: "Дысплей",
        rows: [
          ["Экран", "OLED SSD1322"],
          ["Раздзяляльнасць", "256 × 64 px"],
          ["Кантраснасць", "10000:1"],
        ],
      },
      {
        label: "Сілкаванне",
        rows: [
          ["Батарэя", "LiPo 3,7 V · 1500 mAh"],
          ["Праца", "~8 гадз. у змешаным рэжыме"],
          ["Зарадка", "USB-C · ~2 гадз."],
        ],
      },
    ],
    systemReady: "Сістэма гатовая.",
  },
  es: {
    eyebrow: "[ 04 ] · Hardware",
    heading: (
      <>
        Hardware <span className="italic">polaco</span>.<br />
        Hasta el último detalle.
      </>
    ),
    side:
      "Placa diseñada, soldada y probada en Polonia. Cada dispositivo lleva número de serie y 24 meses de garantía.",
    groups: [
      {
        label: "Cómputo",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Memoria", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Óptica",
        rows: [
          ["Sensor", "OmniVision OV2640 · 2 MP"],
          ["Campo de visión", "78°"],
          ["Autoenfoque", "Sí · 10–∞ cm"],
        ],
      },
      {
        label: "Pantalla",
        rows: [
          ["Tipo", "OLED SSD1322"],
          ["Resolución", "256 × 64 px"],
          ["Contraste", "10000:1"],
        ],
      },
      {
        label: "Alimentación",
        rows: [
          ["Batería", "LiPo 3,7 V · 1500 mAh"],
          ["Autonomía", "~8 h en uso mixto"],
          ["Carga", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "Sistema listo.",
  },
  pt: {
    eyebrow: "[ 04 ] · Hardware",
    heading: (
      <>
        Hardware <span className="italic">polaco</span>.<br />
        Até ao último detalhe.
      </>
    ),
    side:
      "Placa de circuito concebida, soldada e testada na Polónia. Cada dispositivo tem número de série e 24 meses de garantia.",
    groups: [
      {
        label: "Processamento",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Memória", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Ótica",
        rows: [
          ["Sensor", "OmniVision OV2640 · 2 MP"],
          ["Campo de visão", "78°"],
          ["Autofoco", "Sim · 10–∞ cm"],
        ],
      },
      {
        label: "Ecrã",
        rows: [
          ["Tipo", "OLED SSD1322"],
          ["Resolução", "256 × 64 px"],
          ["Contraste", "10000:1"],
        ],
      },
      {
        label: "Alimentação",
        rows: [
          ["Bateria", "LiPo 3,7 V · 1500 mAh"],
          ["Autonomia", "~8 h em uso misto"],
          ["Carregamento", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "Sistema pronto.",
  },
  fr: {
    eyebrow: "[ 04 ] · Matériel",
    heading: (
      <>
        Matériel <span className="italic">polonais</span>.<br />
        Jusqu’au moindre détail.
      </>
    ),
    side:
      "Circuit imprimé conçu, soudé et testé en Pologne. Chaque appareil porte un numéro de série et bénéficie d’une garantie de 24 mois.",
    groups: [
      {
        label: "Calcul",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Mémoire", "8 Mo PSRAM · 16 Mo Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Optique",
        rows: [
          ["Capteur", "OmniVision OV2640 · 2 MP"],
          ["Champ de vision", "78°"],
          ["Autofocus", "Oui · 10–∞ cm"],
        ],
      },
      {
        label: "Affichage",
        rows: [
          ["Écran", "OLED SSD1322"],
          ["Résolution", "256 × 64 px"],
          ["Contraste", "10000:1"],
        ],
      },
      {
        label: "Alimentation",
        rows: [
          ["Batterie", "LiPo 3,7 V · 1500 mAh"],
          ["Autonomie", "~8 h en usage mixte"],
          ["Recharge", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "Système prêt.",
  },
  it: {
    eyebrow: "[ 04 ] · Hardware",
    heading: (
      <>
        Hardware <span className="italic">polacco</span>.<br />
        Curato nei minimi dettagli.
      </>
    ),
    side:
      "Scheda progettata, saldata e collaudata in Polonia. Ogni dispositivo ha un numero di serie e 24 mesi di garanzia.",
    groups: [
      {
        label: "Elaborazione",
        rows: [
          ["MCU", "ESP32-S3-WROOM-1-N16R8"],
          ["Memoria", "8 MB PSRAM · 16 MB Flash"],
          ["WiFi", "2,4 GHz 802.11 b/g/n"],
        ],
      },
      {
        label: "Ottica",
        rows: [
          ["Sensore", "OmniVision OV2640 · 2 MP"],
          ["Campo visivo", "78°"],
          ["Autofocus", "Sì · 10–∞ cm"],
        ],
      },
      {
        label: "Display",
        rows: [
          ["Schermo", "OLED SSD1322"],
          ["Risoluzione", "256 × 64 px"],
          ["Contrasto", "10000:1"],
        ],
      },
      {
        label: "Alimentazione",
        rows: [
          ["Batteria", "LiPo 3,7 V · 1500 mAh"],
          ["Autonomia", "~8 h uso misto"],
          ["Ricarica", "USB-C · ~2 h"],
        ],
      },
    ],
    systemReady: "Sistema pronto.",
  },
};

export default function Specs({ lang = "pl" }: { lang?: Locale }) {
  const t = content[lang];
  return (
    <section id="hardware" className="relative py-24 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-16">
          <div className="lg:col-span-7">
            <p className="km-mono-eyebrow text-[#D8FF3D]">{t.eyebrow}</p>
            <h2 className="km-display text-[clamp(40px,7vw,108px)] text-[#F2EDE3] mt-4">
              {t.heading}
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-[15px] leading-[1.65] text-[#F2EDE3]/65">
              {t.side}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-px bg-[rgba(242,237,227,0.10)] border border-[rgba(242,237,227,0.10)]">
          {t.groups.map((g, i) => (
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
                  {String(i + 1).padStart(2, "0")} / {String(t.groups.length).padStart(2, "0")}
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
              <span className="text-[#D8FF3D]">$</span> {t.systemReady}{" "}
              <span className="text-[#F2EDE3]/35 km-blink">_</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
