'use strict';
/*
 * Buscador de fotos para los tours.
 *
 *   node buscar-fotos-tours.js            -> escribe public/tour-photos.generated.js
 *
 * Consulta Wikimedia Commons, se queda solo con licencias libres y guarda por
 * tour la foto, el autor y la licencia. El archivo generado es el que se
 * commitea; este script queda para poder regenerar la lista.
 *
 * No inventa: si un subject no devuelve nada con licencia libre, no lo agrega
 * y lo reporta, para que la tarjeta caiga en la foto del destino.
 */
const fs = require('fs');
const path = require('path');

// Licencias aceptadas. Commons mezcla material libre con material con
// derechos restringidos, asÃ­ que el filtro es explÃ­cito y no opcional.
const FREE = /^(cc0|cc by|cc by-sa|public domain|pd-|no restrictions)/i;

// La bÃºsqueda de Commons exige TODAS las palabras del tÃ©rmino: con cuatro o
// cinco tÃ©rminos la chances de cero resultado se disparan. Por eso cada
// subject trae una lista de alternativas que se prueban en orden, de la mÃ¡s
// especÃ­fica a la mÃ¡s genÃ©rica. Con dos o tres palabras distintivas acierta
// casi siempre.
const SUBJECTS = {
  'rio#Cristo Redentor y Pan de AzÃºcar': ['Cristo Redentor', 'Corcovado Rio'],
  'rio#Full Day a Arraial do Cabo con paseo en barco': ['Arraial do Cabo', 'Prainhas'],

  'buz#Paseo en barco por las playas de BÃºzios': ['Bozios praia', 'Buzios'],
  'buz#City tour de BÃºzios en buggy': ['Rua das Pedras', 'Buzios centro'],

  'angra#Ilhas ParadisÃ­acas en lancha': ['Ilhas Paradisacas', 'Angra dos Reis'],
  'angra#Paseo de barco a Ilha de Cataguases': ['Cataguases', 'Angra dos Reis'],
  'arraial#Passeio de barco por las Prainhas y Gruta Azul': ['Prainhas Arraial do Cabo', 'Arraial do Cabo praia'],
  'arraial#Buceo de bautismo en aguas cristalinas': ['scuba diving Brazil', 'mergulho Brazil'],
  'bcm#City tour y Cristo Luz': ['Cristo Luz', 'Balneario Camboriu'],
  'bcm#Beto Carrero World desde CamboriÃº': ['Beto Carrero', 'Beto Carrero World'],
  'bombinhas#Snorkel em Ilha do Arvoredo': ['Ilha do Arvoredo', 'Arvoredo'],
  'bombinhas#Trilha da Costa Esmeralda': ['Costa Esmeralda', 'Bombinhas'],
  'cabo#City tour histÃ³rico y playas de Cabo Frio': ['Praia do Forte Cabo Frio', 'Cabo Frio'],
  'cabo#Paseo en barco por el Canal y la Ilha do JaponÃªs': ['Ilha do Japones', 'Cabo Frio canal'],
  'camboriu#Parque Unipraias y telefÃ©rico': ['Unipraias', 'Camboriu telefÃ©rico'],
  'camboriu#Paseo en barco por la costa de BalneÃ¡rio': ['Balneario Camboriu', 'Camboriu praia'],
  'canela#Cascata do Caracol y Skyglass': ['Cascata do Caracol', 'Caracol Canela'],
  'canela#Tren del Vino y cultura italiana': ['Trem do Vinho', 'Vale dos Vinhedos'],
  'curitiba#City tour en la Linha Turismo': ['Linha Turismo', 'Curitiba turismo'],
  'curitiba#Morretes en tren por la Serra do Mar': ['Morrotes', 'Serra do Mar'],
  'fernando#BaÃ­a dos Porcos y playas del Mar de Dentro': ['Baia dos Porcos', 'Fernando de Noronha'],
  'fernando#Paseo en barco con snorkel y puesta de sol': ['Fernando de Noronha praia', 'Noronha'],
  'for#Praia de Cumbuco y dunas en buggy': ['Cumbuco', 'Cumbuco dunes'],
  'for#Beach Park y costa de Aquiraz': ['Beach Park', 'Aquiraz'],
  'gram#Tour del Vino en Bento GonÃ§alves e Vale dos Vinhedos': ['Vale dos Vinhedos', 'Bento Goncalves'],
  'gram#City tour de Gramado y parques de Canela': ['Gramado', 'Gramado rua'],
  'gram#Snowland, el parque de nieve indoor': ['Snowland', 'Snowland Gramado'],
  'igu#Cataratas del lado brasileÃ±o y Parque das Aves': ['Parque das Aves', 'Iguazu Parana'],
  'igu#Cataratas argentinas con Garganta del Diablo': ['Garganta del Diablo', 'Iguazu Argentina'],
  'igu#Represa de ItaipÃº': ['Itaipu', 'Itaipu dam'],
  'ilha#Vuelta a la isla en lancha rÃ¡pida': ['Lopes Mendes', 'Ilha Grande beach'],
  'ilha#Trilha guiada a Lopes Mendes': ['Lopes Mendes', 'Ilha Grande trilha'],
  'ilhabela#Jeep tour por playas y cascadas': ['Ilhabela', 'Ilhabela praia'],
  'ilhabela#Paseo en barco a Castelhanos': ['Castelhanos', 'Castelhanos praia'],
  'jericoacoara#Lagoa do ParaÃ­so y Lagoa Azul en 4x4': ['Lagoa do Paraiso', 'Jericoacoara lagoa'],
  'jericoacoara#PÃ´r do sol en la Duna y Pedra Furada': ['Pedra Furada', 'Jericoacoara duna'],
  'maragogi#CatamarÃ¡n a las Piscinas Naturales (GalÃ©s)': ['Piscinas Naturais', 'Maragogi'],
  'maragogi#Buggy por playas del litoral norte': ['Maragogi praia', 'Maragogi'],
  'mcz#SÃ£o Miguel dos Milagres y Ruta EcolÃ³gica': ['Sao Miguel dos Milagres', 'Sao Miguel dos Milagres praia'],
  'morro#Volta Ã  Ilha em lancha': ['Morro de Sao Paulo', 'Morro de Sao Paulo ilha'],
  'morro#Tirolesa y miradores de Morro': ['Morro de Sao Paulo', 'Morro de Sao Paulo vista'],
  'nat#Dunas de Genipabu en buggy': ['Genipabu', 'Genipabu dunes'],
  'nat#Pipa desde Natal con BaÃ­a dos Golfinhos': ['Baia dos Golfinhos', 'Pipa'],
  'paraty#Schooner por las islas de Paraty': ['Paraty', 'Paraty baia'],
  'paraty#City tour histÃ³rico y Cachoeira do TobogÃ£': ['Cachoeira do Toboga', 'Paraty centro'],
  'pip#Paseo en Buggy de Playa en Playa': ['Pipa beach', 'Pipa'],
  'pip#Paseo en lancha para ver delfines': ['Pipa golfinhos', 'Pipa'],
  'porto#Piscinas naturales de Porto de Galinhas': ['Porto de Galinhas', 'Porto de Galinhas pools'],
  'porto#Praia dos Carneiros y paseo en catamarÃ¡n': ['Praia dos Carneiros', 'Carneiros catamaran'],
  'rec#Olinda histÃ³rica y Recife Antigo': ['Olinda', 'Olinda Pernambuco'],
  'rec#Porto de Galinhas desde Recife': ['Recife', 'Recife Antigo'],
  'rosa#Avistaje de ballenas desde los miradores': ['Praia Vermelha', 'Santa Catarina beach'],
  'rosa#Trilha a Praia Vermelha y Ouvidor': ['ouvidor beach', 'Santa Catarina praia'],
  'sao#City tour por Avenida Paulista y Centro HistÃ³rico': ['Avenida Paulista', 'Paulista Sao Paulo'],
  'sao#Ruta gastronÃ³mica por Liberdade e Mercado Municipal': ['Mercado Municipal Sao Paulo', 'Liberdade'],
  'ssa#Pelourinho, Elevador Lacerda e Mercado Modelo': ['Pelourinho', 'Elevador Lacerda'],
  'ssa#BahÃ­a de Todos os Santos en schooner': ['Baia de Todos os Santos', 'Salvador bahia'],
  'trancoso#Praias do Espelho e CaraÃ­va': ['Caraiva', 'Praia do Espelho'],
  'trancoso#City tour de Trancoso e Quadrado': ['Trancoso', 'Trancoso quadrado'],
  'ubatuba#Paseo en barco por las islas de Ubatuba': ['Ubatuba', 'Ubatuba praia'],
  'ubatuba#Trilha guiada a las cascadas de Ubatuba': ['Ubatuba queda dagua', 'Ubatuba trilhas'],
  'bho#Pampulha e arquitetura de Niemeyer': ['Pampulha', 'Pampulha Belo Horizonte'],
  'bho#Experiencia de bares y comida mineira': ['Belo Horizonte', 'BH bares'],
  'bho#Free tour a pie por el centro histÃ³rico': ['Belo Horizonte centro', 'Belo Horizonte'],
  'curitiba#Free tour a pie por el centro histÃ³rico': ['Curitiba centro', 'Curitiba'],
  'poa#Free tour a pie por el centro histÃ³rico': ['Porto Alegre centro', 'Porto Alegre'],
  'sao#Free tour a pie por el centro histÃ³rico': ['Sao Paulo centro', 'Sao Paulo'],
  'poa#Gramado e Canela desde Porto Alegre': ['Porto Alegre', 'Porto Alegre skyline'],
  'poa#Bento GonÃ§alves e Vale dos Vinhedos': ['Bento Goncalves', 'Vale dos Vinhedos']
};

const UA = 'cuantosale-tour-photos/1.0 (fotos para el catalogo de tours)';

async function buscar(termino, limite) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', 'filetype:bitmap ' + termino);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', String(limite || 8));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|size|mime');
  url.searchParams.set('iiurlwidth', '900');
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
  const out = [];
  for (const p of pages) {
    const info = p.imageinfo && p.imageinfo[0];
    if (!info || info.mime !== 'image/jpeg') continue;
    if (info.width < 900) continue;                       // se ve pixelado en un celular
    const m = info.extmetadata || {};
    const lic = String((m.LicenseShortName && m.LicenseShortName.value) || '');
    if (!FREE.test(lic)) continue;
    const author = String((m.Artist && m.Artist.value) || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    out.push({
      titulo: String(p.title || '').replace(/^File:/, ''),
      thumb: info.thumburl,
      licencia: lic,
      autor: author || 'Wikimedia Commons',
      w: info.width, h: info.height
    });
  }
  // Se prioriza el que mejor se recorta en una tarjeta: apaisado y no muy alto.
  out.sort((a, b) => {
    const score = (x) => (x.w / x.h > 1.2 ? 0 : 3) + (x.w / x.h > 2.4 ? 0 : 1);
    return score(a) - score(b);
  });
  return out;
}

(async function () {
  const claves = Object.keys(SUBJECTS);
  const encontrado = {};
  const sinFoto = [];
  for (let i = 0; i < claves.length; i++) {
    const clave = claves[i];
    const terminos = SUBJECTS[clave];
    let lista = [];
    // Se prueban las alternativas en orden hasta que una devuelva algo usable.
    for (const termino of terminos) {
      if (lista.length) break;
      try { lista = await buscar(termino); }
      catch (e) { console.error("\n  error " + clave + " (" + termino + "): " + e.message); }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (lista.length) {
      encontrado[clave] = lista[0];
      console.log("OK   " + clave + "   <- " + lista[0].titulo.slice(0, 48));
    } else {
      sinFoto.push(clave);
      console.log("FALTA " + clave);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("\n");
  console.log("Con foto: " + Object.keys(encontrado).length + " / " + claves.length);
  if (sinFoto.length) {
    console.log("Sin foto libre: " + sinFoto.length);
    sinFoto.forEach((k) => console.log("   " + k));
  }
  fs.writeFileSync(path.join(__dirname, "tour-photos.buscar.json"), JSON.stringify(encontrado, null, 2), "utf8");
  console.log("\nRevisa tour-photos.buscar.json antes de convertirlo a JS.");
})();
