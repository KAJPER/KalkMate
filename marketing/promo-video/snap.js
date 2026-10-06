// node snap.js t1 t2 ... -> snap_<t>.png (podglad wybranych momentow)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + __dirname + '/index.html');
  await p.evaluate(() => window.ready);
  for (const t of process.argv.slice(2)) {
    await p.evaluate((t) => window.render(+t), t);
    await p.screenshot({ path: `snap_${t}.png` });
  }
  await b.close();
})();
