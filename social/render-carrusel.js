/* node social/render-carrusel.js floripa-vs-bombinhas 6
   -> social/out/floripa-vs-bombinhas-1.png ... -6.png (1080x1080) */
const path = require('path');
const { Chrome } = require('../outputs/reels/_build/cdp.js');
(async () => {
  const nombre = process.argv[2];
  const total = Number(process.argv[3]) || 1;
  const chrome = await Chrome.launch();
  try {
    const page = await chrome.newPage(1080, Number(process.argv[4]) || 1080, 2);
    const base = 'file:///' + path.join(__dirname, nombre + '.html').split(path.sep).join('/');
    for (let n = 1; n <= total; n++) {
      await page.goto(base + '?n=' + n);
      await page.eval('document.fonts.ready.then(()=>true)', true);
      await page.shot(path.join(__dirname, 'out', nombre + '-' + n + '.png'), false);
      console.log('ok', n);
    }
  } finally { await chrome.close(); }
})().catch(e => { console.error(e); process.exit(1); });
