const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const imagesToOptimize = [
  'KalkMate.png',
  'KalkMate2.png',
  'KalkMate3.png',
  'KalkMate4.png',
  'KalkMate5.png',
];

async function optimizeImages() {
  console.log('🔄 Optymalizacja obrazów...\n');

  for (const imageName of imagesToOptimize) {
    const inputPath = path.join(publicDir, imageName);
    const outputWebP = path.join(publicDir, imageName.replace('.png', '.webp'));

    // Sprawdź czy plik istnieje
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Plik nie istnieje: ${imageName}`);
      continue;
    }

    try {
      // Konwertuj do WebP z optymalizacją
      await sharp(inputPath)
        .webp({ quality: 85, effort: 6 })
        .toFile(outputWebP);

      const originalSize = fs.statSync(inputPath).size;
      const webpSize = fs.statSync(outputWebP).size;
      const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);

      console.log(`✅ ${imageName}`);
      console.log(`   Original: ${(originalSize / 1024).toFixed(1)} KB`);
      console.log(`   WebP: ${(webpSize / 1024).toFixed(1)} KB`);
      console.log(`   Oszczędność: ${savings}%\n`);

      // Generuj również responsywne wersje
      const sizes = [640, 828, 1200, 1920];
      for (const width of sizes) {
        const resizedPath = path.join(
          publicDir,
          imageName.replace('.png', `-${width}w.webp`)
        );

        await sharp(inputPath)
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: 85, effort: 6 })
          .toFile(resizedPath);

        console.log(`   📐 Wygenerowano: ${width}w`);
      }
      console.log('');
    } catch (error) {
      console.error(`❌ Błąd podczas optymalizacji ${imageName}:`, error.message);
    }
  }

  console.log('✨ Optymalizacja zakończona!');
}

optimizeImages().catch(console.error);
