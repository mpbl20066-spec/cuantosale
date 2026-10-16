'use strict';
const a = require('fs').readFileSync('public/app.js', 'utf8');
const css = require('fs').readFileSync('public/style.css', 'utf8');
console.log('--- markup del selector de tipo de alojamiento ---');
const i = a.indexOf('Tipo de alojamiento');
console.log(a.slice(Math.max(0, i - 300), i + 620));
console.log('\n\n--- CSS del custom-select ---');
[...css.matchAll(/([^{}]*custom-select[^{}]*)\{([^}]*)\}/g)].forEach(m => {
  console.log('  ' + m[1].trim().slice(0, 52) + ' {');
  console.log('     ' + m[2].trim().replace(/; /g, ';\n     ').slice(0, 300));
  console.log('  }');
});
