const fs = require('node:fs/promises');
const path = require('node:path');
const { FileBlob, SpreadsheetFile } = require('@oai/artifact-tool');
(async () => {
  const dir = path.join(process.cwd(), 'outputs', 'tours-supabase-2026-09-24-01');
  const book = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(dir, 'Tours_para_Supabase.xlsx')));
  const tours = book.worksheets.getItem('Tours');
  const values = tours.getRange('A1:R108').values;
  const csv = values.map(row => row.map(value => {
    if (value == null) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(',')).join('\r\n');
  await fs.writeFile(path.join(dir, 'Tours_para_Supabase.csv'), '\uFEFF' + csv, 'utf8');
  const fln = values.slice(1).filter(row => row[2] === 'fln').map(row => ({title:row[5], price:row[7], original_brl:row[13], rate:row[14], margin:row[15], image_kind:row[11], has_image:!!row[10]}));
  const full = await book.inspect({kind:'workbook,sheet,table',maxChars:3500,tableMaxRows:3,tableMaxCols:6});
  const preview = await book.render({sheetName:'Supabase',range:'A1:C21',scale:1,format:'png'});
  await fs.writeFile(path.join(dir, 'supabase-preview.png'), new Uint8Array(await preview.arrayBuffer()));
  console.log(JSON.stringify({rows:values.length-1,headers:values[0].length,florianopolis_rows:fln.length,all_prices_numeric:values.slice(1).every(row=>typeof row[7]==='number'),all_images_present:values.slice(1).every(row=>typeof row[10]==='string'&&row[10].startsWith('https://')),florianopolis:fln,inspect:full.ndjson,csv:path.join(dir,'Tours_para_Supabase.csv')},null,2));
})().catch(err=>{console.error(err.stack||err);process.exit(1)});
