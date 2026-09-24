const fs = require('node:fs/promises');
const vm = require('node:vm');
const path = require('node:path');
const { Workbook, SpreadsheetFile } = require('@oai/artifact-tool');

async function main() {
  const projectDir = process.cwd();
  const source = await fs.readFile(path.join(projectDir, 'public/app.js'), 'utf8');
  const tourMatch = source.match(/var LOCAL_TOURS = \[([\s\S]*?)\n  \];/);
  if (!tourMatch) throw new Error('No se encontró LOCAL_TOURS en public/app.js');
  const tourFn = (destinations, destination, title, description, price, details) => ({ destinations, destination, title, description, price, details });
  const tours = vm.runInNewContext('[' + tourMatch[1] + ']', { tour: tourFn, florianopolisTourPrice: brl => Number((brl / 5.1414 + 5).toFixed(2)) }, { timeout: 3000 });
  function getObject(name) {
    const re = new RegExp('var ' + name + ' = (\\{[\\s\\S]*?\\n  \\});');
    const match = source.match(re);
    if (!match) throw new Error('No se encontró el mapa ' + name);
    return vm.runInNewContext('(' + match[1] + ')', {}, { timeout: 3000 });
  }
  const destinationPhotos = getObject('DEST_PHOTOS');
  const categoryPhotos = getObject('TOUR_CATEGORY_PHOTOS');
  function photoCategory(title) {
    const t = String(title || '').toLowerCase();
    if (/barco|lancha|schooner|escuna|catamar|jangada|volta.{0,3}ilha|vuelta a la isla/.test(t)) return 'boat';
    if (/buggy|4x4|jeep/.test(t)) return 'buggy';
    if (/kayak|paddle/.test(t)) return 'kayak';
    return '';
  }
  function slug(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
  const rows = [];
  const idSeen = new Set();
  const noPhoto = [];
  tours.forEach((tour, i) => {
    const keys = Array.isArray(tour.destinations) ? tour.destinations : [];
    const category = photoCategory(tour.title);
    const imageUrl = categoryPhotos[category] || destinationPhotos[keys[0]] || '';
    if (!imageUrl) noPhoto.push(tour.title);
    let id = 'tour_' + slug(keys.join('_')) + '_' + slug(tour.title).slice(0, 56);
    if (idSeen.has(id)) id += '_' + String(i + 1).padStart(3, '0');
    idSeen.add(id);
    const brlMatch = String(tour.details || '').match(/R\$\s*([0-9]+(?:[.,][0-9]+)?)/i);
    const isFlorianopolis = keys.includes('fln') && brlMatch;
    rows.push([
      id,
      '{' + keys.map(k => '"' + String(k).replace(/"/g, '\\"') + '"').join(',') + '}',
      keys[0] || '',
      tour.destination || '',
      'Brasil',
      tour.title || '',
      tour.description || '',
      Number(tour.price),
      'USD',
      tour.details || '',
      imageUrl,
      category || 'destination',
      'Wikimedia Commons',
      isFlorianopolis ? Number(String(brlMatch[1]).replace(',', '.')) : null,
      isFlorianopolis ? 5.1414 : null,
      isFlorianopolis ? 5 : null,
      true,
      i + 1
    ]);
  });

  const headers = ['id','destinations','destination_key','destination','country','title','description','price','currency','details','image_url','image_kind','image_source','source_price_brl','fx_brl_per_usd','margin_usd','is_active','sort_order'];
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add('Tours');
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
  sheet.tables.add('A1:R' + (rows.length + 1), true, 'ToursSupabaseImport');
  sheet.freezePanes.freezeRows(1);
  sheet.getRange('A1:R1').format = { fill: '#10233E', font: { name: 'Aptos', size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
  sheet.getRange('A2:R' + (rows.length + 1)).format = { font: { name: 'Aptos', size: 10, color: '#24364B' }, verticalAlignment: 'top', wrapText: true };
  sheet.getRange('H2:H' + (rows.length + 1)).format.numberFormat = '"US$" #,##0.00';
  sheet.getRange('N2:N' + (rows.length + 1)).format.numberFormat = '"R$" #,##0.00';
  sheet.getRange('O2:O' + (rows.length + 1)).format.numberFormat = '0.0000';
  sheet.getRange('P2:P' + (rows.length + 1)).format.numberFormat = '"US$" #,##0.00';
  sheet.getRange('R2:R' + (rows.length + 1)).format.numberFormat = '0';
  sheet.getRange('A1:R1').format.rowHeight = 32;
  sheet.getRange('A2:R' + (rows.length + 1)).format.rowHeight = 66;
  const widths = { A: 40, B: 22, C: 20, D: 34, E: 14, F: 48, G: 58, H: 15, I: 12, J: 95, K: 90, L: 16, M: 24, N: 18, O: 18, P: 14, Q: 12, R: 12 };
  for (const [col, width] of Object.entries(widths)) sheet.getRange(col + ':' + col).format.columnWidth = width;

  const help = workbook.worksheets.add('Supabase');
  help.showGridLines = false;
  help.getRange('A1:C1').values = [['Campo','Tipo sugerido en Supabase','Notas de importación']];
  const schema = [
    ['id','text (Primary key)','Identificador estable generado a partir del destino y el título.'],
    ['destinations','text[]','Array Postgres como {"rio"}; si la importación no lo reconoce, crear columna text[] antes de importar.'],
    ['destination_key','text','Clave principal de destino para filtrar desde la app.'],
    ['destination','text','Nombre legible del destino.'],
    ['country','text','País del tour.'],
    ['title','text','Nombre del tour.'],
    ['description','text','Descripción breve.'],
    ['price','numeric','Precio numérico por persona, actualmente en USD.'],
    ['currency','text','Moneda ISO: USD.'],
    ['details','text','Incluye información operativa, duración y condiciones cuando están disponibles.'],
    ['image_url','text','URL de imagen asignada actualmente por la web; se puede reemplazar por una ruta de Supabase Storage.'],
    ['image_kind','text','boat, buggy, kayak o destination; indica qué regla de imagen asignó la URL.'],
    ['image_source','text','Fuente declarada en el código. Verificar licencia/atribución de cada imagen antes de uso comercial.'],
    ['source_price_brl','numeric nullable','Solo para tours de Florianópolis con precio original en reales.'],
    ['fx_brl_per_usd','numeric nullable','Tipo de cambio usado por el código para Florianópolis: 5.1414 BRL/USD.'],
    ['margin_usd','numeric nullable','Margen sumado por el código a los precios convertidos de Florianópolis: US$5.'],
    ['is_active','boolean','Todos los tours del catálogo local aparecen activos.'],
    ['sort_order','integer','Orden original del catálogo en la web.']
  ];
  help.getRange('A2:C19').values = schema;
  help.tables.add('A1:C19', true, 'SupabaseSchema');
  help.freezePanes.freezeRows(1);
  help.getRange('A1:C1').format = { fill: '#10233E', font: { name: 'Aptos', size: 10, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true };
  help.getRange('A2:C19').format = { font: { name: 'Aptos', size: 10, color: '#24364B' }, verticalAlignment: 'top', wrapText: true };
  help.getRange('A1:C1').format.rowHeight = 32;
  help.getRange('A2:C19').format.rowHeight = 38;
  help.getRange('A:A').format.columnWidth = 30;
  help.getRange('B:B').format.columnWidth = 32;
  help.getRange('C:C').format.columnWidth = 90;
  help.getRange('A21:C21').merge();
  help.getRange('A21').values = [['Catálogo extraído de public/app.js. Los precios son referenciales por persona y pueden cambiar; las imágenes son URLs actuales del código.']];
  help.getRange('A21:C21').format = { font: { name: 'Aptos', size: 10, italic: true, color: '#5B6B7D' }, wrapText: true, verticalAlignment: 'center' };
  help.getRange('A21:C21').format.rowHeight = 34;

  const outputDir = path.join(projectDir, 'outputs', 'tours-supabase-2026-09-24-01');
  await fs.mkdir(outputDir, { recursive: true });
  const preview = await workbook.render({ sheetName: 'Tours', range: 'A1:H12', scale: 1, format: 'png' });
  await fs.writeFile(path.join(outputDir, 'preview.png'), new Uint8Array(await preview.arrayBuffer()));
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(path.join(outputDir, 'Tours_para_Supabase.xlsx'));
  const check = await workbook.inspect({ kind: 'table', range: 'Tours!A1:R12', include: 'values', tableMaxRows: 12, tableMaxCols: 18, maxChars: 6000 });
  console.log(JSON.stringify({ tour_count: tours.length, image_missing_count: noPhoto.length, tours_without_photo: noPhoto, preview: path.join(outputDir, 'preview.png'), xlsx: path.join(outputDir, 'Tours_para_Supabase.xlsx'), inspect: check.ndjson }, null, 2));
}
main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
