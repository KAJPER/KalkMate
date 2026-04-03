"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const galleryImages = [
  {
    src: "/galeria/kalkulator-kalkmate-prototyp-widok-ogolny.png",
    alt: "KalkMate - prototyp kalkulatora graficznego z AI, widok ogólny urządzenia",
  },
  {
    src: "/galeria/kalkulator-graficzny-ai-ekran-lcd.png",
    alt: "Kalkulator graficzny z ekranem LCD i technologią sztucznej inteligencji",
  },
  {
    src: "/galeria/kalkulator-naukowy-kalkmate-ukryta-kamera.jpg",
    alt: "Kalkulator naukowy KalkMate z ukrytą kamerą do skanowania zadań matematycznych",
  },
  {
    src: "/galeria/inteligentny-kalkulator-rozwiazywanie-zadan.jpg",
    alt: "Inteligentny kalkulator AI do automatycznego rozwiązywania zadań matematycznych",
  },
  {
    src: "/galeria/kalkulator-ai-pomocy-edukacyjne.jpg",
    alt: "Kalkulator z AI jako pomoc edukacyjna dla studentów i uczniów",
  },
  {
    src: "/galeria/kalkulator-matematyczny-ekran-wyswietlacz.png",
    alt: "Kalkulator matematyczny z wyświetlaczem LCD pokazującym rozwiązania krok po kroku",
  },
  {
    src: "/galeria/kalkulator-kalkmate-platforma-pcb-elektronika.png",
    alt: "Płytka PCB kalkulatora KalkMate - widok elektroniki i układów wewnętrznych",
  },
  {
    src: "/galeria/kalkulator-ai-interfejs-uzytkownika.png",
    alt: "Interfejs użytkownika kalkulatora AI z intuicyjnym menu i funkcjami",
  },
  {
    src: "/galeria/kalkulator-kieszonkowy-kompaktowy-design.png",
    alt: "Kompaktowy kalkulator kieszonkowy KalkMate z nowoczesnym designem",
  },
  {
    src: "/galeria/kalkulator-naukowy-przyciski-funkcje.png",
    alt: "Kalkulator naukowy z przyciskami i zaawansowanymi funkcjami matematycznymi",
  },
  {
    src: "/galeria/kalkulator-graficzny-kalkmate-technologia-ai.png",
    alt: "Kalkulator graficzny KalkMate z technologią AI i rozpoznawaniem obrazu",
  },
  {
    src: "/galeria/inteligentny-kalkulator-produkt-finalny.png",
    alt: "Produkt finalny - inteligentny kalkulator KalkMate gotowy do użytku",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function Gallery() {
  return (
    <section id="galeria" className="py-24 bg-[#F5F5F5] dark:bg-[#313338]">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-[#1a1a1a] dark:text-[#E0E0E0]">
            Galeria zdjęć KalkMate
          </h2>
          <p className="mt-4 text-[#1a1a1a]/60 dark:text-[#E0E0E0]/60 max-w-2xl mx-auto">
            Zobacz prawdziwe zdjęcia kalkulatora z AI - od prototypu po produkt finalny
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {galleryImages.map((image, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="relative aspect-square rounded-xl overflow-hidden bg-white dark:bg-[#2B2D31] shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                quality={80}
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                loading="lazy"
              />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <a
            href="#kup-teraz"
            className="inline-flex items-center px-8 py-3 bg-[#2563EB] dark:bg-[#3B82F6] text-white font-medium rounded-full hover:bg-[#1d4ed8] dark:hover:bg-[#2563EB] transition-colors"
          >
            Zamów KalkMate
          </a>
        </motion.div>
      </div>
    </section>
  );
}
