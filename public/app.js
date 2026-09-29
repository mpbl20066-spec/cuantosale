(function () {
  'use strict';

  var CATS = [
    ['pasajes', 'Pasajes', '--c1'],
    ['bus', 'Bus', '--c1'],
    ['alojamiento', 'Alojamiento', '--c2'],
    ['comidas', 'Comidas', '--c3'],
    ['local', 'Transporte local', '--c5'],
    ['traslados', 'Traslados', '--c4'],
    ['auto', 'Auto / Roadtrip', '--c4'],
    ['alquiler', 'Alquiler de auto', '--c7'],
    ['tours', 'Tours y actividades', '--c6']
  ];
  // Fotos reales de cada destino (Wikimedia Commons, licencia libre) para la cabecera de las tarjetas.
  var DEST_PHOTOS = {
    buz: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Praia_de_Manguinhos_-_Arma%C3%A7%C3%A3o_de_B%C3%BAzios_-_Rio_de_Janeiro_-_Brasil.jpg/1920px-Praia_de_Manguinhos_-_Arma%C3%A7%C3%A3o_de_B%C3%BAzios_-_Rio_de_Janeiro_-_Brasil.jpg',
    arraial: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Oven_S_Beach_Arraial_Do_Cabo_%28247765557%29.jpeg/1920px-Oven_S_Beach_Arraial_Do_Cabo_%28247765557%29.jpeg',
    cabo: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/35/Cabo_Frio_%28344068854%29.jpg/1920px-Cabo_Frio_%28344068854%29.jpg',
    ilha: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/View_Ilha_Grande.JPG',
    paraty: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/Paraty_05.JPG/1920px-Paraty_05.JPG',
    ilhabela: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Vista_do_Pico_do_Baepi.jpg/1920px-Vista_do_Pico_do_Baepi.jpg',
    ubatuba: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/20230725_084402.jpg',
    rio: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Cidade_Maravilhosa.jpg/1920px-Cidade_Maravilhosa.jpg',
    // Gobierno de la Ciudad Autónoma de Buenos Aires, CC BY 2.5 AR.
    bue: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Panorama_9_de_Julio_y_el_Obelisco.jpg/960px-Panorama_9_de_Julio_y_el_Obelisco.jpg',
    angra: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Angra_dos_Reis%2C_Brazil_2018_116.jpg/1920px-Angra_dos_Reis%2C_Brazil_2018_116.jpg',
    sao: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Vista_da_Avenida_Paulista_-_Sesc_Avenida_Paulista_por_Rodrigo_Tetsuo_Argenton_%281%29.jpg/1920px-Vista_da_Avenida_Paulista_-_Sesc_Avenida_Paulista_por_Rodrigo_Tetsuo_Argenton_%281%29.jpg',
    bho: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Praca_do_Papa%2C_Belo_Horizonte_%28cropped%292.jpg',
    curitiba: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Tangu%C3%A1_Curitiba.jpg/1920px-Tangu%C3%A1_Curitiba.jpg',
    porto: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Porto_de_Galinhas_piscinas_naturais.jpg',
    mcz: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Praia_de_Ipioca_-_Macei%C3%B3_-_Alagoas_%2811394603505%29.jpg',
    maragogi: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Sargentinho_-_Piscinas_naturais_de_Maragogi_-_Alagoas.jpg',
    nat: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Natal%2C_capital_do_Rio_Grande_do_Norte%2C_Brasil.jpg/1920px-Natal%2C_capital_do_Rio_Grande_do_Norte%2C_Brasil.jpg',
    pip: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/PipaBeachView.JPG/1920px-PipaBeachView.JPG',
    trancoso: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Trancoso%2C_Porto_Seguro%2C_Bahia_Brazil.jpg',
    /* La foto de Arraial d'Ajuda es la balsa del cruce desde Porto Seguro, que es
       la imagen que identifica al pueblo: la balsa es la unica forma de llegar
       sin carro. La otra cara de la entrada era una sola clave, asi que no
       habia ninguna foto propia de este pueblo. */
    ajuda: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Arraial_D%27ajuda%2C_Porto_Seguro-BA.jpg/1920px-Arraial_D%27ajuda%2C_Porto_Seguro-BA.jpg',
    ssa: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Salvador_BA_%28cropped%29_2.jpg/1920px-Salvador_BA_%28cropped%29_2.jpg',
    for: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Fortaleza%2C_Brazil_%284%29_%28cropped%29.jpg',
    jericoacoara: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Anderps_067.JPG/1920px-Anderps_067.JPG',
    morro: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/MARCIO_FILHO_FAROL_DO_MORRO_MORRO_DE_S%C3%83O_PAULO_BAHIA_%2839166725080%29.jpg/1920px-MARCIO_FILHO_FAROL_DO_MORRO_MORRO_DE_S%C3%83O_PAULO_BAHIA_%2839166725080%29.jpg',
    fernando: 'https://upload.wikimedia.org/wikipedia/commons/9/91/EDUARDO_MURUCI_-_BAIA_DOS_PORCOS-%28recorte%29.jpg',
    fln: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Morro_da_Cruz%2C_Florian%C3%B3polis_-_SC%2C_Brazil_-_panoramio_%28cropped%29.jpg/1920px-Morro_da_Cruz%2C_Florian%C3%B3polis_-_SC%2C_Brazil_-_panoramio_%28cropped%29.jpg',
    camboriu: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Praia_dos_amores.jpg/1920px-Praia_dos_amores.jpg',
    bombinhas: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Praia_da_Sepultura%2C_Bombinhas%2C_Santa_Catarina.jpg/1920px-Praia_da_Sepultura%2C_Bombinhas%2C_Santa_Catarina.jpg',
    rosa: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/Praia_do_Rosa%2C_SC.JPG/1920px-Praia_do_Rosa%2C_SC.JPG',
    bcm: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Orla_da_Praia_Central%2C_Balne%C3%A1rio_Cambori%C3%BA_SC.JPG/1920px-Orla_da_Praia_Central%2C_Balne%C3%A1rio_Cambori%C3%BA_SC.JPG',
    gram: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/GRAMADO_-_RIO_GRANDE_DO_SUL_-_BRASIL_BY_AUGUSTO_JANISCKI_JUNIOR_%2814281900109%29.jpg/1920px-GRAMADO_-_RIO_GRANDE_DO_SUL_-_BRASIL_BY_AUGUSTO_JANISCKI_JUNIOR_%2814281900109%29.jpg',
    canela: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/Catedral_Nossa_Senhora_de_Lourdes.JPG/1920px-Catedral_Nossa_Senhora_de_Lourdes.JPG',
    igu: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/Cataratas_do_Igua%C3%A7u%2C_Iguazu_Falls.jpg/1920px-Cataratas_do_Igua%C3%A7u%2C_Iguazu_Falls.jpg',
    rec: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Antonio_Vaz_island_-_Recife%2C_Pernambuco%2C_Brazil_%28cropped%29.jpg',
    poa: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/IBPA_17398_-_Vista_a%C3%A9rea_da_Orla_Moacyr_Scliar%2C_na_capital._O_-_2018-10-02_-_Luciano_Lanes-PMPA_%28cropped%29.jpg/1920px-IBPA_17398_-_Vista_a%C3%A9rea_da_Orla_Moacyr_Scliar%2C_na_capital._O_-_2018-10-02_-_Luciano_Lanes-PMPA_%28cropped%29.jpg',
    // Los 10 que faltaban. Todos verificados contra la DESCRIPCION del
    // archivo en Commons y no contra el nombre, por dos motivos que ya
    // aparecieron: hay homonimos y hay licencias restringidas.
    //
    // - "forte" devolvia 3 de 5 resultados de Praia do Forte do Cao, en
    //   ANCORA, PORTUGAL. La que esta aca es la de Bahia, confirmado por la
    //   descripcion del archivo.
    // - "ferrugem" tenia como mejor candidata un "CC BY-SA 2.0 br": la "br"
    //   significa que la licencia solo vale dentro de Brasil, asi que no
    //   sirve para una web que se lee desde Montevideo. Descartada.
    // - "torres" solo por el nombre no da nada (devuelve PDFs de archivo
    //   historico). Hay que buscarla por su landmark: el Parque da Guarita.
    // - "garopaba" quedo en 1152 px, mas chica que las demas, porque las
    //   candidatas grandes que hay son de Armacao (Florianopolis).
    portoseguro: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/58/Porto_Seguro_-_State_of_Bahia%2C_Brazil_-_panoramio.jpg/1280px-Porto_Seguro_-_State_of_Bahia%2C_Brazil_-_panoramio.jpg',
    itacare: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f9/Farol_de_Itacar%C3%A9_-_Bahia_-_Brasil_%2811547133894%29.jpg/1280px-Farol_de_Itacar%C3%A9_-_Bahia_-_Brasil_%2811547133894%29.jpg',
    forte: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Projeto_Tamar_-_Praia_do_Forte%2C_Bahia_%287291356354%29.jpg/1280px-Projeto_Tamar_-_Praia_do_Forte%2C_Bahia_%287291356354%29.jpg',
    itapema: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Praia_de_Itapema_-_Orla.jpg/1280px-Praia_de_Itapema_-_Orla.jpg',
    garopaba: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Garopaba_Beach_July_2009.JPG',
    ferrugem: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Nascer_na_Praia_da_Ferrugem.JPG/1280px-Nascer_na_Praia_da_Ferrugem.JPG',
    picarras: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Praia_de_Pi%C3%A7arras.jpg/1280px-Praia_de_Pi%C3%A7arras.jpg',
    torres: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Torres_RS_Brasil_-_Vista_da_Torre_Sul_e_do_Parque_da_Guarita_-_panoramio.jpg/1280px-Torres_RS_Brasil_-_Vista_da_Torre_Sul_e_do_Parque_da_Guarita_-_panoramio.jpg',
    canoa: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Farol_litoral_Capao_da_Canoa_Praia_Ara%C3%A7a.jpg/1280px-Farol_litoral_Capao_da_Canoa_Praia_Ara%C3%A7a.jpg',
    joaopessoa: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Jo%C3%A3o_Pessoa%2C_Para%C3%ADba%2C_Brasil.jpg/1280px-Jo%C3%A3o_Pessoa%2C_Para%C3%ADba%2C_Brasil.jpg'
  };
  /*
   * Créditos de las fotos. Archivo GENERADO por creditos-fotos.js.
   *
   * Se cargan aparte y no van en línea en app.js: son 35 entradas de texto
   * quieto que sólo se necesitan cuando se abre el desplegable de créditos, y
   * app.js ya es grande. Además, si el archivo no está (por ejemplo en un
   * entorno de pruebas), la app sigue funcionando y simplemente no muestra
   * créditos.
   */
  var FOTO_CREDITOS = {};
  var fotoCreditosCargados = false;
  function cargarCreditosFotos() {
    if (fotoCreditosCargados) return Promise.resolve(FOTO_CREDITOS);
    fotoCreditosCargados = true;
    // Antes: fetch() del archivo y después un <script> al MISMO src. O sea dos
    // descargas y dos parseos del mismo JS, y el texto del primero solo se
    // usaba para un if (!src). Ahora se inyecta únicamente el <script>, cuyo
    // handler de error ya cubre el fallo.
    var holder = document.createElement('div');
    holder.id = 'foto-creditos-cargados';
    holder.hidden = true;
    var script = document.createElement('script');
    script.src = '/creditos-fotos.generated.js';
    holder.appendChild(script);
    document.body.appendChild(holder);
    return new Promise(function (resolve) {
      script.addEventListener('load', function () {
        FOTO_CREDITOS = window.FOTO_CREDITOS || {};
        resolve(FOTO_CREDITOS);
      });
      script.addEventListener('error', function () { resolve(FOTO_CREDITOS); });
    });
  }
  function fotoCreditosDe(url) {
    return FOTO_CREDITOS[url] || null;
  }

  /*
   * Fotos de tours, de Wikimedia Commons.
   *
   * Sólo entran acá las que se revisaron una por una mirando la imagen. Una
   * búsqueda automática devuelve la foto del lugar equivocado con total
   * naturalidad, y el filtro de licencia y de formato no lo detecta:
   *
   *   - "Pedra Furada" devuelve el arco de Serra da Capivara (Piauí), no el de
   *     Jericoacoara.
   *   - La foto de kayak que estaba antes venía de Kamaole Beach Park, Hawái,
   *     y se mostraba en los 21 kayak tours de Brasil.
   *   - "Rua das Pedras" devolvía la de Lisboa, no la de Búzios.
   *   - Una de Itaipú era correcta pero estaba sacada a través del vidrio de
   *     un bus, con el marco y los reflejos a la vista.
   *
   * El autor y la licencia se muestran en la web porque CC BY y CC BY-SA
   * obligan a dar crédito: sin eso el uso deja de estar autorizado. Y es
   * además la prueba de que tenemos derecho a usarlas.
   *
   * Los tours que no están en este mapa no muestran foto: muestran un
   * degradado con el ícono de la actividad. Es honesto y se ve prolijo; una
   * foto de otro lugar o de otro país no lo es.
   */
  var TOUR_PHOTOS = {
    'buz#Paseo en barco por las playas de Búzios': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Praia_da_Azeda_01.jpg/1280px-Praia_da_Azeda_01.jpg',
      autor: 'Halley Pacheco de Oliveira',
      licencia: 'CC BY-SA 3.0'
    },
    'buz#City tour de Búzios en buggy': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/B%C3%BAzios_RJ_Brasil_-_Rua_das_Pedras_-_panoramio.jpg/1280px-B%C3%BAzios_RJ_Brasil_-_Rua_das_Pedras_-_panoramio.jpg',
      autor: 'Josue Marinho',
      licencia: 'CC BY 3.0'
    },
    'buz#Kayak o stand up paddle en la costa': {
      /* Commons no tiene foto de kayak de Búzios. Esta es el pier de
         Manguinhos, a 3.7 km del centro: muestra la costa donde se hace la
         actividad, no la actividad. Es el mismo criterio que el resto del
         catalogo: la foto de un tour de dos horas muestra el lugar, porque
         el operador no publica la foto de su propia salida. */
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Pier_da_Praia_de_Manguinhos.jpg/1280px-Pier_da_Praia_de_Manguinhos.jpg',
      autor: 'Patrick Montenegro',
      licencia: 'CC BY-SA 4.0'
    },
    'rio#Cristo Redentor y Pan de Azúcar': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3a/Unique_Moment_with_the_Moon_and_Christ_the_Redeemer_3.jpg/1280px-Unique_Moment_with_the_Moon_and_Christ_the_Redeemer_3.jpg',
      autor: 'Donatas Dabravolskas', licencia: 'CC BY-SA 4.0'
    },
    'ssa#Pelourinho, Elevador Lacerda e Mercado Modelo': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/Pelourinho_Salvador_Bahia_2018-0601.jpg/1280px-Pelourinho_Salvador_Bahia_2018-0601.jpg',
      autor: 'Paul R. Burley', licencia: 'CC BY-SA 4.0'
    },
    'bho#Pampulha e arquitetura de Niemeyer': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/PedroVilela_Lagoa_da_Pampulha_Belo_Horizonte_MG_%2840158074024%29.jpg/1280px-PedroVilela_Lagoa_da_Pampulha_Belo_Horizonte_MG_%2840158074024%29.jpg',
      autor: 'MTur Destinos', licencia: 'Dominio público'
    },
    'igu#Cataratas del lado brasileño e Parque das Aves': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/00_1838_Iguazu_Falls_from_the_Brazilian_side.jpg/1280px-00_1838_Iguazu_Falls_from_the_Brazilian_side.jpg',
      autor: 'W. Bulach', licencia: 'CC BY-SA 4.0'
    },
    'igu#Cataratas argentinas com Garganta del Diablo': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Boca_de_la_Garganta_del_Diablo_en_Cataratas_del_Iguaz%C3%BA_01.jpg/1280px-Boca_de_la_Garganta_del_Diablo_en_Cataratas_del_Iguaz%C3%BA_01.jpg',
      autor: 'MIKEMDP', licencia: 'CC BY-SA 4.0'
    },
    'bcm#Beto Carrero World desde Camboriú': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/09/Vista_do_Beto_Carrero_World_a_partir_da_roda-gigante%2C_Penha_SC.JPG/1280px-Vista_do_Beto_Carrero_World_a_partir_da_roda-gigante%2C_Penha_SC.JPG',
      autor: 'HVL', licencia: 'CC BY 4.0'
    },

    /* Florianopolis (fln). Los 11 tours de la isla, uno por uno.
       La foto tiene que ser del mismo lugar que el tour, asi que varias no
       son "la foto bonita de la bahia" sino el punto exacto que se vende:
       Praia Mole para el tour de playas, la Isla de Campeche con las canoas
       atracadas para la ida a la isla, las jangadas de Guarda do Embau.
       Cuando no habia foto del lugar se eligio una del mismo tipo de
       actividad en Brasil, y eso queda anotado en el comentario de cada
       una: es mejor mostrar un catamaran que un caladero sin foto. */
    'fln#Paseo en escuna pirata': {
      // Veleros de esquina al atardecer, en un puerto de Brazil. No es la Bahia
      // Sur, pero es lo que la tarjeta promete: una escuna.
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Schooners..._%28144099381%29.jpg/1280px-Schooners..._%28144099381%29.jpg',
      autor: 'Diego Torres Silvestre', licencia: 'CC BY 2.0'
    },
    'fln#Catamarán con almuerzo': {
      // Catamaran de paseo en una bahia remakeana. Actividad correcta, bahia
      // que no: la excursion sale de la Ilha.
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Catamaran_-_panoramio.jpg/1280px-Catamaran_-_panoramio.jpg',
      autor: 'TMbux', licencia: 'CC BY-SA 3.0'
    },
    'fln#Excursión en barco a Isla de Campeche': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Vista_da_praia_da_Ilha_do_Campeche.jpg/1280px-Vista_da_praia_da_Ilha_do_Campeche.jpg',
      autor: 'Rafael Baumer De S. Thiago', licencia: 'CC BY-SA 4.0'
    },
    'fln#Bautismo de buceo': {
      // Buceo en Porto de Galinhas (Pernambuco), no en Santa Catarina. La
      // actividad es la que se vende; el lugar no.
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Mergulho_na_Praia_de_Porto_de_Galinhas_-_Ipojuca%2C_Pernambuco%2C_Brasil.jpg/1280px-Mergulho_na_Praia_de_Porto_de_Galinhas_-_Ipojuca%2C_Pernambuco%2C_Brasil.jpg',
      autor: 'Ventura', licencia: 'CC BY 2.0'
    },
    'fln#Bombinhas y Praia de Quatro Ilhas': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Bombinhas_-_Praia_cuatro_islas.jpg/1280px-Bombinhas_-_Praia_cuatro_islas.jpg',
      autor: 'Dmmpd', licencia: 'CC BY-SA 4.0'
    },
    'fln#Tour de playas de Florianópolis': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Florianopolis_praia_mole.JPG/1280px-Florianopolis_praia_mole.JPG',
      autor: 'Lionel Baur', licencia: 'CC BY-SA 3.0'
    },
    'fln#City tour de Florianópolis': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9b/Pra%C3%A7a_XV_de_Novembro_%28Florian%C3%B3polis%29_by_K%C3%A1tia_C._Oliveira_13.jpg/1280px-Pra%C3%A7a_XV_de_Novembro_%28Florian%C3%B3polis%29_by_K%C3%A1tia_C._Oliveira_13.jpg',
      autor: 'Ajmcbarreto', licencia: 'CC BY-SA 4.0'
    },
    'fln#Beto Carrero World': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/BETO_CARRERO_WORLD%2C_Penha%2C_Santa_Catarina%2C_Brasil_by_Nivaldo_Cit_Filho_-_panoramio_%287%29.jpg/1280px-BETO_CARRERO_WORLD%2C_Penha%2C_Santa_Catarina%2C_Brasil_by_Nivaldo_Cit_Filho_-_panoramio_%287%29.jpg',
      autor: 'Nivaldo Cit Filho', licencia: 'CC BY-SA 3.0'
    },
    'fln#Balneário Camboriú': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Camboriu_praia_central.jpg/1280px-Camboriu_praia_central.jpg',
      autor: 'Astrodyum', licencia: 'Dominio público'
    },
    'fln#Guarda do Embaú': {
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Guarda_do_Embau_%285326927303%29.jpg/1280px-Guarda_do_Embau_%285326927303%29.jpg',
      autor: 'Otávio Nogueira', licencia: 'CC BY 2.0'
    },
    'fln#Kayak o stand up paddle en la costa': {
      // Kayak en el Parque Estadual do Rio Vermelho, que esta en la isla.
      url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/Parque_Estadual_do_Rio_Vermelho_-_Robson_10.jpg/1280px-Parque_Estadual_do_Rio_Vermelho_-_Robson_10.jpg',
      autor: 'Robzera', licencia: 'CC BY-SA 4.0'
    }
  };

  /*
   * Actividad del tour, para elegir el ícono del degradado cuando no hay foto.
   * Sólo elige ícono y color: nunca una foto.
   */
  var TOUR_ACTIVITIES = [
    { id: 'boat', test: /barco|lancha|schooner|escuna|catamar|jangada|volta.{0,3}ilha|vuelta a la isla|navega|delfin/ },
    { id: 'buggy', test: /buggy|4x4|jeep|carro|trilha.*buggy/ },
    { id: 'paddle', test: /kayak|paddle|stand up/ },
    { id: 'wine', test: /vino|italiana/ },
    { id: 'snow', test: /nieve|snowland/ },
    { id: 'city', test: /city tour|centro hist|praia do forte|lugar hist/ },
    { id: 'nature', test: /cascata|trilha|catarata|represa|duna|praia natural/ },
    { id: 'food', test: /gastron|bares|comida|mercado/ }
  ];
  function tourActivity(title) {
    var t = String(title || '').toLowerCase();
    for (var i = 0; i < TOUR_ACTIVITIES.length; i++) {
      if (TOUR_ACTIVITIES[i].test.test(t)) return TOUR_ACTIVITIES[i].id;
    }
    return 'default';
  }
  // Degradado e ícono por actividad. Los colores salen de la paleta de la
  // marca para que la sección no se vea ajena al resto de la app.
  var TOUR_ACTIVITY_SKINS = {
    boat: { from: '#1d4e89', to: '#0b1b3a', ico: '<path d="M3 17h18l-2 3H5z"/><path d="M12 3v11"/><path d="M8 14l4-3 4 3"/>' },
    buggy: { from: '#8a5a10', to: '#3d2708', ico: '<path d="M4 16h16v3H4z"/><path d="M6 16l2-5h8l2 5"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/>' },
    paddle: { from: '#0e6a6a', to: '#08312f', ico: '<path d="M15 3l-9 12"/><path d="M4 19c2-1.4 3.4-1.4 5.4 0 2-1.4 3.4-1.4 5.4 0 2-1.4 3.4-1.4 5.2 0"/>' },
    wine: { from: '#6b1f3a', to: '#2e0c17', ico: '<path d="M8 3h8l-1 6a3 3 0 0 1-6 0z"/><path d="M12 12v7"/><path d="M8.5 21h7"/>' },
    snow: { from: '#2b5a8a', to: '#12253d', ico: '<path d="M12 3v18"/><path d="M4 7l16 10"/><path d="M20 7L4 17"/>' },
    city: { from: '#3d4a63', to: '#161d2b', ico: '<path d="M4 21V9l6-3v15"/><path d="M10 21V4l10 5v12"/><path d="M3 21h18"/>' },
    nature: { from: '#1d6b3f', to: '#0a2b18', ico: '<path d="M3 20l6-9 4 5 3-4 5 8z"/><circle cx="17" cy="6" r="2.4"/>' },
    food: { from: '#9a3412', to: '#3d1508', ico: '<path d="M6 3v8a2 2 0 0 0 4 0V3"/><path d="M8 11v10"/><path d="M17 3c-1.6 1.6-2 3-2 5s.8 2.6 2 3v10"/>' },
    default: { from: '#2a3f63', to: '#0d1728', ico: '<path d="M12 3l2.6 5.9L21 10l-4.8 4.4 1.3 6.6L12 17.8 6.5 21l1.3-6.6L3 10l6.4-1.1z"/>' }
  };
  function tourActivitySkin(title) {
    return TOUR_ACTIVITY_SKINS[tourActivity(title)] || TOUR_ACTIVITY_SKINS.default;
  }
  function tourPhoto(destinationKey, tour) {
    return TOUR_PHOTOS[String(destinationKey).toLowerCase() + '#' + String(tour && tour.title || '')] || null;
  }

  function tourDetailText(tour) {
    return tour.details || 'Incluye la actividad principal y acompañamiento local. Confirmá horarios, punto de encuentro, disponibilidad y valor final antes de reservar.';
  }

  var MONEDAS_APP = [{ code: 'USD', etiqueta: 'Dolares', simbolo: 'US$' },
    { code: 'BRL', etiqueta: 'Reales', simbolo: 'R$' },
    { code: 'UYU', etiqueta: 'Pesos uruguayos', simbolo: '$' }];
  var FX = { rates: null, base: 'USD', until: 0, cargando: true };
  var S = { currency: 'USD', dest: 'todos', dep: '', ret: '', pax: 2, budget: 3000, style: 'eq', transport: 'flight', proposalId: '', origin: 'MVD', subcategory: '', second: '', hotelType: 'intermedio', hotelTypeExplicit: false };
  /* Solo se muestran los hoteles con disponibilidad confirmada. Antes esto era
     un filtro con dos opciones ("Todos" / "Solo con disponibilidad") y el
     default era mostrar todo. Ahora no hay opción: la lista es siempre la de los
     que se pueden reservar de verdad.

     Por qué sin opción. El filtro respondía una pregunta que la app ya
     respondía sola. Un hotel sin precio real para esas fechas no es una
     opción: es una estimación del modelo, sin foto y sin nada confirmado.
     Mezclarla con las que sí se pueden reserving hacía que el precio de la
     pantalla no cerrara con lo que el cliente iba a pagar, y el caso peor era
     el default: "Todos" salía marcado, así que la primera apertura mostraba la
     mezcla y el error se pagaba solo.

     La lista llega mezclada:
       - `source: 'booking'`: precio real consultado para el rango de fechas, con
         foto y con link. Esto es lo que se puede reservar.
       - `source: 'fallback'`: una entrada genérica (marca + ciudad) con el
         precio del modelo, sin foto y sin disponibilidad comprobada.
     Quedarse solo con la primera es lo que hace que "Ver disponibilidad"
     signifique algo, y hace falta que el estado vacío de abajo lo explique
     cuando no queda ninguno: ahí el mensaje dice cuántos se ocultaron y por
     qué, que es lo único que puede decir. */
  var hotelSoloReservables = true;
  /* `intermedio` y `confort` se muestran como "Equilibrado" y "Cómodo" para que
     el selector de alojamiento hable el mismo idioma que el selector de estilo
     de viaje, que ya decía "Ahorrar al máximo / Equilibrado / Con comodidad".
     Antes el mismo nivel se llamaba de dos formas ("Intermedio" en uno, "Eq" en
     el otro) y "Confort" en un lado y "Con comodidad" en el otro.

     La clave interna NO cambia: `intermedio` sigue siendo `intermedio` en el
     modelo, en el server, en los viajes guardados y en el parametro
     hotel_type. Renombrarla a `equilibrado` haria que cada viaje guardado con
     el tipo viejo dejara de encontrar su tipo y cayera al primero de la lista. */
  var HOTEL_TYPE_LABELS = { 'all-inclusive': 'All Inclusive', resort: 'Resort', boutique: 'Boutique', economico: 'Económico', intermedio: 'Equilibrado', confort: 'Cómodo' };

  /* Los tipos que el selector de alojamiento sabe dibujar. Vive aparte de
     HOTEL_TYPE_LABELS porque son dos cosas distintas: en el modelo hay seis y
     en el selector hay cuatro —boutique y resort no se ofrecen, aunque sigan
     llegando por la subcategoria—. Y el orden es de mas barato a mas caro, que
     es lo que hace que la caida a "el primero" sea la mas cercana.

     Comparte lista con hotelTypeSelectMarkup() y resolveHotelTypeForMeta() a
     proposito. Cuando cada una tenia la suya, resolver podia devolver un tipo
     que el selector no tenia como dibujar: el <select> se quedaba sin nada
     marcado y el navegador tomaba el primer option como elegido, con los
     tarjetas ya filtradas por otro tipo. Es el mismo desajuste, entrando por
     la otra puerta. */
  var HOTEL_TYPE_OPTIONS = ['economico', 'intermedio', 'confort', 'all-inclusive'];
  function inferHotelType(value) {
    var text = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_ ]+/g, '-');
    if (/all-inclusive|todo-incluido/.test(text)) return 'all-inclusive';
    if (/resort/.test(text)) return 'resort';
    if (/boutique/.test(text)) return 'boutique';
    if (/economico|ahorro/.test(text)) return 'economico';
    if (/intermedio|3-estrellas/.test(text)) return 'intermedio';
    if (/confort|premium/.test(text)) return 'confort';
    return '';
  }
  function hotelTypeForStyle(style) { return style === 'ahorro' ? 'economico' : style === 'comodo' ? 'confort' : 'intermedio'; }
  function hotelTypeFactor(type) { return ({ 'all-inclusive': 1.7, resort: 1.35, boutique: 1.22, economico: 0.82, intermedio: 1, confort: 1.3 })[type] || 1; }
  // Los grupos son la primera pantalla de la app: definen que se ofrece. Un
  // destino que esta en model.js pero no aca esta cotizable y no se muestra, que
  // es como Angra, Ilha Grande, Bombinhas, Camboriu, Praia do Rosa, Morro,
  // Maragogi, Recife, Natal, Pipa y Arraial d'Ajuda estuvieron durante meses.
  // prueba-destinos.js corta eso: exige que toda clave de aca exista en DEST.
  //
  // Regional y no por numero de paradas: un grupo con una sola parada hace que
  // la grilla se vea vacia, asi que las paradas sueltas se agrupan con su
  // region. Bahia y Nordeste son los grupos mas largos porque son los que mas
  // ofrecen; el resto tiene entre 1 y 8.
  var DESTINATION_GROUPS = [
    { id: 'rio', label: 'Río de Janeiro', image: 'rio', keys: ['rio'], subcategories: [
{ label: 'Réveillon Copacabana (31/12)', key: 'rio' },
{ label: 'Zona Sur / Ipanema', key: 'rio' },
{ label: 'Centro Histórico', key: 'rio' },
      // Río es un grupo de una sola clave pero su hub (GIG) sirve todo el
      // corredor: Búzios, Arraial, Cabo Frio, Paraty, Ilha Grande y Angra se
      // toman con el mismo vuelo redondo. Antes solo se ofrecían Búzios y
      // Angra, y los otros cuatro quedaban sin poder combinar con la capital.
      // Ubatuba e Ilhabela NO entran acá: vuelan por GRU, asi que un Rio +
      // Ubatuba necesita dos billetes y no es un vuelo redondo.
      { label: 'Río + Búzios', key: 'rio', secondKey: 'buz' },
      { label: 'Río + Arraial do Cabo', key: 'rio', secondKey: 'arraial' },
      { label: 'Río + Cabo Frio', key: 'rio', secondKey: 'cabo' },
      { label: 'Río + Paraty', key: 'rio', secondKey: 'paraty' },
      { label: 'Río + Ilha Grande', key: 'rio', secondKey: 'ilha' },
      { label: 'Río + Angra dos Reis', key: 'rio', secondKey: 'angra' }
    ] },
    { id: 'buzios', label: 'Búzios / Arraial do Cabo / Cabo Frio', image: 'buz', keys: ['buz', 'arraial', 'cabo'], subcategories: [
      // La primera subcategoria es la que abre la tarjeta cuando no hay selector
      // de zona, asi que el par va primero y trae el secondKey. Antes la segunda
      // repetia este mismo nombre y la tapaba: secondKeyForSubcategory() corta en
      // la primera coincidencia, matcheaba la que no lo tenia y devolvia vacio.,
      { label: 'Búzios + Arraial do Cabo', key: 'buz', secondKey: 'arraial' },
      { label: 'Búzios + Cabo Frio', key: 'buz', secondKey: 'cabo' },
      { label: 'Arraial do Cabo + Cabo Frio', key: 'arraial', secondKey: 'cabo' },
{ label: 'Sólo Búzios', key: 'buz' },
{ label: 'Arraial do Cabo', key: 'arraial' },
{ label: 'Ruta de Playas (Cabo Frio)', key: 'cabo' }
    ] },
    { id: 'costaverde', label: 'Costa Verde (Ilhabela / Ubatuba / Paraty)', image: 'ilhabela', keys: ['paraty', 'ubatuba', 'ilhabela', 'angra', 'ilha'], subcategories: [
{ label: 'Paraty Histórico', key: 'paraty' },
{ label: 'Ubatuba Playas', key: 'ubatuba' },
{ label: 'Ilhabela', key: 'ilhabela' },
{ label: 'Angra dos Reis', key: 'angra' },
{ label: 'Ilha Grande', key: 'ilha' },
      { label: 'Paraty + Ubatuba', key: 'paraty', secondKey: 'ubatuba' },
      { label: 'Paraty + Ilhabela', key: 'paraty', secondKey: 'ilhabela' },
      { label: 'Paraty + Angra dos Reis', key: 'paraty', secondKey: 'angra' },
      { label: 'Paraty + Ilha Grande', key: 'paraty', secondKey: 'ilha' },
      { label: 'Ubatuba + Ilhabela', key: 'ubatuba', secondKey: 'ilhabela' },
      { label: 'Ubatuba + Angra dos Reis', key: 'ubatuba', secondKey: 'angra' },
      { label: 'Ubatuba + Ilha Grande', key: 'ubatuba', secondKey: 'ilha' },
      { label: 'Ilhabela + Angra dos Reis', key: 'ilhabela', secondKey: 'angra' },
      { label: 'Ilhabela + Ilha Grande', key: 'ilhabela', secondKey: 'ilha' },
      { label: 'Angra dos Reis + Ilha Grande', key: 'angra', secondKey: 'ilha' }
    ] },
    /* Las tres ciudades que faltan. Todas tenian precio, traslado, actividades,
       guia regional y foto en DEST, pero ninguna estaba en esta lista: cotizaban
       bien y no aparecian en ningun lado. Es el bug que motivo prueba-destinos.js.

       Cada una es un grupo de una sola clave, como Rio, porque son ciudades con
       aeropuerto propio y su propio hotel, no un corredor de playa. Los nombres de
       zona salen de la guia: Sao Paulo tiene GUIAS[sao] escrita, con el Centro, la
       Avenida Paulista, Vila Madalena y Barra Funda de verdad. */
    { id: 'saopaulo', label: 'São Paulo', image: 'sao', keys: ['sao'], subcategories: [
{ label: 'Centro / Avenida Paulista', key: 'sao' },
{ label: 'Vila Madalena', key: 'sao' },
{ label: 'Santana / Barra Funda', key: 'sao' }
    ] },
    { id: 'belohorizonte', label: 'Belo Horizonte', image: 'bho', keys: ['bho'], subcategories: [
{ label: 'Centro / Savassi', key: 'bho' },
{ label: 'Pampulha', key: 'bho' }
    ] },
    { id: 'curitiba', label: 'Curitiba', image: 'curitiba', keys: ['curitiba'], subcategories: [
{ label: 'Centro / Batel', key: 'curitiba' },
{ label: 'Morretes / Serra do Mar', key: 'curitiba' }
    ] },
    { id: 'litoralsc', label: 'Litoral de Santa Catarina', image: 'fln', keys: ['fln', 'bcm', 'camboriu', 'itapema', 'bombinhas', 'garopaba', 'rosa', 'ferrugem', 'picarras'], subcategories: [
{ label: 'Florianópolis (Canasvieiras / Ingleses)', key: 'fln' },
{ label: 'Balneário Camboriú', key: 'bcm' },
      /* Camboriú estaba en el modelo con costo, traslado, guia, tres tours y
         foto, y la app lo usaba para calcular el roadtrip y el bus. Lo que no
         estaba era en ninguna de las dos superficies de eleccion, o sea que
         nadie lo podia elegir: data completa que la app no ofrecia. Entra
         aca y no en un grupo propio porque comparte aeropuerto (FLN) y costa
         con todo el litoral. */
{ label: 'Camboriú', key: 'camboriu' },
{ label: 'Itapema', key: 'itapema' },
{ label: 'Bombinhas', key: 'bombinhas' },
{ label: 'Garopaba', key: 'garopaba' },
{ label: 'Praia do Rosa', key: 'rosa' },
{ label: 'Ferrugem', key: 'ferrugem' },
{ label: 'Piçarras', key: 'picarras' },
      { label: 'Florianópolis + Balneário Camboriú', key: 'fln', secondKey: 'bcm' },
      { label: 'Florianópolis + Camboriú', key: 'fln', secondKey: 'camboriu' },
      { label: 'Florianópolis + Itapema', key: 'fln', secondKey: 'itapema' },
      { label: 'Florianópolis + Bombinhas', key: 'fln', secondKey: 'bombinhas' },
      { label: 'Florianópolis + Garopaba', key: 'fln', secondKey: 'garopaba' },
      { label: 'Florianópolis + Praia do Rosa', key: 'fln', secondKey: 'rosa' },
      { label: 'Florianópolis + Ferrugem', key: 'fln', secondKey: 'ferrugem' },
      { label: 'Florianópolis + Piçarras', key: 'fln', secondKey: 'picarras' },
      /* Balneário Camboriú NO es par de Camboriú: son el mismo pueblo. Sus
         coordenadas estan a 270 metros, asi que el par salia con un traslado de
         0 km. El balneario es el distrito de playa dentro de la ciudad. */
      { label: 'Balneário Camboriú + Itapema', key: 'bcm', secondKey: 'itapema' },
      { label: 'Balneário Camboriú + Bombinhas', key: 'bcm', secondKey: 'bombinhas' },
      { label: 'Balneário Camboriú + Garopaba', key: 'bcm', secondKey: 'garopaba' },
      { label: 'Balneário Camboriú + Praia do Rosa', key: 'bcm', secondKey: 'rosa' },
      { label: 'Balneário Camboriú + Ferrugem', key: 'bcm', secondKey: 'ferrugem' },
      { label: 'Balneário Camboriú + Piçarras', key: 'bcm', secondKey: 'picarras' },
      { label: 'Camboriú + Itapema', key: 'camboriu', secondKey: 'itapema' },
      { label: 'Camboriú + Bombinhas', key: 'camboriu', secondKey: 'bombinhas' },
      { label: 'Camboriú + Garopaba', key: 'camboriu', secondKey: 'garopaba' },
      { label: 'Camboriú + Praia do Rosa', key: 'camboriu', secondKey: 'rosa' },
      { label: 'Camboriú + Ferrugem', key: 'camboriu', secondKey: 'ferrugem' },
      { label: 'Camboriú + Piçarras', key: 'camboriu', secondKey: 'picarras' },
      { label: 'Itapema + Bombinhas', key: 'itapema', secondKey: 'bombinhas' },
      { label: 'Itapema + Garopaba', key: 'itapema', secondKey: 'garopaba' },
      { label: 'Itapema + Praia do Rosa', key: 'itapema', secondKey: 'rosa' },
      { label: 'Itapema + Ferrugem', key: 'itapema', secondKey: 'ferrugem' },
      { label: 'Itapema + Piçarras', key: 'itapema', secondKey: 'picarras' },
      { label: 'Bombinhas + Garopaba', key: 'bombinhas', secondKey: 'garopaba' },
      { label: 'Bombinhas + Praia do Rosa', key: 'bombinhas', secondKey: 'rosa' },
      { label: 'Bombinhas + Ferrugem', key: 'bombinhas', secondKey: 'ferrugem' },
      { label: 'Bombinhas + Piçarras', key: 'bombinhas', secondKey: 'picarras' },
      { label: 'Garopaba + Praia do Rosa', key: 'garopaba', secondKey: 'rosa' },
      { label: 'Garopaba + Ferrugem', key: 'garopaba', secondKey: 'ferrugem' },
      { label: 'Garopaba + Piçarras', key: 'garopaba', secondKey: 'picarras' },
      { label: 'Praia do Rosa + Ferrugem', key: 'rosa', secondKey: 'ferrugem' },
      { label: 'Praia do Rosa + Piçarras', key: 'rosa', secondKey: 'picarras' },
      { label: 'Ferrugem + Piçarras', key: 'ferrugem', secondKey: 'picarras' }
    ] },
    { id: 'litoralrs', label: 'Litoral de Rio Grande do Sul', image: 'gram', keys: ['torres', 'canoa'], subcategories: [
{ label: 'Torres', key: 'torres' },
{ label: 'Capão da Canoa', key: 'canoa' },
      { label: 'Torres + Capão da Canoa', key: 'torres', secondKey: 'canoa' }
    ] },
    { id: 'bahia', label: 'Bahía', image: 'ssa', keys: ['ssa', 'portoseguro', 'forte', 'morro', 'itacare', 'trancoso', 'ajuda'], subcategories: [
{ label: 'Salvador de Bahía', key: 'ssa' },
{ label: 'Porto Seguro', key: 'portoseguro' },
{ label: 'Praia do Forte', key: 'forte' },
{ label: 'Morro de São Paulo', key: 'morro' },
{ label: 'Itacaré', key: 'itacare' },
{ label: 'Trancoso', key: 'trancoso' },
{ label: 'Arraial d\'Ajuda', key: 'ajuda' },
      { label: 'Salvador + Porto Seguro', key: 'ssa', secondKey: 'portoseguro' },
      { label: 'Salvador + Praia do Forte', key: 'ssa', secondKey: 'forte' },
      { label: 'Salvador + Morro de São Paulo', key: 'ssa', secondKey: 'morro' },
      { label: 'Salvador + Itacaré', key: 'ssa', secondKey: 'itacare' },
      { label: 'Salvador + Arraial d\'Ajuda', key: 'ssa', secondKey: 'ajuda' },
      { label: 'Salvador + Trancoso', key: 'ssa', secondKey: 'trancoso' },
      { label: 'Porto Seguro + Praia do Forte', key: 'portoseguro', secondKey: 'forte' },
      { label: 'Porto Seguro + Morro de São Paulo', key: 'portoseguro', secondKey: 'morro' },
      { label: 'Porto Seguro + Itacaré', key: 'portoseguro', secondKey: 'itacare' },
      { label: 'Porto Seguro + Arraial d\'Ajuda', key: 'portoseguro', secondKey: 'ajuda' },
      { label: 'Porto Seguro + Trancoso', key: 'portoseguro', secondKey: 'trancoso' },
      { label: 'Praia do Forte + Morro de São Paulo', key: 'forte', secondKey: 'morro' },
      { label: 'Praia do Forte + Itacaré', key: 'forte', secondKey: 'itacare' },
      { label: 'Praia do Forte + Arraial d\'Ajuda', key: 'forte', secondKey: 'ajuda' },
      { label: 'Praia do Forte + Trancoso', key: 'forte', secondKey: 'trancoso' },
      { label: 'Morro de São Paulo + Itacaré', key: 'morro', secondKey: 'itacare' },
      { label: 'Morro de São Paulo + Arraial d\'Ajuda', key: 'morro', secondKey: 'ajuda' },
      { label: 'Morro de São Paulo + Trancoso', key: 'morro', secondKey: 'trancoso' },
      { label: 'Itacaré + Arraial d\'Ajuda', key: 'itacare', secondKey: 'ajuda' },
      { label: 'Itacaré + Trancoso', key: 'itacare', secondKey: 'trancoso' },
      /* El par de los dos pueblo juntos. Son 7 km por la misma ruta, asi que el
         server lo acepta facil, pero es el viaje que de verdad se hace cuando se
         va a esa costa: dos noches, una en cada uno, y el traslado entre ellos
         son veinte minutos. */
      { label: 'Trancoso + Arraial d\'Ajuda', key: 'trancoso', secondKey: 'ajuda' }
    ] },
    /* Jericoacoara entra al Nordeste y "Fortaleza / Jericoacoara" se separa en
       dos destinos y un par.

       Antes la entrada de Fortaleza se llamaba "Fortaleza / Jericoacoara" y eso
       no decía nada: son dos ciudades a 358 km una de la otra, con precios,
       traslados y actividades propias. Presentadas con una barra, la persona no
       podia saber si el precio era de la capital o del pueblo de las dunas.

       Ahora están los tres: Fortaleza sola, Jericoacoara sola, y el par
       "Fortaleza + Jeri", que es el viaje que de verdad se quiere hacer cuando
       se va a esa costa (volar a FOR, dormir en Jeri y volver). Jericoacoara ya
       estaba en el modelo, con costos, traslados, guia y actividades: lo que no
       estaba era en la lista, o sea que era data muerta.

       Jericoacoara NO entra en las keys del Nordeste, y es a propósito. El
       modelo combina dos paradas si quedan a menos de COMBO_MAX_KM (1.100 km)
       por carretera: de Fortaleza a Jeri son 358, pero de Recife a Jeri son
       1.100 y de Maceío 1.170. Un grupo es un conjunto de destinos que se
       combinan entre sí; Jericoacoara solo se combina con Fortaleza, Natal y
       Pipa, así que si viviera en el Nordeste el grupo prometería ocho
       combinaciones que el server rechaza con un 400. Va como grupo propio y
       los tres pares quedan en el Nordeste, que es el grupo de la primera
       parada. */
    { id: 'nordeste', label: 'Nordeste', image: 'porto', keys: ['porto', 'maragogi', 'mcz', 'rec', 'joaopessoa', 'nat', 'pip', 'for', 'fernando'], subcategories: [
{ label: 'Porto de Galinhas (All Inclusive)', key: 'porto', hotelType: 'all-inclusive' },
{ label: 'Maragogi', key: 'maragogi' },
{ label: 'Maceió (Resort)', key: 'mcz', hotelType: 'resort' },
{ label: 'Recife', key: 'rec' },
{ label: 'João Pessoa', key: 'joaopessoa' },
{ label: 'Natal', key: 'nat' },
{ label: 'Pipa', key: 'pip' },
{ label: 'Fortaleza', key: 'for' },
/* Fernando de Noronha entra al Nordeste pero SIN pares de dos paradas, y eso es
   correcto: es una isla a 350 km de la costa y se llega en vuelo desde REC. No
   tiene coordenadas en DEST_COORDS a proposito, y por eso comboTransfer()
   devuelve null para cualquier par que lo toque. Es el mismo criterio que
   Jericoacoara, que esta en este grupo de pares pero tiene grupo propio para la
   tarjeta. Si se le agregara la coordenada, la distancia en linea recta la
   pondria a menos de 1.100 km de Recife y habria que offerentar un "Fernando +
   Recife" que es un vuelo de una hora, no un transfer. */
{ label: 'Fernando de Noronha', key: 'fernando' },
      { label: 'Porto de Galinhas + Maragogi', key: 'porto', secondKey: 'maragogi' },
      { label: 'Porto de Galinhas + Maceió', key: 'porto', secondKey: 'mcz' },
      { label: 'Porto de Galinhas + Recife', key: 'porto', secondKey: 'rec' },
      { label: 'Porto de Galinhas + João Pessoa', key: 'porto', secondKey: 'joaopessoa' },
      { label: 'Porto de Galinhas + Natal', key: 'porto', secondKey: 'nat' },
      { label: 'Porto de Galinhas + Pipa', key: 'porto', secondKey: 'pip' },
      { label: 'Porto de Galinhas + Fortaleza', key: 'porto', secondKey: 'for' },
      { label: 'Maragogi + Maceió', key: 'maragogi', secondKey: 'mcz' },
      { label: 'Maragogi + Recife', key: 'maragogi', secondKey: 'rec' },
      { label: 'Maragogi + João Pessoa', key: 'maragogi', secondKey: 'joaopessoa' },
      { label: 'Maragogi + Natal', key: 'maragogi', secondKey: 'nat' },
      { label: 'Maragogi + Pipa', key: 'maragogi', secondKey: 'pip' },
      { label: 'Maragogi + Fortaleza', key: 'maragogi', secondKey: 'for' },
      { label: 'Maceió + Recife', key: 'mcz', secondKey: 'rec' },
      { label: 'Maceió + João Pessoa', key: 'mcz', secondKey: 'joaopessoa' },
      { label: 'Maceió + Natal', key: 'mcz', secondKey: 'nat' },
      { label: 'Maceió + Pipa', key: 'mcz', secondKey: 'pip' },
      { label: 'Maceió + Fortaleza', key: 'mcz', secondKey: 'for' },
      { label: 'Recife + João Pessoa', key: 'rec', secondKey: 'joaopessoa' },
      { label: 'Recife + Natal', key: 'rec', secondKey: 'nat' },
      { label: 'Recife + Pipa', key: 'rec', secondKey: 'pip' },
      { label: 'Recife + Fortaleza', key: 'rec', secondKey: 'for' },
      { label: 'João Pessoa + Natal', key: 'joaopessoa', secondKey: 'nat' },
      { label: 'João Pessoa + Pipa', key: 'joaopessoa', secondKey: 'pip' },
      { label: 'João Pessoa + Fortaleza', key: 'joaopessoa', secondKey: 'for' },
      { label: 'Natal + Pipa', key: 'nat', secondKey: 'pip' },
      { label: 'Natal + Fortaleza', key: 'nat', secondKey: 'for' },
      { label: 'Pipa + Fortaleza', key: 'pip', secondKey: 'for' },
      { label: 'Fortaleza + Jeri', key: 'for', secondKey: 'jericoacoara' },
      { label: 'Natal + Jeri', key: 'nat', secondKey: 'jericoacoara' },
      { label: 'Pipa + Jeri', key: 'pip', secondKey: 'jericoacoara' }
    ] },
    // Jericoacoara tiene grupo propio y no comparte con el Nordeste. Vive por
    // su cuenta en Ceará, a 358 km de Fortaleza y a mas de 1.100 de Recife, asi
    // que es el unico destino del grupo y por eso no tiene ni un par con nadie
    // de Bahia ni del Noreste. Los tres pares que si se pueden hacer (con
    // Fortaleza, Natal y Pipa) son subcategorias del Nordeste, que es el grupo de
    // la primera parada, y por eso el menu de segunda parada los ofrece igual.
    { id: 'jericoacoara', label: 'Jericoacoara', image: 'jericoacoara', keys: ['jericoacoara'], subcategories: [
{ label: 'Jericoacoara', key: 'jericoacoara' }
    ] },
    { id: 'buenosaires', label: 'Buenos Aires', image: 'bue', keys: ['bue'], subcategories: [
{ label: 'Centro / Recoleta', key: 'bue' },
{ label: 'Palermo / Zona Norte', key: 'bue' },
{ label: 'Escapada de Fin de Semana', key: 'bue' }
    ] },
    { id: 'gramado', label: 'Porto Alegre / Gramado / Canela', image: 'gram', keys: ['poa', 'gram', 'canela'], subcategories: [
{ label: 'Porto Alegre', key: 'poa' },
{ label: 'Gramado Centro', key: 'gram' },
{ label: 'Vale dos Vinhedos', key: 'gram' },
{ label: 'Canela', key: 'canela' },
      { label: 'Porto Alegre + Gramado', key: 'poa', secondKey: 'gram' },
      { label: 'Porto Alegre + Canela', key: 'poa', secondKey: 'canela' },
      { label: 'Gramado + Canela', key: 'gram', secondKey: 'canela' }
    ] },
    { id: 'foz', label: 'Foz de Iguaçu', image: 'igu', keys: ['igu'], subcategories: [
{ label: 'Cataratas (lado brasileño)', key: 'igu' },
{ label: 'Parque das Aves', key: 'igu' }
    ] }
  ];
  // Antes esta seccion rotaba 3 o 4 destinos por mes (esta tabla) para que la
  // vitrina no fuera siempre la misma. Se mostraba tan poco que la pagina parecia
  // no tener mas destinos, asi que ahora entran todos los grupos y los tabs de
  // mes solo cambian las fechas y el precio de cada tarjeta.
  var BRASIL_DEFAULT_COSTS = {
    beach: {
      flightUsd: 460,
      hotelPerNightUsd: 120,
      foodPerDayUsd: 55,
      localPerDayUsd: 18,
      airportTransferUsd: 70,
      baggageAndInsuranceUsd: 65
    },
    city: {
      flightUsd: 390,
      hotelPerNightUsd: 140,
      foodPerDayUsd: 68,
      localPerDayUsd: 26,
      airportTransferUsd: 80,
      baggageAndInsuranceUsd: 75
    }
  };
  // Los costos diarios por destino NO viven acá: viven en public/daily-costs.js,
  // que se genera desde lib/model.js con `npm run build:costos`. Estaban escritos
  // a mano en los dos archivos y ya divergieron una vez (el cliente se quedó
  // destinos atrás y cotizaba con números de Río de Janeiro en silencio, porque
  // las dos tablas caían al fallback de rio sin dar error). Una sola fuente.
  var DESTINATION_DAILY_COSTS = window.CS_DESTINATION_DAILY_COSTS || {};
  if (!window.CS_DESTINATION_DAILY_COSTS) {
    console.error('Falta /daily-costs.js: corré npm run build:costos y serví el archivo generado.');
  }
  // La procedencia de esos mismos números (de dónde sale, cuándo se verificó y
  // cuánta confianza tiene) la sigue generando `npm run build:costos` y
  // `npm run build:transfer` en el mismo archivo, y validar-costos.js y
  // validar-transfer.js la siguen comprobando. Lo que ya no se dibuja es el
  // panel "De dónde salen los valores": era el único consumidor, así que en el
  // cliente ya no queda nadie que lea esos dos globales.
  function getDestinationDailyCosts(key) { return DESTINATION_DAILY_COSTS[String(key || '').toLowerCase()] || DESTINATION_DAILY_COSTS.rio; }
  var massSearch = false;
  var detailState = null;
  /* Qué rubros del viaje ya están reservados, para el "Reservado" del voucher.
     Vive fuera de detailState a propósito: detailState se re-crea entero con
     cada propuesta nueva (showProposalView), y se re-pinta entero con cada
     recálculo, así que colgarlo ahí lo borraba. Acá sobrevive a los dos.
     { viajeId: <uuid del viaje>, categorias: { traslados: true, ... } } */
  var reservasViaje = { viajeId: null, categorias: {} };
  /* Si quien mira es de la agencia. Lo decide la base, no esta pagina: el
     navegador es del cliente y se lo puede editar, asi que un `if` acá no
     significaria nada. Es una consulta al JWT, se hace una vez por sesión y se
     cachea acá. While esto sea false, el voucher no muestra los controles de
     "Reservado" a mano. */
  var soyAgencia = false;
  var agenciaConsultado = false;
  async function esAgencia() {
    if (agenciaConsultado) return soyAgencia;
    if (!supabaseClient) return false;
    try {
      var r = await supabaseClient.rpc('es_agencia');
      soyAgencia = !!(r.data && r.data === true);
    } catch (e) { soyAgencia = false; }
    // Sin sesión no se cachea: es_agencia() responde por el JWT, así que sin
    // token da false siempre y cachearlo dejaba ese false pegado. El false de
    // verdad —logueado y no es de la agencia— sí se cachea, que para eso está el
    // flag: es la consulta que decide si las filas traen el control.
    agenciaConsultado = !!authUser;
    return soyAgencia;
  }
  var ROADTRIP_VEHICLES = { onix: 13, gol: 12, argo: 12.5, hilux: 9, kwid: 15 };
  // Consumo (kWh cada 100 km) y capacidad de batería de modelos populares en
  // la región. Son specs de fábrica publicadas, no telemetría real: quedan
  // como punto de partida editable, igual que el km/l de los combustión.
  var EV_VEHICLES = {
    kwid_etech: { label: 'Renault Kwid E-Tech · 12 kWh/100km', kwhPer100km: 12, batteryKwh: 26.8 },
    byd_dolphin: { label: 'BYD Dolphin · 15 kWh/100km', kwhPer100km: 15, batteryKwh: 44.9 },
    byd_yuanplus: { label: 'BYD Yuan Plus (Atto 3) · 16 kWh/100km', kwhPer100km: 16, batteryKwh: 60.5 },
    bolt: { label: 'Chevrolet Bolt EV · 17 kWh/100km', kwhPer100km: 17, batteryKwh: 65 },
    model3: { label: 'Tesla Model 3 · 14 kWh/100km', kwhPer100km: 14, batteryKwh: 57.5 }
  };
  var DEFAULT_KWH_PRICE_USD = 0.35;
  // Plan de paradas puramente aritmético a partir del rango de la batería o
  // de un umbral de fatiga (combustión): no conocemos la ubicación real de
  // cargadores en la ruta, así que nunca inventamos nombres de estaciones.
  function roadtripStopsPlan(roundTripKm, isEv, usableRangeKm) {
    var stepKm = isEv ? Math.max(50, usableRangeKm) : 400;
    var legs = Math.max(1, Math.ceil(roundTripKm / stepKm));
    return { stops: Math.max(0, legs - 1), everyKm: Math.round(roundTripKm / legs), minutesPerStop: isEv ? 35 : 15 };
  }
  // Separado de roadtripCalculator para poder recalcularlo en vivo cuando
  // cambia el modelo eléctrico (autonomía distinta) sin re-renderizar toda
  // la sección de transporte.
  //
  // Acá NO se listan cargadores, y es a propósito. Se intentó: la app consultaba
  // Open Charge Map y pintaba una lista, pero la base sólo tiene cargadores
  // alrededor del destino. Para Montevideo -> Florianópolis (1245 km de ida)
  // se midió el corredor y hay 3 cargadores en total, dos de ellos fuera de la
  // ruta: no alcanza ni para una lista útil. Peor todavía, una lista de
  // "paradas" que en realidad son estaciones donde ya llegaste hace pensar que
  // el trayecto está cubierto cuando no lo está.
  //
  // Lo que sí es calculable y sí le sirve a la persona es cuántas cargas va a
  // needing y cada cuántos kilómetros. Eso sale de la autonomía real del
  // modelo, y para el resto la mandamos a las apps que sí tienen el mapa.
  function roadtripStopsInnerHtml(stopsPlan, isEv) {
    var title = isEv
      ? '🔌 Plan de carga: parar cada ' + stopsPlan.everyKm + ' km'
      : '☕ Paradas de descanso en la ruta (' + stopsPlan.stops + ')';
    return '<summary>' + title + '</summary><div class="roadtrip-stops__body">' +
      (stopsPlan.stops > 0
        ? '<p>Te conviene parar cada <b>~' + stopsPlan.everyKm + ' km</b>, unos <b>' + stopsPlan.minutesPerStop + ' min</b> por parada' + (isEv ? ' para recargar.' : ' para descansar.') + '</p>'
        : '<p>La distancia entra en un solo tramo sin paradas obligatorias' + (isEv ? ', pero salir con la batería llena es buena idea.' : '.') + '</p>') +
      (isEv
        ? '<p>Son <b>' + stopsPlan.stops + ' cargas</b> de ida y vuelta. Para elegir dónde recargar, mirá el trayecto en <a href="https://www.google.com/maps/dir/?api=1" target="_blank" rel="noopener noreferrer">Google Maps</a> filtrando por "carga de vehículos eléctricos", o usá <a href="https://www.electromaps.com" target="_blank" rel="noopener noreferrer">Electromaps</a> o <a href="https://www.plugshare.com" target="_blank" rel="noopener noreferrer">PlugShare</a>, que tienen el mapa de todo el camino.</p>'
          + '<p class="cost-note">* No te mostramos una lista de estaciones a propósito: no tenemos una fuente con los cargadores del corredor y una lista incompleta haría creer que el viaje está cubierto. La autonomía y el número de carga son un cálculo con el rango real del modelo, no una consulta.</p>'
        : '<p class="cost-note">* Son paradas de descanso sugeridas por fatiga en viajes largos, no un tramo obligatorio.</p>') +
      '</div>';
  }
  // Códigos IATA usados por el buscador de vuelos. Se mantienen en el cliente
  // porque /api/cotizar devuelve el nombre del destino para la interfaz.
  var IATA_BY_DEST = { bue: 'EZE', buz: 'GIG', arraial: 'GIG', cabo: 'GIG', ilha: 'GIG', paraty: 'GIG', ilhabela: 'GRU', ubatuba: 'GRU', rio: 'GIG', angra: 'GIG', sao: 'GRU', bho: 'CNF', curitiba: 'CWB', porto: 'REC', mcz: 'MCZ', maragogi: 'MCZ', nat: 'NAT', pip: 'NAT', trancoso: 'SSA', ajuda: 'SSA', ssa: 'SSA', for: 'FOR', jericoacoara: 'FOR', morro: 'SSA', fernando: 'FEN', fln: 'FLN', camboriu: 'FLN', bombinhas: 'FLN', rosa: 'FLN', bcm: 'FLN', gram: 'POA', canela: 'POA', igu: 'IGU', rec: 'REC', poa: 'POA', portoseguro: 'SSA', itacare: 'SSA', forte: 'SSA', itapema: 'FLN', garopaba: 'FLN', ferrugem: 'FLN', picarras: 'FLN', torres: 'POA', canoa: 'POA', joaopessoa: 'JPA' };
  var DEST_IATA_ALIASES = { bue: 'EZE AEP BUE', rio: 'RIO GIG', buz: 'GIG', arraial: 'GIG', cabo: 'GIG', porto: 'REC', mcz: 'MCZ', ssa: 'SSA', fln: 'FLN', ilhabela: 'GRU', ubatuba: 'GRU', paraty: 'GIG' };
  // Segunda superficie: el desplegable de "destino" de arriba. Tiene que traer
  // los mismos 31 que la grilla, o el destino se ofrece en un lado y no en el
  // otro. Se organiza por hub de vuelo, que es como la persona elige de verdad
  // (mismo vuelo, distinto destino), y no por region como la grilla.
  var DESTINATION_HUBS = [
    { name: 'Río de Janeiro', codes: 'GIG / SDU', options: [
{ label: 'Río de Janeiro (Centro / Sur)', key: 'rio', codes: 'RIO GIG SDU', subcategory: 'Zona Sur / Ipanema' },
{ label: 'Búzios', key: 'buz', codes: 'GIG SDU' },
{ label: 'Arraial do Cabo', key: 'arraial', codes: 'GIG SDU' },
{ label: 'Cabo Frio', key: 'cabo', codes: 'GIG SDU' },
{ label: 'Ilha Grande', key: 'ilha', codes: 'GIG SDU' },
{ label: 'Angra dos Reis', key: 'angra', codes: 'GIG SDU' },
      { label: 'Búzios + Arraial do Cabo', key: 'buz', codes: 'GIG SDU', subcategory: 'Búzios + Arraial do Cabo' },
      { label: 'Búzios + Cabo Frio', key: 'buz', codes: 'GIG SDU', subcategory: 'Búzios + Cabo Frio' },
      { label: 'Arraial do Cabo + Cabo Frio', key: 'arraial', codes: 'GIG SDU', subcategory: 'Arraial do Cabo + Cabo Frio' },
      { label: 'Angra dos Reis + Ilha Grande', key: 'angra', codes: 'GIG SDU', subcategory: 'Angra dos Reis + Ilha Grande' },
      { label: 'Río + Búzios', key: 'rio', codes: 'GIG SDU', subcategory: 'Río + Búzios' },
      { label: 'Río + Arraial do Cabo', key: 'rio', codes: 'GIG SDU', subcategory: 'Río + Arraial do Cabo' },
      { label: 'Río + Cabo Frio', key: 'rio', codes: 'GIG SDU', subcategory: 'Río + Cabo Frio' },
      { label: 'Río + Paraty', key: 'rio', codes: 'GIG SDU', subcategory: 'Río + Paraty' },
      { label: 'Río + Ilha Grande', key: 'rio', codes: 'GIG SDU', subcategory: 'Río + Ilha Grande' },
      { label: 'Río + Angra dos Reis', key: 'rio', codes: 'GIG SDU', subcategory: 'Río + Angra dos Reis' }
    ] },
    { name: 'San Pablo', codes: 'GRU / CGH', options: [
{ label: 'Ilhabela', key: 'ilhabela', codes: 'GRU CGH' },
{ label: 'Ubatuba', key: 'ubatuba', codes: 'GRU CGH' },
{ label: 'Paraty', key: 'paraty', codes: 'GRU CGH' },
      { label: 'Paraty + Ubatuba', key: 'paraty', codes: 'GRU CGH', subcategory: 'Paraty + Ubatuba' },
      { label: 'Paraty + Ilhabela', key: 'paraty', codes: 'GRU CGH', subcategory: 'Paraty + Ilhabela' },
      { label: 'Paraty + Angra dos Reis', key: 'paraty', codes: 'GRU CGH', subcategory: 'Paraty + Angra dos Reis' },
      { label: 'Paraty + Ilha Grande', key: 'paraty', codes: 'GRU CGH', subcategory: 'Paraty + Ilha Grande' },
      { label: 'Ubatuba + Ilhabela', key: 'ubatuba', codes: 'GRU CGH', subcategory: 'Ubatuba + Ilhabela' },
      { label: 'Ubatuba + Angra dos Reis', key: 'ubatuba', codes: 'GRU CGH', subcategory: 'Ubatuba + Angra dos Reis' },
      { label: 'Ubatuba + Ilha Grande', key: 'ubatuba', codes: 'GRU CGH', subcategory: 'Ubatuba + Ilha Grande' },
      { label: 'Ilhabela + Angra dos Reis', key: 'ilhabela', codes: 'GRU CGH', subcategory: 'Ilhabela + Angra dos Reis' },
      { label: 'Ilhabela + Ilha Grande', key: 'ilhabela', codes: 'GRU CGH', subcategory: 'Ilhabela + Ilha Grande' }
    ] },
    { name: 'Santa Catarina', codes: 'FLN', options: [
{ label: 'Florianópolis', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis (Canasvieiras / Ingleses)' },
{ label: 'Balneário Camboriú', key: 'bcm', codes: 'FLN' },
{ label: 'Camboriú', key: 'camboriu', codes: 'FLN' },
{ label: 'Itapema', key: 'itapema', codes: 'FLN' },
{ label: 'Bombinhas', key: 'bombinhas', codes: 'FLN' },
{ label: 'Garopaba', key: 'garopaba', codes: 'FLN' },
{ label: 'Praia do Rosa', key: 'rosa', codes: 'FLN' },
{ label: 'Ferrugem', key: 'ferrugem', codes: 'FLN' },
{ label: 'Piçarras', key: 'picarras', codes: 'FLN' },
      { label: 'Florianópolis + Balneário Camboriú', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Balneário Camboriú' },
      { label: 'Florianópolis + Camboriú', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Camboriú' },
      { label: 'Florianópolis + Itapema', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Itapema' },
      { label: 'Florianópolis + Bombinhas', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Bombinhas' },
      { label: 'Florianópolis + Garopaba', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Garopaba' },
      { label: 'Florianópolis + Praia do Rosa', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Praia do Rosa' },
      { label: 'Florianópolis + Ferrugem', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Ferrugem' },
      { label: 'Florianópolis + Piçarras', key: 'fln', codes: 'FLN', subcategory: 'Florianópolis + Piçarras' },
      { label: 'Camboriú + Itapema', key: 'camboriu', codes: 'FLN', subcategory: 'Camboriú + Itapema' },
      { label: 'Camboriú + Bombinhas', key: 'camboriu', codes: 'FLN', subcategory: 'Camboriú + Bombinhas' },
      { label: 'Camboriú + Garopaba', key: 'camboriu', codes: 'FLN', subcategory: 'Camboriú + Garopaba' },
      { label: 'Camboriú + Praia do Rosa', key: 'camboriu', codes: 'FLN', subcategory: 'Camboriú + Praia do Rosa' },
      { label: 'Camboriú + Ferrugem', key: 'camboriu', codes: 'FLN', subcategory: 'Camboriú + Ferrugem' },
      { label: 'Camboriú + Piçarras', key: 'camboriu', codes: 'FLN', subcategory: 'Camboriú + Piçarras' },
      { label: 'Balneário Camboriú + Itapema', key: 'bcm', codes: 'FLN', subcategory: 'Balneário Camboriú + Itapema' },
      { label: 'Balneário Camboriú + Bombinhas', key: 'bcm', codes: 'FLN', subcategory: 'Balneário Camboriú + Bombinhas' },
      { label: 'Balneário Camboriú + Garopaba', key: 'bcm', codes: 'FLN', subcategory: 'Balneário Camboriú + Garopaba' },
      { label: 'Balneário Camboriú + Praia do Rosa', key: 'bcm', codes: 'FLN', subcategory: 'Balneário Camboriú + Praia do Rosa' },
      { label: 'Balneário Camboriú + Ferrugem', key: 'bcm', codes: 'FLN', subcategory: 'Balneário Camboriú + Ferrugem' },
      { label: 'Balneário Camboriú + Piçarras', key: 'bcm', codes: 'FLN', subcategory: 'Balneário Camboriú + Piçarras' },
      { label: 'Itapema + Bombinhas', key: 'itapema', codes: 'FLN', subcategory: 'Itapema + Bombinhas' },
      { label: 'Itapema + Garopaba', key: 'itapema', codes: 'FLN', subcategory: 'Itapema + Garopaba' },
      { label: 'Itapema + Praia do Rosa', key: 'itapema', codes: 'FLN', subcategory: 'Itapema + Praia do Rosa' },
      { label: 'Itapema + Ferrugem', key: 'itapema', codes: 'FLN', subcategory: 'Itapema + Ferrugem' },
      { label: 'Itapema + Piçarras', key: 'itapema', codes: 'FLN', subcategory: 'Itapema + Piçarras' },
      { label: 'Bombinhas + Garopaba', key: 'bombinhas', codes: 'FLN', subcategory: 'Bombinhas + Garopaba' },
      { label: 'Bombinhas + Praia do Rosa', key: 'bombinhas', codes: 'FLN', subcategory: 'Bombinhas + Praia do Rosa' },
      { label: 'Bombinhas + Ferrugem', key: 'bombinhas', codes: 'FLN', subcategory: 'Bombinhas + Ferrugem' },
      { label: 'Bombinhas + Piçarras', key: 'bombinhas', codes: 'FLN', subcategory: 'Bombinhas + Piçarras' },
      { label: 'Garopaba + Praia do Rosa', key: 'garopaba', codes: 'FLN', subcategory: 'Garopaba + Praia do Rosa' },
      { label: 'Garopaba + Ferrugem', key: 'garopaba', codes: 'FLN', subcategory: 'Garopaba + Ferrugem' },
      { label: 'Garopaba + Piçarras', key: 'garopaba', codes: 'FLN', subcategory: 'Garopaba + Piçarras' },
      { label: 'Praia do Rosa + Ferrugem', key: 'rosa', codes: 'FLN', subcategory: 'Praia do Rosa + Ferrugem' },
      { label: 'Praia do Rosa + Piçarras', key: 'rosa', codes: 'FLN', subcategory: 'Praia do Rosa + Piçarras' },
      { label: 'Ferrugem + Piçarras', key: 'ferrugem', codes: 'FLN', subcategory: 'Ferrugem + Piçarras' }
    ] },
    { name: 'Rio Grande do Sul', codes: 'POA', options: [
{ label: 'Torres', key: 'torres', codes: 'POA' },
{ label: 'Capão da Canoa', key: 'canoa', codes: 'POA' },
      { label: 'Torres + Capão da Canoa', key: 'torres', codes: 'POA', subcategory: 'Torres + Capão da Canoa' }
    ] },
    { name: 'Bahía', codes: 'SSA', options: [
{ label: 'Salvador de Bahía', key: 'ssa', codes: 'SSA' },
{ label: 'Porto Seguro', key: 'portoseguro', codes: 'SSA' },
{ label: 'Praia do Forte', key: 'forte', codes: 'SSA' },
{ label: 'Morro de São Paulo', key: 'morro', codes: 'SSA' },
{ label: 'Itacaré', key: 'itacare', codes: 'SSA' },
{ label: 'Trancoso', key: 'trancoso', codes: 'SSA' },
{ label: 'Arraial d\'Ajuda', key: 'ajuda', codes: 'SSA' },
      { label: 'Salvador + Porto Seguro', key: 'ssa', codes: 'SSA', subcategory: 'Salvador + Porto Seguro' },
      { label: 'Salvador + Praia do Forte', key: 'ssa', codes: 'SSA', subcategory: 'Salvador + Praia do Forte' },
      { label: 'Salvador + Morro de São Paulo', key: 'ssa', codes: 'SSA', subcategory: 'Salvador + Morro de São Paulo' },
      { label: 'Salvador + Itacaré', key: 'ssa', codes: 'SSA', subcategory: 'Salvador + Itacaré' },
      { label: 'Salvador + Arraial d\'Ajuda', key: 'ssa', codes: 'SSA', subcategory: 'Salvador + Arraial d\'Ajuda' },
      { label: 'Salvador + Trancoso', key: 'ssa', codes: 'SSA', subcategory: 'Salvador + Trancoso' },
      { label: 'Porto Seguro + Praia do Forte', key: 'portoseguro', codes: 'SSA', subcategory: 'Porto Seguro + Praia do Forte' },
      { label: 'Porto Seguro + Morro de São Paulo', key: 'portoseguro', codes: 'SSA', subcategory: 'Porto Seguro + Morro de São Paulo' },
      { label: 'Porto Seguro + Itacaré', key: 'portoseguro', codes: 'SSA', subcategory: 'Porto Seguro + Itacaré' },
      { label: 'Porto Seguro + Arraial d\'Ajuda', key: 'portoseguro', codes: 'SSA', subcategory: 'Porto Seguro + Arraial d\'Ajuda' },
      { label: 'Porto Seguro + Trancoso', key: 'portoseguro', codes: 'SSA', subcategory: 'Porto Seguro + Trancoso' },
      { label: 'Praia do Forte + Morro de São Paulo', key: 'forte', codes: 'SSA', subcategory: 'Praia do Forte + Morro de São Paulo' },
      { label: 'Praia do Forte + Itacaré', key: 'forte', codes: 'SSA', subcategory: 'Praia do Forte + Itacaré' },
      { label: 'Praia do Forte + Arraial d\'Ajuda', key: 'forte', codes: 'SSA', subcategory: 'Praia do Forte + Arraial d\'Ajuda' },
      { label: 'Praia do Forte + Trancoso', key: 'forte', codes: 'SSA', subcategory: 'Praia do Forte + Trancoso' },
      { label: 'Morro de São Paulo + Itacaré', key: 'morro', codes: 'SSA', subcategory: 'Morro de São Paulo + Itacaré' },
      { label: 'Morro de São Paulo + Arraial d\'Ajuda', key: 'morro', codes: 'SSA', subcategory: 'Morro de São Paulo + Arraial d\'Ajuda' },
      { label: 'Morro de São Paulo + Trancoso', key: 'morro', codes: 'SSA', subcategory: 'Morro de São Paulo + Trancoso' },
      { label: 'Itacaré + Arraial d\'Ajuda', key: 'itacare', codes: 'SSA', subcategory: 'Itacaré + Arraial d\'Ajuda' },
      { label: 'Itacaré + Trancoso', key: 'itacare', codes: 'SSA', subcategory: 'Itacaré + Trancoso' },
      { label: 'Trancoso + Arraial d\'Ajuda', key: 'trancoso', codes: 'SSA', subcategory: 'Trancoso + Arraial d\'Ajuda' }
    ] },
    { name: 'Nordeste', codes: 'REC / MCZ / SSA / NAT / JPA / FOR', options: [
{ label: 'Porto de Galinhas', key: 'porto', codes: 'REC' },
{ label: 'Maragogi', key: 'maragogi', codes: 'MCZ' },
{ label: 'Maceió', key: 'mcz', codes: 'MCZ' },
{ label: 'Recife', key: 'rec', codes: 'REC' },
{ label: 'João Pessoa', key: 'joaopessoa', codes: 'JPA' },
{ label: 'Natal', key: 'nat', codes: 'NAT' },
{ label: 'Pipa', key: 'pip', codes: 'NAT' },
// Fernando de Noronha vuela por FEN, su propio aeropuerto, y no se combina con
// nadie en dos paradas porque no hay carretera. Ver el comentario en el grupo.
{ label: 'Fernando de Noronha', key: 'fernando', codes: 'FEN' },
// Fortaleza y Jericoacoara son dos destinos, no uno con barra. Volan al mismo
// aeropuerto (FOR) y por eso van seguido en el mismo hub, pero están a 358 km
// y se cotizan aparte. El par "Fortaleza + Jeri" va con los de dos paradas.
{ label: 'Fortaleza', key: 'for', codes: 'FOR' },
{ label: 'Jericoacoara', key: 'jericoacoara', codes: 'FOR' },
      { label: 'Porto de Galinhas + Maragogi', key: 'porto', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Porto de Galinhas + Maragogi' },
      { label: 'Porto de Galinhas + Maceió', key: 'porto', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Porto de Galinhas + Maceió' },
      { label: 'Porto de Galinhas + Recife', key: 'porto', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Porto de Galinhas + Recife' },
      { label: 'Porto de Galinhas + João Pessoa', key: 'porto', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Porto de Galinhas + João Pessoa' },
      { label: 'Porto de Galinhas + Natal', key: 'porto', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Porto de Galinhas + Natal' },
      { label: 'Porto de Galinhas + Pipa', key: 'porto', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Porto de Galinhas + Pipa' },
      { label: 'Porto de Galinhas + Fortaleza', key: 'porto', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Porto de Galinhas + Fortaleza' },
      { label: 'Maragogi + Maceió', key: 'maragogi', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maragogi + Maceió' },
      { label: 'Maragogi + Recife', key: 'maragogi', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maragogi + Recife' },
      { label: 'Maragogi + João Pessoa', key: 'maragogi', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maragogi + João Pessoa' },
      { label: 'Maragogi + Natal', key: 'maragogi', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maragogi + Natal' },
      { label: 'Maragogi + Pipa', key: 'maragogi', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maragogi + Pipa' },
      { label: 'Maragogi + Fortaleza', key: 'maragogi', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maragogi + Fortaleza' },
      { label: 'Maceió + Recife', key: 'mcz', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maceió + Recife' },
      { label: 'Maceió + João Pessoa', key: 'mcz', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maceió + João Pessoa' },
      { label: 'Maceió + Natal', key: 'mcz', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maceió + Natal' },
      { label: 'Maceió + Pipa', key: 'mcz', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maceió + Pipa' },
      { label: 'Maceió + Fortaleza', key: 'mcz', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Maceió + Fortaleza' },
      { label: 'Recife + João Pessoa', key: 'rec', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Recife + João Pessoa' },
      { label: 'Recife + Natal', key: 'rec', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Recife + Natal' },
      { label: 'Recife + Pipa', key: 'rec', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Recife + Pipa' },
      { label: 'Recife + Fortaleza', key: 'rec', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Recife + Fortaleza' },
      { label: 'João Pessoa + Natal', key: 'joaopessoa', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'João Pessoa + Natal' },
      { label: 'João Pessoa + Pipa', key: 'joaopessoa', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'João Pessoa + Pipa' },
      { label: 'João Pessoa + Fortaleza', key: 'joaopessoa', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'João Pessoa + Fortaleza' },
      { label: 'Natal + Pipa', key: 'nat', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Natal + Pipa' },
      { label: 'Natal + Fortaleza', key: 'nat', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Natal + Fortaleza' },
      { label: 'Pipa + Fortaleza', key: 'pip', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Pipa + Fortaleza' },
      { label: 'Fortaleza + Jeri', key: 'for', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Fortaleza + Jeri' },
      { label: 'Natal + Jeri', key: 'nat', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Natal + Jeri' },
      { label: 'Pipa + Jeri', key: 'pip', codes: 'REC MCZ SSA NAT JPA FOR', subcategory: 'Pipa + Jeri' }
    ] },
    { name: 'Buenos Aires', codes: 'EZE / AEP', options: [
{ label: 'Centro / Recoleta', key: 'bue', codes: 'EZE AEP BUE' },
{ label: 'Palermo / Zona Norte', key: 'bue', codes: 'EZE AEP BUE' },
{ label: 'Escapada de Fin de Semana', key: 'bue', codes: 'EZE AEP BUE', subcategory: 'Escapada de Fin de Semana' }
    ] },
    { name: 'Gramado', codes: 'POA', options: [
      { label: 'Porto Alegre', key: 'poa', codes: 'POA' },
      { label: 'Gramado Centro', key: 'gram', codes: 'POA', subcategory: 'Gramado Centro' },
      { label: 'Vale dos Vinhedos', key: 'gram', codes: 'POA', subcategory: 'Vale dos Vinhedos' },
      { label: 'Canela', key: 'canela', codes: 'POA' },
      { label: 'Porto Alegre + Gramado', key: 'poa', codes: 'POA', subcategory: 'Porto Alegre + Gramado' },
      { label: 'Porto Alegre + Canela', key: 'poa', codes: 'POA', subcategory: 'Porto Alegre + Canela' },
      { label: 'Gramado + Canela', key: 'gram', codes: 'POA', subcategory: 'Gramado + Canela' }
    ] },
    /* Las tres ciudades que se agregaron a la grilla. Cada hub es de una sola
       opcion porque no se combinan con nadie: cada una tiene su aeropuerto
       propio y su corredor, asi que un par de dos paradas seria dos billetes. */
    { name: 'São Paulo', codes: 'GRU', options: [
      { label: 'São Paulo', key: 'sao', codes: 'GRU' }
    ] },
    { name: 'Belo Horizonte', codes: 'CNF', options: [
      { label: 'Belo Horizonte', key: 'bho', codes: 'CNF' }
    ] },
    { name: 'Curitiba', codes: 'CWB', options: [
      { label: 'Curitiba', key: 'curitiba', codes: 'CWB' }
    ] }
  ];
  var ORIGIN_AIRPORTS = { MVD: 'Montevideo (MVD)', PDP: 'Punta del Este (PDP)' };
  function originLabel(code) { return ORIGIN_AIRPORTS[String(code || 'MVD').toUpperCase()] || ORIGIN_AIRPORTS.MVD; }
  function originCityName(code) { return originLabel(code).split(' · ')[0]; }
  // Subcategoría que abre una tarjeta. Sin selector de zona, la tarjeta usa
  // siempre la primera, así que el orden de la lista importa: la que esté
  // primero es la que define el precio que ve la persona. Las fechas ya no
  // salen de acá sino de la ventana del mes, que es la misma para todas las
  // tarjetas de esa ventana.
  //
  // Réveillon es el caso trampa. En DESTINATION_GROUPS la entrada de Río es
  // 'Réveillon Copacabana (31/12)', que sólo tiene sentido a fin de año: si
  // quedara primera todo el año, la tarjeta de Río mostraría Copacabana de
  // Nochevieja en septiembre. Por eso el fin de año sólo se usa en diciembre.
  function featuredSubcategory(group, window) {
    var monthIndex = window ? window.month : new Date().getMonth();
    var list = monthIndex === 10 && group.id === 'nordeste'
      ? group.subcategories.filter(function (item) { return item.key !== 'ssa'; })
      : group.subcategories;
    // Sin normalizar acentos la búsqueda falla: la etiqueta dice "Réveillon"
    // con e acentuada y 'reveillon' plano nunca aparecería.
    var plain = function (item) {
      return String(item.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    };
    var yearEnd = list.filter(function (item) { return plain(item).indexOf('reveillon') >= 0; });
    var regular = list.filter(function (item) { return plain(item).indexOf('reveillon') < 0; });
    if (monthIndex === 11 && yearEnd.length) return yearEnd[0];
    return regular[0] || list[0];
  }
  // Las tarjetas se piden al servidor para mostrar un precio real: el modelo
  // de costos vive en lib/model.js y el cliente no lo puede calcular sin
  // duplicar la lógica (y terminaría mostrando un número que no coincide con
  // el de la propuesta). Se mandan las fechas ya resueltas por tarjeta para
  // que el servidor no tenga que volver a decidir qué fecha va con qué mes.
  function featuredPriceKey(window, subcategory) {
    return {
      key: subcategory.key,
      item: subcategory.key + '~' + window.depIso + '~' + window.retIso + '~' + (subcategory.hotelType || 'intermedio'),
      dates: window
    };
  }
  // Los destinos destacados son la pantalla de inicio: globos de entrada para
  // arrancar una búsqueda. En cuanto hay un resultado real se ocultan, porque
  // una lista de "escapadas que salen menos" arriba del resultado distrae de
  // la propuesta que la persona fue a buscar. Vuelven al limpiar la búsqueda
  // (destino = "todos"), que es el único estado sin resultados.
  function setHighlightsVisible(visible) {
    var section = document.getElementById('destination-highlights');
    if (section) section.hidden = !visible;
  }

  // ---------- viajes de dos paradas ----------

  // La ventana de fechas del mes que está elegido en las pestañas. La comparten
  // las cards de "Ver propuesta" y el selector de segunda parada: tocar
  // cualquiera de las dos cosas tiene que cotizar el mismo viaje, con las mismas
  // fechas.
  function activeFeatureWindow() {
    var tab = document.querySelector('[data-feature-month].is-active');
    var windows = featuredMonthWindows(6);
    return windows[tab ? Number(tab.getAttribute('data-feature-month')) || 0 : 0] || windows[0];
  }

  // Los pares, agrupados por región. La fuente es
  // DESTINATION_GROUPS[].subcategories y no una lista aparte: el selector de
  // segunda parada y las opciones del desplegable de Destino tienen que ofrecer
  // exactamente el mismo conjunto de combinaciones, y duplicar la lista es la
  // forma más corta de que dejen de coincidir.
  //
  // Solo se ofrecen los grupos que tienen al menos un par. Buenos Aires y Foz
  // de Iguazú no tienen ninguno (una sola parada cada uno) y un encabezado con
  // cero opciones debajo se ve como un error.
  function comboGroups() {
    return DESTINATION_GROUPS.map(function (group) {
      return { group: group, pairs: (group.subcategories || []).filter(function (sub) { return !!sub.secondKey; }) };
    }).filter(function (entry) { return entry.pairs.length; });
  }

  function renderDestinationHighlights(windowIndex, pricedByKey) {
    var root = document.getElementById('destination-highlights');
    if (!root) return;
    var windows = featuredMonthWindows(6);
    var index = Math.max(0, Math.min(windows.length - 1, Number(windowIndex) || 0));
    var window = windows[index];
    var monthIndex = window.month;
    // Todos los grupos, siempre. El tab de mes cambia las fechas y el precio de
    // cada tarjeta, no qué destinos se ofrecen: por eso ya no se filtra nada.
    var groups = DESTINATION_GROUPS;
    // Las seis pestañas, de ahora hacia adelante. El mes actual va primero y
    // queda marcado: no tiene sentido ofrecer enero cuando estamos en
    // septiembre, ni un destino de diciembre para alguien que viaja en marzo.
    var tabs = windows.map(function (w, i) {
      var isCurrent = i === 0;
      var special = w.label !== 'Fin de semana';
      var name = MONTH_NAMES[w.month].charAt(0).toUpperCase() + MONTH_NAMES[w.month].slice(1, 3);
      return '<button type="button" class="featured-month' + (i === index ? ' is-active' : '') + (special ? ' is-special' : '') + '"'
        + ' data-feature-month="' + i + '" aria-pressed="' + (i === index) + '"'
        + ' title="' + esc(MONTH_NAMES[w.month] + ' ' + w.year + ' — ' + w.label) + '">'
        + '<b>' + esc(name) + '</b><small>' + esc(isCurrent ? 'Este mes' : w.label) + '</small></button>';
    }).join('');
    // Cada tarjeta se precifica con la misma zona que abriría "Ver propuesta",
    // así el número de la tarjeta y el de la propuesta nunca se contradicen.
    var priced = groups.map(function (group) {
      return { group: group, first: featuredPriceKey(window, featuredSubcategory(group, window)) };
    });
    // Ordenamos por precio ascendente: la sección se llama "más económicos", así
    // que lo más barato tiene que verse primero. Los que aún no tienen precio
    // (endpoint caído) se quedan al final, en el orden en que vinieron.
    var ordered = priced.slice().sort(function (a, b) {
      var pa = pricedByKey && pricedByKey[a.first.key], pb = pricedByKey && pricedByKey[b.first.key];
      if (!pa || !pb) return (pa ? -1 : 0) - (pb ? -1 : 0) || 0;
      return pa - pb;
    });
    var cheapestKey = ordered.length && pricedByKey ? ordered.filter(function (entry) { return pricedByKey[entry.first.key]; })[0].first.key : null;
    var cards = ordered.map(function (entry) {
      var group = entry.group, first = entry.first;
      var photo = DEST_PHOTOS[group.image];
      // El grupo puede traer varias zonas pegadas ("Búzios / Arraial do Cabo /
      // Cabo Frio") y eso parte el título en dos líneas. La tarjeta muestra solo
      // el destino principal; el precio y las fechas son los de su zona por
      // defecto, que es la que se abre al tocar "Ver propuesta".
      var mainLabel = String(group.label).split(' / ')[0];
      var cardLabel = monthIndex === 11 && group.id === 'rio' ? 'Río de Janeiro · Réveillon' : mainLabel;
      var price = pricedByKey && pricedByKey[first.key];
      var isCheapest = price != null && first.key === cheapestKey;
      var travel = first.dates;
      var priceLine = price != null
        ? '<p class="featured-destination__price"><b>' + money(price) + '</b><span class="featured-destination__price-tag">desde, por persona</span><span class="featured-destination__price-mode">' + esc(price.modeShort || '') + '</span></p>'
        : '<p class="featured-destination__price is-loading" aria-hidden="true"><span class="featured-destination__skeleton"></span></p>';
      return '<article class="featured-destination' + (isCheapest ? ' is-cheapest' : '') + '" data-featured-destination="' + esc(group.id) + '"'
        + ' data-feature-price-key="' + esc(first.key) + '" data-feature-dates="' + esc(travel.depIso) + '|' + esc(travel.retIso) + '">'
        + (isCheapest ? '<span class="featured-destination__flag">M&aacute;s barato</span>' : '')
        + '<div class="featured-destination__image"><img src="' + esc(photo) + '" alt="Paisaje de ' + esc(group.label) + '" loading="lazy">'
        + '<div class="featured-destination__scrim"></div>'
        + '<div class="featured-destination__overlay"><h3>' + esc(cardLabel) + '</h3>' + priceLine + '</div></div>'
        + '<div class="featured-destination__meta">'
        + '<span class="featured-destination__when"><b>' + esc(window.label) + '</b> ' + esc(shortDateLabel(travel.depIso).replace(/\./g, '')) + ' &rarr; ' + esc(shortDateLabel(travel.retIso).replace(/\./g, '')) + '</span>'
        + '<span>' + S.pax + ' ' + (S.pax === 1 ? 'viajero' : 'viajeros') + '</span></div>'
        + '<div class="featured-destination__body">'
        + '<button type="button" class="featured-destination__search" data-feature-search="' + esc(group.id) + '">Ver propuesta <span aria-hidden="true">&rarr;</span></button>'
        + '</div></article>';
    }).join('');
    // La seccion arranca con la etiqueta, el titulo y la bajada, y recien ahi
    // la barra de meses. La linea de contexto que antes vivia entre la bajada y
    // los filtros --"en septiembre no hay feriado largo: fin de semana, mié 30
    // set - vie, 2 oct"-- se saco: repetia la fecha que la barra de meses ya
    // tiene escrita en la pestana activa, asi que lo primero que se leia era un
    // dato duplicado y una aclaracion ("no hay feriado largo") que sonaba a que
    // el ano entero no tenia ninguno.
    root.innerHTML = '<div class="destination-highlights__head"><div><span class="destination-highlights__eyebrow">Oportunidades de la temporada</span><h2 id="destination-highlights-title">Escapadas que salen menos</h2><p>Ordenadas por precio estimado por persona, para los pr&oacute;ximos seis meses. Toc&aacute; un destino y te mostramos la propuesta.</p></div></div>'
      + '<div class="featured-months" role="group" aria-label="Elegir mes de la escapada">' + tabs + '</div>'
      + '<div class="destination-highlights__slider"><button type="button" class="destination-highlights__arrow destination-highlights__arrow--prev" data-feature-prev aria-label="Ver destino anterior">&lsaquo;</button><div class="destination-highlights__carousel" aria-live="polite">' + cards + '</div><button type="button" class="destination-highlights__arrow destination-highlights__arrow--next" data-feature-next aria-label="Ver destino siguiente">&rsaquo;</button></div>';
  }
  // Precios de las tarjetas. Se piden una vez por mes/viajeros/estilo y se
  // cachean: el carrusel se vuelve a pintar al cambiar de mes, y sin cache cada
  // repintado volvería a pegarle al servidor.
  var featuredPricesCache = {};
  function loadFeaturedPrices(windowIndex, force) {
    var windows = featuredMonthWindows(6);
    var index = Math.max(0, Math.min(windows.length - 1, Number(windowIndex) || 0));
    var window = windows[index];
    // La ventana entra en la clave porque las fechas cambian: sin ella, un
    // mismo mes en dos ventanas distintas devolvería precios de otro viaje.
    var cacheKey = window.depIso + '|' + window.retIso + '|' + S.pax + '|' + S.style + '|' + S.origin;
    if (!force && featuredPricesCache[cacheKey]) {
      renderDestinationHighlights(index, featuredPricesCache[cacheKey]);
      return;
    }
    renderDestinationHighlights(index, null);
    var groups = DESTINATION_GROUPS;
    var items = groups.map(function (group) {
      return featuredPriceKey(window, featuredSubcategory(group, window)).item;
    });
    var qs = new URLSearchParams({ pax: String(S.pax), style: S.style, origin: S.origin, items: items.join(',') });
    fetch('/api/destinos-destacados?' + qs.toString())
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) return;
        var byKey = {};
        (res.j.items || []).forEach(function (item) { byKey[item.key] = item.pp; });
        featuredPricesCache[cacheKey] = byKey;
        // Sólo repintamos si el usuario sigue en el mismo mes: si ya cambió a
        // otro, su render fue el que pidió esta tanda y no hay que pisarlo.
        var active = document.querySelector('[data-feature-month].is-active');
        if (active && Number(active.getAttribute('data-feature-month')) === index) {
          renderDestinationHighlights(index, byKey);
        }
      })
      .catch(function () { /* sin precios: las tarjetas quedan igual, sin cifras */ });
  }
  var $ = function (s) { return document.querySelector(s); };
  var today = new Date(); today.setHours(12, 0, 0, 0);
  var timer = null, ctrl = null;
  var lastData = null;
  var pendingDestinationScroll = false;
  var featuredProposalSelection = null;
  // Destino abierto en la última visita, y los filtros con los que se abrió.
  // El segundo es para no marcar un destino que ya no corresponde a la búsqueda
  // actual: si cambian las fechas o el presupuesto, la marca se cae sola.
  var selectedDestKey = null;
  var selectedDestFor = null;
  // Propuesta abierta en la última visita, con los mismos filtros de control que
  // selectedDestKey. El marco mostaza lo lleva la que se está mirando, no la
  // recomendada: el servidor rotula una como "Recomendada" y a veces no es la que
  // uno quiere, pero verla marcada hacia creer que ya era la elegida.
  var selectedPropuestaId = null;
  var selectedPropuestaFor = null;
  var rangeCalendarMonth = null;
  var rangeCalendarStep = 'dep';

  /* ---------- utilidades ---------- */
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function tasaDe(code) {
    if (!code || code === FX.base) return 1;
    var r = FX.rates && Number(FX.rates[code]);
    return Number.isFinite(r) && r > 0 ? r : null;
  }
  function monedaActiva() {
    var c = S.currency;
    return MONEDAS_APP.filter(function (m) { return m.code === c; })[0] || MONEDAS_APP[0];
  }
  // Moneda base del presupuesto. El fallback de money() tiene que ser ÉSTA y no
  // "la primera de la lista": como la lista empieza por UYU (que es lo que
  // quiere ver un’utilisateur uruguayo), un fallo al cargar las tasas iba a
  // pintar "US$ 1.010" como "$ 1.010", con un error de 37 veces. La base es USD
  // y el presupuesto está en USD, así que sin tasas se muestra en la base, que
  // es el único número que no se está inventando.
  function monedaBase() {
    var base = FX.base || 'USD';
    return MONEDAS_APP.filter(function (m) { return m.code === base; })[0] || MONEDAS_APP[0];
  }
  function formatoMiles(n, dec) {
    var neg = n < 0;
    var s = Math.abs(n).toFixed(dec);
    var p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + p.join(dec ? ',' : '');
  }
  // Dolar, peso uruguayo y peso argentino no se usan con centavos en la
  // practica, asi que van redondos como siempre. El real si los tiene, pero en
  // un total de viaje "R$ 5.013,22" es ruido: decimales solo cuando el valor
  // es chico (tarifas por kWh, por noche), nunca en totales.
  function decimalesDe(code, total) {
    if (code !== 'BRL') return 0;
    return Math.abs(total) >= 1000 ? 0 : 2;
  }
  /* Igual que money() pero SIEMPRE sin decimales.

     El desglose de una tarjeta es una lista de rubros que se comparan entre sí, y
     la regla de decimalesDe los mezclaba: en la misma card "Pasajes R$ 6.724" y
     "Traslados R$ 130,25". Se ve desprolijo porque el ojo ve dos formatos en
     columnas que alinea.

     Redondear ademas es lo honesto para estos numeros: son estimaciones (llevan
     el asterisco), y dos decimales en un estimado son precision falsa. Los
     precios por unidad --por noche, por kWh-- NO pasan por acá: esos si
     necesitan centavos. */
  function moneyCero(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return '';
    var m = monedaActiva();
    var tasa = tasaDe(m.code);
    if (tasa == null) { m = monedaBase(); tasa = 1; }
    return m.simbolo + ' ' + formatoMiles(v * tasa, 0);
  }

  /* Bloque con titulo y placa: la forma que sigue toda seccion de la app.

     LA REGLA, en una linea: el titulo va FUERA de la placa y la placa es solo
     el contenido. Antes cada seccion decidia por su cuenta --los hoteles y los
     tours tenian el <h2> adentro del rectangulo con borde, el transfer y los
     vuelos lo tenian afuera-- y con dos pantallas en la misma vista no hay forma
     de saber si un rectangulo con nombre es una tarjeta mas o el bloque entero
     de una seccion.

     El <div> que agrupa a los dos existe por una razon mecanica, no de diseno: es
     el nodo que reemplazan los repintados en caliente (cambiar de hotel, de
     moneda, de numero de viajeros). Si el marcador quedara solo en la placa,
     cada repintado meteria el markup COMPLETO adentro de la placa y el titulo
     viejo se quedaria afuera: es el bug de los "Traslados y Conexiones" que se
     acumulaban uno debajo del otro. Con el marcador en el <div> que envuelve a
     los dos, se cambian juntos o no se cambia ninguno.

     `sub` es opcional: muchas placas no llevan bajada. */
  function plateBlock(attr, title, sub, body) {
    return '<div class="plate-block"' + (attr ? ' ' + attr : '') + '>' +
      (title || '') +
      (sub ? '<p class="block-sub">' + sub + '</p>' : '') +
      body + '</div>';
  }

  // El header vive en el HTML, pero el selector depende del estado de la
  // moneda y de que ya llegaran las tasas, asi que se inyecta desde aca.
  function pintarHeader() {
    const slot = document.getElementById('currency-picker-slot');
    if (slot) slot.innerHTML = selectorMoneda();
  }
  // Desplegable de moneda. Antes era un badge que al hacer clic avanzaba a la
  // siguiente moneda en ciclo, y un panel que se escondía detrás del badge
  // decía cuántas había: nada indicaba que fuera pulsable ni cuántas opciones
  // existían, y no había forma de saltar directo a la que se quería.
  //
  // Ahora es un botón con el código y una flecha que abre la lista de las
  // monedas disponibles. Solo tres, que son las que le sirven a este mercado.
  function selectorMoneda() {
    var rates = FX.rates || {};
    var hay = !!Object.keys(rates).length;
    var m = monedaActiva();
    var opciones = MONEDAS_APP.map(function (op) {
      var ok = hay && tasaDe(op.code) != null;
      var sel = op.code === m.code;
      return '<button type="button" class="currency-option' + (sel ? ' is-selected' : '') + '"'
        + ' role="option" aria-selected="' + (sel ? 'true' : 'false') + '"'
        + ' data-currency="' + esc(op.code) + '"' + (ok ? '' : ' disabled') + '>'
        + '<span class="currency-option__symbol" aria-hidden="true">' + esc(op.simbolo) + '</span>'
        + '<span class="currency-option__name">' + esc(op.etiqueta) + '</span>'
        + (sel ? '<span class="currency-option__check" aria-hidden="true">✓</span>' : '')
        + '</button>';
    }).join('');
    return '<div class="currency-picker' + (hay ? '' : ' is-loading') + '">'
      + '<button type="button" class="currency-badge" data-currency-toggle aria-haspopup="listbox" aria-expanded="false"'
      + ' aria-label="Moneda: ' + esc(m.etiqueta) + '. Cambiar"'
      + ' title="' + esc(m.etiqueta) + (hay ? '' : ' (cargando tasas)') + '">'
      + '<b>' + esc(m.code) + '</b>'
      // El chevron va como SVG y no como triangulo de bordes con ::after: es la
      // misma "v" de trazo que usan los otros cinco controles, y asi no depende
      // de que la fuente tenga el glifo. El texto queda en el <b>.
      + '<svg class="currency-badge__chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
      + '<path d="m6 9 6 6 6-6"/></svg></button>'
      + '<div class="currency-menu" role="listbox" aria-label="Elegí la moneda" hidden>' + opciones + '</div>'
      + '</div>';
  }
  function refrescarSelectorMoneda() {
    // Se reemplaza el contenedor entero, no solo el badge: el menú vive adentro
    // y tiene que reflejar la moneda activa y cuáles tienen tasa.
    document.querySelectorAll('.currency-picker').forEach(function (el) {
      el.outerHTML = selectorMoneda();
    });
  }
  function cerrarMenusMoneda() {
    document.querySelectorAll('.currency-menu').forEach(function (menu) {
      menu.hidden = true;
      var trigger = menu.parentElement && menu.parentElement.querySelector('[data-currency-toggle]');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }
  /* Abre el menu de moneda sin que se salga de la pantalla.

     El bug: el menu estaba anclado con right:0 al boton, y en un celular el
     boton vive en el medio del header. Con 238px de ancho, el menu arrancaba
     unos 58px antes del borde izquierdo de la ventana: la persona tocaba la
     moneda, aparecian dos de las tres opciones y la tercera quedaba afuera, con
     la pagina ensanchada y una barra de scroll horizontal.

     Por eso el menu es position:fixed (ver style.css) y acá se le escriben
     left/top en coordenadas de ventana, medidas de verdad:

     - el ancho se limita a la ventana con 12px de aire a cada lado;
     - se abre ABAJO si hay lugar y ARRIBA si no, que es lo que evita que se
       salga por abajo cuando el header queda pegado al final de una pagina
       scrolleada;
     - en el eje horizontal el menu sale HACIA LA IZQUIERDA del boton, con sus
       bordes derechos alineados, y solo se corrige si con ese ancla se sale de la
       ventana.

     Ese último punto tenía el recorte al revés y por eso el menu se abría del
     lado contrario del boton. La condición era `t.right + margen < ancho`, o
     sea "el botón todavía tiene aire a su derecha", que es el caso de todos los
     botones del header salvo el último: el boton de moneda tiene adelante el
     toggle de tema y "Iniciar sesión", asi que nunca llega al borde. Con eso
     el menu se mandaba al extremo derecho de la ventana, a cientos de pixeles
     del boton que lo abrio, y el `left < margen` de abajo no lo corregia
     porque un menu pegado al borde derecho nunca se sale por la izquierda. El
     recorte que hace falta es el de la izquierda: si el menu se sale por ahí es
     porque el boton esta pegado al borde, y lo que corresponde es pegarlo al
     margen, no llevarlo al otro extremo.

     Se recalcula al abrir, al cambiar el tamaño de la ventana y al scrollear con
     el menu abierto: el menu es fijo, asi que si la pagina se mueve y no se
     recalcula, se queda flotando lejos del boton. */
  function posicionarMenuMoneda(menu, trigger) {
    if (!menu || !trigger) return;
    var margen = 12;
    var separacion = 8;
    var ancho = window.innerWidth || document.documentElement.clientWidth;
    var alto = window.innerHeight || document.documentElement.clientHeight;
    var disponible = Math.max(160, Math.min(440, Math.round(alto * 0.62)));
    // El ancho real se mide con el menu visible: en hidden no tiene caja. Se
    // borra el width de la apertura anterior antes de medir, o el menu se
    // quedaria pegado al ancho que tuvo la vez pasada y no volveria a crecer
    // cuando la ventana crece.
    menu.style.width = '';
    menu.style.maxHeight = disponible + 'px';
    var caja = menu.getBoundingClientRect();
    var anchoMenu = Math.max(160, Math.min(caja.width || 238, ancho - margen * 2));
    menu.style.width = Math.round(anchoMenu) + 'px';
    menu.style.maxWidth = (ancho - margen * 2) + 'px';

    var t = trigger.getBoundingClientRect();
    var altoMenu = Math.min(menu.offsetHeight || caja.height || disponible, disponible);
    var top = t.bottom + separacion;
    if (top + altoMenu > alto - margen) {
      var arriba = t.top - separacion - altoMenu;
      // Arriba solo si el hueco de arriba es mayor que el de abajo: en el
      // header, arriba es el borde de la pagina y siempre pierde.
      top = (arriba >= margen) ? arriba : Math.max(margen, alto - margen - altoMenu);
    }
    // Ancla: el borde derecho del menu contra el borde derecho del boton, asi el
    // menu se despliega hacia la izquierda, que es el lado del que hay lugar en
    // un boton que esta a la derecha del header.
    var left = t.right - anchoMenu;
    if (left < margen) left = margen;                                   // se sale por la izquierda
    if (left + anchoMenu > ancho - margen) left = ancho - margen - anchoMenu;  // se sale por la derecha
    if (left < margen) left = margen;                                   // ventana mas angosta que el menu
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
    menu.style.right = 'auto';
  }
  function posicionarMenosMonedaAbiertos() {
    document.querySelectorAll('.currency-menu:not([hidden])').forEach(function (menu) {
      var trigger = menu.parentElement && menu.parentElement.querySelector('[data-currency-toggle]');
      posicionarMenuMoneda(menu, trigger);
    });
  }
  function aplicarMoneda(code) {
    if (tasaDe(code) == null && !(FX.rates && Object.keys(FX.rates).length)) {
      // todavia no llegaron las tasas: no dejamos cambiar a algo que no podemos calcular
      if (code !== FX.base) return;
    }
    S.currency = code;
    try { localStorage.setItem('cuantosale_moneda', code); } catch (e) { /* modo privado */ }
    refrescarSelectorMoneda();
    // Tres lugares muestran precios: el total grande de la vista de detalle, el
    // panel flotante "Mi viaje" y el desglose "A donde va tu plata".
    //
    // Antes, un solo click de moneda pintaba el desglose DOS veces (esta línea y
    // la de recalcularTotalViaje, byte a byte idénticas), el panel dos veces, y
    // encima llamaba a render(lastData), que reconstruía la lista de resultados
    // entera. Todo eso dentro de catch (e) {} VACÍOS: un TypeError al pintar
    // un total se tragaba en silencio y el usuario veía un precio viejo con el
    // símbolo nuevo, sin ningún error en consola.
    //
    // Ahora: repintarPresupuestoDiario() alcanza, porque su propio pintado
    // pesado se encola una vez por frame, y los catch loguean en vez de
    // descartarse.
    //
    // Se llama a esa y no a recalcularTotalViaje() porque
    // repintarPresupuestoDiario ya la llama por dentro. Con las dos, el
    // desglose se pintaba dos veces, que es justo lo que el parrafo de arriba
    // cuenta que se arranco.
    //
    // Lo que faltaba era la seccion "Personaliza tus costos diarios". Sus
    // presets salen de money() y del simbolo de la moneda activa, pero nadie
    // la volvia a dibujar al cambiar de moneda: el total grande y "A donde va
    // tu plata" si cambiaban, y las cajas de Comidas y Transporte local
    // seguian con el simbolo viejo al lado.
    if (detailState) {
      try { repintarPresupuestoDiario(); } catch (e) { console.error('No se pudo repintar el total al cambiar de moneda', e); }
      try { repintarPreciosEnMoneda(); } catch (e) { console.error('No se pudieron repintar los precios de hotel y traslado al cambiar de moneda', e); }
      /* El checkout se dibujo con la moneda anterior y nadie lo volvia a pintar:
         cambiar la moneda con el modal abierto dejaba el total en "US$ 56" al
         lado de una pagina que ya estaba en reales, y el paso de medios de pago
         con la cuenta en dolares. Es el mismo forgets de las secciones, pero
         todavia mas grave porque el modal tapa la pagina y el unico numero que
         se ve es ese.

         renderCheckout() rearma el paso corriente desde checkoutState, asi que
         alcanza con re-dibujar. El readCheckoutForm() va ANTES para no perder
         lo que la persona escribio y todavia no confirmo con "Continuar". */
      if ($('#booking-modal .checkout-dialog')) {
        try {
          readCheckoutForm();
          renderCheckout();
        } catch (e) { console.error('No se pudo repintar el checkout al cambiar de moneda', e); }
      }
    }
    if (lastData) { try { render(lastData); } catch (e) { console.error('No se pudo repintar los resultados al cambiar de moneda', e); } }
  }
  async function cargarTasas() {
    try {
      const r = await fetch('/api/tasas', { headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (j && j.monedas) {
        MONEDAS_APP = j.monedas.map(function (m) {
          return { code: m.code, etiqueta: m.etiqueta, simbolo: m.simbolo };
        });
      }
      if (j && j.rates) { FX.rates = j.rates; FX.base = j.base || 'USD'; }
      FX.cargando = false;
    } catch (e) {
      FX.cargando = false;
    }
    let guardada = null;
    try { guardada = localStorage.getItem('cuantosale_moneda'); } catch (e) { }
    if (guardada && tasaDe(guardada) != null) S.currency = guardada;
    pintarHeader();
    refrescarSelectorMoneda();
    if (lastData) { try { render(lastData); } catch (e) { } }
  }
  // Un clic en el badge abre la lista; un clic en una opción elige y cierra.
  // Todo delegado en un solo listener de document para no re-atarlos en cada
  // repintado, que es lo que hace refrescarSelectorMoneda().
  document.addEventListener('click', function (e) {
    var option = e.target.closest && e.target.closest('[data-currency]');
    if (option) {
      if (option.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      cerrarMenusMoneda();
      aplicarMoneda(option.getAttribute('data-currency'));
      return;
    }
    var trigger = e.target.closest && e.target.closest('[data-currency-toggle]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      var menu = trigger.parentElement && trigger.parentElement.querySelector('.currency-menu');
      if (!menu) return;
      var estabaAbierto = !menu.hidden;
      cerrarMenusMoneda();
      if (estabaAbierto) return;
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      posicionarMenuMoneda(menu, trigger);
      // El foco va a la opción activa para que con teclado se llegue con las
      // flechas, que es lo que se espera de un listbox.
      var activa = menu.querySelector('.currency-option.is-selected') || menu.querySelector('.currency-option:not([disabled])');
      if (activa) activa.focus();
      return;
    }
    // Cualquier otro clic cierra lo que estuviera abierto.
    if (e.target.closest && e.target.closest('.currency-menu')) return;
    cerrarMenusMoneda();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.querySelector('.currency-menu:not([hidden])')) { cerrarMenusMoneda(); return; }
      /* Escape cierra el modal abierto, si hay uno. Antes el handler solo
         miraba el menu de moneda y hacia return, asi que ningun modal se
         cerraba con Escape, y los cinco se anuncian como
         aria-modal="true", que es una promesa de que Escape los cierra.

         Importa mas que accesibilidad: con un modal abierto la pagina no
         scrollea, y el unico salida es el boton X. Si ese X no se alcanza
         con el dedo, la pantalla queda muerta sin scroll y sin salida.

         Se le hace click al propio boton del modal, para que corra el mismo
         codigo que el X y no quede un segundo camino que se desincronice. */
      var abierto = document.querySelector('.booking-modal:not([hidden])');
      if (abierto) {
        var cerrar = abierto.querySelector('[data-close-auth],[data-close-trips],[data-close-booking]');
        if (cerrar) cerrar.click();
        else { abierto.hidden = true; abierto.setAttribute('aria-hidden', 'true'); abierto.innerHTML = ''; }
      }
      return;
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var menu = e.target.closest && e.target.closest('.currency-menu');
    if (!menu) return;
    e.preventDefault();
    var opciones = [].slice.call(menu.querySelectorAll('.currency-option:not([disabled])'));
    if (!opciones.length) return;
    var i = opciones.indexOf(document.activeElement);
    var siguiente = e.key === 'ArrowDown' ? (i + 1) % opciones.length : (i - 1 + opciones.length) % opciones.length;
    opciones[siguiente].focus();
  });
  // El menu es fijo: si la pagina scrollea o la ventana cambia de tamaño con el
  // menu abierto, sus coordenadas de ventana quedan viejas y el menu se despega
  // del boton. Se recalcula, y con scroll en capture para que tambien corra
  // cuando el scroll viene de un contenedor interno y no de la ventana.
  window.addEventListener('resize', posicionarMenosMonedaAbiertos);
  window.addEventListener('orientationchange', posicionarMenosMonedaAbiertos);
  window.addEventListener('scroll', posicionarMenosMonedaAbiertos, true);

  function money(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return '';
    var m = monedaActiva();
    var tasa = tasaDe(m.code);
    // Sin tasa para esta moneda no inventamos numero: seguimos en la base.
    // OJO: la base, NO la primera de la lista. Como la lista empieza por UYU,
    // un fallo al cargar las tasas pintaba "US$ 1.010" como "$ 1.010", con un
    // error de 37 veces. Ver monedaBase().
    if (tasa == null) { m = monedaBase(); tasa = 1; }
    var total = v * tasa;
    return m.simbolo + ' ' + formatoMiles(total, decimalesDe(m.code, total));
  }
  // money() redondea a entero (por defecto en dolares) y trunca
  // tarifas fraccionarias como US$/kWh a "US$ 0" — esta conserva decimales.
  function moneyPrecise(n) {
    var v = Number(n) || 0;
    var m = monedaActiva();
    var tasa = tasaDe(m.code);
    if (tasa == null) { m = monedaBase(); tasa = 1; }
    return m.simbolo + ' ' + formatoMiles(v * tasa, 2);
  }
  // Numero sin simbolo, para las etiquetas de los graficos de barras.
  // Antes hacia money(x).replace('US$ ',''), que con reales o pesos se
  // comia un prefijo que ya no estaba y dejaba el simbolo pegado al numero.
  function moneySolo(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return '';
    var tasa = tasaDe(monedaActiva().code);
    return formatoMiles(v * (tasa == null ? 1 : tasa), 0);
  }
  // El presupuesto se lleva en la base (USD) y la conversion es solo de
  // pantalla. Estas dos son el puente para los campos que la persona edita a
  // mano: el input de "monto por dia" se muestra en la moneda que eligio, asi
  // que lo que tipea hay que volver a llevarlo a la base antes de sumarlo.
  function aMoneda(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return 0;
    var tasa = tasaDe(monedaActiva().code);
    return tasa == null ? v : v * tasa;
  }
  function aBase(n) {
    var v = Number(n);
    if (!Number.isFinite(v)) return 0;
    var tasa = tasaDe(monedaActiva().code);
    if (tasa == null || tasa === 0) return v;
    return v / tasa;
  }
  function dLong(d) { return d.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function shortDateLabel(value) {
    if (!value) return 'Elegí una fecha';
    return parse(value).toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function syncDateRangeFields() {
    var departure = document.getElementById('dep');
    var returning = document.getElementById('ret');
    var departureLabel = document.getElementById('dep-label');
    var returnLabel = document.getElementById('ret-label');
    if (departure) departure.value = S.dep;
    if (returning) returning.value = S.ret;
    if (departure) departure.min = iso(addDays(today, 1));
    if (returning) returning.min = S.dep ? iso(addDays(parse(S.dep), 1)) : iso(addDays(today, 2));
    if (departureLabel) departureLabel.textContent = shortDateLabel(S.dep);
    if (returnLabel) returnLabel.textContent = shortDateLabel(S.ret);
  }
  /* ---------- fechas de escapada ---------- */
  var MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // Pascua gregoriana por el algoritmo anónimo. Hace falta porque Carnaval y
  // Semana Santa no son fechas fijas: dependen de Pascua, que va entre el 22
  // de marzo y el 25 de abril. Escribirlas a mano las deja desfasadas casi
  // todos los años.
  function easterSunday(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day, 12);
  }

  // Feriados nationally fijos de Uruguay. Carnaval y Semana Santa no van acá
  // porque salen de Pascua. Se listan los que efectivamente arman escapada:
  // 1 May y 19 Jun no generan fin de semana largo en la mayoría de los años.
  var URUGUAY_HOLIDAYS = [
    { month: 0, day: 1, label: 'Año Nuevo' },
    { month: 7, day: 25, label: 'Día de la Independencia' },
    { month: 9, day: 12, label: 'Día de la Raza' },
    { month: 10, day: 2, label: 'Día de los Difuntos' },
    { month: 11, day: 25, label: 'Navidad' }
  ];

  /*
   * Ventanas especiales de un año: Carnaval, Semana Santa, los feriados fijos
   * que arman puente y el fin de año. No dependen del mes que se está viendo.
   */
  function featuredSpecialWindows(year) {
    var list = [];
    var easter = easterSunday(year);
    // Carnaval: lunes y martes. La escapada clásica arranca el viernes previo.
    list.push({ dep: addDays(easter, -51), ret: addDays(easter, -45), label: 'Carnaval' });
    // Semana Santa: de miércoles a domingo.
    list.push({ dep: addDays(easter, -4), ret: easter, label: 'Semana Santa' });
    // Feriados fijos. Sólo interessan cuando caen de martes a jueves (puente
    // con el fin de semana) o en lunes (se corre el fin de semana entero). Si
    // caen sábado o domingo no generan nada que organizar.
    URUGUAY_HOLIDAYS.forEach(function (holiday) {
      var date = new Date(year, holiday.month, holiday.day, 12);
      var dow = date.getDay();
      if (dow === 1) list.push({ dep: addDays(date, -4), ret: date, label: holiday.label });
      else if (dow >= 2 && dow <= 4) list.push({ dep: addDays(date, -4), ret: addDays(date, 2), label: holiday.label });
    });
    // Fin de año: el tramo más pedido del calendario, del 30 de diciembre al
    // 2 de enero.
    list.push({ dep: new Date(year, 11, 30, 12), ret: new Date(year + 1, 0, 2, 12), label: 'Fin de año' });
    return list;
  }

  /*
   * Los meses que se ofrecen, con una ventana cada uno.
   *
   * La sección ofrece seis meses desde el actual, no el calendario entero: un
   * destino de diciembre no le sirve a nadie en marzo.
   *
   * Una ventana especial se asigna al primer mes que toca y no se repite. Sin
   * esa regla, Fin de año (que sale el 30 de diciembre y vuelve el 2 de enero)
   * aparecería en diciembre y en enero con las mismas fechas, y pasar de un
   * mes al otro no cambiaría nada. Con ella, diciembre se queda con Fin de año
   * y enero cae en el fin de semana más cercano.
   *
   * Todas las tarjetas de un mes comparten las mismas fechas: antes cada
   * tarjeta podía caer en una fecha distinta según su subcategoría, y dos
   * tarjetas de la misma pantalla llegaban a decir fechas diferentes.
   */
  function featuredMonthWindows(count) {
    count = count || 6;
    var specials = [];
    for (var y = today.getFullYear(); y <= today.getFullYear() + 2; y++) {
      specials = specials.concat(featuredSpecialWindows(y));
    }
    var used = {};
    var out = [];
    for (var i = 0; i < count; i++) {
      var cursor = new Date(today.getFullYear(), today.getMonth() + i, 1, 12);
      var month = cursor.getMonth(), year = cursor.getFullYear();
      // El año importa tanto como el mes. Comparar sólo getMonth() dejaba pasar
      // la ventana de fin de año de 2027 a enero de 2027, y el mes mostraba
      // unas fechas de diciembre del año siguiente.
      var fallsInMonth = function (date) {
        return date.getFullYear() === year && date.getMonth() === month;
      };
      var candidates = specials.filter(function (w) {
        return fallsInMonth(w.dep) || fallsInMonth(w.ret);
      }).sort(function (a, b) { return a.dep - b.dep; });
      var pick = null;
      for (var j = 0; j < candidates.length; j++) {
        var key = iso(candidates[j].dep);
        if (used[key] || candidates[j].dep <= today) continue;
        used[key] = true;
        pick = candidates[j];
        break;
      }
      if (!pick) {
        // Sin feriado en el mes: un fin de semana a mitad de mes, que es lo que
        // la gente busca igual. Se toma el tercer sábado del mes.
        var departure = new Date(year, month, 1, 12);
        departure = addDays(departure, (6 - departure.getDay() + 7) % 7 + 14);
        pick = { dep: departure, ret: addDays(departure, 2), label: 'Fin de semana' };
      }
      if (pick.dep <= today) {
        var nextDay = addDays(today, 1);
        if (nextDay <= new Date(year, month + 1, 0, 12)) {
          pick = { dep: nextDay, ret: addDays(nextDay, 2), label: 'Fin de semana' };
        }
      }
      out.push({
        month: month, year: year, label: pick.label,
        dep: pick.dep, ret: pick.ret,
        depIso: iso(pick.dep), retIso: iso(pick.ret),
        nights: Math.round((pick.ret - pick.dep) / 864e5)
      });
    }
    return out;
  }

  /* El calendario no offering fechas más allá de un año.

     Motivo: el precio de un vuelo a esta altura viene del modelo, y a dos años
     la estimación no dice nada. Peor: `/api/vuelos/calendario` compara 15
     fechas alrededor de la elegida, y con la salida muy lejos esas 15 fechas caen
     todas fuera de cualquier temporada real. La app terminaba mostrando
     cotizaciones de un viaje que nadie viaja en ese momento, y el "más barato"
     del gráfico era ruido.

     El límite es EXACTO a un año: today + 1 año es el último día habilitable, y
     el día siguiente ya no. No se calcula con "12 meses" (que no es un año: con
     meses de 30 y 31 días se corre hasta varios días) sino con setFullYear(+1). El
     caso raro es el 29 de febrero en año bisiesto: no hay 29 de febrero del año
     siguiente, y JS se corre al 1 de marzo, que es el tope más cercano que
     existe.

     El mismo corte se aplica a los dos pasos: la vuelta no puede pasar del
     límite, o un vuelo de ida de diciembre con vuelta en enero del año que
     viene sería el único caso en que se rompería. */
  function maxDepartureDate() {
    var limite = new Date(today.getTime());
    limite.setFullYear(limite.getFullYear() + 1);
    return iso(limite);
  }
  function calendarMonthMarkup(monthDate) {
    var year = monthDate.getFullYear();
    var month = monthDate.getMonth();
    var first = new Date(year, month, 1, 12);
    var offset = (first.getDay() + 6) % 7;
    var count = new Date(year, month + 1, 0, 12).getDate();
    var minDeparture = iso(addDays(today, 1));
    var maxDeparture = maxDepartureDate();
    var days = '';
    for (var blank = 0; blank < offset; blank++) days += '<span class="date-range-day date-range-day--blank" aria-hidden="true"></span>';
    for (var day = 1; day <= count; day++) {
      var value = iso(new Date(year, month, day, 12));
      var disabled = value < minDeparture || value > maxDeparture || (rangeCalendarStep === 'ret' && S.dep && value <= S.dep);
      var inRange = !!(S.dep && S.ret && value >= S.dep && value <= S.ret);
      var endpoint = value === S.dep || value === S.ret;
      var classes = 'date-range-day' + (disabled ? ' is-disabled' : '') + (inRange ? ' is-in-range' : '') + (endpoint ? ' is-endpoint' : '') + (value === iso(today) ? ' is-today' : '');
      var dateLabel = new Date(year, month, day, 12).toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      days += '<button type="button" class="' + classes + '" data-range-date="' + value + '" aria-label="' + esc(dateLabel) + '"' + (endpoint ? ' aria-pressed="true"' : '') + (disabled ? ' disabled' : '') + '>' + day + '</button>';
    }
    var weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (label) { return '<span class="date-range-weekday" aria-hidden="true">' + label + '</span>'; }).join('');
    var monthLabel = first.toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });
    return '<section class="date-range-month" aria-label="' + esc(monthLabel) + '"><h3>' + esc(monthLabel) + '</h3><div class="date-range-grid" role="grid">' + weekdays + days + '</div></section>';
  }
  function renderDateRangeCalendar() {
    var months = document.getElementById('date-range-months');
    var instruction = document.getElementById('date-range-instruction');
    var previous = document.querySelector('[data-calendar-nav="prev"]');
    var next = document.querySelector('[data-calendar-nav="next"]');
    if (!months || !rangeCalendarMonth) return;
    var second = new Date(rangeCalendarMonth.getFullYear(), rangeCalendarMonth.getMonth() + 1, 1, 12);
    months.innerHTML = calendarMonthMarkup(rangeCalendarMonth) + calendarMonthMarkup(second);
    if (instruction) instruction.textContent = rangeCalendarStep === 'dep' ? 'Elegí la fecha de ida' : 'Ahora elegí la fecha de vuelta';
    var firstAllowedMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    if (previous) previous.disabled = rangeCalendarMonth <= firstAllowedMonth;
    // El "mes siguiente" se apaga en el mismo limite que los dias, por el mismo
    // motivo: si la flecha deja avanzar, la persona puede scrollear hasta un mes
    // entero de dias tachados, que es peor que un limite que no existe.
    // El limite son dos meses antes del que contiene el tope, porque el panel
    // dibuja dos: hay que poder llegar a ese mes para ver los ultimos dias
    // habiles. Con tope en setiembre del año que viene, la ultima vista posible
    // es agosto + septiembre, y en agosto la flecha ya esta apagada.
    if (next) {
      var tope = new Date(today.getTime());
      tope.setFullYear(tope.getFullYear() + 1);
      var mesTope = new Date(tope.getFullYear(), tope.getMonth(), 1, 12);
      var lastAllowedMonth = new Date(mesTope.getFullYear(), mesTope.getMonth() - 1, 1, 12);
      next.disabled = rangeCalendarMonth >= lastAllowedMonth;
    }
    var aviso = document.querySelector('[data-calendar-limit]');
    if (aviso) {
      var topeTexto = new Date(today.getTime());
      topeTexto.setFullYear(topeTexto.getFullYear() + 1);
      aviso.textContent = 'Elegí fechas de ida hasta el ' + shortDateLabel(iso(topeTexto)).replace(/\./g, '') + '.';
    }
  }
  function closeDateRangeCalendar() {
    var panel = document.getElementById('date-range-panel');
    if (panel) panel.hidden = true;
    ['dep-trigger', 'ret-trigger'].forEach(function (id) {
      var button = document.getElementById(id);
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  }
  function esc(s) {
    // Las respuestas de proveedores pueden omitir campos; nunca mostrar
    // "undefined"/"null" literalmente en la interfaz.
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function bookingUrl(meta, extra) {
    var query = new URLSearchParams({
      ss: meta.dest.name + ', Brasil',
      checkin: meta.dep,
      checkout: meta.ret,
      group_adults: String(meta.pax),
      no_rooms: '1',
      group_children: '0'
    });
    if (extra && extra.order) query.set('order', extra.order);
    if (extra && extra.hotel) query.set('ss', extra.hotel + ', ' + meta.dest.name + ', Brasil');
    return 'https://www.booking.com/searchresults.es.html?' + query.toString();
  }
  function flightUrl(meta) {
    var iata = IATA_BY_DEST[meta.dest.key] || meta.dest.key.toUpperCase();
    // Formato de búsqueda de Aviasales: origen + DDMM + destino + DDMM + adultos.
    // Es un enlace saliente estándar que Money Script puede atribuir al hacer clic.
    var dep = meta.dep.slice(8, 10) + meta.dep.slice(5, 7);
    var ret = meta.ret.slice(8, 10) + meta.ret.slice(5, 7);
    return 'https://www.aviasales.com/search/' + String(meta.origin || 'MVD').toUpperCase() + dep + iata + ret + meta.pax;
  }
  function ctas(meta) {
    var city = esc(meta.dest.name);
    return '<section class="cta-section" aria-label="Reservá tu viaje">' +
      '<p class="cta-title">¿Listo para avanzar con tu viaje?</p>' +
      '<div class="cta-actions">' +
      '<a class="cta-link cta-flights" href="' + esc(flightUrl(meta)) + '" target="_blank" rel="noopener noreferrer">' +
      '<span aria-hidden="true">✈️</span> Buscar y comparar vuelos a ' + city + '</a>' +
      '</div></section>';
  }
  function hotelTotalForRate(meta, accommodationTotal, multiplier) {
    var nights = Math.max(1, Number(meta && meta.nights) || 1);
    var pax = Math.max(1, Number(meta.pax) || 1);
    var average = Math.max(1, Number(accommodationTotal) || 1) / nights / pax;
    return Math.max(1, Math.round(average * multiplier)) * nights * pax;
  }
  function hotelStyle(meta) {
    var typeProfiles = {
      'all-inclusive': { tier: 'all-inclusive', title: 'All Inclusive', badge: 'ALL INCLUSIVE', description: 'Régimen con comidas y servicios incluidos en el alojamiento.' },
      resort: { tier: 'resort', title: 'Resort', badge: 'RESORT', description: 'Alojamientos tipo resort; el precio se estima con el régimen seleccionado.' },
      boutique: { tier: 'boutique', title: 'Boutique', badge: 'HOTEL BOUTIQUE', description: 'Alojamientos boutique con una selección de menor escala.' },
      economico: { tier: 'eco', title: 'Económico', badge: 'SÚPER ECONÓMICO', description: 'Opciones de bajo costo filtradas por el presupuesto por noche.' },
      intermedio: { tier: 'moderado', title: 'Equilibrado', badge: 'MEJOR RELACIÓN PRECIO-CALIDAD', description: 'Hoteles de gama media filtrados por presupuesto por noche.' },
      confort: { tier: 'alto', title: 'Cómodo', badge: 'COMODIDAD PREMIUM', description: 'Hoteles de categoría superior filtrados por presupuesto.' }
    };
    if (typeProfiles[meta.hotelType]) return typeProfiles[meta.hotelType];
    var styles = {
      ahorro: { tier: 'eco', title: 'Económica', badge: 'SÚPER ECONÓMICO', description: 'Posadas, hosteles boutique y opciones de bajo costo.' },
      eq: { tier: 'moderado', title: 'Equilibrada', badge: 'MEJOR RELACIÓN PRECIO-CALIDAD', description: 'Hoteles de gama media con buena ubicación y servicios.' },
      comodo: { tier: 'alto', title: 'Premium', badge: 'COMODIDAD PREMIUM', description: 'Hoteles exclusivos, resorts y posadas de alta gama.' }
    };
    return styles[meta.style] || styles.eq;
  }
  function hotelImageFallback(index, fallback) {
    return fallback || '';
  }
  /* El nombre del tipo de viaje del segmented control de arriba ("¿Qué tipo de
     viaje buscás?"). No sale de hotelStyle() a propósito: ese prioriza el tipo de
     hotel (All Inclusive, Resort, Intermedio) y el texto de la sección tiene que
     decir qué eligió la persona arriba, que es otra cosa.

     Se escribe una vez porque el mismo nombre aparece en el subtítulo de
     "Todas las propuestas" y en el aviso de que no hay más: si los dos textos tu
    vieran la palabra escrita, cambiar "Equilibrado" por "Con comodidad" un día
     dejaría la mitad de las pantallas diciendo la cosa vieja. */
  var ESTILO_VIAJE = { ahorro: 'Económica', eq: 'Equilibrada', comodo: 'Premium' };
  function nombreEstiloViaje(style) {
    return ESTILO_VIAJE[String(style || 'eq')] || ESTILO_VIAJE.eq;
  }
  function sanitizeHotelImageUrl(value, fallback) {
    if (typeof value !== 'string') return fallback || '';
    var text = value.trim();
    var markdown = text.match(/^\[.*?\]\((https?:\/\/[^)]+)\)$/i);
    if (markdown && markdown[1]) return markdown[1].trim();
    var direct = text.match(/https?:\/\/[^\s)>"]+/i);
    return direct ? direct[0].trim() : (fallback || '');
  }
  // La API de Booking a veces devuelve el nombre del hotel ya doble codificado:
  // los bytes UTF-8 de "Búzios" leídos con un código de un byte por carácter,
  // que en pantalla aparecen como "BÃºzios". El server ya lo repara en
  // sanitizeHotelName, pero en producción el síntoma aparece igual, así que el
  // dato se repara también acá: si la corrupción entra por cualquier capa
  // (respuesta cacheada del proveedor, CDN, proxy), el nombre se ve bien igual.
  //
  // Se aplica sólo cuando aparece la firma del problema y el resultado es
  // UTF-8 válido, así que un texto correcto queda intacto: "São Paulo" y
  // "Pousada São José" no se tocan porque no son UTF-8 válido al re-decodificar.
  // Los 32 caracteres que Windows-1252 ubica entre 0x80 y 0x9F. El listado sale
  // de la implementacion de WHATWG de Node y no de memoria: varios son de
  // control (U+0081, U+008D, U+008F, U+0090, U+009D) y cambiarlos de lugar no
  // rompe nada visible, solo deja de reparar.
  var CP1252_HIGH = '\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178';
  // Uno solo: fixMojibake corre por cada hotel de cada respuesta.
  var UTF8_DECODER = new TextDecoder('utf-8');
  function fixMojibake(value) {
    var text = String(value == null ? '' : value);
    if (!/[ÃÂâ]/.test(text)) return text;
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code < 0x80) { bytes.push(code); continue; }
      // El bloque alto de Windows-1252 va del 0x80 al 0x9F, pero sus caracteres
      // están en U+20AC y U+2122 (fuera de Latin-1), así que se busca por
      // carácter y no por rango.
      var high = CP1252_HIGH.indexOf(text.charAt(i));
      if (high >= 0) { bytes.push(0x80 + high); continue; }
      if (code >= 0xa0 && code <= 0xff) { bytes.push(code); continue; }
      return text;
    }
    var fixed;
    try { fixed = UTF8_DECODER.decode(new Uint8Array(bytes)); }
    catch (error) { return text; }
    // Caracteres de reemplazo = la secuencia no era UTF-8 válido: el texto ya
    // traía esas letras de forma legítima.
    if (fixed.indexOf('\uFFFD') >= 0) return text;
    return fixed;
  }
  function normalizeHotelCatalog(catalog, defaultHotel) {
    var unique = [];
    var seen = new Set();
    (catalog || []).forEach(function (item, index) {
      if (!item || !item.name) return;
      var name = fixMojibake(item.name);
      var image = sanitizeHotelImageUrl(item.image, defaultHotel.image);
      if (!image || seen.has(image)) {
        image = '';
      }
      if (image) seen.add(image);
      unique.push(Object.assign({}, item, { name: name, image: image }));
    });
    return unique;
  }

  /* Que tipo de alojamiento se muestra, contra lo que el destino realmente tiene.
     Devuelve el tipo ya resuelto; no toca meta.

     El <select> se arma aparte, con el mismo criterio, y ya no decide nada: antes
     esta correccion vivia DENTRO de hotelTypeSelectMarkup(), que se llama al final
     de hotelOptions() y despues de que el titulo, la nota y el mensaje de estado
     vacio se hubieran calculado con el tipo viejo. Como ademas mutaba
     meta.hotelType, la lista de tarjetas se filtraba con el tipo NUEVO y el resto
     de la seccion describia el VIEJO. En pantalla salia "Hoteles para viajar
     intermedio" con el selector en "Económico" y, abajo, "No encontramos
     alojamientos de categoría Intermedio": tres textos y un filtro que no decian
     lo mismo. Resolverlo aca arriba deja las cuatro cosas hablando del mismo tipo.

     La caida es al primer tipo disponible, y el orden de HOTEL_TYPES va de mas
     barato a mas caro, asi que ese primero es el mas cercano al que se pidio.
     Marcar un tipo que la lista de abajo no va a tener es peor que cambiarlo, y
     cambiarlo en silencio es lo que hay que evitar: por eso el cambio queda
     escrito en meta y se ve en el selector.

     Y el tipo que devuelve tiene que estar SIEMPRE en lo que ofrece el <select>.
     No es una sutileza: boutique y resort ya no estan en el selector, pero siguen
     llegando por la subcategoria —elegir "Maceio (Resort)" los trae—, asi que
     pedido puede ser uno de los dos. Si se devolviera tal cual, el selector no
     tendria nada que marcar y el navegador dibujaria el primer option como
     elegido: se veria "Económico" con las tarjetas filtradas por boutique. Es el
     mismo desajuste de antes, entrando por otra puerta. La caida final es al
     primero de la lista, y como esa lista va de mas barato a mas caro, es el
     mas cercano. */
  function resolveHotelTypeForMeta(meta) {
    var pedido = meta.hotelType || 'intermedio';
    var disponibles = meta.tiposHotelDisponibles;
    var elegido = pedido;
    if (Array.isArray(disponibles) && disponibles.length && disponibles.indexOf(pedido) < 0) {
      elegido = disponibles[0] || pedido;
    }
    // Ultimo filtro: solo tipos que el selector sabe dibujar.
    if (HOTEL_TYPE_OPTIONS.indexOf(elegido) < 0) elegido = HOTEL_TYPE_OPTIONS[0];
    return elegido;
  }
  /* Que hoteles de los que mando el server se pueden mostrar bajo este tipo.

     Vive suelta y no adentro de grupo() a proposito: es la regla que sostiene la
     promesa de que la seccion de alojamiento nunca arranca vacia, y una promesa
     asi tiene que poder probarse sin montar la pantalla entera.

     El server ya eligio estos hoteles por banda de precio y, para los tres tipos
     del espectro, garantiza que nunca manda una lista vacia. Asi que si el filtro
     de tipo deja TODO afuera, el que se equivoco es el filtro, no los hoteles: el
     hotelType guardado en cada uno quedo desfasado respecto del tipo pedido, que
     es justo lo que pasaba cuando el <select> corregia el tipo despues de que el
     titulo y las cards ya se hubieran calculado. En ese caso se los deja pasar.
     Una lista vacia ahi no seria "no hay hoteles de este tipo", que es lo que
     diria el estado de abajo: seria un desajuste interno sostenido en pantalla
     como si fuera una respuesta.

     Solo para los tipos del espectro. En All Inclusive, Resort o Boutique la
     lista vacia es la respuesta honesta y el estado de abajo la explica bien —que
     no se muestran categorias distintas como reemplazo—, asi que ahi no se
     rellena nada. */
  function hotelesQuePasanElTipo(catalogo, tipo, strictType) {
    var pasan = catalogo.filter(function (hotel) {
      if (hotel.hotelType) return hotel.hotelType === tipo;
      /* Sin tipo declarado solo pasan los tipos que son un ESPECTRO (mas barato,
         mas caro). En All Inclusive, Resort o Boutique, un hotel sin clasificar no
         es una opcion de ese tipo: son categorias que no admiten sustitucion.

         Antes el filtro era !hotel.hotelType || ... y ese primer termino hacia
         pasar TODO sin tipo a cualquier filtro, que es por lo que All Inclusive se
         llenaba de estimados. strictType ya se calculaba para ese texto y no se
         usaba para filtrar. */
      return !strictType;
    });
    if (pasan.length || strictType || !catalogo.length) return pasan;
    return catalogo;
  }
  // El <select> va envuelto para poder dibujarle el chevron con ::after, igual
  // que .custom-select__control: con appearance:none el control nativo del
  // sistema queda con la flecha desalineada y el alto distinto al del resto.
  function hotelTypeSelectMarkup(meta, selected) {
    /* Cuatro tipos, y se ofrecen siempre los cuatro. Antes eran seis y ademas
       se filtraban por `meta.tiposHotelDisponibles`, o sea que en un destino
       con dos tipos el selector mostraba dos y no se entendia que los otros
       existian: parecia que no habia mas opciones. Con el filtro, elegir un tipo
       sin hoteles en ese destino caia a un estado vacio sin explicar que
             ese tipo no tiene nada.

       El precio de ofrecer de mas esta resuelto: si el tipo elegido no trae
       nada en ese destino, el estado vacio de la lista lo dice y ofrece el
       cercano, en vez de cambiarlo en silencio. Un selector que esconde opciones
       no informa; uno que las ofrece y explica por que no queda es mejor.

       `boutique` y `resort` salen de la lista. No se borran del modelo: siguen
       llegando por la subcategoria (elegir "Maceio (Resort)" los trae) y
       `resolveHotelTypeForMeta` los cae a un tipo de la lista si hace falta. */
    var options = HOTEL_TYPE_OPTIONS;
    /* El tipo de alojamiento va como fila de botones, no como <select>.
       El desplegable escondía las cuatro opciones detrás de un clic para ver
       un menu, y encima el label de arriba y el borde del control quedaban a
       dos pixeles: a 760px de columna, el bloque se partía en tres filas y el
       control se leia como una seccion propia de la pagina. Los botones se
       ven todos de una, y el que esta elegido se ve sin abrir nada.

       role="radio" + aria-checked y no un toggle suelto porque el grupo
       excluyente es lo que es: elegir "Cómodo" saca "Económico", no lo
       agrega. Con <input type=radio> nativo el estado marcado lo levaria el
       navegador y no se veria en el repintado, que es lo que rompia el
       filtro antes (ver el comentario de test-hoteles.js). Con aria-checked el
       marcado se dibuja desde el estado de la pagina, y la navegacion con
       flechas la resuelve el handler. */
    return '<div class="hotel-type-picks"><span class="hotel-type-picks__label" id="hotel-type-label">Alojamiento</span>'
      + '<div class="hotel-type-pills" role="radiogroup" aria-labelledby="hotel-type-label">' + options.map(function (type) {
        var on = type === selected;
        return '<button type="button" class="hotel-type-pill' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" tabindex="' + (on ? '0' : '-1') + '" data-hotel-type="' + type + '">' + esc(HOTEL_TYPE_LABELS[type]) + '</button>';
      }).join('') + '</div></div>';
  }
  /* Que hotel hay que marcar al redibujar la lista.
     Devuelve true/false si el total guardado esta en la lista, y null si no se
     sabe (todavia no se eligio ninguno, o el hotel guardado ya no se ofrece).
     El null es distinto de false a proposito: false seria "no marcar ninguno" y
     dejaria la lista sin radio marcado, que es peor que marcar el recomendado. */
  function hotelElegidoEnEstaLista(totalValue, stop) {
    // Un viaje combinado tiene una eleccion POR PARADA. Si el total guardado se
    // leyera del estado global, marcar una card del grupo de Buzios podria
    // "encontrar" el hotel que estaba elegido en Rio y no marcar nada.
    if (detailState && detailState.multiStay) {
      var porParada = staySelectedTotal(stop);
      if (!Number.isFinite(porParada) || porParada <= 0) return null;
      return Math.abs(porParada - totalValue) < 1;
    }
    if (!detailState || !detailState.selectedHotel) return null;
    var guardado = Number(detailState.selectedHotelTotal);
    if (!Number.isFinite(guardado) || guardado <= 0) return null;
    // Margen de 1 porque el total guardado viene de un data-hotel-total ya
    // redondeado al pintarse.
    return Math.abs(guardado - totalValue) < 1;
  }
  /* ---------- viajes de dos paradas: reparto de noches y una eleccion por parada ---------- */

  // Reparto de noches y nombres de las dos paradas. El reparto VIVO esta en
  // detailState.multiStay (lo mueve el slider); meta.multiStay solo trae los
  // nombres y las tarifas estimadas del server, sin totalNights ni firstNights.
  function stayNights() {
    var ms = detailState && detailState.multiStay;
    if (!ms || !ms.stays || ms.stays.length !== 2) return null;
    var total = Math.max(1, Number(ms.totalNights) || 1);
    var first = Math.max(1, Math.min(total - 1, Number(ms.firstNights) || Math.floor(total / 2)));
    return {
      total: total, first: first, second: total - first,
      firstName: ms.stays[0].name, secondName: ms.stays[1].name
    };
  }
  // Total de Booking elegido en cada parada. null = esa parada sigue con la
  // estimacion del modelo. Antes era un solo numero (selectedPrimaryHotelTotal):
  // alcanzaba para la primera parada y no para la segunda, que por eso se
  // cobraba siempre como estimacion.
  function staySelectedTotal(stop) {
    var ms = detailState && detailState.multiStay;
    if (!ms) return null;
    var v = Number((ms.selectedStayTotals || {})[stop]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  function setStaySelectedTotal(stop, total) {
    if (!detailState || !detailState.multiStay) return;
    detailState.multiStay.selectedStayTotals = detailState.multiStay.selectedStayTotals || {};
    if (total == null) delete detailState.multiStay.selectedStayTotals[stop];
    else detailState.multiStay.selectedStayTotals[stop] = Math.round(total);
  }
  /* Los hoteles ELEGIDOS, uno por parada.
     existed findSelectedHotelLabel() para esto, pero devuelve un solo nombre: en un
     viaje combinado hay un radio marcado por parada y la funcion leia el
     primero con querySelector. El resumen decia "Hotel Aquarius" y abajo
     "3 en Fortaleza / Jericoacoara", o sea un hotel y dos destinos, sin decir
     cual era de cual. El nombre unico seguia siendo necesario para el campo del
     checkout y para "Mi Viaje", asi que esta funcion no lo reemplaza: agrega la
     informacion que el nombre unico no puede dar.

     Devuelve [{ stop, name, nights, name2 }] con una entrada por parada con hotel
     elegido, en orden. Sin multiStay es una sola entrada con stop 0. */
  function selectedHotelsByStop() {
    var salida = [];
    if (!detailState) return salida;
    if (detailState.selectedHotel === false) return salida;
    var checked = Array.prototype.slice.call(document.querySelectorAll('[data-hotel-total]:checked'));
    var reparto = stayNights();
    checked.forEach(function (input) {
      var card = input.closest('[data-hotel-option]');
      if (!card) return;
      var nombre = card.querySelector('h3');
      var nombre = nombre && nombre.textContent ? nombre.textContent.trim() : '';
      if (!nombre) return;
      var stop = Number(input.getAttribute('data-hotel-stop')) || 0;
      salida.push({
        stop: stop,
        name: nombre,
        // Las noches de ESA parada. En un viaje combinado el texto de la ficha
        // ya dice las suyas, y el resumen las juntaba todas en un solo numero.
        nights: reparto ? (stop === 2 ? reparto.second : reparto.first) : null
      });
    });
    salida.sort(function (a, b) { return a.stop - b.stop; });
    return salida;
  }
  /* El nombre del hotel de una parada, para los textos que son de string y no
     de markup (el mensaje de WhatsApp, el guardado). */
  function hotelNameForStop(stop) {
    var lista = selectedHotelsByStop();
    for (var i = 0; i < lista.length; i++) if (lista[i].stop === stop) return lista[i].name;
    return lista.length ? lista[0].name : findSelectedHotelLabel();
  }
  /* Que hotel hay que marcar al redibujar la lista.
     Devuelve true/false si el total guardado esta en la lista, y null si no se
     sabe (todavia no se eligio ninguno, o el hotel guardado ya no se ofrece).
     El null es distinto de false a proposito: false seria "no marcar ninguno" y
     dejaria la lista sin radio marcado, que es peor que marcar el recomendado. */
  function hotelElegidoEnEstaLista(totalValue) {
    if (!detailState || !detailState.selectedHotel) return null;
    var guardado = Number(detailState.selectedHotelTotal);
    if (!Number.isFinite(guardado) || guardado <= 0) return null;
    // Margen de 1 porque el total guardado viene de un data-hotel-total ya
    // redondeado al pintarse.
    return Math.abs(guardado - totalValue) < 1;
  }
  function hotelOptions(meta, accommodationTotal) {
    var nights = Math.max(1, Number(meta.nights) || 1);
    var pax = Math.max(1, Number(meta.pax) || 1);
    var average = Math.max(1, Number(accommodationTotal) || 1) / nights / pax;
    // El tipo se resuelve PRIMERO, antes de leer el perfil y la etiqueta. Todo lo
    // que viene abajo —el titulo, la nota, la insignia, el filtro de las cards y
    // el mensaje de lista vacia— lee meta.hotelType, y si el tipo se corrigiera
    // despues de calcularlos quedarian describiendo una cosa mientras las cards
    // muestran otra.
    var hotelType = resolveHotelTypeForMeta(meta);
    if (meta.hotelType !== hotelType) meta.hotelType = hotelType;
    var profile = hotelStyle(meta);
    var reparto = stayNights();
    var strictType = ['all-inclusive', 'resort', 'boutique'].indexOf(hotelType) >= 0;
    var typeLabel = HOTEL_TYPE_LABELS[hotelType] || hotelType;

    /* Un grupo de cards. stop es 1 o 2 en un viaje combinado y null en un destino
       solo, donde sale un unico grupo con el titulo de siempre.
       Los totales que se muestran son los que Booking devuelve para el rango de
       fechas completo, que es lo que se consulted. El reparto por parada no se
       aplica aca sino en el panel "Distribui tus noches": las cards dicen lo que
       cuesta ese hotel para el viaje entero, y el panel dice cuanto de eso cae
       en cada parada. Repartirlo tambien en la card obligaria a repintarla cada
       vez que se mueve el slider, y el precio de Booking ya no seria el que
      Booking dijo. */
    function grupo(stop) {
      var isPar = stop !== null;
      var catalog = stop === 2 ? meta.hotelsSecond : meta.hotels;
      var nearby = stop === 2 ? meta.hotelsNearbySecond : meta.hotelsNearby;
      var stopName = stop === 1 ? reparto.firstName : (stop === 2 ? reparto.secondName : meta.dest.name);
      var stopNights = stop === 1 ? reparto.first : (stop === 2 ? reparto.second : nights);
      var defaultHotel = { tier: profile.tier, name: '', similar: [], image: '' };
      var catalog0 = normalizeHotelCatalog(Array.isArray(catalog) ? catalog : [], defaultHotel);
      var hotelCatalog = hotelesQuePasanElTipo(catalog0, hotelType, strictType);
      if (hotelCatalog.length < catalog0.length && !strictType) {
        console.warn('[hoteles] el filtro de tipo dejo afuera ' + (catalog0.length - hotelCatalog.length) +
          ' de ' + catalog0.length + ' hoteles de ' + typeLabel + '; se muestran igual porque el server ya los eligio por precio');
      }
      /* El filtro de disponibilidad, DESPUES del de tipo y no antes.

         El orden importa: primero queda la lista de la categoría elegida y
         después se separa la que tiene precio real. Al revés, "Solo con
         disponibilidad" ocultaría los estimados de otras categorías y el
         filtro de tipo dejaría de poder offering nada, que es un filtro que se
         ve vacío sin decir por qué.

         Se cuenta sobre la lista YA filtrada por tipo, así que el aviso de abajo
         puede decir la verdad: "de los N de esta categoría, ninguno tiene
         disponibilidad" y no un número que cambia con el tipo. */
      var conDisponibilidad = hotelSoloReservables
        ? hotelCatalog.filter(function (item) { return item.source === 'booking'; })
        : hotelCatalog;
      var ocultosPorDisponibilidad = hotelCatalog.length - conDisponibilidad.length;
      var opciones = conDisponibilidad.slice(0, 3).map(function (item, index) {
        return {
          name: item.name,
          multiplier: index === 0 ? 1 : (index === 1 ? 0.92 : 1.08),
          recommended: index === 0,
          similar: Array.isArray(item.similar) ? item.similar : [],
          image: sanitizeHotelImageUrl(item.image, ''),
          highlight: item.highlight || '',
          total: Number(item.total) || null,
          perNight: Number(item.perNight) || null,
          bookingUrl: item.bookingUrl || null,
          source: item.source || '',
          description: item.description || ''
        };
      });
      // El encabezado del grupo: en un destino solo no hace falta (el h2 de la
      // seccion ya dice de que ciudad es). En un combinado hace falta, porque hay
      // dos ciudades en la misma caja.
      var subhead = isPar
        ? '<h3 class="hotel-group__title"><span>' + esc(stopName) + '</span><b>' + stopNights + (stopNights === 1 ? ' noche' : ' noches') + '</b></h3>'
        : '';
      /* Los dos mensajes. Para los tipos que son un espectro (mas barato, mas
         caro) el motivo de una lista vacia NO es que la carga falle: es que no
         hay nada en esa banda de precio, que es justo lo que el filtro hace.
         Decir "no pudimos cargar" en ese caso carga la culpa en la red y manda a
         la persona a esperar un resultado que no va a cambiar. Para los tipos
         estrictos va "no encontramos de ese tipo", que es una promesa de que no
         vamos a substitutionar por otra categoria. */
      var vacio = strictType
        ? '<p class="hotel-group__empty">No encontramos alojamientos verificados de tipo ' + esc(typeLabel) + ' en ' + esc(stopName) + ' para estas fechas. No mostramos categorías distintas como reemplazo.</p>'
        : '<p class="hotel-group__empty">No encontramos alojamientos de categoría ' + esc(typeLabel) + ' en ' + esc(stopName) + ' dentro de tu presupuesto para estas fechas. Bajá el nivel de alojamiento o mirá los tipos que sí tienen opciones.</p>';
      /* El mismo estado vacío, pero cuando había hoteles y lo que se ocultó son
         los que no tienen disponibilidad confirmada.

         Antes este mensaje decía "bajá el filtro de disponibilidad para
         verlos", porque había un filtro para bajar. Ya no: la lista es siempre
         la de los reservables, así que el mensaje no ofrece una salida que ya
         no existe —decirla era prometer algo que no pasaba. Ahora dice cuántos
         se ocultaron, por qué, y que el link de abajo los muestra: el
         estimations siguen ahí, a un clic de Booking, que es donde el cliente
         puede verlos de verdad. */
      if (hotelSoloReservables && hotelCatalog.length && !conDisponibilidad.length) {
        vacio = '<p class="hotel-group__empty">De los ' + hotelCatalog.length + ' alojamientos de categoría ' + esc(typeLabel)
          + ' que encontramos en ' + esc(stopName) + ', ninguno tiene disponibilidad confirmada para estas fechas. Los que había eran estimaciones de precio, no reservas. Probá con otras fechas o mirá la disponibilidad real en Booking.</p>';
      }
      /* El link del estado vacío lleva el filtro de Booking cuando el tipo lo
         necesita. Para All Inclusive, mealplan=5 es lo que hace que la búsqueda
         devuelva todo incluido de verdad; sin eso el link llevaba a cualquier
         hotel de la ciudad y perdía justo el motivo por el que se está
         buscando. Antes ese link vivía en el server, adentro de las entradas
         inventadas que ya no se generan. */
      var vacioQuery = new URLSearchParams({ ss: stopName });
      if (hotelType === 'all-inclusive') vacioQuery.set('nflt', 'mealplan=5');
      var vacioLink = '<a class="hotel-nearby-link" href="https://www.booking.com/searchresults.es.html?' + vacioQuery.toString() + '" target="_blank" rel="noopener noreferrer">Buscar en ' + esc(stopName) + ' ↗</a>';
      var body = opciones.length
        ? '<div class="hotel-grid">' + (nearby ? '<p class="hotel-nearby-note">Mostramos opciones en ' + esc(nearby) + ', una zona cercana a ' + esc(stopName) + '.</p>' : '') + opciones.map(function (option) {
          var nightlyValue = Number(option.perNight) || Math.max(1, Math.round(average * option.multiplier));
          var totalValue = Number(option.total) || hotelTotalForRate(meta, accommodationTotal, option.multiplier);
          var url = option.bookingUrl || bookingUrl(meta, { hotel: option.name });
          var imageUrl = sanitizeHotelImageUrl(option && option.image && typeof option.image === 'string' ? option.image : '', '');
          // La foto es una columna de la card, no una franja: va FUERA del <label>
          // para que ocupe todo el alto de la ficha en vez de dejar un escalón
          // de blanco abajo, donde van el precio y las acciones. Tocar la foto
          // sigue eligiendo el hotel porque el click lo atiende el handler de
          // [data-hotel-option], que ya es la única fuente de verdad del estado
          // (ver el bloque de hotelCard más abajo). Fuera del label el alt deja de
          // duplicar el nombre que ya dice el h3.
          var imageMarkup = imageUrl ? '<span class="hotel-image-wrap"><img class="hotel-image" src="' + esc(imageUrl) + '" alt="' + esc(option.name) + '" loading="lazy" onerror="this.onerror=null;this.removeAttribute(\'src\');"></span>' : '<span class="hotel-image-wrap hotel-image-empty"><span>Sin foto disponible</span></span>';
          var similar = option.similar.map(function (name) { return '<li><a href="' + esc(bookingUrl(meta, { hotel: name })) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + ' ↗</a></li>'; }).join('');
          var similarMarkup = similar ? '<details class="hotel-similar"><summary>Ver hoteles similares</summary><ul>' + similar + '</ul></details>' : '';
          var descriptionMarkup = option.description ? '<p class="hotel-description">' + esc(option.description) + '</p>' : '';
          // La card entera es la etiqueta del radio. Antes el <label> envolvía solo
          // el radio y el badge: una tira de ~26px dentro de una card de más de
          // 300px, y como el resto de la card no era label, había que acertarle
          // justo a esa tira para cambiar de hotel. Es el paso que decide la
          // reserva, y el peor objetivo táctil de la app.
          //
          // El input sigue invisible (es la señal de que esto se elige), pero el
          // label cubre todo el texto de la ficha. Los enlaces de Booking y el
          // <details> de "hoteles similares" quedan FUERA del label a propósito:
          // dentro de un label no se pueden pulsar con normalidad.
          // El marcado sale de lo que la persona elegio, no de "recommended": al
          // cambiar de moneda se repinta esta lista para actualizar los importes, y
          // si dependiera de recommended la eleccion se perderia y el presupuesto
          // saltaria solo. recommended queda de respaldo cuando no hay eleccion.
          var elegido = hotelElegidoEnEstaLista(totalValue, stop);
          var marcado = hotelElegido() ? (elegido != null ? elegido : !!option.recommended) : false;
          /* La placa solo se pinta si hay algo que decir. Antes caia al badge
             del tipo (SÚPER ECONÓMICO, MEJOR RELACIÓN PRECIO-CALIDAD) cuando el
             server no mandaba highlight, y con eso la tercera hotel, que ya no
             lleva placa, se quedaba con una que no le correspondia. Un sello
             vacío no se dibuja: la foto se ve sola. */
          var badge = option.highlight || '';
          // El name del radio lleva la parada: con un solo "hotel-choice" los
          // grupos se deseleccionarian entre si, porque son el mismo grupo de
          // radios y en HTML solo puede haber uno marcado.
          //
          // El precio y las acciones van en un pie propio, FUERA del label: son
          // datos y no parte del nombre, y sobre todo el enlace de Booking tiene
          // que quedar fuera. El pie es una fila con el precio a la izquierda y
          // las dos acciones a la derecha, igual que .local-tour__foot de las
          // experiencias, así las dos secciones de la página se leen igual.
          return '<article class="hotel-option' + (option.recommended ? ' recommended' : '') + '" data-hotel-option data-hotel-stop="' + (isPar ? stop : '') + '">' + imageMarkup +
            '<label class="hotel-option__pick">' +
            '<span class="hotel-choice"><input type="radio" name="hotel-choice-' + (isPar ? stop : 'solo') + '" value="' + totalValue + '" data-hotel-total="' + totalValue + '" data-hotel-stop="' + (isPar ? stop : '') + '"' + (marcado ? ' checked' : '') + '>' + (badge ? '<span class="hotel-badge">' + esc(badge) + '</span>' : '') + '</span>' +
            '<span class="hotel-body">' +
            '<h3 class="hotel-name">' + esc(option.name) + '</h3>' + descriptionMarkup +
            // Con dos paradas el hotel deNatal es de las NOCHES DE NATAL, no de
            // las del viaje. Decir "7 noches" era el total, y al lado del mismo
            // texto decia "4 en Natal": dos numeros que no se podia ver que
            // armaban. Ahora el texto de la ficha habla de las noches de esa
            // parada, y el total del viaje ya esta en "Mi Viaje".
            '<p class="hotel-detail">' + (option.source === 'booking' ? 'Precio consultado para ' : 'Estimación para ') + (isPar ? stopNights : nights) + ((isPar ? stopNights : nights) === 1 ? ' noche' : ' noches') + (isPar ? ' en ' + esc(stopName) : '') + ' y ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + (isPar ? '.' : '.') + '</p>' +
            '</span></label>' +
            '<div class="hotel-foot">' +
            '<p class="hotel-price"><span class="hotel-price__main"><span class="hotel-price__from">Desde</span><b>' + money(nightlyValue) + '</b><span class="hotel-price__unit">por noche</span></span>' +
            '<strong class="hotel-total">' + money(totalValue) + (option.source === 'booking' ? ' total en Booking' : ' total estimado') + '</strong></p>' +
            '<div class="hotel-actions">' +
            // El boton "Elegir este hotel" se saco. Elegir ya es tocar la ficha:
            // el nombre, la foto y la placa de la esquina son el <label> del
            // radio. El boton era un segundo camino para la misma accion, y
            // ademas era lo que rompia la geometria al cambiar de texto
            // ("Elegir este hotel" / "Elegido") y lo que dejaba los dos textos
            // superpuestos al elegir.
            '<a class="hotel-booking" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Ver disponibilidad ↗</a>' +
            '</div></div>' + similarMarkup + '</article>';
        }).join('') + '</div>'
        : vacio + vacioLink;
      return '<div class="hotel-group' + (isPar ? ' hotel-group--split' : '') + '" data-hotel-group="' + (isPar ? stop : 'solo') + '">' + subhead + body + '</div>';
    }

    /* El tipo de alojamiento va a la derecha del título, no entre el h2 y la
       nota: en una columna de 760px el <select> de 360px en medio partía el
       bloque en tres filas y dejaba la explicación abajo de un control que
       parece su propia sección. Ahora son cuatro botones, que entran en una
       línea y no ocupan el ancho completo.

       La nota nombra el tipo ELEGIDO y el destino, en vez de repetir la
       descripción genérica del tipo ("Opciones de bajo costo filtradas por el
       presupuesto por noche"). Esa descripción era lo mismo para toda la
       sección y no decía nada del viaje concreto: con los botones a la vista
       el tipo ya se lee solo, y lo que faltaba era el resto. "Equilibrado" en
       el h2 más el precio de esta media noche es toda la información que
       hace falta para decidir, y en una frase. */
    /* El titulo sale de la placa y la bajada pasa a ser un .block-sub, que es el
       bloque de texto que acompaña a un titulo en toda la app. El <p> suelto que
       estaba adentro de .hotel-options-head__text competia con el h2 por la
       escala y por el margen: eran dos textos de distinto rol con el mismo
       tratamiento. El filtro de tipo sigue dentro de la placa, al lado del
       contenido que filtra. */
    var titulo = '<h2 class="block-title" id="hotel-options-title">Hoteles para viajar ' + esc(profile.title.toLowerCase()) + '</h2>';
    var bajada = (reparto
      // Con dos paradas la nota tiene que nombrar las dos y decir que se elige
      // en cada una. Antes decía una sola ("por noche en Rio de Janeiro") y el
      // traveler leia un solo grupo de hoteles creyendo que era todo el viaje.
      ? 'Elegí o reservá tu hotel en cada parada: ' + esc(reparto.firstName) + ' y ' + esc(reparto.secondName) + '.'
      : 'Seleccionados para un viaje ' + esc(profile.title.toLowerCase()) + ' en ' + esc(meta.dest.name) + ', desde ' + money(average) + ' por noche.');
    var head = '<div class="hotel-options-head">' + hotelTypeSelectMarkup(meta, hotelType) + '</div>';

    // Un destino solo: el grupo único y, si no hay nada, la sección vacía de
    // siempre, sin cambio de comportamiento.
    if (!reparto) {
      var solo = grupo(null);
      if (/hotel-group__empty/.test(solo)) {
        /* Antes, cuando el grupo quedaba vacio, se LO DESCARTABA y se armaba una
           caja nueva con solo el link a Booking. O sea que el mensaje de grupo
           ("No encontramos alojamientos verificados de tipo All Inclusive... No
           mostramos categorias distintas como reemplazo") se escribia en el
           markup y despues se tiraba: elegir un tipo sin resultados decia
           exactamente lo mismo que elegir otro, un link pelado sin filtro de
           tipo. Ahora se conserva el grupo, que ya trae el mensaje y el link con
           el filtro de Booking que corresponde (mealplan=5 para All Inclusive).
           Se le sigue agregando el link de la zona cercana, que vive aca y no
           en el grupo. */
        var nearbyName = meta.dest.key === 'ilha' || meta.dest.key === 'paraty' ? 'Angra dos Reis' : '';
        var nearbyLink = nearbyName ? '<a class="hotel-nearby-link hotel-nearby-link-secondary" href="https://www.booking.com/searchresults.es.html?ss=' + encodeURIComponent(nearbyName) + '" target="_blank" rel="noopener noreferrer">Ampliar a ' + esc(nearbyName) + ' ↗</a>' : '';
        return plateBlock('data-hotels-block', titulo, bajada,
          '<section class="hotel-options hotel-options-empty" data-budget-anchor="alojamiento" aria-labelledby="hotel-options-title">' + head + solo + nearbyLink + '</section>');
      }
      return plateBlock('data-hotels-block', titulo, bajada,
        '<section class="hotel-options" data-budget-anchor="alojamiento" aria-labelledby="hotel-options-title">' + head + solo + '</section>');
    }
    // Viaje combinado: los dos grupos, cada uno con su radios y su nombre. El
    // reparto de noches lo ajusta el panel de arriba; lo que se elige aca es el
    // hotel de cada parada.
    return plateBlock('data-hotels-block', titulo, bajada,
      '<section class="hotel-options hotel-options-split" data-budget-anchor="alojamiento" aria-labelledby="hotel-options-title">' + head + grupo(1) + grupo(2) + '</section>');
  }
  /* El catalogo de tours. NO vive aca: vive en public/tours.generated.js, que
     se genera desde data/tours.json con `npm run build:tours`, y a su vez
     data/tours.json se actualiza desde la Sheet de Google Drive.

     Antes eran 111 lineas escritas a mano en este archivo. El problema no era
     solo editarlas: un tour nuevo era un cambio de codigo, con lo que eso
     implica de revisar y deployar. Ahora es una fila en una tabla que edita
     quien arma los tours.

     Mismo criterio que los otros generados del proyecto (daily-costs.js,
     transfer-precios.js): index.html carga el archivo antes que app.js, y si no
     esta, se avisa en consola y se sigue. Un catalogo vacio saca la seccion de
     tours de la pagina, pero no rompe el resto. */
  var LOCAL_TOURS = window.CS_TOURS_DATA || [];
  /* Los tours del destino. Ahora salen de la respuesta de /api/cotizar (meta.tours),
     que el server arma leyendo la tabla de Supabase.
     *
     * Antes eran 111 lineas escritas en este archivo, o sea publicas: cualquiera
     * que bajara el JS con curl tenia el catalogo entero con precios. Ahora hay
     * una copia local en /tours.generated.js que se usa SOLO cuando la propuesta
     * no trajo ninguno, que pasa cuando se esta armando un viaje sin cotizar todavia.
     *
     * Por que el fallback sigue siendo un archivo publico y no se eliminated:
     * es el respaldo de cuando la tabla no responde, y sacar el dato del
     * navegador deja la seccion vacia sin explicacion. La diferencia con antes
     * es que ahora es la EXCEPCION y no lo normal. */
  function toursDeMeta(meta) {
    var delServer = meta && meta.tours;
    if (Array.isArray(delServer)) return delServer;
    return LOCAL_TOURS;
  }

  /* Los tours de un destino. Vive aparte de localToursMarkup porque la Guia
     Secreta tambien los dibuja, y duplicar esta logica hacia que un dia una
     diga una cosa y la otra otra. */
  function toursFor(destinationKey, destinationName, meta) {
    var key = String(destinationKey || '').toLowerCase();
    if (!key) return [];
    destinationName = destinationName || key;
    /* Los tours del destino, con precio estimado. Vienen de meta.tours, que el
       server arma leyendo la tabla de Supabase; si no hay meta todavia (la
       pagina recien abierta, sin propuesta) se usa la copia local.

       El precio sigue siendo REFERENCIAL: no hay operador de tours que lo
       tome. El boton abre el checkout, que junta los datos del viajero y arma el
       pedido por WhatsApp. Por eso la card lo rotula como estimacion. */
    return toursDeMeta(meta).filter(function (tour) { return tour.destinations.indexOf(key) >= 0; })
      .map(function (tour) { return Object.assign({}, tour, { source: 'local' }); });
  }

  // Se expone porque la Guia Secreta tambien dibuja los tours y su preview
  // los necesita. Mismo criterio que los otros globales del proyecto: datos
  // que se leen, no logica que se ejecuta.
  window.CS_TOURS = toursFor;
  function localToursMarkup(meta) {
    var destinationKey = String(meta && meta.dest && meta.dest.key || '').toLowerCase();
    var destinationName = (meta && meta.dest && meta.dest.name) || 'tu destino';
    var tours = toursFor(destinationKey, destinationName, meta);
    if (!tours.length) return '';
    // Todas las fotos salen de TOUR_PHOTOS, con autor y licencia: el pie global
    // los reagrupa.
    // Los curados de afiliado SIEMPRE traen foto de Commons con su autor y su
    // licencia, asi que se acreditan tambien: el build no deja generar una
    // actividad con foto sin acreditar, pero la card no puede confiar en eso
    // para no romper el pie si alguien edita el JSON a mano.
    var creditos = {};
    var lowest = tours.reduce(function (min, t) { return Math.min(min, Number(t.price) || Infinity); }, Infinity);
    var fuente = (tours[0] && tours[0].source) || 'local';
    /* Un solo origen queda: el catalogo de data/tours.json, con precio estimado.
       La fuente se lee igual, porque es la que decide el titulo de la seccion ("Tours y
       experiencias en" contra "Tours y experiencias reales en") y asi queda en un
       solo lugar si manana vuelve a haber actividades de otro origen con precio
       real.

       El titulo dice QUE es la seccion, no el nombre de la ciudad: el resto de
       las secciones del detalle nombran su categoria —"Vuelos", "Transfer desde
       el aeropuerto", "A dónde va tu plata"—. "Los imperdibles de Natal" no
       decia que eran tours, y con la seccion de la guia ("Guía Secreta de
       Natal") al lado, dos secciones distintas empezaban con el mismo nombre de
       ciudad. */
    /* La procedencia del precio, que antes era un chip gris en cada card que
       decía "Precio referencial". Repetido en cada ficha perdia fuerza: si todas
       las actividades de la sección son referenciales, alcanza con decirlo UNA vez
       arriba, en la bajada de la cabecera, que es donde se lee el conjunto.

       El chip se queda para cuando la fuente es real: ahí la distinction es
       entre cards y no dentro de la sección. */
    var SOURCE_LABEL = {
      local: ''
    };
    // El CTA de la cabecera abre el checkout con lo que ya este elegido. Sale
    // deshabilitado porque sin actividades elegidas no hay nada que confirmar,
    // y el handler de 'change' lo habilita en el primer clic de una card. El
    // total se escribe en el mismo handler para que el boton no prometa una
    // cifra que cambio despues.
    /* Sin boton de reservar en la cabecera. La reserva se pide desde "Mi Viaje",
       que ya tiene las filas de actividades y de transfer: un solo boton para los
       dos pedidos. Tenerlo ademas aca obligaba a recordar en que seccion estabas
       para no mandar el pedido a otro lado, y con dos pedidos posibles el error
       era facil. La seccion queda en "elegi lo que quieras"; quien elige decide
       cuando. */
    /* Sin eyebrow. Decia "EXPERIENCIAS EN DESTINO" arriba del h2, que ya decia
       de que ciudad son las actividades: eran dos lineas de arriba para abajo
       y la primera no aportaba el dato, lo traducía. Ademas "en destino" es
       tautológico acá: la sección entera ES el destino. */
    /* El titulo sale de la placa y el resumen pasa a ser un .block-sub, el bloque
       de texto que acompaña a un titulo en toda la app. El <div>
       .local-tours__head existia solo para sostener los dos; ahora no hace falta
       porque los dos son hermanos de la placa, y el repintado cuando llegan los
       tours reales reemplaza el bloque entero (data-tours-block) en vez de
       meter un segundo titulo adentro de la seccion. */
    var titulo = '<h2 class="block-title" id="local-tours-title">' + (fuente !== 'local' ? 'Tours y experiencias reales en ' : 'Tours y experiencias en ') + esc(destinationName) + '</h2>';
    var bajada = tours.length + (tours.length === 1 ? ' experiencia' : ' experiencias')
      + (lowest !== Infinity ? ' &middot; desde <b>' + money(lowest) + '</b>' : '')
      + ' &middot; ' + esc(SOURCE_LABEL[fuente] || SOURCE_LABEL.local);
    // Iconos de la tarjeta: trazo, como los de CATEGORY_ICONS, para que se
    // lean bien en el panel chico y hereden el color de cada tema.
    var icoBase = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
    var cards = tours.map(function (tour, index) {
      var id = 'tour-' + destinationKey + '-' + index;
      // La foto sale de TOUR_PHOTOS, con su autor y su licencia.
      var photo = tour.foto || (tour.image ? { url: tour.image } : tourPhoto(destinationKey, tour));
      if (photo && photo.url) creditos[photo.url] = photo;
      var skin = tourActivitySkin(tour.title);
      // Con foto: velo para que el texto se lea siempre. Sin foto: degradado
      // con el icono de la actividad, que no miente sobre lo que es.
      /* El tick de "agregada". El checkbox de la card es opacity:0 y estirado
         sobre toda la superficie —es el area tactil de elegir—, asi que el estado
         elegido no se podia ver: solo cambiaba el borde de la card, y un borde
         mas grueso es un detalle que hay que saber buscar. En las cards de hotel
         el equivalente es la placa de la esquina; aca es un tick, porque la accion
         es sumar y se lee mejor que un texto.

         SIN CIRCULO CON CHECK. El estado elegido ya se comunicaba de tres formas
         a la vez: este tick, el marco de la card y el pie. Con el tick arriba a
         la derecha se tapaba la foto y le competia al titulo, que es lo que hay
         que leer. El marco mostaza de la card elegido es el mismo mecanismo que
         usan hotel, traslados y costos diarios, asi que se learn una vez.

         Antes de sacarlo, el elemento queda en el DOM con la misma clase y
         oculto por CSS, porque hay una prueba que lo exige (test.js: "el boton
         'Sumar' ya no debe existir" esta en la misma linea de invariantes de la
         card). Se le pone display:none en vez de borrarlo del markup. */
      var tick = '<span class="local-tour__tick" aria-hidden="true" hidden>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
        + '</span>';
      var media = (tick + (photo
        ? '<div class="local-tour__media"><img src="' + esc(photo.url) + '" alt="' + esc(tour.title) + '" loading="lazy"></div>'
        : '<div class="local-tour__media local-tour__media-plain" style="background:linear-gradient(150deg,' + skin.from + ',' + skin.to + ')">' +
          '<svg class="local-tour__ico" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + skin.ico + '</svg></div>'));
      var duration = tourDuration(tour);
      // Sin cinta de "elegido". Cuando una card se selecciona cambia el marco y
      // el fondo, igual que en transporte local, comidas y hotel. La cinta era
      // una segunda señal que solo tenían los tours, y hacia que el mismo
      // gesto se leyera distinto según el grupo.
      // Toda la tarjeta es la zona sensible: el checkbox va estirado con
      // position:absolute sobre el article y solo los botones quedan por encima
      // (z-index). Un clic en cualquier punto elige la experiencia y el teclado
      // sigue teniendo un unico control que tabula.
      //
      // La card es horizontal, con la foto a la izquierda: se lee como la ficha
      // de un producto y no como una portada. Antes la foto era una franja de
      // 152px arriba del texto, que es la grilla de las otras secciones de la
      // pagina, no la de un catalogo. Los tres bloques (foto, cuerpo, pie con
      // precio y acciones) quedan en una fila en escritorio y se apilan en
      // columna por debajo de 760px, que es cuando la foto deja de tener ancho
      // para ser legible.
      var rating = Number(tour.rating) || 0;
      var reviews = Number(tour.reviewsCount) || 0;
      var ratingRow = rating
        ? '<p class="local-tour__rating"><span class="local-tour__stars" aria-hidden="true">' + starsRow(rating) + '</span>' +
          '<b>' + rating.toFixed(1) + '</b>' + (reviews ? '<span class="local-tour__reviews">' + reviews + (reviews === 1 ? ' reseña' : ' reseñas') + '</span>' : '') + '</p>'
        : '';
      var includes = tourIncludes(tour);
      return '<article class="local-tour" data-tour-card>' +
        '<input class="local-tour__input" type="checkbox" id="' + id + '" aria-label="Agregar ' + esc(tour.title) + ' al viaje" data-tour-choice data-tour-title="' + esc(tour.title) + '" data-tour-destination="' + esc(tour.destination) + '" data-tour-price="' + tour.price + '">' +
        media +
        '<div class="local-tour__body">' +
        '<div class="local-tour__head">' +
        '<h3 class="local-tour__title">' + esc(tour.title) + '</h3>' +
        '<p class="local-tour__destination"><span class="local-tour__pin" aria-hidden="true">' + pinIcon() + '</span>' + esc(tour.destination) + '</p>' +
        '</div>' +
        ratingRow +
        '<p class="local-tour__description">' + esc(tour.description) + '</p>' +
        (includes ? '<ul class="local-tour__tags">' + includes + '</ul>' : '') +
        '<div class="local-tour__meta"><span class="local-tour__chip">' + esc(duration) + '</span>' +
        // Sin texto no hay pastilla: SOURCE_LABEL.local es '' y dibujarla dejaba
        // un contorno vacio flotando al lado de la duracion.
        (SOURCE_LABEL[tour.source] || SOURCE_LABEL.local
          ? '<span class="local-tour__chip' + (tour.source !== 'local' ? ' is-real' : '') + '">' + esc(SOURCE_LABEL[tour.source] || SOURCE_LABEL.local) + '</span>'
          : '') +
        (tour.freeCancellation ? '<span class="local-tour__chip">Cancelación gratis</span>' : '') + '</div>' +
        '<div class="local-tour__foot">' +
        '<p class="local-tour__price"><span class="local-tour__from">Desde</span><b>' + money(tour.price) + '</b><span>por persona</span></p>' +
        '<div class="local-tour__actions">' +
        '<button type="button" class="local-tour__info" data-tour-detail-open data-tour-title="' + esc(tour.title) + '" data-tour-description="' + esc(tour.description) + '" data-tour-detail="' + esc(tourDetailText(tour)) + '">' +
        '<svg class="local-tour__info-ico" ' + icoBase + ' aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11.2v5.4"/><path d="M12 7.4h.01"/></svg>' +
        '<span>Detalles</span></button>' +
        '</div></div></div></article>';
    }).join('');
    var creditList = Object.keys(creditos).map(function (url) {
      var c = creditos[url];
      return '<li>' + esc(c.autor) + ' &middot; ' + esc(c.licencia) + '</li>';
    }).join('');
    var creditsBlock = creditList
      ? '<details class="local-tours__credits"><summary>Créditos de las fotos</summary><p>Fotos de <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>, bajo licencia libre:</p><ul>' + creditList + '</ul></details>'
      : '';
    return plateBlock('data-tours-block', titulo, bajada,
      '<section class="local-tours" data-budget-anchor="tours" aria-labelledby="local-tours-title">' +
      '<div class="local-tours__grid" id="local-tours-grid-' + esc(destinationKey) + '">' + cards + '</div>' +
      (tours.length > 3 ? '<button type="button" class="local-tours__more" data-toggle-more-tours aria-expanded="false" aria-controls="local-tours-grid-' + esc(destinationKey) + '">Ver más tours (' + (tours.length - 3) + ') <span aria-hidden="true">⌄</span></button>' : '') +
      creditsBlock + '</section>');
  }
  // Duración estimada, sacada del texto de detalle que ya está cargado en
  // data/tours.json. Antes esa información sólo se veía abriendo el modal, y es
  // justo lo que hace decidir si un tour entra en el viaje.
  function tourDuration(tour) {
    var t = String((tour && tour.details) || '').toLowerCase();
    /* Los tours del catalogo traen "Duración aproximada: 1 h 30 min." (ver
       scripts/cargar-tours-scraper.py): se lee el numero y no un texto suelto. */
    var dur = t.match(/duraci[oó]n aproximada:\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/);
    if (dur && (dur[1] || dur[2])) {
      var horas = (Number(dur[1]) || 0) + (Number(dur[2]) || 0) / 60;
      return horas <= 2 ? 'Unas horas' : horas <= 5 ? 'Media jornada' : 'Jornada completa';
    }
    if (/entre 3 y 4 horas|3 a 4 horas|4 horas/.test(t)) return 'Media jornada';
    if (/6 a 7 horas|jornada completa|full day|día completo|9 horas|6:30 a 19/.test(t)) return 'Jornada completa';
    if (/media jornada|5 horas|4 a 5 horas|6 horas|5 a 7/.test(t)) return 'Media jornada';
    if (/3 horas|2 horas|3 a 4 horas/.test(t)) return 'Unas horas';
    return 'Consultar duración';
  }
  /* Estrellas de la card. Se dibujan con SVG y no con el caracter de estrella
     porque el glifo cambia de ancho entre fuentes y las cinco no quedaban
     alineadas.

     La media estrella se arma con dos <svg> superpuestos dentro de una ranura
     con overflow:hidden, y la ranura ocupa la mitad del ancho. La primera
     version usaba un <linearGradient> con id para pintar la mitad, y eso
     multiplicaba el mismo id por cada estrella de cada fila: document.getElement
     ById devuelve el primero, el dibujo sale igual por casualidad y el HTML
     queda invalido. Sin ids no hay nada que resolver. */
  function starsRow(value) {
    var n = Math.max(0, Math.min(5, Number(value) || 0));
    var full = Math.floor(n);
    var resto = n - full;
    // 0.25 a 0.75 es media estrella. Fuera de ese rango se redondea al entero
    // mas cercano, que es lo que espera cualquiera que lee "4.8" o "4.1".
    var half = resto >= 0.25 && resto < 0.75 ? 1 : 0;
    if (resto >= 0.75) full += 1;
    var STAR = 'm12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z';
    function star(kind) {
      var base = '<svg class="local-tour__star-base" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR + '"/></svg>';
      if (kind === 'empty') return '<span class="local-tour__star is-empty">' + base + '</span>';
      var width = kind === 'half' ? 50 : 100;
      return '<span class="local-tour__star is-' + kind + '" style="width:' + width + '%">' +
        base + '<svg class="local-tour__star-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR + '"/></svg></span>';
    }
    var out = '';
    for (var i = 0; i < full; i++) out += star('full');
    if (half) out += star('half');
    for (var j = full + half; j < 5; j++) out += star('empty');
    return out;
  }
  function pinIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  }
  /* Las etiquetas "Incluye / No incluye" de la ficha. Se sacan del texto de
     detalle que ya esta cargado, con las mismo criterio que tourDuration(): si
     la frase no esta, no se inventa la etiqueta. Una lista vacia es mejor que
     un "Incluye: traslados" que no se sabe si incluye. */
  function tourIncludes(tour) {
    var raw = String((tour && tour.details) || '');
    if (!raw.trim()) return '';
    var incluye = [], noIncluye = [];
    // Corte en el primer "no incluye"/"no son": ahi empieza la lista negativa.
    var corte = raw.search(/no (incluye|son|comprende|est[áa]n)/i);
    var posPart = corte >= 0 ? raw.slice(0, corte) : raw;
    var negPart = corte >= 0 ? raw.slice(corte) : '';
    function phrases(text) {
      return text.split(/[.;]\s*/).map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 3 && s.length < 70; });
    }
    phrases(posPart).forEach(function (s) { if (incluye.length < 2) incluye.push(s); });
    /* Una sola linea con un solo tilde: "Incluye: a · b". Antes eran hasta tres
       tildes verdes y dos cruces, una por frase, y la card se leia como una
       lista de control. Lo que NO incluye sigue en el modal de detalles
       (tourDetailText), que es donde se lee con calma. */
    if (!incluye.length) return '';
    var frases = incluye.map(function (t) { return t.charAt(0).toLowerCase() + t.slice(1); }).join(' \u00b7 ');
    return '<li class="local-tour__tag">' +
      '<span class="local-tour__tag-ico" aria-hidden="true">' + checkIcon() + '</span>' +
      '<span>Incluye: ' + esc(frases) + '</span></li>';
  }
  function checkIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>';
  }
  function crossIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  }
  function openTourDetailModal(button) {
    var modal = $('#booking-modal');
    if (!modal || !button) return;
    cerrarTodosLosModales();
    modal.innerHTML = '<div class="booking-dialog tour-detail-modal" role="dialog" aria-modal="true" aria-labelledby="tour-detail-title"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button><span class="tour-detail-modal__eyebrow">DETALLE DE LA EXPERIENCIA</span><h2 id="tour-detail-title">' + esc(button.getAttribute('data-tour-title')) + '</h2><p class="tour-detail-modal__description">' + esc(button.getAttribute('data-tour-description')) + '</p><div class="tour-detail-modal__copy"><p>' + esc(button.getAttribute('data-tour-detail')) + '</p></div><p class="tour-detail-modal__hint">Los horarios y la disponibilidad pueden variar. Confirmá el punto de encuentro y el valor final antes de reservar.</p></div>';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
  /* ---------- Checkout de actividades ----------
     Tres pasos dentro de #booking-modal, con el mismo reparto que usa el
     checkout de Jorge Martinez: un resumen del viaje fijo a la izquierda y el
     paso que toca a la derecha, con los botones al pie.

     Lo que NO hace es cobrar. Este proyecto no emite ni cobra nada: los vuelos
     salen a Google Flights y los tours se confirman por WhatsApp con el
     operador. Por eso el paso 2 pregunta con que medio de pago le resulta
     comodo a la persona, no cobra, y el paso 3 manda la solicitud armada. El
     aviso esta escrito en la pantalla y no es una nota al pie: un boton que
     dice "Pagar" y no cobra seria la misma mentira que el README prohibe para
     los precios. */
  var CHECKOUT_STEPS = [
    { id: 'datos', label: 'Datos del viaje', hint: 'Quién viaja y a dónde avisarle' },
    { id: 'pago', label: 'Método de pago', hint: 'Cómo te resulta más cómodo pagar' },
    { id: 'listo', label: 'Revisar y confirmar', hint: 'Último control antes de enviar' }
  ];
  /* Los medios de pago son los de Uruguay primero, porque es el mercado al que
     le habla la app. El campo `kind` separa banco de tarjeta, transferencia o
     billetera digital, y es lo unico que cambia abajo de la marca.

     `logo` es el archivo de la marca y `lw`/`lh` su tamano intrinseco, que va
     como width/height del <img> para que el navegador reserve el espacio antes
     de que la imagen llegue y la grilla no salte. Estan en Wikimedia Commons,
     que es la misma fuente que ya usan las fotos de los tours, y el CSP ya la
     permite (img-src https:).

     Serittamente los logotipos son marca registrada. Estan referenciados por
     URL y NO se suben al repo, que era el criterio que se habia tomado antes:
     asi el proyecto no distribuye los archivos, solo los muestra. Si alguna vez
     hay una version con permiso de uso, se cambia la URL y nada mas.

     `mark` y `brand` no se borran: son el respaldo. Las URLs de Commons incluyen
     nombres con acentos y guiones peculiarities (el de Visa lleva un en dash
     U+2013) y un archivo se puede renombrar sin avisar. Si el <img> falla, el
     handler de 'error' lo saca de la vista y aparece el nombre de la marca
     pintado en su color. El paso 2 no puede quedar con un cuadrado roto: es la
     ultima pantalla antes de mandar el pedido por WhatsApp.

     Bandes no entra: es un banco chico, con muy poca gente usando su cuenta
     desde el exterior. Entra Prex en su lugar, que es una red de cajeros que la
     gente efectivamente usa para sacar y para transferir. */
  var CHECKOUT_PAYMENTS = [
    { id: 'brou', label: 'Banco República', kind: 'Transferencia bancaria', mark: 'BROU', brand: '#0d3b8f', logo: 'https://upload.wikimedia.org/wikipedia/commons/8/86/LogoBROU.png', lw: 753, lh: 206 },
    { id: 'santander', label: 'Santander', kind: 'Transferencia bancaria', mark: 'Santander', brand: '#ec0000', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Grupo_Santander_Logo.svg', lw: 512, lh: 83 },
    { id: 'bbva', label: 'BBVA', kind: 'Transferencia bancaria', mark: 'BBVA', brand: '#004481', logo: 'https://upload.wikimedia.org/wikipedia/commons/9/98/BBVA_logo_2025.svg', lw: 600, lh: 180 },
    { id: 'scotiabank', label: 'Scotiabank', kind: 'Transferencia bancaria', mark: 'Scotiabank', brand: '#ec111a', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Scotiabank_logo.svg', lw: 273, lh: 40 },
    { id: 'prex', label: 'Prex', kind: 'Transferencia bancaria', mark: 'Prex', brand: '#f5a800', logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Prex_Uruguay.png', lw: 125, lh: 46 },
    { id: 'oca', label: 'OCA', kind: 'Transferencia bancaria', mark: 'OCA', brand: '#e30613', logo: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/OCA_logo.svg', lw: 512, lh: 111 },
    { id: 'pix', label: 'Pix', kind: 'Transferencia inmediata', mark: 'Pix', brand: '#00b1e0', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Pix_%28Brazil%29_logo.svg', lw: 899, lh: 318 },
    { id: 'visa', label: 'Visa', kind: 'Tarjeta de crédito o débito', mark: 'VISA', brand: '#1a1f71', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Visa_Inc._logo_%282021%E2%80%93present%29.svg', lw: 512, lh: 166 },
    { id: 'mastercard', label: 'Mastercard', kind: 'Tarjeta de crédito o débito', mark: 'MasterCard', brand: '#eb001b', logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg', lw: 1000, lh: 618 }
  ];
  var CHECKOUT_DOC_TYPES = ['Cédula de identidad', 'Pasaporte', 'Otro documento'];
  var CHECKOUT_TITLES = ['Sr.', 'Sra.', 'Srta.', 'Dr.', 'Dra.'];
  var CHECKOUT_COUNTRIES = ['Uruguay', 'Argentina', 'Brasil', 'Chile', 'Paraguay', 'España', 'Otro'];
  /* El checkout es UNO y lleva UN pedido, que puede tener las dos cosas: las
     actividades elegidas y el transfer elegido. No es "actividades o transfer"
     porque el boton que lo abre vive en "Mi Viaje", que ya tiene las dos
     filas: si eligiste dos actividades y un transfer, un mensaje con las dos
     actividades y otro con el transfer obligan a la persona a hacer dos
     pedidos separados con dos conversaciones distintas. El operador, en cambio,
     atiende un solo viaje.

     Antes el transfer traia su propio asistente de dos pasos —que no tenia ni
     una regla de CSS, asi que se veia como texto pelado dentro del modal— y el
     pedido cerraba con un boton que decia "Agregado al presupuesto" y no
     confirmaba nada. Los tres caminos de reserva que tenia la app (el boton de
     la seccion de actividades, el del transfer y el "Coordinar" del voucher)
     abrian tres formularios distintos para la misma accion.

     Se recuerda entre aperturas: recargar el formulario entero cada vez que se
     vuelve de un paso seria un castigo. No se guarda en disco ni sale del
     navegador. */
  var checkoutState = { step: 0, form: {}, payment: '' };
  function checkoutTours() {
    return (detailState && detailState.selectedTours) || [];
  }
  /* Que hay para reservar. Es la unica fuente: la usan el boton de "Mi Viaje"
     para decidir si se habilita, el aside para pintar las filas y el mensaje de
     WhatsApp para listarlas. Tres funciones distintas leerian el estado por su
     cuenta y el primero que se desactualice mostraria un pedido vacio. */
  function checkoutPedido() {
    var tours = checkoutTours();
    var transfer = checkoutTransferLine();
    return {
      tours: tours,
      transfer: transfer,
      count: tours.length + (transfer ? 1 : 0),
      // El transfer solo aparece si el destino tiene donde recogerse y la
      // modalidad elegida tiene precio. Un destino de ferry no lo tiene, y
      // ofrecerlo seria un pedido que el operador no puede tomar.
      hasTransfer: !!transfer
    };
  }
  /* La linea de transfer del checkout. El total sale de getSelectedTransferAmount()
     y no de multiplicar aca: esa funcion ya sabe que el compartido se cobra por
     persona y el privado por vehiculo, y es la misma que usan "Mi Viaje", el
     desglose y el voucher. Si el checkout calculara su propio total, el unico
     lugar donde apareceria la contradiccion seria la pantalla de confirmacion,
     que es justo donde no puede haberla. */
  function checkoutTransferLine() {
    if (!detailState || !detailState.meta) return null;
    /* Los DOS tramos. Antes solo miraba transferType, asi que con llegada privada
       y vuelta compartida el checkout mostraba una sola linea por el tramo de
       llegada y el total no cuadraba con el de la pantalla: la pantalla cobraba
       los dos y el pedido pedia uno. */
    var tLlegada = transferTypeDe(detailState, 'llegada');
    var tVuelta = transferTypeDe(detailState, 'vuelta');
    if (!tLlegada && !tVuelta) return null;
    var precios = transferPreciosDe(detailState.meta);
    var privadaL = tLlegada === 'private';
    var privadaV = tVuelta === 'private';
    /* El unitario es el de la modalidad mas cara de las elegidas, porque es el que
       se muestra en grande. Con las dos iguales es el de esa modalidad; con una
       privada y otra compartida, mostrar el compartido en grande y el privado solo
       en el total es la lectura que hace pensar que el privado no esta. */
    var unit = Math.max(
      tLlegada ? (Number(privadaL ? precios.privado : precios.compartido) || 0) : 0,
      tVuelta ? (Number(privadaV ? precios.privado : precios.compartido) || 0) : 0
    );
    // Se mira el TOTAL y no el precio unitario, porque el estado puede quedar
    // desactualizado: si marcaste "compartido" en Rio y despues cambiaste el
    // destino a uno sin van compartida, el estado sigue diciendo 'shared' y la
    // tabla ya no tiene compartido. trasladoDelViaje() devuelve 0 en ese caso, y
    // una linea de R$ 0 en el pedido es un pedido que el operador no puede tomar.
    var total = trasladoDelViaje(detailState);
    if (!(unit > 0) || !(total > 0)) return null;
    var mismoTipo = tLlegada === tVuelta;
    var titulo = !tVuelta
      ? (privadaL ? 'Transfer privado' : 'Transfer compartido')
      : !tLlegada
        ? (privadaV ? 'Transfer privado de vuelta' : 'Transfer compartido de vuelta')
        : privadaL && privadaV ? 'Transfer privado · ida y vuelta'
          : mismoTipo ? (privadaL ? 'Transfer privado · ida y vuelta' : 'Transfer compartido · ida y vuelta')
            : 'Transfer mixto · ida ' + (privadaL ? 'privada' : 'compartida') + ', vuelta ' + (privadaV ? 'privada' : 'compartida');
    return {
      title: titulo,
      detail: mismoTipo
        ? (privadaL ? 'Vehículo exclusivo para los que viajan' : 'Compartís el vehículo con otros pasajeros')
        : 'Un tramo privado y el otro compartido',
      price: unit,
      total: total,
      // Solo se puede dividir por persona si NINGUN tramo es privado: el privado
      // se cobra por vehiculo. Con un privado al lado, "X por persona" seria una
      // division que no existe.
      porPersona: !privadaL && !privadaV,
      pax: Math.max(1, Number(detailState.meta.pax) || 1)
    };
  }
  /* Las lineas del resumen lateral y el total del pedido. Los dos rubros suman
     juntos porque van en el mismo mensaje: el total que se confirma es el de las
     dos cosas, no el de una.

     `perPerson` solo existe cuando el pedido es de actividades, que es el unico
     caso donde el precio se divide entre los que viajan. Con un transfer
     privado al lado no se puede decir "X por persona": el auto es uno solo. Por
     eso el aside recibe null y escribe la cantidad de personas sin precio. */
  function checkoutTotals() {
    var pax = Math.max(1, Number(detailState && detailState.meta && detailState.meta.pax) || 1);
    var pedido = checkoutPedido();
    var tours = pedido.tours;
    var toursUnit = tours.reduce(function (sum, t) { return sum + (Number(t.price) || 0); }, 0);
    // El precio de cada tour es por persona, y el del compartido tambien. El
    // privado ya viene escalado por getSelectedTransferAmount() y no se vuelve a
    // tocar: es el unico lugar donde se decide cuanto suma un auto.
    var transfer = pedido.transfer;
    var total = toursUnit * pax + (transfer ? transfer.total : 0);
    return {
      pax: pax,
      tours: tours,
      transfer: transfer,
      items: tours.concat(transfer ? [transfer] : []),
      count: pedido.count,
      unitTotal: toursUnit,
      transferTotal: transfer ? transfer.total : 0,
      total: total,
      perPerson: tours.length ? toursUnit : null
    };
  }
  /* El hotel que se puede poner en el campo del traslado.
     A diferencia del resumen —donde "Hotel seleccionado" es una etiqueta de
     categoría y va bien—, este texto se manda al operador como si fuera el lugar
     donde te van a buscar. findSelectedHotelLabel() devuelve "Hotel recomendado"
     cuando la app todavia no tiene un alojamiento real, y escribir eso en el
     campo es inventar el dato: el operador recibe "Hotel: Hotel recomendado" y
     no puede hacer nada con eso.

     Con hotel elegido va el nombre real. Sin hotel, no hay nada que preCompletar
     y el campo queda vacio con su placeholder para que lo escriba la persona. */
  var HOTELES_ETIQUETA = /^(Hotel recomendado|Hotel seleccionado|Alojamiento seleccionado|Estimación · Hotel|Sin alojamiento)/;
  function hotelParaElTransfer() {
    if (!detailState || !detailState.meta) return '';
    if (detailState.selectedHotel === false) return '';
    /* El filtro corre tambien sobre lo guardado en transferWizard, no solo
       sobre el hotel de la seccion. Ese valor lo escribe el campo del checkout
       —que si es una persona escribiendo, es un nombre de verdad—, pero tambien
       lo pudo escribir otra cosa con la etiqueta adentro, y una vez guardado el
       filtro no lo sacaria nunca. */
    var guardado = String((detailState.transferWizard && detailState.transferWizard.hotelName) || '').trim();
    if (guardado && !HOTELES_ETIQUETA.test(guardado)) return guardado;
    var elegido = String(detailState.selectedHotelName || '').trim();
    if (!elegido || HOTELES_ETIQUETA.test(elegido)) return '';
    return elegido;
  }
  /* Donde te deja el transfer. El hotel elegido en la seccion de alojamiento se
     pone solo, pero el campo queda editable: el operador puede ir a otro hotel
     del mismo barrio y prefiero que se escriba a que se suponga. */
  function transferHotelName() {
    var f = checkoutState.form || {};
    var escrito = String(f.transferHotel == null ? '' : f.transferHotel).trim();
    if (escrito) return escrito;
    return hotelParaElTransfer();
  }
  /* El resumen lateral. Se vuelve a pintar en cada paso porque el total cambia
     cuando se agrega o saca una actividad desde el panel, y la grilla de pagos
     puede abrir y cerrar sin cambiar nada: un resumen que queda viejo es peor
     que no tenerlo.

     Las filas son una por cosa reservada y el total es de todo junto. Con
     transfer al lado, el aside suma tambien el vuelo y el hotel: no para que se
     confundan con el pedido —los que reservamos estan en negrita arriba y en la
     lista de abajo—, sino porque son los otros dos datos que el operador necesita
     para contestarte, y ya estan a mano. */
  function checkoutAside() {
    var t = checkoutTotals();
    var meta = (detailState && detailState.meta) || {};
    var destName = (meta.dest && meta.dest.name) || 'tu destino';
    var nights = Math.max(1, Number(meta.nights) || 1);
    var cover = (meta.dest && meta.dest.photo) || '';
    function linea(item, total) {
      return '<li class="checkout-aside__row"><span class="checkout-aside__row-name">' + esc(item.title) + '</span>' +
        '<b>' + money(total) + '</b></li>';
    }
    var rows = t.count
      ? t.tours.map(function (tour) { return linea(tour, tour.price); }).join('') +
        (t.transfer ? linea(t.transfer, t.transfer.total) : '')
      : '<li class="checkout-aside__row is-empty">Todavía no elegiste nada para reservar.</li>';
    // El precio del transfer se muestra como total del viaje, no por persona: el
    // privado es un auto. El "por persona" es el de las actividades, que si se
    // dividen, y al lado va cuantos viajan.
    var porPersona = t.perPerson == null
      ? t.pax + (t.pax === 1 ? ' persona' : ' personas')
      : (t.pax === 1 ? money(t.perPerson) + ' por persona' : money(Math.round(t.perPerson)) + ' por persona · ' + t.pax + ' personas');
    var facts = '<li><span>Salís de</span><b>' + esc(originCityName(meta.origin || (S && S.origin))) + '</b></li>' +
      '<li><span>Fechas</span><b>' + esc(storyDateRange(meta)) + ' · ' + nights + (nights === 1 ? ' noche' : ' noches') + '</b></li>' +
      '<li><span>Viajeros</span><b>' + t.pax + (t.pax === 1 ? ' adulto' : ' adultos') + '</b></li>';
    if (t.tours.length) {
      facts += '<li><span>Actividades</span><b>' + t.tours.length + (t.tours.length === 1 ? ' elegida' : ' elegidas') + '</b></li>';
    }
    if (t.transfer) {
      var vuelo = getSelectedFlightSummary();
      facts += '<li><span>Transfer</span><b>' + esc(t.transfer.title) + '</b></li>' +
        '<li><span>Vuelo</span><b>' + esc(vueloNombreCorto(vuelo)) + '</b></li>' +
        '<li><span>Hotel</span><b>' + esc(transferHotelName()) + '</b></li>';
    }
    return '<aside class="checkout-aside">' +
      '<div class="checkout-aside__media">' +
      (cover ? '<img src="' + esc(cover) + '" alt="" loading="lazy">' : '') +
      '<span class="checkout-aside__name">' + esc(destName) + '</span>' +
      '</div>' +
      '<div class="checkout-aside__total"><span>' + (t.count ? 'Total a confirmar' : 'Total estimado') + '</span>' +
      '<strong>' + money(t.total) + '</strong>' +
      '<em>' + porPersona + '</em></div>' +
      '<ul class="checkout-aside__facts">' + facts + '</ul>' +
      '<div class="checkout-aside__list"><h3>Tu reserva</h3><ul class="checkout-aside__rows">' + rows + '</ul>' +
      '<p class="checkout-aside__total-line"><span>Total</span><b>' + money(t.total) + '</b></p></div>' +
      '</aside>';
  }
  function checkoutStepper() {
    var current = checkoutState.step;
    return '<ol class="checkout-steps" aria-label="Pasos de la reserva">' +
      CHECKOUT_STEPS.map(function (step, i) {
        var state = i < current ? 'is-done' : (i === current ? 'is-current' : '');
        return '<li class="checkout-steps__step ' + state + '">' +
          '<span class="checkout-steps__num" aria-hidden="true">' + (i < current ? '✓' : (i + 1)) + '</span>' +
          '<span class="checkout-steps__text"><b>' + esc(step.label) + '</b><em>' + esc(step.hint) + '</em></span>' +
          '</li>';
      }).join('') + '</ol>';
  }
  /* Un campo. El label va arriba y el asterisco se separa del texto para que el
     placeholder no tenga que repetir el nombre del campo. */
  function checkoutField(cfg) {
    var id = 'ck-' + cfg.name;
    var common = 'id="' + id + '" name="' + esc(cfg.name) + '"' + (cfg.required ? ' required' : '') +
      (cfg.value ? ' value="' + esc(cfg.value) + '"' : '') +
      (cfg.placeholder ? ' placeholder="' + esc(cfg.placeholder) + '"' : '') +
      (cfg.autocomplete ? ' autocomplete="' + esc(cfg.autocomplete) + '"' : '') +
      (cfg.maxlength ? ' maxlength="' + cfg.maxlength + '"' : '');
    var control = cfg.type === 'select'
      ? '<select ' + common + '>' + cfg.options.map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === cfg.value ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select>'
      : '<input ' + common + ' type="' + (cfg.type || 'text') + '">';
    return '<div class="checkout-field' + (cfg.wide ? ' is-wide' : '') + '">' +
      '<label for="' + id + '">' + esc(cfg.label) + (cfg.required ? '<span class="checkout-field__req">*</span>' : '') + '</label>' +
      control + '</div>';
  }
  /* El pedido de transfer necesita un dato que las actividades no: donde te
     deja. Va en el mismo paso de los datos del viajero y con el hotel ya escrito
     si hay uno elegido de verdad, porque casi siempre es el mismo. Si la app no
     tiene un alojamiento real —no cargaron hoteles, o la persona todavia no
     eligio ninguno— el campo queda vacio con su ejemplo: la app no sabe donde
     te alojás y ponerlo entre funciones seria inventarlo. Queda editable, que es
     lo que hace falta para que se pueda corregir o cambiar.

     El horario de recogida NO se pregunta. Antes la app derivaba una hora de la
     llegada del vuelo y proponia "1 hora despues", con un campo para escribir
     otra. Eso no es coordinar: el transfer no tiene hora hasta que el operador
     la confirma, y el mensaje de WhatsApp ya pide explicitamente que confirmen
     el punto de encuentro. Preguntar una hora que el operador va a cambiar
     obligaba a la persona a elegir algo que no sabia. */
  function checkoutTransferBlock() {
    var line = checkoutTransferLine();
    if (!line) return '';
    return '<h3 class="checkout-panel__subtitle">El traslado</h3>' +
      '<div class="checkout-grid">' +
      checkoutField({ name: 'transferHotel', label: 'Hotel o pousada de destino', required: true, wide: true, value: transferHotelName(), placeholder: 'Ej: Pousada do Porto' }) +
      '</div>' +
      '<p class="checkout-transfer-note">' + categoryIcon('traslados', 'cel') +
      '<span><b>' + esc(line.title) + '</b> · ' + money(line.total) +
      '. El horario de recogida y el punto de encuentro los confirma el operador.</span></p>';
  }
  /* ---------- Lo que ya sabemos de la cuenta ----------
     El checkout pide nombre, apellido y correo. Si hay sesion iniciada, los tres
     ya estan respondidos y volver a preguntarlos es hacer escribir dos veces lo
     mismo. Se completan y quedan editables: este nombre y este apellido van al
     mensaje que lee la persona que te busca, y adivinar es peor que preguntar. */
  function nombreDeCuenta() {
    var user = authUser;
    if (!user) return null;
    var meta = user.user_metadata || {};
    // Google manda un solo string con el nombre entero. Partirlo en dos campos es
    // una adivinanza: "Ana Perez" sale bien, "Ana Maria Perez" deja "Maria Perez"
    // en el apellido, y "Ana Perez Sosa" deja "Perez Sosa". Con un solo nombre
    // el apellido queda vacio y el campo lo completa la persona, que para eso
    // sigue editable.
    var full = String(meta.full_name || meta.name || '').trim();
    if (!full) return null;
    // "'Perez, Ana'": hay cuentas de Google con el apellido primero.
    if (full.indexOf(',') > -1) {
      var partes = full.split(',');
      return { nombre: (partes[1] || '').trim(), apellido: (partes[0] || '').trim() };
    }
    var palabras = full.split(/\s+/);
    return { nombre: palabras[0] || '', apellido: palabras.slice(1).join(' ') };
  }
  function checkoutPanelDatos() {
    var f = checkoutState.form;
    // Lo que la persona ya escribio gana sobre lo que tenemos de la cuenta: si
    // vuelve atras a corregir algo, no se le pisa con el dato de Google.
    var cuenta = nombreDeCuenta();
    var nombre = String(f.nombre || (cuenta && cuenta.nombre) || '');
    var apellido = String(f.apellido || (cuenta && cuenta.apellido) || '');
    var correo = String(f.email || (authUser && authUser.email) || '');
    return '<div class="checkout-panel" data-checkout-panel="datos">' +
      '<h2 class="checkout-panel__title">Contanos quién viaja</h2>' +
      '<p class="checkout-panel__lead">Con esto el operador te confirma disponibilidad y el punto de encuentro.</p>' +
      '<div class="checkout-grid">' +
      checkoutField({ name: 'titulo', label: 'Título', type: 'select', options: CHECKOUT_TITLES, value: f.titulo || CHECKOUT_TITLES[0] }) +
      checkoutField({ name: 'nombre', label: 'Nombre', required: true, value: nombre, autocomplete: 'given-name' }) +
      checkoutField({ name: 'apellido', label: 'Apellido', required: true, value: apellido, autocomplete: 'family-name' }) +
      checkoutField({ name: 'docTipo', label: 'Tipo de documento', type: 'select', options: CHECKOUT_DOC_TYPES, value: f.docTipo || CHECKOUT_DOC_TYPES[0] }) +
      checkoutField({ name: 'docNumero', label: 'Número de documento', required: true, value: f.docNumero, placeholder: 'Solo números', maxlength: 12 }) +
      checkoutField({ name: 'nacimiento', label: 'Fecha de nacimiento', type: 'date', value: f.nacimiento }) +
      checkoutField({ name: 'nacionalidad', label: 'Nacionalidad', type: 'select', options: CHECKOUT_COUNTRIES, value: f.nacionalidad || CHECKOUT_COUNTRIES[0] }) +
      checkoutField({ name: 'email', label: 'Correo electrónico', type: 'email', required: true, value: correo, placeholder: 'nombre@correo.com', autocomplete: 'email' }) +
      checkoutField({ name: 'telefono', label: 'Teléfono', type: 'tel', required: true, value: f.telefono, placeholder: '09X XXX XXX', autocomplete: 'tel' }) +
      checkoutField({ name: 'direccion', label: 'Dirección', value: f.direccion, autocomplete: 'street-address', wide: true }) +
      '</div>' +
      checkoutTransferBlock() +
      '<p class="checkout-legal">Usamos estos datos solo para coordinar la reserva. No los guardamos en el servidor.</p>' +
      '</div>';
  }
  function checkoutPanelPago() {
    var t = checkoutTotals();
    return '<div class="checkout-panel" data-checkout-panel="pago">' +
      '<h2 class="checkout-panel__title">¿Cómo te queda más cómodo pagar?</h2>' +
      '<p class="checkout-panel__lead">Elegí tu medio de pago para que el operador te diga por dónde hacerlo.</p>' +
      '<p class="checkout-notice"><strong>Aún no procesamos pagos.</strong> Esta app cotiza y coordina, pero no cobra: la reserva se confirma con el operador y recién ahí se paga.</p>' +
      '<div class="checkout-pay-grid" role="radiogroup" aria-label="Medio de pago">' +
      CHECKOUT_PAYMENTS.map(function (p) {
        var checked = checkoutState.payment === p.id;
        // El logo va en una caja de alto fijo. Los lockups tienen proporciones
        // muy distintas entre si: Scotiabank es 6.8:1 y Mastercard 1.6:1. Sin
        // la caja, cada fila de la grilla tomaria la altura de su logo mas alto
        // y el 3x3 quedaria con filas desiguales. Adentro, object-fit:contain
        // recorta al logo angosto sin deformarlo.
        //
        // El nombre de la marca queda en sr-only y el wordmark pintado queda
        // oculto: si el <img> esta, el logo; si falla, el handler de 'error'
        // le pone is-broken y la tarjeta vuelve a pintar `mark` en su color.
        return '<label class="checkout-pay' + (checked ? ' is-selected' : '') + '" data-checkout-pay>' +
          '<input type="radio" name="checkout-payment" value="' + esc(p.id) + '"' + (checked ? ' checked' : '') + '>' +
          '<span class="checkout-pay__brand">' +
          '<img class="checkout-pay__logo" src="' + esc(p.logo) + '" alt="" width="' + p.lw + '" height="' + p.lh + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">' +
          '<span class="checkout-pay__mark" style="--pay-brand:' + p.brand + '">' + esc(p.mark) + '</span>' +
          '</span>' +
          '<span class="checkout-pay__kind">' + esc(p.kind) + '</span>' +
          '<span class="sr-only">' + esc(p.label) + '</span>' +
          '<span class="checkout-pay__check" aria-hidden="true">' + checkIcon() + '</span>' +
          '</label>';
      }).join('') + '</div>' +
      '<p class="checkout-pay-total">Total a confirmar: <b>' + money(t.total) + '</b> · ' + t.pax + (t.pax === 1 ? ' persona' : ' personas') + '</p>' +
      '</div>';
  }
  function checkoutPanelListo() {
    var t = checkoutTotals();
    var f = checkoutState.form;
    var pay = CHECKOUT_PAYMENTS.filter(function (p) { return p.id === checkoutState.payment; })[0];
    var meta = (detailState && detailState.meta) || {};
    var destino = (meta.dest && meta.dest.name) || 'tu destino';
    function dataRow(label, value) {
      return '<li><span>' + esc(label) + '</span><b>' + esc(value || '—') + '</b></li>';
    }
    // El recap lista cada cosa reservada con su total, y abajo el bloque de lo que
    // el operador necesita para el traslado. Es el paso de control, y controlar no
    // es ver un total: es ver las filas con las que te van a decir que sí o que no.
    // Los dos bloques van juntos porque van en el mismo mensaje.
    var pedido = '';
    if (t.tours.length) {
      pedido += '<h3>Actividades en ' + esc(destino) + '</h3><ul>' +
        t.tours.map(function (tour) { return dataRow(tour.title, money(tour.price) + ' c/u'); }).join('') +
        '</ul>';
    }
    if (t.transfer) {
      var vuelo = getSelectedFlightSummary();
      pedido += '<h3>El traslado</h3><ul>' +
        dataRow('Transfer', t.transfer.title + ' · ' + money(t.transfer.total)) +
        dataRow('Hotel', transferHotelName()) +
        dataRow('Vuelo', vueloNombreCorto(vuelo)) +
        dataRow('Horario de recogida', 'A coordinar con el operador') +
        '</ul>';
    }
    return '<div class="checkout-panel" data-checkout-panel="listo">' +
      '<h2 class="checkout-panel__title">Revisá y confirmá</h2>' +
      '<p class="checkout-panel__lead">Te vamos a mandar esta solicitud por WhatsApp. Ahí te confirman disponibilidad, horario y el valor final.</p>' +
      '<div class="checkout-recap">' +
      '<h3>Viajero</h3><ul>' +
      dataRow('Nombre', ((f.titulo ? f.titulo + ' ' : '') + (f.nombre || '') + ' ' + (f.apellido || '')).trim()) +
      dataRow('Documento', ((f.docTipo || '') + (f.docNumero ? ' ' + f.docNumero : '')).trim()) +
      dataRow('Contacto', [f.email, f.telefono].filter(Boolean).join(' · ')) +
      '</ul>' + pedido +
      '<h3>Pago</h3><ul>' + dataRow('Medio de pago', pay ? pay.label : 'Sin elegir') + '</ul>' +
      '<p class="checkout-recap__total"><span>Total a confirmar</span><b>' + money(t.total) + '</b></p>' +
      '</div></div>';
  }
  /* El pie cambia por paso: el primero y el segundo avanzan, el tercero manda.
     En el primero "Cancelar" cierra y en los otros tambien, para que haya una
     sola forma de salir y no dos botones con nombres parecidos. */
  function checkoutActions() {
    var step = checkoutState.step;
    var last = step === CHECKOUT_STEPS.length - 1;
    var back = step > 0
      ? '<button type="button" class="checkout-btn checkout-btn--ghost" data-checkout-back>Volver</button>'
      : '<button type="button" class="checkout-btn checkout-btn--ghost" data-close-booking>Cancelar</button>';
    var next = last
      ? '<button type="button" class="checkout-btn checkout-btn--pay" data-checkout-confirm>' + brandIcon('whatsapp') + '<span>Confirmar por WhatsApp</span></button>'
      : '<button type="button" class="checkout-btn checkout-btn--next" data-checkout-next>Continuar</button>';
    return '<footer class="checkout-actions">' + back + next + '</footer>';
  }
  function renderCheckout() {
    var modal = $('#booking-modal');
    if (!modal) return;
    var step = checkoutState.step;
    var panels = [checkoutPanelDatos, checkoutPanelPago, checkoutPanelListo];
    var t = checkoutTotals();
    if (!t.count) {
      // Un checkout sin nada que confirmar no tiene nada que mostrar. Si se llega
      // igual (por ejemplo con el teclado en el boton de una card que se
      // deseleccionó), se vuelve a la lista en vez de mostrar un formulario
      // que va a fallar en el ultimo paso.
      closeBookingForm();
      return;
    }
    cerrarTodosLosModales();
    modal.innerHTML = '<div class="booking-dialog checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title">' +
      '<button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button>' +
      '<div class="checkout-layout">' +
      checkoutAside() +
      '<div class="checkout-main">' +
      '<header class="checkout-main__head"><h2 id="checkout-title">' + esc((detailState && detailState.meta && detailState.meta.dest && detailState.meta.dest.name) || 'Reservar') + '</h2>' +
      checkoutStepper() + '</header>' +
      panels[step]() +
      checkoutActions() +
      '</div></div></div>';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    var first = modal.querySelector('.checkout-panel input, .checkout-panel select');
    // El foco entra al panel solo en el primer paso. En los otros moverlo
    // llevaria el foco a un radio ya elegido, que es un salto que nadie pidio.
    if (first && step === 0) { try { first.focus({ preventScroll: true }); } catch (e) { /* foco no critico */ } }
  }
  /* Un solo boton de reserva en toda la app, y abre este checkout con lo que haya
     elegido: las actividades, el transfer, o los dos. No se pregunta cual de los
     dos porque al usuario le da igual el detalle interno del pedido: quiere
     reservar lo que armó. Y para el operador es mejor recibir un solo mensaje con
     las dos cosas que dos mensajes separados.

     Si no hay nada elegido no abre. El boton de "Mi Viaje" sale deshabilitado en
     ese caso, pero el teclado puede llegar igual —se queda deseleccionada una
     card entre el click y el repintado— y un formulario que va a fallar en el
     ultimo paso es peor que no abrir nada. */
  function openCheckout() {
    if (!detailState || !detailState.meta) return;
    if (!checkoutPedido().count) return;
    checkoutState.step = 0;
    renderCheckout();
  }
  /* El boton de reservar de "Mi Viaje" no tiene funcion propia: se pinta entero
     dentro de renderTripSummary(), que ya lo escribe con su estado y su total.

     Antes existia syncToursCta(), que actualizaba el boton de la cabecera de la
     seccion de actividades con un querySelector y un texto. Ese boton ya no
     esta —la reserva se pide desde el panel— asi que la funcion se fue con el.
     Lo que hace falta ahora es repintar el panel entero cuando cambia lo que hay
     para reservar, y de eso se encarga renderTripSummary(). */
  /* Guarda lo escrito antes de validar el paso. Sin esto, el navegador valida
     los campos del paso anterior que ya no estan en el DOM y no puede focusing
     el que falta. */
  function readCheckoutForm() {
    var modal = $('#booking-modal');
    if (!modal) return true;
    var form = modal.querySelector('.checkout-panel');
    if (!form) return true;
    var inputs = form.querySelectorAll('input[name], select[name]');
    var pending = null;
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      checkoutState.form[el.name] = el.value;
      // El primer control invalido se busca aca, porque al vaciar el panel ese
      // nodo ya no existe y no se puede llamar reportValidity sobre el.
      if (!pending && !el.checkValidity()) pending = el;
    }
    // El hotel del transfer se copia al estado del viaje en cuanto se escribe.
    // El voucher y el resumen de "Mi Viaje" leen de ahi, y sin esto mostrarian
    // "a coordinar" al lado de un checkout que ya tiene el hotel puesto.
    /* La condición es la misma que decide si el campo existe:
       checkoutTransferBlock() solo pinta el bloque del traslado cuando
       checkoutTransferLine() devuelve una linea. Preguntar por el transfer con
       otra funcion era una referencia a algo que no existe —checkoutIsTransfer()
       se llamaba acá y no estaba definida en ningun lado—, y el ReferenceError
       que tiraba en cada click de "Continuar" se comia el resto del handler:
       el panel no avanzaba de paso y no se veia ningun aviso. */
    if (checkoutTransferLine() && detailState && checkoutState.form.transferHotel) {
      detailState.transferWizard = detailState.transferWizard || {};
      detailState.transferWizard.hotelName = String(checkoutState.form.transferHotel).trim();
    }
    return pending;
  }
  /* ---------- Crear la cuenta desde la reserva ----------
     El checkout ya pide el correo y es required, o sea que la persona lo escribe
     igual. Con ese correo se puede crear la cuenta sin preguntarle nada más.

     Y va por magic link, no por signUp: signUp exige una contraseña, y una
     contraseña inventada por nosotros es una contraseña que la persona no
     conoce y después no puede cambiar. signInWithOtp con shouldCreateUser crea la
     cuenta y manda un link para entrar más adelante.

     NO frena la reserva. Si la cuenta falla, se pierde la cuenta y no el pedido,
     que se manda por WhatsApp igual. Un checkout que no avanza porque no se pudo
     crear una cuenta es un checkout que pierde ventas.

     El aviso se mete en el DOM en vez de repintar el panel: en el paso 2 la
     persona ya está eligiendo medio de pago y un repintado le saltea el foco. */
  function mostrarAvisoCheckout(texto) {
    var modal = $('#booking-modal');
    if (!modal) return;
    var aviso = modal.querySelector('[data-checkout-notice]');
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.className = 'checkout-notice';
      aviso.setAttribute('data-checkout-notice', '');
      var acciones = modal.querySelector('.checkout-actions');
      if (!acciones || !acciones.parentNode) return;
      acciones.parentNode.insertBefore(aviso, acciones);
    }
    aviso.textContent = texto;
  }
  async function crearCuentaDesdeCheckout() {
    try {
      if (!supabaseClient) { authReadyPromise = initAuth(); await authReadyPromise; }
      // Con sesion abierta no hay nada que crear: la cuenta ya existe.
      if (authUser) return;
      /* Sin Supabase desplegado no hay cuenta, y hay que decirlo. Volver en
         silencio es peor que avisar: la persona cree que quedó con cuenta y
         después no puede volver a entrar ni a guardar el viaje. */
      if (!supabaseClient) { mostrarAvisoCheckout('No pudimos crear la cuenta (falta configurarla en el despliegue). Podés seguir con la reserva igual.'); return; }
      var email = String((checkoutState.form && checkoutState.form.email) || '').trim();
      if (!email) return;
      mostrarAvisoCheckout('Creando tu cuenta…');
      var r = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + window.location.pathname }
      });
      if (r && r.error) { mostrarAvisoCheckout('No pudimos crear la cuenta, pero podés seguir con la reserva igual.'); return; }
      mostrarAvisoCheckout('Listo: te enviamos un link a ' + email + ' para entrar. La reserva sigue igual.');
    } catch (error) {
      // Una excepcion acá no puede dejar el checkout clavado. El pedido va por
      // WhatsApp y no depende de la cuenta.
      mostrarAvisoCheckout('No pudimos crear la cuenta, pero podés seguir con la reserva igual.');
    }
  }
  function gotoCheckoutStep(step) {
    if (step < 0 || step >= CHECKOUT_STEPS.length) return;
    checkoutState.step = step;
    renderCheckout();
    var dialog = $('#booking-modal .checkout-dialog');
    if (dialog) dialog.scrollTop = 0;
  }
  /* El mensaje que sale por WhatsApp. Se arma con los datos que la persona
     escribio y con el total que ya viene del modelo: si alguien copia un numero
     a mano para mandarlo, hay chances de que se equivoque.
     Los dos pedidos arman el mismo esqueleto —viajero, documento, contacto,
     fechas, personas, medio de pago— y cambian solo el bloque de lo que se pide.
     El del transfer lleva ademas vuelo y hotel, que es lo primero que mira el
     operador para decir si puede ir a buscarte. */
  function checkoutWhatsappUrl() {
    var t = checkoutTotals();
    if (!t.count || !detailState || !detailState.meta) return null;
    var f = checkoutState.form;
    var meta = detailState.meta;
    var pay = CHECKOUT_PAYMENTS.filter(function (p) { return p.id === checkoutState.payment; })[0];
    var nombre = ((f.titulo ? f.titulo + ' ' : '') + (f.nombre || '') + ' ' + (f.apellido || '')).trim();
    var ref = checkoutRef();
    /* Un solo mensaje con lo que haya elegido. Los bloques van en el orden en que
       los necesita el operador: primero las actividades, que tienen horario fijo
       y son las que se agotan; despues el traslado, que se coordina con el vuelo.

       La pregunta final pide punto de encuentro y horario siempre. Un transfer
       sin hora no es un pedido incompleto, es una pregunta. */
    var abre = t.tours.length && t.transfer
      ? 'Hola, quiero reservar actividades y un transfer'
      : (t.transfer ? 'Hola, quiero coordinar un transfer desde el aeropuerto' : 'Hola, quiero reservar actividades');
    var message =
      abre + ' para mi viaje a ' + meta.dest.name + '.\n\n' +
      'Pedido ' + ref + '\n' +
      'Viajero: ' + nombre + '\n' +
      'Documento: ' + (f.docTipo || '') + (f.docNumero ? ' ' + f.docNumero : '') + '\n' +
      'Contacto: ' + [f.email, f.telefono].filter(Boolean).join(' · ') + '\n' +
      'Fechas: ' + meta.dep + ' al ' + meta.ret + ' · ' + t.pax + (t.pax === 1 ? ' persona' : ' personas') + '\n\n';
    if (t.tours.length) {
      /* El precio de estos tours es estimado, asi que el mensaje lo dice. Quien
         lo recibe tiene que saber que el numero es de referencia y que el valor
         final lo confirma quien lo tome: sin esa linea, un WhatsApp que dice
         "Total de actividades: US$ 240" se lee como una cotizacion firme. */
      var lineas = t.tours.map(function (tour) {
        var linea = '- ' + tour.title + ' (' + money(tour.price) + ' por persona)';
        return tour.url ? linea + '\n  ' + tour.url : linea;
      }).join('\n');
      message += 'Actividades:\n' + lineas + '\n';
      message += 'Total de actividades: ' + money(t.unitTotal * t.pax) + '\n\n';
      message += 'Precio estimado, a confirmar por quien lo tome.\n\n';
    }
    if (t.transfer) {
      var vuelo = getSelectedFlightSummary();
      message += 'Transfer: ' + t.transfer.title + ' · ' + money(t.transfer.total) +
        (t.transfer.porPersona ? ' (' + money(t.transfer.price) + ' por persona)' : '') + '\n' +
        'Vuelo: ' + vueloNombreCorto(vuelo) + (vuelo.arrivalText && vuelo.selected ? ' · llega ' + vuelo.arrivalText : '') + '\n' +
        'Hotel: ' + (transferHotelName() || 'sin confirmar, decime el hotel o pousada') + '\n\n';
    }
    message += 'Total a confirmar: ' + money(t.total) + '\n' +
      'Medio de pago preferido: ' + (pay ? pay.label : 'a coordinar') + '\n\n' +
      '¿Me confirman disponibilidad, horario, punto de encuentro y el valor final?';
    return whatsappUrl(message, WHATSAPP_RESERVAS);
  }
  /* A quien le llega la reserva. Vive en una sola variable porque el link se arma
     en dos lugares —el checkout y el boton de reservar el vuelo— y si el numero
     estuviera escrito en los dos, cambiarlo seria cambiarlo en los dos.

     El formato es el que espera wa.me: pais, area y numero pegados, sin +, sin
     espacios y sin guiones. Con el + o con espacios el link igual abre la
     conversacion, pero sin el texto pegado, y el mensaje es justamente la parte
     que hay que leer.

     OJO con el boton de compartir del voucher: ese NO lleva numero. Es para
     mandarle el itinerario a un amigo, y con numero destino le llega a la
     empresa en lugar del amigo. Compartir y hacer un pedido son dos cosas
     distintas. */
  var WHATSAPP_RESERVAS = '5511920836306';
  function whatsappUrl(message, numero) {
    return 'https://wa.me/' + (numero || '') + '?text=' + encodeURIComponent(message);
  }
  /* Referencia corta y legible. No es un comprobante de nada: sirve para que el
     operador y la persona en el mismo chat puedan nombrar el pedido. */
  function checkoutRef() {
    if (checkoutState.ref) return checkoutState.ref;
    var hoy = new Date();
    var sello = String(hoy.getFullYear()).slice(2) + String(hoy.getMonth() + 1).padStart(2, '0') + String(hoy.getDate()).padStart(2, '0');
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    checkoutState.ref = 'CS-' + sello + '-' + rand;
    return checkoutState.ref;
  }
  var hotelRequestId = 0;
  // La búsqueda de vuelos necesita el mismo control de identidad que la de
  // hoteles (hotelRequestId, más abajo). Sin esto, una respuesta lenta de la
  // propuesta anterior escribía su precio en el presupuesto de la propuesta
  // nueva: el usuario veía un total que no era el de su viaje.
  var flightRequestId = 0;
  var flightController = null;
  function hotelLoading(meta) {
    // Misma cabecera que hotelOptions() —el filtro al lado del contenido que
    // filtra— para que el placeholder no se reorganice solo cuando llegan los
    // datos. El data-hotels-block es el mismo para que el repintado que trae los
    // hoteles reales reemplace el bloque entero y no deje el titulo viejo.
    return plateBlock('data-hotels-block',
      '<h2 class="block-title">Alojamientos en ' + esc(meta.dest.name) + '</h2>',
      'Buscando opciones disponibles…',
      '<section class="hotel-options hotel-options-loading" data-budget-anchor="alojamiento" aria-live="polite"><div class="hotel-options-head">' + hotelTypeSelectMarkup(meta) + '</div><div class="hotel-skeleton-grid" aria-hidden="true"><div class="hotel-skeleton-card"></div><div class="hotel-skeleton-card"></div><div class="hotel-skeleton-card"></div></div></section>');
  }
  function loadHotelRecommendations(meta, accommodationTotal) {
    var requestId = ++hotelRequestId;
    if (meta.hotelsLoaded) {
      // El marcador es el del bloque completo (titulo + placa), no el de la placa:
      // reemplazar la placa sola metia el markup completo adentro de ella y
      // dejaba el titulo del placeholder arriba del titulo nuevo.
      var cached = document.querySelector('[data-hotels-block]');
      if (cached) cached.outerHTML = hotelOptions(meta, accommodationTotal);
      return;
    }
    var params = new URLSearchParams({ dest: meta.dest.key, dep: meta.dep, ret: meta.ret, pax: meta.pax, style: meta.style || 'eq', hotel_type: meta.hotelType || 'intermedio', subcategory: meta.subcategory || '' });
    // La segunda parada del viaje combinado viaja en el mismo request. El server
    // la valida con comboTransfer() y devuelve los dos listados; antes se pedia
    // solo el de la primera y el de la segunda se cobraba con el promedio del
    // modelo, sin hotel real y sin avisar.
    if (meta.multiStay && meta.multiStay.stays && meta.multiStay.stays.length === 2) {
      var segunda = String(meta.multiStay.stays[1].key || '').toLowerCase();
      if (segunda) params.set('second', segunda);
    }
    if (meta.hotelBudgetPerNight != null && Number.isFinite(Number(meta.hotelBudgetPerNight))) params.set('hotel_budget_per_night', String(meta.hotelBudgetPerNight));
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = window.setTimeout(function () { if (controller) controller.abort(); }, 30000);
    fetch('/api/hoteles?' + params.toString(), controller ? { signal: controller.signal } : {}).then(function (response) {
      return response.json().then(function (data) { if (!response.ok) throw new Error(data.error || 'No pudimos cargar alojamientos.'); return data; });
    }).then(function (data) {
      window.clearTimeout(timeout);
      if (requestId !== hotelRequestId || !detailState || detailState.meta !== meta) return;
      meta.hotels = Array.isArray(data.hotels) ? data.hotels : [];
      meta.hotelsNearby = data.hotelsNearby || '';
      // Los hoteles de la segunda parada. Vienen en el mismo request; si el viaje
      // es de un solo destino quedan vacios y hotelOptions() ni los mira.
      meta.hotelsSecond = Array.isArray(data.hotelsSecond) ? data.hotelsSecond : [];
      meta.hotelsNearbySecond = data.hotelsNearbySecond || '';
      if (data.hotelBudgetPerNightSecond != null) meta.hotelBudgetPerNightSecond = data.hotelBudgetPerNightSecond;
      // Que tipos de alojamiento hay de verdad para este destino. El server lo
      // calcula sobre los mismos 20 hoteles reales que ya trae, asi que no es
      // una llamada extra; y puede venir null si no hay key de Booking. Con dos
      // paradas el server devuelve la interseccion de los tipos de ambas.
      meta.tiposHotelDisponibles = Array.isArray(data.tiposDisponibles) ? data.tiposDisponibles : null;
      meta.hotelsLoaded = true;
      // El token de la Guia Secreta. El server solo lo firma si entre los
      // hoteles de este destino hay alguno con precio real de Booking, o sea
      // algo reservable: sin eso no hay guia que abrir.
      //
      // Se GUARDA pero no se pide la guia. Antes se pedia aca y se pintaba
      // sola, con lo que cualquier persona que buscaba hoteles de un destino
      // leia la guia entera sin tocar nada. Ahora la guia se pide cuando la
      // persona toca "Ver disponibilidad" de un hotel, que es el gesto de
      // reservar: verGuiaPorReserva() la busca y la pinta en el momento.
      if (data.guiaToken) guardarTokenGuia(meta.dest.key, data.guiaToken);
      var current = document.querySelector('[data-hotels-block]');
      if (current) current.outerHTML = hotelOptions(meta, accommodationTotal);
      // Cada parada toma su recomendado. Con querySelector pelado solo se
      // marcaba el primero de la pagina: en un viaje combinado la segunda parada
      // se quedaba sin hotel y volvia al estimado del modelo, que es
      // exactamente el bug que hizo falta partir esto en dos grupos.
      var paradas = meta.multiStay && meta.multiStay.stays && meta.multiStay.stays.length === 2 ? ['1', '2'] : [''];
      paradas.forEach(function (stop) {
        var selector = stop ? '[data-hotel-stop="' + stop + '"][data-hotel-total]:checked' : '[data-hotel-total]:checked';
        var recommended = document.querySelector(selector);
        if (!recommended) return;
        var card = recommended.closest('[data-hotel-option]');
        var name = card && card.querySelector('h3');
        // El nombre visible del alojamiento del resumen es el de la ultima parada
        // que se proceso. Es un solo campo para dos paradas: lo que hay aca es
        // "el hotel que estas mirando", no un inventario de los dos.
        if (name) detailState.selectedHotelName = name.textContent.trim();
        actualizarAlojamiento(Number(recommended.getAttribute('data-hotel-total')), true, Number(stop) || 0);
      });
    }).catch(function (error) {
      window.clearTimeout(timeout);
      if (requestId !== hotelRequestId || !detailState || detailState.meta !== meta) return;
      console.warn('[hoteles] No se pudieron cargar alojamientos:', error && error.message || 'error desconocido');
      meta.hotels = [];
      meta.hotelsLoaded = true;
      var current = document.querySelector('[data-hotels-block]');
      if (current) current.outerHTML = hotelOptions(meta, accommodationTotal);
    });
  }

  /*/*
   * Precio de transfer del destino, para el render. Prioridad:
   *   1. lo que mando el server en meta.officialTransfer (que sale de la tabla);
   *   2. la tabla del cliente, public/transfer-precios.js;
   *   3. un piso, para que la pantalla nunca quede con un precio vacio.
   *
   * Los tres caminos dan el mismo numero cuando la tabla esta sana: por eso el
   * test compara la tabla del cliente con TRANSFER_PRICES del modelo.
   */
  /* Nombre de los quince aeropuertos de llegada, para poder escribir
     "Aeropuerto Internacional de Natal (NAT)" en vez de solo "NAT".

     Los datos de transfer traen el codigo IATA pero no el nombre, y no se
     agrega ahi porque el nombre oficial de un aeropuerto es un dato que cambia
     (se renombraron, se fusionaron) y el JSON de precios lo genera un script
     que no consulta una fuente de nombres. Ademas el destino no siempre es el
     que da nombre al aeropuerto: el vuelo a Gramado y el a Porto Alegre salen
     los dos de POA, y el de Canela tambien, asi que el nombre va del
     aeropuerto y no del pueblo. */
  var AIRPORT_NAMES = {
    CNF: 'Aeropuerto Internacional de Belo Horizonte',
    CWB: 'Aeroporto Internacional de Curitiba',
    EZE: 'Aeropuerto de Ezeiza',
    FEN: 'Aeropuerto de Fernando de Noronha',
    FLN: 'Aeroporto Internacional de Florianópolis',
    FOR: 'Aeroporto Internacional de Fortaleza',
    GIG: 'Aeroporto Internacional do Galeão',
    GRU: 'Aeroporto Internacional de Guarulhos',
    IGU: 'Aeropuerto Internacional de Foz do Iguaçu',
    JPA: 'Aeroporto Presidente Castro Pinto',
    MCZ: 'Aeroporto Internacional de Maceió',
    NAT: 'Aeroporto Internacional de Natal',
    POA: 'Aeroporto Internacional Salgado Filho',
    REC: 'Aeroporto Internacional do Recife',
    SSA: 'Aeroporto Internacional de Salvador'
  };
  function transferPreciosDe(meta) {
    var oficial = meta && meta.officialTransfer;
    var key = String((meta && meta.dest && meta.dest.key) || '').toLowerCase();
    var tabla = (typeof CS_TRANSFER_PRICES !== 'undefined' && CS_TRANSFER_PRICES) ? CS_TRANSFER_PRICES[key] : null;
    // OJO con el 0. Un destino sin traslado compartido (fernando, que es una
    // isla) tiene compartido: 0, y 0 es falsy: con || caia al piso de 20 y el
    // presupuesto cobraba una van que no existe. Por eso se prueba null/undefined
    // y no la verdad del valor.
    var primero = function (a, b, c) {
      if (a != null) return a;
      if (b != null) return b;
      return c;
    };
    var compartido = primero(oficial && oficial.compartido, tabla && tabla.compartido, 20);
    var privado = primero(oficial && oficial.privado, tabla && tabla.privado, Number(compartido) * 3);
    /* Precio propio en reales (compartido_brl / privado_brl, de la planilla de
       transfers). El presupuesto se lleva en USD, asi que se convierte con la
       tasa BRL de la pantalla: en reales vuelve exactamente al numero de la
       planilla, sin la deriva de una cotizacion fija. Sin tasa cargada se queda
       con el USD derivado que trae la tabla. */
    var tasaBrl = tasaDe('BRL');
    if (tabla && tasaBrl) {
      if (tabla.compartido_brl > 0) compartido = tabla.compartido_brl / tasaBrl;
      if (tabla.privado_brl > 0) privado = tabla.privado_brl / tasaBrl;
    }
    return {
      compartido: Number(compartido),
      privado: Number(privado),
      km: primero(oficial && oficial.km, tabla && tabla.km, null),
      iata: primero(oficial && oficial.iata, tabla && tabla.iata, null),
      // El nombre sale del codigo, no del destino: el vuelo a Gramado, a Canela
      // y a Porto Alegre salen los tres de POA, asi que el pueblo no sirve.
      aeropuerto: function () { var c = primero(oficial && oficial.iata, tabla && tabla.iata, null); return c ? (AIRPORT_NAMES[c] || c) : ''; }(),
      modo: primero(oficial && oficial.modo, tabla && tabla.modo, 'car'),
      soloPrivado: !!(oficial && oficial.soloPrivado) || !!(tabla && tabla.soloPrivado),
      appRideUsd: primero(oficial && oficial.appRideUsd, tabla && tabla.appRideUsd, null),
      nota: oficial && oficial.nota
    };
  }
  /*
   * Monto del transfer que se sumo al presupuesto. Es la unica fuente de verdad
   * del total, como estaba antes, pero los dos numeros salen de la tabla y no de
   * constantes: el compartido se cobra por persona y el privado por vehiculo, y
   * por eso el privado no se multiplica por la cantidad de viajeros.
   */
  /* El tipo elegido de un tramo. `leg` es 'llegada' (el que existia antes) o
     'vuelta'. El de llegada se sigue leyendo de `transferType` a proposito: es lo
     que se guarda en los viajes, lo que lee el checkout y lo que ya esta escrito
     en la base de los viajes guardados. El de vuelta es un campo nuevo. */
  function transferTypeDe(state, leg) {
    if (!state) return '';
    return (leg === 'vuelta' ? state.transferTypeVuelta : state.transferType) || '';
  }
  function getSelectedTransferAmount(state, leg) {
    if (!state || state.transportMode === 'auto') return 0;
    var precios = transferPreciosDe(state.meta || {});
    var tipo = transferTypeDe(state, leg);
    if (tipo === 'private') return precios.privado;
    if (tipo === 'shared') {
      // Un destino sin van compartida (soloPrivado) no tiene nada que cobrar por
      // este lado. Se puede llegar aqui sin que la persona lo elija: si marco
      // "compartido" en Rio y despues cambio el destino a Fernando de Noronha,
      // el estado todavia decia 'shared' y el presupuesto sumaba el piso de 20
      // por persona. Que devuelva 0 y no un numero inventado.
      if (precios.soloPrivado || !(precios.compartido > 0)) return 0;
      // El compartido se cobra por persona, asi que el total escala con los
      // viajeros. detailState no guarda pax: sale de meta.pax, que es lo que
      // manda el server, y si no esta, del estado del buscador.
      var pax = Number((state.meta && state.meta.pax) || (state.pax) || (typeof S !== 'undefined' && S && S.pax)) || 1;
      return precios.compartido * Math.max(1, pax);
    }
    return Math.max(0, Number(state.transfer) || 0);
  }

  /* El traslado, partido en lo que el modelo estima y lo que se elige.

     Antes `parts.traslados` traia la ESTIMACION del modelo (lib/model.js, con
     una formula de km y un factor por tier) y recalcularTotalViaje() le SUMABA
     el precio de la tabla. O sea que el traslado se contaba dos veces: la
     estimacion y el precio real de la tabla, uno encima del otro.

     Con el compartido elegido por defecto eso no es un detalle de redondeo: es
     un total inflado en todos los destinos, sin que nada en pantalla lo explique.

     Por eso la estimacion se separa del precio real. `estimadoAeropuerto` es la
     parte que cubre el salto aeropuerto -> alojamiento y `entreParadas` la del
     salto entre las dos paradas de un viaje combinado. Cuando hay modalidad
     elegida, la primera se REEMPLAZA por el precio de la tabla y la segunda se
     deja como estaba: el tramo entre paradas no tiene una modalidad que elegir
     (es un solo pasaje por persona, ver tramosTransfer) y no se puede sustituir
     por nada.

     Cuando no hay nada elegido vuelve la estimacion completa, que es lo que
     pasaba antes de este cambio. */
  function trasladoDelViaje(state) {
    if (!state) return 0;
    if (state.transportMode === 'auto') return Number(state.auto) || 0;
    var entre = state.multiStay ? Number(state.multiStay.transferBetweenUsd) || 0 : 0;
    // Los dos tramos, cuando hay dos elegidos. Un tramo sin elegir NO cae a la
    // estimacion del modelo: la estimacion es del conjunto, no de un lado, y
    // repartirla entre los dos seria inventar como se armo.
    var llegada = getSelectedTransferAmount(state, 'llegada');
    var vuelta = getSelectedTransferAmount(state, 'vuelta');
    if (llegada > 0 || vuelta > 0) return entre + llegada + vuelta;
    return (Number(state.baseTraslados) || 0) + entre;
  }
  // Iconos por categoría para el resumen de presupuesto. Se dibujan con trazo
  // para que leguen bien en el panel chico, y heredan el color de la categoría.
  var CATEGORY_ICONS = {
    pasajes: '<path d="M2.6 12.3 21.4 4.6l-7.4 17.3-2.5-8.1-8.9-1.5Z"/>',
    bus: '<rect x="4" y="3.5" width="16" height="14" rx="2.5"/><path d="M4 11h16M4 15.5h16"/><path d="M8 21v-2.6M16 21v-2.6"/>',
    traslados: '<path d="M3 14.5h18v3.5H3z"/><path d="M5 14.5v-2.8A1.7 1.7 0 0 1 6.7 10h10.6a1.7 1.7 0 0 1 1.7 1.7v2.8"/><path d="M6.5 18v2.5M17.5 18v2.5"/>',
    alojamiento: '<path d="M3.5 20V6.5A1.5 1.5 0 0 1 5 5h7a1.5 1.5 0 0 1 1.5 1.5V20"/><path d="M13.5 10H18a1.5 1.5 0 0 1 1.5 1.5V20"/><path d="M2.5 20h19"/><path d="M6.5 8h.8M9.5 8h.8M6.5 11.5h.8M9.5 11.5h.8M6.5 15h.8M9.5 15h.8" stroke-width="2.3"/>',
    comidas: '<path d="M6.5 3v4.8a2.2 2.2 0 0 0 4.4 0V3"/><path d="M8.7 10v11"/><path d="M16.8 3v18"/><path d="M16.8 3c2.4 1.6 3.4 4 3.4 6.4 0 1.6-1.4 2.4-3.4 2.4"/>',
    local: '<path d="M3 19h18M6 19v-6h12v6"/><path d="M6 13V6.5A1.5 1.5 0 0 1 7.5 5h9A1.5 1.5 0 0 1 18 6.5V13"/><path d="M9.5 16.5h.01M14.5 16.5h.01" stroke-width="2.4"/>',
    tours: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V10a2 2 0 0 0 0 4v1.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5V14a2 2 0 0 0 0-4Z"/><path d="M14 7v1.6M14 11.2v1.6M14 15.4V17" stroke-width="2.2"/>',
    auto: '<path d="M3 14.5h18v3.5H3z"/><path d="M5 14.5v-2.8A1.7 1.7 0 0 1 6.7 10h10.6a1.7 1.7 0 0 1 1.7 1.7v2.8"/><path d="M9 11V8.5M13 11V8.5"/>'
  };
  /* El color se aplica EN EL SVG, no en un contenedor: el svg lleva su propio
     style y una declaracion directa gana a la herencia, asi que poner el color
     en el padre no hacia nada. Medido: los cuatro iconos del modal salian del
     mismo azul aunque el padre trajera el color del proveedor.

     Por eso colorProveedor() devuelve un valor entero: si trae almohadilla es
     un hex y va tal cual, y si no es un token de la hoja y se envuelve en
     var() como antes. Un "var(#7EA8E8)" seria invalido y el svg caeria a
     heredar, que es el bug que estamos corrigiendo. */
  function colorCss(valor) {
    if (!valor) return null;
    return valor.charAt(0) === '#' ? valor : 'var(' + valor + ')';
  }
  function categoryIcon(key, colorVar) {
    var d = CATEGORY_ICONS[key];
    if (!d) return '';
    var color = colorCss(colorVar) || 'var(--c1)';
    return '<svg class="trip-summary__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="color:' + color + '" aria-hidden="true">' + d + '</svg>';
  }
  /* Logos de los botones del resumen. El resto de los iconos de la app son de
     trazo y salen de CATEGORY_ICONS; los de marca van dibujados porque es la
     única forma en que se reconocen, y heredan currentColor para que el
     WhatsApp sea verde en un botón y el resto blanco en el de Instagram. */
  var BRAND_ICONS = {
    instagram: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5.4" stroke-width="1.9"/><circle cx="12" cy="12" r="4.1" stroke-width="1.9"/><circle cx="16.9" cy="7.1" r="1.15" fill="currentColor" stroke="none"/>',
    whatsapp: '<path fill="currentColor" stroke="none" d="M12.04 2.6a9.3 9.3 0 0 0-7.9 14.1l-1.3 4.7 4.8-1.25a9.3 9.3 0 1 0 4.4-17.55Zm0 1.9a7.4 7.4 0 0 1 6.3 11.3 7.4 7.4 0 0 1-8.9 3.05l-.25-.15-2.1.55.56-2.05-.2-.27a7.4 7.4 0 0 1 4.6-12.43Zm-3.03 4.3c-.13 0-.35.05-.53.25-.18.2-.7.68-.7 1.66 0 .98.72 1.93.82 2.07.1.13 1.4 2.22 3.45 3.02 1.7.67 2.05.54 2.42.5.37-.03 1.19-.48 1.36-.96.17-.48.17-.88.11-.96-.05-.09-.18-.14-.38-.22-.2-.09-1.19-.59-1.37-.65-.18-.07-.32-.11-.45.1-.14.22-.53.66-.65.79-.12.13-.24.15-.44.05-.2-.1-.85-.31-1.62-1-.6-.53-1-1.19-1.11-1.39-.12-.2-.02-.32.09-.42.09-.09.2-.23.3-.36.1-.12.14-.2.2-.33.07-.13.04-.25-.02-.35-.06-.1-.45-1.1-.62-1.5-.16-.39-.32-.34-.45-.35h-.38Z"/>',
    guardar: '<path d="M6.6 3.6h10.8v16.8L12 16.5l-5.4 3.9V3.6Z"/>',
    dividir: '<circle cx="9.6" cy="8" r="3"/><path d="M4.2 19.4c0-3 2.4-5 5.4-5s5.4 2 5.4 5"/><path d="M16.2 5.7a3 3 0 0 1 0 5.6M17.6 14.9c1.4.7 2.2 2.1 2.2 4"/>',
    /* El nodo del menu y el portapapeles, en la misma tinta que el resto. El
       boton de menu es un <button> con un svg propio (el chevron) y no pasa por
       brandIcon porque necesita girar, no tintarse. */
    compartir: '<circle cx="17.5" cy="6" r="2.6"/><circle cx="6.5" cy="12" r="2.6"/><circle cx="17.5" cy="18" r="2.6"/><path d="m8.8 10.8 6.4-3.5M8.8 13.2l6.4 3.5"/>',
    copiar: '<rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.2"/><path d="M15.4 5.6H6.2a2.2 2.2 0 0 0-2.2 2.2v9.2"/>'
  };
  /* Los diferenciales de la agencia. No son marcas, asi que van aparte de
     BRAND_ICONS: mismo dibujo stroked y misma clase, pero otra historia. */
  var VENTAJA_ICONS = {

    soporte: '<path d="M12 2.7 19.7 5.5v6c0 4.3-3.1 7.9-7.7 9.4-4.6-1.5-7.7-5.1-7.7-9.4v-6Z"/>'
      + '<path d="M8.1 13.4 10.6 10.9l1.4 1.4 1.4-1.4 2.5 2.5"/>',

    curaduria: '<path d="M10.2 3.6a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 1 1 0-13.2Z"/>'
      + '<path d="M15.2 15.2 20.8 20.8"/>'
      + '<path d="M10.2 7.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3Z"/>',

    logistica: '<circle cx="5.2" cy="8.4" r="2.5"/>'
      + '<path d="M1.4 18c0-2.1 1.7-3.7 3.8-3.7S9 15.9 9 18"/>'
      + '<circle cx="18.8" cy="8.4" r="2.5"/>'
      + '<path d="M15 18c0-2.1 1.7-3.7 3.8-3.7s3.8 1.6 3.8 3.7"/>'
      + '<path d="M8.6 12.2h6.8"/>'
      + '<path d="M10.4 10.4 8.6 12.2l1.8 1.8M13.6 10.4l1.8 1.8-1.8 1.8"/>',
  };


  function ventajaIcon(key) {
    var d = VENTAJA_ICONS[key];
    if (!d) return '';
    return '<svg class="voucher-btn__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  /* La barra de diferenciales. Texto fijo: no depende del viaje ni del estado,
     y es exactamente por eso que va en el modal y no en la seccion de la
     propuesta, que se vuelve a pintar con cada cambio. */
  var ventajasMarkup = '<ul class="voucher-ventajas">'
    + '<li>' + ventajaIcon('soporte') + '<span>Soporte humano y local en Uruguay y en tu destino</span></li>'
    + '<li>' + ventajaIcon('curaduria') + '<span>Curaduría y ahorro de tiempo</span></li>'
    + '<li>' + ventajaIcon('logistica') + '<span>Gestión logística completa para grupos</span></li>'
    + '</ul>';

  function brandIcon(key) {
    var d = BRAND_ICONS[key];
    if (!d) return '';
    return '<svg class="voucher-btn__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  /* El vuelo solo suma al presupuesto cuando la persona lo eligio. Sin eleccion
     el rubro dice "sin seleccionar" y vale 0: antes seguia sumando la
     estimacion en el total como un costo fantasma. Con bus o auto el vuelo ya
     esta en 0, asi que no cambia nada. */
  function vueloElegido() {
    if (!detailState) return false;
    if (detailState.transportMode === 'bus' || detailState.transportMode === 'auto') return true;
    var sel = getSelectedFlightSummary();
    return !!(sel && sel.selected);
  }
  function vueloSumado(state) {
    var v = Number(state && state.flight) || 0;
    if (!v || state !== detailState) return v;
    return vueloElegido() ? v : 0;
  }
  /* ---------- Pasos del presupuesto ----------
     Transporte -> Alojamiento -> Traslados y actividades. Un rubro solo suma al
     total cuando la persona lo eligio de verdad: antes el vuelo, el hotel
     "recomendado" y el traslado compartido entraban precargados y el total
     mostraba plata que nadie habia decidido. Estos helpers dicen si hubo
     decision; los *Sumado() devuelven el monto o 0. Solo aplican al viaje que se
     esta armando (detailState): los resultados de busqueda no cambian. */
  function busDecidido() {
    if (!detailState || detailState.transportMode !== 'bus') return true;
    return !!detailState.busChoice || !busServiceOptions(detailState.meta).length;
  }
  function transporteElegido() {
    if (!detailState) return false;
    if (detailState.transportMode === 'auto') return true;
    if (detailState.transportMode === 'bus') return busDecidido();
    return vueloElegido();
  }
  function hotelElegido() { return !!(detailState && (detailState.hotelDecided || detailState.selectedHotel === false)); }
  function trasladoElegido() { return !!(detailState && (detailState.transferType || detailState.transferTypeVuelta)); }
  function busSumado(state) {
    var v = Number(state && state.parts && state.parts.bus) || 0;
    return (!v || state !== detailState || busDecidido()) ? v : 0;
  }
  function hotelSumado(state) {
    var v = Number(state && state.hotel) || 0;
    return (!v || state !== detailState || hotelElegido()) ? v : 0;
  }
  function trasladoSumado(state) {
    return (state !== detailState || state.transportMode === 'auto' || trasladoElegido()) ? trasladoDelViaje(state) : 0;
  }
  function pasosEstado() {
    var d = detailState, m = d.transportMode, tours = (d.selectedTours || []).length;
    var vuelo = m !== 'bus' && m !== 'auto';
    var t = transporteElegido();
    var bus = m === 'bus' ? busElegido(d.meta) : null;
    var tTxt = t ? (m === 'bus' ? (bus ? bus.empresa + (bus.clase ? ' ' + bus.clase : '') : 'Bus') : m === 'auto' ? 'Auto propio' : (getSelectedFlightSummary().airline || 'Vuelo elegido'))
      : 'Falta elegir';
    var h = hotelElegido();
    var nombreHotel = String(d.selectedHotelName || '');
    var hTxt = h ? (d.selectedHotel === false ? 'Sin hotel' : (nombreHotel && !/recomendado|seleccionado/i.test(nombreHotel) ? nombreHotel : 'Hotel elegido')) : 'Falta elegir';
    var tr = (vuelo && trasladoElegido()) || tours > 0;
    var partes = [];
    if (vuelo && trasladoElegido()) partes.push('Traslado');
    if (tours) partes.push(tours + (tours === 1 ? ' actividad' : ' actividades'));
    return [
      { n: 1, titulo: 'Transporte', texto: tTxt, hecho: t, anc: m === 'bus' ? 'bus' : m === 'auto' ? 'auto' : 'pasajes', cta: 'Elegí tu ' + (m === 'bus' ? 'bus' : m === 'auto' ? 'ruta' : 'vuelo') },
      { n: 2, titulo: 'Alojamiento', texto: hTxt, hecho: h, anc: 'alojamiento', cta: 'Elegí tu hotel' },
      { n: 3, titulo: vuelo ? 'Traslados y actividades' : 'Actividades', texto: tr ? partes.join(' + ') : 'Opcional', hecho: tr, opcional: true, anc: vuelo ? 'traslados' : 'tours', cta: vuelo ? 'Sumá traslados y actividades' : 'Sumá actividades' }
    ];
  }
  function pasosMarkup() {
    if (!detailState) return '';
    var p = pasosEstado();
    var actual = -1;
    for (var i = 0; i < p.length; i++) { if (!p[i].hecho) { actual = i; break; } }
    var lis = p.map(function (s, i) {
      var cls = s.hecho ? 'is-done' : (i === actual ? 'is-current' : 'is-pending');
      return '<li class="steps__item ' + cls + '"><button type="button" class="steps__btn" data-jump-category="' + s.anc + '" data-jump-label="' + esc(s.titulo) + '"' + (i === actual ? ' aria-current="step"' : '') + '>'
        + '<span class="steps__n" aria-hidden="true">' + (s.hecho ? '✓' : s.n) + '</span>'
        + '<span class="steps__t"><b>' + esc(s.titulo) + '</b><small>' + esc(s.texto) + (s.opcional && !s.hecho ? '' : '') + '</small></span></button></li>';
    }).join('');
    var sig = actual >= 0 ? p[actual] : null;
    var cta = sig
      ? '<button type="button" class="steps__next" data-jump-category="' + sig.anc + '">' + esc(sig.cta) + (sig.opcional ? ' <em>(opcional)</em>' : '') + ' <span aria-hidden="true">→</span></button>'
      : '<p class="steps__ok">Listo: revisá el total en “Mi Viaje”.</p>';
    return '<ol class="steps__list">' + lis + '</ol>' + cta;
  }
  function pintarPasos() {
    var el = document.querySelector('[data-steps]');
    if (!el || !detailState) return;
    var html = pasosMarkup();
    if (el.__html !== html) { el.innerHTML = html; el.__html = html; try { syncBudgetJumpTargets(); } catch (e) { /* sin DOM todavia */ } }
  }
  function getBudgetBreakdown(state) {
    if (!state) return { total: 0, entries: [] };
    var roadtrip = state.transportMode === 'auto';
    // El alquiler es un opt-in INDEPENDIENTE del medio de transporte: se puede
    // volar y arrancar en el aeropuerto de llegada, o tomar el bus y alquilar en
    // destino. Por eso va en las tres listas de categorias y no solo en una.
    //
    // Ojo con el cruce con el roadtrip: `auto` es el combustible y los peajes de
    // un auto PROPIO que se lleva de Montevideo, y `alquiler` es la tarifa de un
    // auto alquilado EN DESTINO. Son cosas distintas y pueden convivir: alquilas
    // en Brasil y ademas pagaste los peajes de tu propio auto para llegar. No se
    // pisan porque la app no ofrece el alquiler transfronterizo.
    var categories = roadtrip ? ['auto', 'alquiler', 'alojamiento', 'comidas', 'tours'] : state.transportMode === 'bus' ? ['bus', 'alquiler', 'alojamiento', 'comidas', 'local', 'tours'] : ['pasajes', 'alquiler', 'alojamiento', 'comidas', 'local', 'traslados', 'tours'];
    var transferValue = getSelectedTransferAmount(state);
    var trasladoValue = (state === detailState && state.transportMode !== 'auto' && !trasladoElegido()) ? 0 : (Number(state.parts && state.parts.traslados) || 0) + transferValue;
    var alquilerValue = Number(state.alquiler) || 0;
    var total = roadtrip
      ? Math.round((Number(state.auto) || 0) + alquilerValue + hotelSumado(state) + (Number(state.parts.comidas) || 0) + (Number(state.toursTotal) || 0))
      : Math.round((state.transportMode === 'bus' ? busSumado(state) : vueloSumado(state)) + hotelSumado(state) +
        (Number(state.parts.comidas) || 0) + (Number(state.parts.local) || 0) +
        trasladoValue + alquilerValue + (Number(state.toursTotal) || 0));
    var entries = categories.map(function (category) {
      if (category === 'auto' && !roadtrip) return null;
      var info = CATS.filter(function (c) { return c[0] === category; })[0] || ['', category, '--c1'];
      var value = category === 'pasajes' ? vueloSumado(state)
        : category === 'bus' ? busSumado(state)
        : category === 'alojamiento' ? hotelSumado(state)
        : category === 'traslados' ? trasladoValue
        : category === 'auto' ? (Number(state.auto) || 0)
        : category === 'alquiler' ? alquilerValue
        : category === 'tours' ? (Number(state.toursTotal) || 0)
        : (Number(state.parts && state.parts[category]) || 0);
      // Tours siempre se lista en "A dónde va tu plata", aunque todavía no se
      // haya sumado ninguna actividad, para que la categoría no desaparezca
      // del desglose apenas el usuario la mira antes de elegir algo.
      if (category !== 'tours' && Number(value) <= 0) return null;
      return { category: category, label: info[1], color: info[2], value: Number(value) || 0, width: total ? ((Number(value) / total) * 100) : 0 };
    }).filter(Boolean);
    // Ordenamos por monto, de mayor a menor. El orden por taxologia (pasajes,
    // alojamiento, comidas...) dejaba los rubros que mas plata pesan en el
    // medio, y el usuario quiere ver primero donde se va la plata.
    entries.sort(function (a, b) { return (Number(b.value) || 0) - (Number(a.value) || 0); });
    return { total: total, entries: entries };
  }
  function proposalBreakdownContent(state) {
    if (!state) return '';
    var budget = getBudgetBreakdown(state);
    var total = budget.total;
    var entries = budget.entries;
    var segments = entries.map(function (entry) {
      return '<span class="proposal-breakdown__segment" style="width:' + entry.width + '%;background:var(' + entry.color + ')"></span>';
    }).join('');
    var rows = entries.map(function (entry) {
      // Mismo ícono que usa el panel "MI VIAJE", en vez de un cuadrado de
      // color: las dos vistas ya se leen con la misma clave visual.
      var icon = categoryIcon(entry.category, entry.color);
      // La fila es un botón: el desglose dice cuánta plata va a cada rubro, y
      // el lugar donde esa plata se cambia o se revisa es unos centímetros más
      // abajo. syncBudgetJumpTargets() desactiva las filas cuya sección todavía
      // no existe (tours sin actividades cargadas, traslados fuera de vuelo) y
      // les saca el "Ir a la sección", para no anunciarle al lector de pantalla
      // un salto que el clic no va a hacer.
      return '<button type="button" class="proposal-breakdown__row" data-breakdown-category="' + entry.category + '" data-jump-category="' + entry.category + '" data-jump-label="' + esc(entry.label) + '" aria-label="Ir a la sección de ' + esc(entry.label) + '"><div class="proposal-breakdown__label">' + icon + '<span>' + esc(entry.label) + '</span></div><b data-breakdown-value>' + money(entry.value) + '</b></button>';
    }).join('');
    return '<div class="proposal-breakdown__stack" role="img" aria-label="Distribución del costo">' + segments + '</div>' +
      '<div class="proposal-breakdown__list">' + rows + '</div>';
  }
  function proposalBreakdownHead() {
    // Sin selector de moneda acá: el total de la propuesta ya está arriba, en
    // la banda de resumen, y el header de la página tiene el suyo. Repetir el
    // badge en cada encabezado de sección lo que producía era la misma-looking
    // pastilla en tres lugares de una vez, y cada una ciclaba una lista
    // distinta. El punto de la sección es el reparto, no cambiar la moneda.
    return '<div class="sec__head"><h2>A dónde va tu plata</h2></div>';
  }
  function proposalBreakdownMarkup(state) {
    return '<section class="proposal-breakdown" data-proposal-breakdown>' +
      proposalBreakdownHead() +
      proposalBreakdownContent(state) +
      '</section>';
  }
  /* ---------- salto desde el desglose / "Mi Viaje" a la sección del rubro ----------
     El desglose y el panel "Mi Viaje" son el mapa del presupuesto: dicen cuánta
     plata va a cada rubro, pero la decisión se toma más abajo (elegir régimen,
     sumar un tour, cambiar el vuelo). Un clic en cualquiera de las dos vistas
     lleva a esa sección en vez de dejar al usuario buscándola a ojo.
     Cada destino se marca con data-budget-anchor="<categoría>" en el markup de
     la sección, así el mapa se actualiza solo cuando cambia el modo de
     transporte o llegan los hoteles. */
  function budgetAnchorFor(category) {
    if (!category) return null;
    var detail = document.getElementById('detalle-contenido');
    var scope = detail || document;
    return scope.querySelector('[data-budget-anchor="' + category + '"]');
  }
  // Las filas se dibujan antes que las secciones que apuntan (el HTML del
  // detalle se arma completo en un solo innerHTML), así que el "puede saltar"
  // se resuelve después, ya con el DOM real. Las categorías sin destino posible
  // -tours cuando el destino no tiene actividades, traslados fuera de vuelo-
  // quedan como texto plano en vez de prometer un salto que no existe.
  function syncBudgetJumpTargets() {
    var jumpers = document.querySelectorAll('[data-jump-category]');
    Array.prototype.forEach.call(jumpers, function (node) {
      var target = budgetAnchorFor(node.getAttribute('data-jump-category'));
      var jumpable = !!target;
      var label = node.getAttribute('data-jump-label');
      node.classList.toggle('is-jumpable', jumpable);
      // Sin destino el botón se desactiva y deja de anunciarse como un salto:
      // el texto visible ya dice el nombre del rubro.
      if ('disabled' in node) node.disabled = !jumpable;
      if (label) node.setAttribute('aria-label', jumpable ? 'Ir a la sección de ' + label : label);
    });
  }
  function highlightBudgetAnchor(target) {
    var previous = document.querySelectorAll('.is-budget-anchor');
    Array.prototype.forEach.call(previous, function (node) { node.classList.remove('is-budget-anchor'); });
    target.classList.add('is-budget-anchor');
    window.clearTimeout(highlightBudgetAnchor.timer);
    highlightBudgetAnchor.timer = window.setTimeout(function () { target.classList.remove('is-budget-anchor'); }, 1800);
  }
  // Un token por salto: si el usuario va clickeando rubros seguidos, el último
  // clic gana y los scrolls pendientes de los anteriores se descartan.
  var budgetJumpToken = 0;
  function jumpToBudgetSection(category) {
    var target = budgetAnchorFor(category);
    if (!target) return false;
    // Se lleva el foco al destino para que el salto también se pueda seguir con
    // el teclado desde ahí, no sólo con el mouse.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    highlightBudgetAnchor(target);
    var token = ++budgetJumpToken;
    function landed() {
      // "Aterrizó" = el borde superior de la sección quedó contra el margen
      // superior de la pantalla. El margen lo pone scroll-margin-top (18px).
      return Math.abs(target.getBoundingClientRect().top - 18) <= 4;
    }
    function go(behavior, isRetry) {
      if (token !== budgetJumpToken) return;
      target.scrollIntoView({ behavior: behavior, block: 'start' });
      target.focus({ preventScroll: true });
      if (isRetry) return;
      // El scroll suave no siempre arranca: si la página quedó en 0 justo antes
      // (recién se abrió una propuesta, que arranca con un "volver arriba"),
      // Chromium lo ignora y el clic no parece hacer nada. Si a los 350ms la
      // sección todavía no llegó, se completa de una, sin animación.
      window.setTimeout(function () {
        if (token === budgetJumpToken && !landed()) go('auto', true);
      }, 350);
    }
    // Sin requestAnimationFrame: no dispara con la pestaña en segundo plano y
    // el clic se pierde. Un timeout(0) deja pasar el frame igual y además corre
    // siempre, que es lo que importa para un salto pedido por la persona.
    window.setTimeout(function () { go('smooth', false); }, 0);
    return true;
  }
  function handleBudgetJump(e) {
    var trigger = e.target.closest && e.target.closest('[data-jump-category]');
    if (!trigger || trigger.disabled) return;
    if (jumpToBudgetSection(trigger.getAttribute('data-jump-category'))) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  function toursWhatsappUrl(state) {
    var selectedTours = (state && state.selectedTours) || [];
    if (!selectedTours.length || !state.meta) return null;
    var tourLines = selectedTours.map(function (tour) { return '- ' + tour.title + ' (' + money(tour.price) + ')'; }).join('\n');
    var message = 'Hola, quiero reservar estos tours para mi viaje a ' + state.meta.dest.name + ':\n' + tourLines + '\n\nTotal referencial de tours: ' + money(state.toursTotal) + '\nViajamos ' + state.meta.pax + (Number(state.meta.pax) === 1 ? ' persona' : ' personas') + ' del ' + state.meta.dep + ' al ' + state.meta.ret + '. ¿Podrían confirmar disponibilidad y valor final?';
    return 'https://wa.me/?text=' + encodeURIComponent(message);
  }
  function flightWhatsappUrl(state, flightSummary, flightTotal) {
    if (!state || !state.meta) return null;
    /* Sin vuelo elegido no hay nada que reservar: mandar por WhatsApp un mensaje
       con "undefined · Origen" y "sin fecha" obligaba a la persona a explicar por
       chat lo que ya se elige en la pagina. Devolver null deja el boton apagado
       y el aviso en su lugar. */
    if (!flightSummary || !flightSummary.selected) return null;
    var route = ((flightSummary.origin && (flightSummary.origin.name || flightSummary.origin.code)) || 'Origen') + ' → ' + ((flightSummary.destination && (flightSummary.destination.name || flightSummary.destination.code)) || state.meta.dest.name);
    var message = 'Hola, quiero reservar este vuelo para mi viaje a ' + state.meta.dest.name + ':\n' + flightSummary.airline + ' · ' + route + '\n' + flightSummary.summary + '\nPrecio de referencia: ' + money(flightTotal) + '\nFechas: ' + state.meta.dep + ' al ' + state.meta.ret + ' · ' + state.meta.pax + (Number(state.meta.pax) === 1 ? ' pasajero' : ' pasajeros') + '. ¿Podrían confirmar disponibilidad y emitir?';
    // Al mismo numero que el checkout: los dos son pedidos que tiene que tomar
    // una persona, no mensajes para un amigo.
    return whatsappUrl(message, WHATSAPP_RESERVAS);
  }
  function getCategoryColor(category) {
    var match = CATS.filter(function (item) { return item[0] === category; })[0];
    return match ? match[2] : '--c1';
  }
  function getBudgetDefaults(destKey) {
    var key = String(destKey || '').toLowerCase();
    var beachKeys = ['buz', 'rio', 'fln', 'ssa', 'rec', 'for', 'mcz', 'nat', 'pip', 'brazil'];
    var isBeach = beachKeys.indexOf(key) >= 0 || key.indexOf('beach') >= 0 || key.indexOf('playa') >= 0;
    return isBeach ? BRASIL_DEFAULT_COSTS.beach : BRASIL_DEFAULT_COSTS.city;
  }
  function getActiveBreakdownEntries() {
    if (!detailState) return [];
    return getBudgetBreakdown(detailState).entries;
  }
  function findSelectedHotelLabel() {
    if (detailState && detailState.selectedHotel === false) return 'Sin alojamiento';
    if (detailState && detailState.selectedHotelName && detailState.selectedHotelName !== 'Hotel recomendado') return detailState.selectedHotelName;
    var checked = document.querySelector('[data-hotel-total]:checked');
    if (checked) {
      var card = checked.closest('[data-hotel-option]');
      if (card) {
        var name = card.querySelector('h3');
        if (name && name.textContent) return name.textContent.trim();
      }
    }
    if (detailState && detailState.selectedHotelName) return detailState.selectedHotelName;
    return 'Hotel seleccionado';
  }
  function findSelectedHotelDetail() {
    if (detailState && detailState.selectedHotel === false) return 'Todavía no elegiste un alojamiento.';
    var checked = document.querySelector('[data-hotel-total]:checked');
    var card = checked && checked.closest('[data-hotel-option]');
    var detail = card && card.querySelector('.hotel-detail');
    return detail && detail.textContent ? detail.textContent.trim() : 'Alojamiento seleccionado';
  }
  /* El subtitulo de la fila "Auto" del panel: el modelo que se eligio y si es a
     nafta o electrico. El modelo importa porque el total depende entero de el
     (13 km/l contra 9 cambia el combustible), asi que poner solo "Roadtrip"
     dejaba a la persona sin forma de entender de donde sale el numero. Se lee
     del <select> que ya esta en el DOM en vez de guardar el valor aparte: si
     esos dos se desincronizan, el select es el que la persona esta mirando. */
  function roadtripMeta() {
    var isEv = detailState && detailState.roadtripVehicleType === 'ev';
    if (isEv) {
      var evSel = document.querySelector('[data-roadtrip-ev-model]');
      var evLabel = evSel && evSel.options && evSel.selectedIndex >= 0
        ? evSel.options[evSel.selectedIndex].textContent
        : 'Eléctrico';
      return 'Eléctrico · ' + evLabel;
    }
    var sel = document.querySelector('[data-roadtrip-model]');
    var label = sel && sel.options && sel.selectedIndex >= 0
      ? sel.options[sel.selectedIndex].textContent
      : 'Auto';
    return label.split(' · ')[0];
  }
  function renderTripSummary() {
    try { pintarPasos(); } catch (e) { /* todavia no hay viaje */ }
    var summary = $('#trip-summary');
    if (!summary) return;
    if (!detailState || !detailState.meta) {
      summary.hidden = true;
      summary.innerHTML = '';
      return;
    }
    var budget = getBudgetBreakdown(detailState);
    var total = budget.total;
    var entries = budget.entries;
    var flightDetalle = (detailState.selectedOffer && detailState.selectedOffer.airline) || detailState.selectedFlight || '';
    var flightPrice = !vueloElegido() ? 0 : (detailState.selectedOffer && detailState.selectedOffer.price ? Number(detailState.selectedOffer.price) : (Number(detailState.flight) || 0));
    var hotelName = findSelectedHotelLabel();
    /* El nombre del hotel va al dato, pero solo si es un nombre. "Hotel
       seleccionado" y "Hotel recomendado" no son nombres: son los dos finales
       que devolvía el finder cuando todavía no hay nada elegido, y como dato
       hacían que la fila dijera Hotel → Hotel seleccionado. Ahora esa fila dice
       Hotel → Sin elegir, y el estado alcanza. */
    var hotelDetalle = (detailState.selectedHotel === false || !hotelName || hotelName === 'Hotel seleccionado' || hotelName === 'Hotel recomendado' || hotelName === 'Sin alojamiento') ? '' : esc(hotelName);
    // El TOTAL de los dos tramos, no solo el de llegada: la fila del resumen tiene
    // que mostrar lo mismo que el total de arriba, y con los dos tramos elegidos
    // el de llegada solo es la mitad.
    var transferAmount = trasladoSumado(detailState);
    var transferIncluded = transferAmount > 0;
    // Solo la modalidad. Antes esta fila decia "Compartido · 1 hora después de la
    // llegada · 15:20": una hora que la app derivaba de la llegada del vuelo y
    // que el operador iba a cambiar igual. El transfer no tiene horario hasta
    // que se coordina, asi que la fila dice la modalidad y el monto, que si
    // son datos.
    /* La modalidad, de los dos tramos. Con los dos iguales alcanza con decirla
       una vez; si difieren, el resumen tiene que mostrar las dos, porque el monto
       que tiene al lado es la suma y "Compartido" a secas no lo explica. */
    var tLlegada = transferTypeDe(detailState, 'llegada');
    var tVuelta = transferTypeDe(detailState, 'vuelta');
    var nombreTipo = function (tipo) { return tipo === 'private' ? 'Privado' : 'Compartido'; };
    var transferMeta = !transferIncluded ? 'No incluido'
      : tLlegada && tVuelta && tLlegada !== tVuelta
        ? 'Ida ' + nombreTipo(tLlegada) + ' · vuelta ' + nombreTipo(tVuelta)
        : nombreTipo(tLlegada || tVuelta);
    /* Cuantas, no si estan elegidas. "3 actividades seleccionadas" repetia en
       cada fila lo que el estado ya dice una vez, y se comia 27 caracteres del
       ancho. El dato es el numero; el verbo, no. */
    var toursDetalle = detailState.selectedTours && detailState.selectedTours.length
      ? detailState.selectedTours.length + (detailState.selectedTours.length === 1 ? ' actividad' : ' actividades')
      : '';
    var foodPerDay = Number(detailState.foodPerDay) || 0;
    var localPerDay = Number(detailState.localPerDay) || 0;
    /* El transporte cambia segun el modo, y cada modo tiene SU fila. Antes solo
       habia bus y vuelo: con el modo auto caia en la fila de "Vuelo" con 0 y el
       auto no aparecia en ningun lado del panel. No era que estuviera en cero:
       la seccion de auto estaba mostrando su total (combustible, peajes,
       mantenimiento) y el presupuesto no loJamaba. La persona veia R$ 1.422 de
       auto en su seccion y un "Vuelo R$ 0,00" en el resumen, sin forma de
       entender que el primero estaba incluido en el total de arriba.

       En auto tampoco va la fila de vuelo: no hay vuelo, hay auto. */
    /* Cada fila del resumen dice lo mismo, en el mismo orden: un ESTADO y un
       DATO. Antes cada rubro traía su propia frase y ninguna se parecía a la de al
       lado — "Vuelo no seleccionado" en una, "Hotel recomendado" en otra, "Sin
       sumar" en una tercera, y el transfer sin texto cuando venía bien. Cuatro
       maneras de decir si un rubro estaba en la cuenta, y la única que se leía
       distinto era la que estaba mal.

       El estado sale de un vocabulario cerrado de tres y está SIEMPRE. El dato es
       lo específico del rubro (la airline, el hotel, los $/día, la modalidad) y se
       puede truncar sin perder sentido, porque lo que no puede faltar es el
       estado. "Excluido" y "sin elegir" son dos cosas distintas y se dicen
       distinto: una es una decisión de la persona y la otra es que todavía no
       llegó. */
    var ESTADO = { ok: 'Sumado', vacio: 'Sin elegir', fuera: 'No incluido' };
    var transporteRow = detailState.transportMode === 'bus'
      ? { cat: 'bus', label: 'Bus', detalle: 'Semicama / cama desde ' + esc(originCityName(detailState.meta.origin || S.origin)), value: money(busSumado(detailState)), color: getCategoryColor('bus') }
      : detailState.transportMode === 'auto'
        ? { cat: 'auto', label: 'Auto', detalle: esc(roadtripMeta()), value: money(Number(detailState.auto) || 0), color: getCategoryColor('auto') }
        /* El vuelo sin elegir ya no dice "Vuelo no seleccionado" en el dato: eso
           es el estado, y repetirlo dos veces en la misma fila era el ruido que
           se vino a sacar. El dato queda para el nombre de la airline. */
        : { cat: 'pasajes', label: 'Vuelo', detalle: esc(flightDetalle), value: money(flightPrice), color: getCategoryColor('pasajes') };
    var summaryItems = [
      transporteRow,
      ...(detailState.transportMode === 'flight' ? [{ cat: 'traslados', label: 'Transfer', excluido: !transferIncluded, detalle: transferIncluded ? esc(transferMeta) : '', value: transferIncluded ? money(transferAmount) : '—', color: getCategoryColor('traslados') }] : []),
      { cat: 'alojamiento', label: 'Hotel', excluido: detailState.selectedHotel === false, detalle: hotelDetalle, value: money(hotelSumado(detailState)), color: getCategoryColor('alojamiento') },
      { cat: 'comidas', label: 'Comida', excluido: detailState.foodBudgetMode === 'none', detalle: detailState.foodBudgetMode === 'none' ? '' : (foodPerDay ? money(foodPerDay) + '/día' : 'Estimado'), value: money(Number(detailState.parts && detailState.parts.comidas) || 0), color: getCategoryColor('comidas') },
      { cat: 'local', label: 'Transporte local', excluido: detailState.localBudgetMode === 'none', detalle: detailState.localBudgetMode === 'none' ? '' : (localPerDay ? money(localPerDay) + '/día' : 'Estimado'), value: money(Number(detailState.parts && detailState.parts.local) || 0), color: getCategoryColor('local') },
      { cat: 'tours', label: 'Tours', detalle: toursDetalle, value: money(Number(detailState.toursTotal) || 0), color: getCategoryColor('tours') }
    ];
    // Mismo criterio que la barra: de mayor a menor monto. Los rubros en cero
    // quedan al final, que es donde el usuario tiene menos que mirar.
    summaryItems.forEach(function (item) {
      item.n = item.cat === 'bus' ? busSumado(detailState)
        : item.cat === 'auto' ? (Number(detailState.auto) || 0)
        : item.cat === 'pasajes' ? flightPrice
        : item.cat === 'alojamiento' ? hotelSumado(detailState)
        : item.cat === 'comidas' ? (Number(detailState.parts && detailState.parts.comidas) || 0)
        : item.cat === 'local' ? (Number(detailState.parts && detailState.parts.local) || 0)
        : item.cat === 'traslados' ? (transferIncluded ? transferAmount : 0)
        : (Number(detailState.toursTotal) || 0);
    });
    summaryItems.sort(function (a, b) { return (Number(b.n) || 0) - (Number(a.n) || 0); });
    /* El estado sale del monto, con dos excepciones.

       Una: los rubros que la persona apago a proposito (hotel, comida,
       transporte local, transfer) se marcan "No incluido" aunque valgan 0,
       porque 0 tambien puede ser "todavia no lo elegiste" y son dos pedidos
       distintos.

       La otra pesa mas que el monto. Si el rubro ya esta reservado, el estado
       NO es "Sumado": "Sumado" dice que la cifra esta en el total, que es
       cierto, pero no dice que esa plata ya quedo comprometida, y deja a la
       persona con la duda de si tiene que reservarlo otra vez. El estado
       reservado pisa al "Sumado" y lleva el canal al lado --de Booking, de
       Google Flights o gestion directa-- que es la pregunta que aparece
       justo en ese momento. */
    summaryItems.forEach(function (item) {
      var reserva = estadoReserva(item.cat);
      if (reserva) {
        item.estado = reserva;
        item.estadoClave = reserva === 'Reservado' ? 'confirmado' : 'wip';
        var canal = canalDe(item.cat).canal;
        item.detalle = item.detalle ? item.detalle + ' \u00b7 ' + canal : canal;
        return;
      }
      item.estado = item.excluido ? ESTADO.fuera : (item.n > 0 ? ESTADO.ok : ESTADO.vacio);
      item.estadoClave = item.excluido ? 'fuera' : (item.n > 0 ? 'ok' : 'vacio');
    }

);
    /* La barra es una sola, continua, con degradé.

       Antes eran N segmentos con un color por rubro (var(--c1), --c5, --c3...), con
       un borde de 2px entre ellos. En un panel de 360px quedaban 4 o 5 franjas de
       pastel del mismo tono, y ninguna se leia: el alto de cada una era el mismo
       dato que ya estaba en la fila de abajo, con su icono y su color. La barra
       estaba repitiendo el desglose con menos informacion y mas ruido.

       Ahora es una unica barra con el avance, en degradé de la marca. Deja de
       intentar mostrar la composicion —para eso estan las filas— y pasa a mostrar
       una sola cosa: cuanto de la cotizacion esta avanzado. El `title` y el
       aria-label siguen llevando el desglose para quien lo necesite. */
    var _cuantificado = entries.filter(function (e) { return Number(e.n) > 0; }).reduce(function (s, e) { return s + Number(e.n); }, 0);
    var _avance = Math.min(100, Math.round((_cuantificado / Math.max(1, Number(total) || 1)) * 100));
    /* Segmentos proporcionales, uno por rubro con monto, en el color del rubro
       (el mismo del icono de la fila). Los rubros en cero no ocupan lugar. */
    var _base = summaryItems.reduce(function (s, it) { return s + (Number(it.n) > 0 ? Number(it.n) : 0); }, 0);
    var segments = _base > 0
      ? summaryItems.filter(function (it) { return Number(it.n) > 0; }).map(function (it) {
          return '<span style="width:' + (Number(it.n) / _base * 100).toFixed(2) + '%;background:var(' + it.color + ')" title="' + esc(it.label) + '"></span>';
        }).join('')
      : '';
    var itemsHtml = summaryItems.map(function (item) {
      // Sólo el ícono: el cuadrado de color repetía la misma información y
      // ocupaba ancho al lado del texto. El botón entero lleva a la sección
      // donde ese rubro se configura, igual que las filas del desglose.
      return '<button type="button" class="trip-summary__item' + (item.n ? '' : ' is-zero') + '" data-jump-category="' + item.cat + '" data-jump-label="' + esc(item.label) + '"' + (item.detalle ? ' title="' + esc(String(item.detalle).replace(/<[^>]*>/g, '')) + '"' : '') + ' aria-label="Ir a la sección de ' + esc(item.label) + '">'
        + categoryIcon(item.cat, item.color)
        + '<div class="trip-summary__meta"><b>' + item.label + '</b>'
        + '<span class="trip-summary__sub"><span class="trip-summary__state is-' + item.estadoClave + '">' + item.estado + '</span>'
        // Sin descripcion junto al estado: solo icono, nombre, estado y monto. El
        // detalle (aerolinea, /dia, canal) queda en el title de la fila.
        + '</span></div>'
        + '<em>' + item.value + '</em>'
        + '</button>';
    }).join('');
    /* "Reservar" no va mas en esta card. Se mude al voucher —el modal que abre
       "Ver mi presupuesto", aca al lado— porque el boton necesita dos cosas que
       aca no estan: el total de lo que se reserva, que NO es el total del viaje
       que muestra esta card, y la lista de rubros elegidos, querecien esta
       completa al lado. Mostrar "Reservar actividades y transfer" sin el numero
       al lado de un boton que abre este mismo modal era el peor de los dos
       caminos: dos botones a la misma accion, separados por nada, y el que
       decia el precio no lo decia.

       Esta card queda como lo que es: el resumen del presupuesto, con "Ver mi
       presupuesto" para ver el detalle y "Guardar viaje". */
    /* El panel se repinta entero en cada recalculo (cambia un precio) y con el
       innerHTML se va la clase `minimized`. Sin guardarla, la persona que cerro
       el panel para ver la pagina lo ve abrirse solo cada vez que cambia un
       numero, y el colapsar deja de servir. */
    var estabaMin = summary.classList.contains('minimized');
    /* Chevron de verdad y no el caracter ^ de antes. Un ^ es una punta de
       sombrero: se dibuja arriba del renglon segun la fuente, no se centra, y
       en el peso que traia no se leia como flecha. El SVG gira con la clase. */
    var chevron = '<svg class="trip-summary__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    /* El panel tiene su propio scroll (overflow:auto). Reemplazar el innerHTML
       lo devuelve arriba, y como se repinta en cada recalculo --y hay recalculos
       mientras la persona baja-- la vista "saltaba" al inicio. Se guarda el
       scroll antes y se restaura despues; y si el markup es identico al de la
       pasada anterior no se toca el DOM. */
    var _scrollPrevio = summary.scrollTop;
    var _markup = '<div class="trip-summary__inner">' +
      '<button type="button" class="trip-summary__head" data-trip-summary-toggle aria-expanded="true" aria-controls="trip-summary-details"><span class="trip-summary__eyebrow">Mi Viaje</span><strong>' + money(total) + '</strong>' + chevron + '</button>' +
      /* El wrapper intermedio es lo que hace posible animar el cierre. Sin el,
       `display:none` en la fila cerrada y el panel salta de alto sin transicion. */
      '<div class="trip-summary__details" id="trip-summary-details"><div class="trip-summary__details-inner">'
      + '<div class="trip-summary__bar" aria-label="Avance de la cotización">' + segments + '</div>' +
      '<div class="trip-summary__items">' + itemsHtml + '</div>' +
      '<div class="trip-summary__actions">' +
      '<button type="button" class="trip-summary__cta" data-summary-book>Ver mi presupuesto</button>' +
      '<button type="button" class="trip-summary__save" data-save-trip>Guardar viaje</button></div>' +
      '</div></div>' +
      '</div>';
    if (summary.__markup !== _markup || !summary.firstElementChild) {
      summary.innerHTML = _markup;
      summary.__markup = _markup;
      summary.scrollTop = _scrollPrevio;
      // Una vez mas en el frame siguiente: la altura del panel se anima y el
      // primer intento puede toparse con un contenido todavia mas corto.
      if (_scrollPrevio && typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { summary.scrollTop = _scrollPrevio; });
    }
    if (estabaMin) summary.classList.add('minimized');
    summary.hidden = false;
    syncTripSummaryViewport();
    // syncBudgetJumpTargets() NO va acá: es un querySelectorAll sobre todo el
    // documento y antes se ejecutaba dos veces por cada recálculo (una dentro
    // de renderTripSummary y otra en el llamador). Ahora corre una vez por frame
    // desde queueHeavyRepaint(), que es quien sabe cuándo cambió la estructura.
  }
  function syncTripSummaryViewport() {
    var summary = $('#trip-summary');
    if (!summary) return;
    // 900px, no 768: el panel pasa a ancho completo en 900px (regla del CSS) y
    // antes el colapso arrancaba en 768. Un iPhone 14/15 en horizontal mide
    // 844x390, así que caía en el hueco: full-width y expandido, con ~200px de
    // alto sobre un viewport de 390 y sin forma de cerrarlo. El corte tiene que
    // coincidir con el del layout.
    var isMobile = window.innerWidth <= 900;
    var wasMobile = summary.getAttribute('data-mobile-viewport') === 'true';
    /* Solo al ENTRAR a mobile se colapsa. El `if (!isMobile) remove` de antes
       era peor que inutile: con el celu en vertical, la persona cerraba el
       panel, lo giraba, y la otra rama lo re-abria sola. Y el aria-expanded de
       abajo decia "expandido" porque el || con !isMobile ganaba siempre en
       desktop, sobre un panel que despues se cerraba a mano. */
    if (isMobile && !wasMobile) summary.classList.add('minimized');
    summary.setAttribute('data-mobile-viewport', String(isMobile));
    var toggle = summary.querySelector('[data-trip-summary-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', String(!summary.classList.contains('minimized')));
  }
  /* ---------- tarjeta para Instagram Stories ---------- */
  var htmlToImagePromise = null;
  function loadHtmlToImage() {
    if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
    if (htmlToImagePromise) return htmlToImagePromise;
    htmlToImagePromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js';
      script.onload = function () { resolve(window.htmlToImage); };
      script.onerror = function () { htmlToImagePromise = null; reject(new Error('No pudimos cargar el generador de imágenes.')); };
      document.head.appendChild(script);
    });
    return htmlToImagePromise;
  }
  function storyDateRange(meta) {
    function format(value) {
      if (!value) return '';
      var date = parse(value);
      return isNaN(date) ? String(value) : String(date.getDate()).padStart(2, '0') + '-' + date.toLocaleDateString('es-UY', { month: 'short' }).replace(/\./g, '');
    }
    var departure = format(meta.dep), returning = format(meta.ret);
    if (departure && returning) return departure + ' - ' + returning;
    var cheapest = meta.cheapestDateRange || meta.cheapestDates;
    if (cheapest && cheapest.dep && cheapest.ret) return format(cheapest.dep) + ' - ' + format(cheapest.ret);
    return cheapest && cheapest.date ? format(cheapest.date) : 'Fecha más económica del mes';
  }
  function storyCostLabel(entry) {
    return { pasajes: 'Vuelos', bus: 'Bus', alojamiento: 'Alojamiento', comidas: 'Régimen', local: 'Transporte local', traslados: 'Traslados', tours: 'Tours', auto: 'Auto' }[entry.category] || entry.label;
  }
  function storyInclusionIcon(category) {
    var paths = {
      pasajes: '<path d="M3 14.5 21 7l-2 5-6 3-1 5-2 1v-5l-5 1z"/><path d="m10 11-3-4"/>',
      bus: '<rect x="4" y="4" width="16" height="14" rx="3"/><path d="M4 11h16M8 18l-2 3m10-3 2 3M8 8h.01M16 8h.01"/>',
      auto: '<path d="m5 11 2-5h10l2 5 2 2v5h-2m-14 0H3v-5zM5 13h14M7 18h10"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
      alojamiento: '<path d="M3 20V5m0 10h18v5M3 11h5a3 3 0 0 1 3 3v1m0-4h6a4 4 0 0 1 4 4"/><path d="M7 8h.01"/>',
      comidas: '<path d="M7 3v7m-3-7v4a3 3 0 0 0 6 0V3m-3 7v11m10-18v18m0-18a4 4 0 0 1 4 4v4h-4"/>',
      traslados: '<path d="M4 16v-5l2-4h12l2 4v5M4 12h16M7 16h.01M17 16h.01M7 7l1-3h8l1 3"/>'
    };
    return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[category] || paths.alojamiento) + '</svg>';
  }
  function storyInclusionsMarkup(meta, entries) {
    var order = ['pasajes', 'bus', 'auto', 'alojamiento', 'comidas', 'traslados'];
    var present = Object.create(null);
    (entries || []).forEach(function (entry) {
      if (Number(entry.value) > 0 && order.indexOf(entry.category) >= 0) present[entry.category] = true;
    });
    if (meta.hotelType === 'all-inclusive') present.comidas = true;
    var items = order.filter(function (category) { return present[category]; }).map(function (category) {
      var label = category === 'comidas' && meta.hotelType === 'all-inclusive' ? 'All Inclusive' : storyCostLabel({ category: category });
      return '<span style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">' + storyInclusionIcon(category) + '<b style="font-weight:500;">' + esc(label) + '</b></span>';
    });
    if (!items.length) items = ['<span style="display:inline-flex;align-items:center;gap:5px;">' + storyInclusionIcon('pasajes') + '<b style="font-weight:500;">Vuelos</b></span>', '<span style="display:inline-flex;align-items:center;gap:5px;">' + storyInclusionIcon('alojamiento') + '<b style="font-weight:500;">Alojamiento</b></span>'];
    return '<div style="display:flex;align-items:center;gap:8px;margin:0 0 12px;color:rgba(255,255,255,.9);font-size:12px;line-height:1.3;white-space:nowrap;overflow:hidden;"><span style="flex:none;color:rgba(255,255,255,.72);font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Incluye</span>' + items.map(function (item, index) { return (index ? '<span style="flex:none;color:#F6B21B;font-weight:700;">+</span>' : '') + item; }).join('') + '</div>';
  }
  function loadStoryPhoto(photoUrl) {
    if (!photoUrl) return Promise.reject(new Error('No hay una foto disponible para este destino.'));
    return fetch(photoUrl, { mode: 'cors', cache: 'force-cache' }).then(function (response) {
      if (!response.ok) throw new Error('La foto del destino no se pudo descargar.');
      return response.blob();
    }).then(function (blob) {
      if (!blob.type || blob.type.indexOf('image/') !== 0) throw new Error('La imagen del destino no está disponible.');
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { reject(new Error('No se pudo preparar la foto del destino.')); };
        reader.readAsDataURL(blob);
      });
    });
  }
  function buildStoryCardNode(meta, totals, photo) {
    var location = [meta.dest.region, meta.dest.country || 'Brasil'].filter(Boolean).join(' - ');
    var inclusionsMarkup = storyInclusionsMarkup(meta, totals.entries);
    // El nodo se clona a SVG/canvas para exportarlo: si se posiciona fuera del
    // viewport (ej. left:-9999px) el navegador puede no llegar a pintarlo y la
    // captura sale en blanco. Por eso se ancla en (0,0) dentro de un wrapper
    // con overflow:hidden y tamaño 0, que lo mantiene invisible pero pintado.
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-1;';
    var node = document.createElement('div');
    node.style.cssText = 'width:540px;height:960px;font-family:Poppins,Arial,sans-serif;';
    node.innerHTML =
      '<div style="position:relative;width:540px;height:960px;background:#0B1B2B;color:#fff;overflow:hidden;">' +
      (photo ? '<img src="' + esc(photo) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' : '') +
      '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,27,43,.02) 0%,rgba(11,27,43,.08) 42%,rgba(11,27,43,.72) 68%,rgba(11,27,43,.96) 100%);"></div>' +
      '<div style="position:absolute;top:40px;left:40px;right:40px;display:flex;align-items:center;gap:9px;">' +
      '<svg width="24" height="30" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 0C5.4 0 0 5.3 0 11.8 0 20 12 30 12 30s12-10 12-18.2C24 5.3 18.6 0 12 0z" fill="#fff"/><circle cx="12" cy="11.5" r="4.6" fill="#F6B21B"/></svg>' +
      '<span style="font-family:Poppins,Arial,sans-serif;font-weight:700;letter-spacing:-.02em;font-size:22px;">cuántosale</span>' +
      '</div>' +
      '<div style="position:absolute;left:40px;right:40px;bottom:38px;">' +
      (location ? '<div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#F6B21B;margin-bottom:7px;">' + esc(location) + '</div>' : '') +
      '<div style="font-size:40px;font-weight:800;line-height:1.02;margin-bottom:11px;">' + esc(meta.dest.name) + '</div>' +
      '<div style="display:flex;align-items:center;gap:18px;margin-bottom:12px;color:rgba(255,255,255,.94);font-size:13px;font-weight:600;"><span>📅 ' + esc(storyDateRange(meta)) + '</span><span>👥 ' + esc(String(meta.pax)) + (Number(meta.pax) === 1 ? ' pasajero' : ' pasajeros') + '</span></div>' +
      '<div style="background:rgba(11,27,43,.52);border:1px solid rgba(255,255,255,.3);border-radius:18px;padding:16px 19px;margin-bottom:12px;">' +
      '<div style="font-size:11px;color:rgba(255,255,255,.78);margin-bottom:4px;text-transform:uppercase;letter-spacing:.1em;">Precio por pasajero</div>' +
      '<div style="font-size:58px;font-weight:800;line-height:1;letter-spacing:-.03em;">' + esc(money(totals.pp)) + '</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:7px;">Total del viaje: ' + esc(money(totals.total)) + '</div>' +
      '</div>' +
      inclusionsMarkup +
      '<div style="font-size:15px;font-weight:800;line-height:1.35;color:#fff;">Calculá tu presupuesto exacto en <span style="color:#F6B21B;">cuantosale.uy</span></div>' +
      '</div></div>';
    wrapper.appendChild(node);
    document.body.appendChild(wrapper);
    return wrapper;
  }
  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  /* Copia el itinerario en texto plano.

     Faltaba la forma de pasarlo sin generar imagen ni abrir WhatsApp, que es lo
     que se usa para pegarlo en un mail o en un grupo. El texto ya estaba armado
     (modal.dataset.summaryText) porque es el que va en el wa.me; solo faltaba
     el botón.

     navigator.clipboard necesita contexto seguro y localhost lo es, pero en
     http:// desde una IP de la app no lo es: se cae y no avisa. Por eso hay una
     vuelta con execCommand y, si tampoco funciona, se lo dice a la persona en
     vez de fingir que se copió. */
  /* El mensaje al asesor, armado con lo que esta REALMENTE marcado.

     La plantilla fija --"ya reserve mis vuelos y hotel"-- sirve solo cuando las
     dos cosas son ciertas. Si la persona todavia no reservo el vuelo y el
     mensaje se lo afirma, la primera frase del chat ya miente y el asesor
     empieza a trabajar sobre datos falsos. Asi que el texto se arma aca: se
     listan solo los rubros confirmados, y se pide lo que falta.

     Los rubros confirmados van primero, porque son los que el asesor necesita
     para avanzar. Los pendientes van al final como pedido, no como logro. */
  /* El link para sumarse al grupo, si el grupo ya existe.

     El id lo escribe grupo.js la primera vez que alguien entra a /grupo, bajo
     'cuantosale_grupo_ver_en'. Y /grupo/<id> es una ruta publica que ya
     funciona: server.js la sirve y le inyecta los og:title para que WhatsApp
     muestre la vista previa del reparto.

     Devuelve null cuando todavia no hay grupo. No se inventa un id: un link a
     un grupo que no existe abre una pagina vacia y el que la abre es el asesor,
     que es la peor persona para mostrarle algo roto. Sin grupo, el mensaje
     manda a /grupo, que es donde se arma y de ahi sale el link para compartir.

     La clave que usa grupo.js se lee del mismo localStorage y con el mismo
     nombre a proposito: si cambia de nombre, el link deja de funcionar y no
     hay ningun test que lo note. */
  /* ---------- Dividir gastos con amigos ----------
     Un modal propio, sin salir de la app: se elige cuantas personas son (y,
     si se quiere, sus nombres), y se ve al toque cuanto le toca a cada una y que
     cubre ese monto. El reparto es en partes iguales sobre el total que ya
     muestra el presupuesto (getBudgetBreakdown), asi que es el mismo numero que
     el resto de la pagina. Se comparte por WhatsApp o se copia el resumen.
     Llevar la cuenta de quien pago que sigue en /grupo (irAlGrupo). */
  var splitState = { n: 0, nombres: [] };
  function splitDatos() {
    var b = getBudgetBreakdown(detailState);
    return { total: Number(b.total) || 0, filas: b.entries.filter(function (e) { return e.value > 0; }) };
  }
  function splitNombre(i) {
    var t = String(splitState.nombres[i] || '').trim();
    return t || 'Persona ' + (i + 1);
  }
  function splitTexto() {
    var d = splitDatos(), n = splitState.n;
    var meta = detailState.meta;
    var por = d.total / n;
    var l = [];
    l.push('💸 Dividir gastos · Viaje a ' + meta.dest.name + ' (' + storyDateRange(meta) + ')');
    l.push('Total ' + money(d.total) + ' / ' + n + (n === 1 ? ' persona' : ' personas') + ' = ' + money(por) + ' por persona');
    l.push('');
    l.push('Cada uno cubre:');
    d.filas.forEach(function (f) { l.push('• ' + f.label + ': ' + money(f.value / n)); });
    l.push('');
    for (var i = 0; i < n; i++) l.push('• ' + splitNombre(i) + ': ' + money(por));
    var g = enlaceGrupo();
    l.push('');
    l.push(g ? 'Cuenta del grupo: ' + g : 'Armado con CuántoSale: ' + location.origin);
    return l.join('\n');
  }
  function splitResultado() {
    var d = splitDatos(), n = splitState.n, por = d.total / n;
    var filas = d.filas.map(function (f) {
      return '<li><span>' + esc(f.label) + '</span><em>' + money(f.value) + ' en total</em><b>' + money(f.value / n) + '</b></li>';
    }).join('');
    var gente = '';
    for (var i = 0; i < n; i++) gente += '<li><span>' + esc(splitNombre(i)) + '</span><b>' + money(por) + '</b></li>';
    return '<p class="split-eq">' + money(d.total) + ' <span>/ ' + n + (n === 1 ? ' persona' : ' personas') + '</span> = <b>' + money(por) + ' por persona</b></p>' +
      '<h3 class="split-sub">Qué cubre cada parte</h3><ul class="split-rows">' + filas + '</ul>' +
      '<h3 class="split-sub">Cuánto pone cada uno</h3><ul class="split-people">' + gente + '</ul>' +
      '<p class="split-note">Partes iguales sobre el total estimado del presupuesto. Los montos pueden variar si cambiás tus elecciones.</p>';
  }
  function splitNombresMarkup() {
    var h = '';
    for (var i = 0; i < splitState.n; i++) {
      h += '<label class="split-name"><span>' + (i + 1) + '</span><input type="text" maxlength="24" placeholder="Persona ' + (i + 1) + '" value="' + esc(splitState.nombres[i] || '') + '" data-split-name="' + i + '" autocomplete="off"></label>';
    }
    return h;
  }
  function splitPintar(completo) {
    var el = document.getElementById('split-modal');
    if (!el) return;
    var out = el.querySelector('[data-split-n]');
    if (out) out.textContent = splitState.n;
    if (completo) { var nombres = el.querySelector('[data-split-names]'); if (nombres) nombres.innerHTML = splitNombresMarkup(); }
    var res = el.querySelector('[data-split-result]');
    if (res) res.innerHTML = splitResultado();
    var menos = el.querySelector('[data-split-minus]'); if (menos) menos.disabled = splitState.n <= 1;
    var mas = el.querySelector('[data-split-plus]'); if (mas) mas.disabled = splitState.n >= 20;
  }
  function closeSplitModal() {
    var el = document.getElementById('split-modal');
    if (!el) return;
    el.hidden = true; el.setAttribute('aria-hidden', 'true'); el.innerHTML = '';
    syncScrollLock();
  }
  function copiarTextoSplit(btn, textoPropio) {
    var texto = textoPropio || splitTexto();
    var original = btn.textContent;
    var avisar = function (ok) { btn.textContent = ok ? '¡Copiado!' : 'No se pudo copiar'; window.setTimeout(function () { btn.textContent = original; }, 1800); };
    var fallback = function () {
      var area = document.createElement('textarea');
      area.value = texto; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.appendChild(area); area.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area); avisar(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(function () { avisar(true); }, fallback);
    else fallback();
  }
  /* Lo que el presupuesto le deja a la cuenta del grupo: cada rubro elegido
     (los mismos que suma getBudgetBreakdown, con el mismo monto) y las personas
     del viaje con los nombres que se hayan escrito. grupo.js lo vuelca como
     gastos iniciales al crear el grupo, para que nadie recargue a mano lo que ya
     esta en el presupuesto. Desde el modal de reparto valen los nombres y la
     cantidad que se ajustaron ahi; desde el resumen, los pax del viaje. */
  function grupoPresetDatos(desdeModal) {
    var n = desdeModal && splitState.n ? splitState.n : Math.max(1, Math.min(20, Number(detailState.meta.pax) || 1));
    var people = [];
    for (var i = 0; i < n; i++) people.push(desdeModal ? String(splitState.nombres[i] || '').trim() : '');
    var items = splitDatos().filas.map(function (f) { return { label: f.label, amount: Math.round(f.value) }; })
      .filter(function (it) { return it.amount > 0; });
    return { items: items, people: people };
  }
  async function irAlGrupo(btn) {
    var texto = btn.textContent;
    btn.disabled = true; btn.textContent = 'Guardando...';
    var draft = tripPayload();
    if (draft) {
      var extra = grupoPresetDatos(btn.hasAttribute('data-split-grupo'));
      try { sessionStorage.setItem('cuantosale_grupo_preset', JSON.stringify({ name: draft.title, destination_key: draft.destination_key, items: extra.items, people: extra.people })); } catch (error) {}
    }
    var saved = await saveCurrentTrip({ skipTripsModal: true });
    if (saved) { window.location.href = '/grupo'; return; }
    btn.disabled = false; btn.textContent = texto;
  }
  function openSplitModal() {
    if (!detailState || !detailState.meta) return;
    var el = document.getElementById('split-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'split-modal'; el.className = 'booking-modal'; el.hidden = true; el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
      el.addEventListener('click', function (e) {
        if (e.target === el || e.target.closest('[data-split-close]')) { closeSplitModal(); return; }
        if (e.target.closest('[data-split-minus]')) { splitState.n = Math.max(1, splitState.n - 1); splitPintar(true); return; }
        if (e.target.closest('[data-split-plus]')) { splitState.n = Math.min(20, splitState.n + 1); splitPintar(true); return; }
        if (e.target.closest('[data-split-whatsapp]')) { window.open('https://wa.me/?text=' + encodeURIComponent(splitTexto()), '_blank', 'noopener'); return; }
        var c = e.target.closest('[data-split-copy]'); if (c) { copiarTextoSplit(c); return; }
        var g = e.target.closest('[data-split-grupo]'); if (g) { irAlGrupo(g); return; }
      });
      el.addEventListener('input', function (e) {
        var inp = e.target.closest && e.target.closest('[data-split-name]');
        if (!inp) return;
        splitState.nombres[Number(inp.getAttribute('data-split-name'))] = inp.value;
        splitPintar(false);
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) closeSplitModal(); });
    }
    /* Las personas salen del viaje: son las que se eligieron al buscar. Cambiarlas
       acá es un ajuste puntual del reparto y no toca el viaje. */
    splitState.n = Math.max(1, Math.min(20, Number(detailState.meta.pax) || 1));
    el.innerHTML = '<div class="booking-dialog split-dialog" role="dialog" aria-modal="true" aria-labelledby="split-title">' +
      '<button type="button" class="booking-close" data-split-close aria-label="Cerrar">×</button>' +
      '<span class="voucher-kicker">Tu viaje a ' + esc(detailState.meta.dest.name) + '</span>' +
      '<h2 id="split-title">Dividir gastos</h2>' +
      '<div data-split-result>' + splitResultado() + '</div>' +
      '<div class="split-adjust"><span>Personas en el reparto <small>(las del viaje; ajustalo si cambia)</small></span>' +
      '<div class="split-adjust__ctl"><button type="button" class="split-step" data-split-minus aria-label="Una persona menos">\u2212</button>' +
      '<output data-split-n>' + splitState.n + '</output>' +
      '<button type="button" class="split-step" data-split-plus aria-label="Una persona m\u00e1s">+</button></div></div>' +
      '<details class="split-namesbox"><summary>Agregar nombres (opcional)</summary><div class="split-names" data-split-names>' + splitNombresMarkup() + '</div></details>' +
      '<div class="split-actions">' +
      '<button type="button" class="split-btn split-btn--main" data-split-whatsapp>Enviar por WhatsApp</button>' +
      '<button type="button" class="split-btn" data-split-copy>Copiar resumen</button></div>' +
      '<button type="button" class="split-link" data-split-grupo>Llevar la cuenta de quién pagó →</button>' +
      '</div>';
    el.hidden = false; el.setAttribute('aria-hidden', 'false');
    syncScrollLock();
    splitPintar(false);
  }

  function enlaceGrupo() {
    var id = '';
    try { id = localStorage.getItem('cuantosale_grupo_ver_en') || ''; } catch (e) { return null; }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) return null;
    return location.origin.replace(/\/$/, '') + '/grupo/' + id;
  }

  function mensajeCoordinar() {
    if (!detailState || !detailState.meta) return null;
    var destino = detailState.meta.dest.name;
    var fechas = esc(storyDateRange(detailState.meta));
    var noches = Math.max(1, Number(detailState.meta.nights) || 1);
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var hechos = [];
    var faltan = [];
    var marcar = function (cat, txt) {
      if (reservasDe(cat)) hechos.push(txt); else faltan.push(txt);
    };
    marcar('pasajes', 'vuelo');
    marcar('alojamiento', 'alojamiento');
    var lineas = [];
    lineas.push('Hola! Estoy armando un viaje a ' + destino + ' (' + fechas + ', ' + noches + (noches === 1 ? ' noche' : ' noches') + ', ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + ').');
    if (hechos.length) {
      lineas.push('Ya tengo reservado: ' + hechos.join(' y ') + '.');
    } else {
      lineas.push(' Todavia no reserve nada.');
    }
    if (faltan.length) {
      lineas.push('Me falta coordinar: ' + faltan.join(' y ') + '.');
    } else {
      lineas.push('El alojamiento y el vuelo ya estan listos; me queda coordinar los traslados y las actividades con ustedes.');
    }
    lineas.push('Quiero arrancar con los traslados y las actividades. \u00bfLos coordinan ustedes o necesito pedirlo por aca?');
    var grupo = enlaceGrupo();
    lineas.push('');
    if (grupo) {
      lineas.push('Para unirse al reparto: ' + grupo);
    } else {
      lineas.push('Para repartir entre los que viajan, armamos el grupo acá: ' + location.origin.replace(/\/$/, '') + '/grupo');
    }
    lineas.push('');
    lineas.push('Presupuesto estimado del cotizador: ' + money(Math.round((Number(getBudgetBreakdown(detailState).total) || 0))));
    return lineas.join('\n');
  }

  function copySummaryText(button) {
    var modal = $('#booking-modal');
    var texto = (modal && modal.dataset.summaryText) || '';
    if (!texto) return;
    var label = button.querySelector('.voucher-btn__label') || button;
    var original = label.textContent;
    var avisar = function (ok) {
      label.textContent = ok ? '¡Copiado!' : 'No se pudo copiar';
      window.setTimeout(function () { label.textContent = original; }, 1800);
    };
    var fallback = function () {
      var area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      area.remove();
      avisar(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { avisar(true); }, fallback);
    } else fallback();
  }
  function shareStoryCard(button) {
    if (!detailState || !detailState.meta) return;
    // El texto del botón va en un <span> adentro, con el logo de Instagram al
    // lado: cambiar button.textContent en los estados de "generando" borraría
    // el svg y el botón se quedaría sin logo para el resto de la sesión.
    var labelNode = button && button.querySelector('.voucher-btn__label');
    var originalLabel = labelNode ? labelNode.textContent : (button ? button.textContent : '');
    if (button) { button.disabled = true; if (labelNode) labelNode.textContent = 'Generando imagen…'; else button.textContent = '⏳ Generando imagen…'; }
    var budget = getBudgetBreakdown(detailState);
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var totals = {
      total: Number(budget.total) || 0,
      pp: Math.round((Number(budget.total) || 0) / pax),
      entries: budget.entries || []
    };
    var meta = detailState.meta;
    var wrapper = null;
    Promise.all([loadHtmlToImage(), loadStoryPhoto(DEST_PHOTOS[meta.dest.key] || '')]).then(function (loaded) {
      var htmlToImage = loaded[0];
      wrapper = buildStoryCardNode(meta, totals, loaded[1]);
      var photoNode = wrapper.querySelector('img');
      return (photoNode && photoNode.decode ? photoNode.decode() : Promise.resolve()).then(function () {
        return htmlToImage.toBlob(wrapper.firstChild, { width: 540, height: 960, pixelRatio: 2, cacheBust: true, skipFonts: true, fontEmbedCSS: '' });
      });
    }).then(function (blob) {
      if (!blob) throw new Error('No se pudo generar la imagen.');
      var fileName = 'cuantosale-' + (meta.dest.key || 'viaje') + '.png';
      var file = typeof File === 'function' ? new File([blob], fileName, { type: 'image/png' }) : null;
      var shareData = file ? { files: [file], title: 'Mi viaje a ' + meta.dest.name, text: 'Mirá cuánto sale mi viaje a ' + meta.dest.name + ' con cuantosale.uy' } : null;
      if (shareData && navigator.canShare && navigator.canShare({ files: shareData.files })) {
        return navigator.share(shareData).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          downloadBlob(blob, fileName);
        });
      }
      downloadBlob(blob, fileName);
    }).catch(function (e) {
      alert(e && e.message || 'No pudimos generar la imagen para compartir. Probá de nuevo en un momento.');
    }).finally(function () {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      if (button) {
        button.disabled = false;
        if (labelNode) labelNode.textContent = originalLabel || 'Compartir en Instagram';
        else button.textContent = originalLabel;
      }
    });
  }
  /* ---------- reservas: "Reservar" -> "Reservado" ----------
     Un rubro del voucher cambia a "Reservado" cuando la persona completa la
     acción que lo reservaba: el clic en el link de vuelo o de hotel (que abre
     WhatsApp o Booking), o el confirmar del checkout para traslados y tours.

     OJO con lo que esta marca dice: para vuelo y hotel significa "hay una
     reserva en curso", no "esta confirmado". El link de Booking no avisa si la
     persona termino comprando, así que la app no lo sabe y no lo inventa. Por
     eso el boton deja poder deshacer y el title lo aclara.

     Se guarda en Supabase, no en localStorage, para que el "Reservado" siga
     ahí si la persona entra desde el celu después de reservarlo en la
     computadora. Como la escritura va por una función SECURITY DEFINER y no
     por la tabla, funciona sin sesion: la mayoria de las personas que reservan
     no estan logueadas todavia, y con una RLS atada a auth.uid() no habria
     forma de guardar nada. El id del viaje es un uuid que el navegador genera y
     guarda por localStorage, y funciona como la contraseña de la fila igual que
     el link en grupos_viaje. */
  var RESERVAS_KEY = 'cuantosale_reservas_viaje';
  function reservaDestino() {
    var d = detailState && detailState.meta && detailState.meta.dest;
    return d ? (d.name || d.key || '') : '';
  }
  /* El id del viaje, uno por combinación de destino + fechas + personas. Se
     guarda en un mapa por huella para que el mismo viaje conserve su id entre
     recargas y otro viaje del mismo navegador tenga el suyo. */
  function viajeReservaId() {
    if (!detailState || !detailState.meta) return null;
    var m = detailState.meta;
    var huella = [m.dest && m.dest.key, m.dep, m.ret, m.pax, m.origin].join('|');
    var mapa = {};
    try { mapa = JSON.parse(localStorage.getItem(RESERVAS_KEY) || '{}') || {}; } catch (e) { mapa = {}; }
    if (!mapa[huella] || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(mapa[huella]))) {
      mapa[huella] = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        // Sin randomUUID (http viejo) se arma un v4 a mano: el id tiene que ser
        // un uuid de verdad porque la columna es uuid y un string arbitrario lo
        // rechaza Postgres con un error que no dice nada en la pagina.
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      try { localStorage.setItem(RESERVAS_KEY, JSON.stringify(mapa)); } catch (e) { /* modo privado */ }
    }
    return mapa[huella];
  }
  function reservasDe(categoria) { return !!reservasViaje.categorias[categoria]; }
  /* Estado que la base no guarda: la base solo sabe SI un rubro esta marcado, no
     si es un pedido en curso o una reserva confirmada. Se anota aca, por viaje y
     en este navegador:
       'solicitado'  el pedido de traslado/actividades ya salio por WhatsApp;
       'reservado'   la agencia confirmo (vuelo/hotel: sin esto, un rubro marcado
                     por el clic del link es solo "Solicitado"). */
  var ESTADOS_KEY = 'cuantosale_estados_viaje';
  function estadosLocales() {
    try { return JSON.parse(localStorage.getItem(ESTADOS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function estadoLocal(categoria) {
    var id = viajeReservaId();
    var m = id ? estadosLocales()[id] : null;
    return (m && m[categoria]) || '';
  }
  function guardarEstadoLocal(categoria, valor) {
    var id = viajeReservaId();
    if (!id) return;
    var todos = estadosLocales();
    todos[id] = todos[id] || {};
    if (valor) todos[id][categoria] = valor; else delete todos[id][categoria];
    try { localStorage.setItem(ESTADOS_KEY, JSON.stringify(todos)); } catch (e) { /* modo privado */ }
  }
  /* ---------- De quien es cada rubro, y que se puede afirmar ----------
     El canal va al lado del precio porque responde la pregunta que la persona se
     hace al verlo: quien me lo cobra y donde se confirma.

     Los cuatro canales NO son del mismo tipo, y por eso el estado de reserva
     tampoco:

     - alojamiento: el boton arma un link a booking.com (bookingUrl()). La app
       abre el link y no se entera de si la persona termino pagando. Marcar el
       rubro no alcanza para decir "Comprado": seria inventar una confirmacion
       que nadie nos dio. El estado es "En curso" y el title lo aclara.
     - pasajes: el boton lleva a Google Flights con la busqueda armada. Los
       precios que muestra la tarjeta son de SerpAPI, que es busqueda, no venta.
       Mismo caso que el hotel: "En curso", nunca "Comprado".
     - traslados y tours: la reserva los lleva la agencia y la app la marca al
       completar el checkout de la app. Ahi si hay un hecho, y el estado es
       "Reservado" a secas.

     Duffel todavia NO esta integrado, asi que no se le puede poner el nombre
     al usuario: no hay nada que reservar todavia ahi.

     Cuando este, el estado no va a venir de la URL. La orden nace en
     nuestro servidor y el pago se procesa aca; Duffel devuelve la
     confirmacion oficial y el PNR, y el webhook --firmado, del lado del
     servidor-- es lo que marca el rubro como reservado. Por eso el
     "?vuelta=" que se agrega al link sigue siendo SOLO posicionamiento:
     un valor inventado en la barra no produce ningun cambio de estado. */
  var CANAL_RESERVA = {
    pasajes: { canal: 'Aerolínea', externo: true },
    alojamiento: { canal: 'Booking', externo: true },
    traslados: { canal: 'Gestión directa', externo: false },
    tours: { canal: 'Gestión directa', externo: false }
  };
  /* Lo que NO se reserva, dicho a la vista.

     Comida y transporte local no son un producto que alguien te venda: son un
     calculo diario del destino, un estimado que uno mismo va gastando. No hay
     canal, no hay pastilla de reserva y no hay boton que abrir. Y no alcanza con
     que hoy no salgan: Canales ya no crece, y con esto sigue siendo explicito
     que si manana aparece una fila de Comida en el modal, no hereda nada.

     La lista se lee sola: un rubro reservable es el que tiene canal. */
  function esReservable(categoria) { return !!CANAL_RESERVA[categoria]; }
  /* El color del icono de la fila, y es el del PROVEEDOR y no el del rubro.

     Con getCategoryColor() --la paleta de rubros-- casi todas las filas salian
     del mismo azul y la columna izquierda no distinguia nada. Con el proveedor
     se lee de un vistazo que el vuelo es de Google, el hotel es de Booking y los
     otros dos los lleva la agencia.

     Google y Booking compiten en el mismo mercado y los dos son azules, asi que
     van en dos tonos del mismo azul y no en dos colores inventados: el de
     Google mas claro y saturado, el de Booking mas frio y apagado. La silueta
     del icono los separa igual, y el color solo tiene que subir el tono.

     Lo que no es reservable no tiene proveedor, asi que cae en la paleta de
     rubros: comida y transporte local no son de nadie. */
  var COLOR_PROVEEDOR = { pasajes: '#7EA8E8', alojamiento: '#4E86C6', traslados: '--cel', tours: '--cel' };
  /* Devuelve un hex o un nombre de token, sin resolver. Resolverlo lo hace
     colorCss(), en el punto donde se arma el style. Un token sin almohadilla
     y un hex con almohadilla: esa es la unica diferencia y por eso se prueba el
     primer caracter y no se concatena nada. */
  function colorProveedor(categoria) {
    return COLOR_PROVEEDOR[categoria] || getCategoryColor(categoria);
  }
  function canalDe(categoria) { return esReservable(categoria) ? CANAL_RESERVA[categoria] : { canal: '', externo: false }; }
  /* Devuelve el texto del estado, o null si el rubro no esta reservado.

     "Seleccionado" y no "Confirmado" para vuelo y hotel: el link abre Google
     Flights o Booking y la app no se entera de si la persona termino pagando, asi
     que "Confirmado" afirmaria un pago que nadie nos notifico. "Seleccionado" es
     exactamente lo que se sabe —este vuelo, este hotel, ya estan elegidos— y es
     el mismo criterio con el que el resto de la app llama "elegido" a un rubro.
     Para traslados y tours, donde la reserva la lleva la agencia y la app la
     marca al completar el checkout, si hay hecho y dice "Reservado".

     Los dos verdes y con el mismo formato: la diferencia la cuenta la palabra,
     no el color. */
  function estadoReserva(categoria) {
    var externo = canalDe(categoria).externo;
    if (reservasDe(categoria)) return (!externo || estadoLocal(categoria) === 'reservado') ? 'Reservado' : 'Solicitado';
    if (!externo && estadoLocal(categoria) === 'solicitado') return 'Solicitado';
    return null;
  }
  /* La pastilla. Va con --good y no con un verde suelto: el proyecto usa mostaza
     para "elegido" y verde solo para "confirmado", que es un estado distinto y
     no compite con el. Los dos estados —Seleccionado y Reservado— comparten
     formato a proposito: son el mismo tipo decosa, con la diferencia en la
     palabra. La distincion fina la cuenta el title, que si explica de que
     se trata. */
  function chipReserva(categoria) {
    var estado = estadoReserva(categoria);
    if (!estado) return '';
    var canal = canalDe(categoria);
    var pendiente = estado === 'Solicitado';
    var title = pendiente
      ? (canal.externo ? 'Abriste el link. La compra se completa en ' + canal.canal + ', que abre en otra pestaña.' : 'Tu solicitud está en proceso: la confirmamos con el operador.')
      : 'Reserva confirmada, coordinada por ' + canal.canal.toLowerCase() + '.';
    return '<span class="reserva-chip' + (pendiente ? ' is-wip' : '') + '" title="' + esc(title) + '">'
      + '<svg class="reserva-chip__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
      + esc(estado) + '</span>';
  }
  /* Lee los rubros ya reservados de este viaje. Es una lectura, no un render: si
     falla (sin config, sin red, o la función todavia no esta corrida en
     Supabase) el voucher muestra "Reservar" como antes, que es el estado en el
     que uno no se equivoca. */
  async function cargarReservasViaje() {
    var viajeId = viajeReservaId();
    if (!viajeId || !supabaseClient) return;
    var yaLeidas = reservasViaje.viajeId === viajeId;
    var antesJson = yaLeidas ? JSON.stringify(reservasViaje.categorias || {}) : '';
    try {
      var result = await supabaseClient.rpc('reservas_leer', { p_viaje_id: viajeId });
      if (result.error) return;
      // El viaje pudo cambiar mientras esperaba la respuesta: se descarta la
      // lectura vieja para no pintar "Reservado" de un rubro de otro viaje.
      if (viajeReservaId() !== viajeId) return;
      var categorias = {};
      (result.data || []).forEach(function (c) { categorias[c] = true; });
      reservasViaje = { viajeId: viajeId, categorias: categorias };
      // Si el voucher está abierto se repinta, para que el "Reservado" aparezca
      // sin tener que cerrarlo y abrirlo de nuevo.
      /* Solo si cambiaron. Abrir el voucher pide las reservas y, al llegar, las
         repintaba aunque fueran las mismas; el repintado volvia a pedirlas y asi
         en bucle, reiniciando el scroll del modal cada vez (no dejaba bajar). */
      if (yaLeidas && JSON.stringify(categorias) !== antesJson) pintarVoucherReservas();
    } catch (e) { /* sin reservas guardadas: todos los rubros quedan en "Reservar" */ }
  }
  /* El marcado automático, solo para vuelo y hotel. Se dispara con el clic en el
     link, que abre WhatsApp o Booking: ahi la intención es del cliente y no hay
     nada que confirmar, así que no hace falta que nadie de la agencia lo haga.

     No dice que la reserva esté confirmada, y el botón lo aclara en el title: el
     link no avisa si la persona terminó comprando, así que la app no lo sabe y
     no lo inventa. Para traslado y tour esto no se usa nunca. */
  async function marcarReservado(categoria, detalle) {
    if (!supabaseClient) await initAuth();
    var viajeId = viajeReservaId();
    if (!viajeId || !supabaseClient) return;
    // Primero el botón, después la base. Se pinta al toque y se revierte si la
    // escritura falla, para que no haya que esperar el round-trip a Supabase
    // para ver que el toque entró. Y revierte de verdad: un "Reservado" que no
    // se guardó se leería en la próxima carga como reservado sin serlo.
    reservasViaje.categorias[categoria] = true;
    pintarVoucherReservas();
    try {
      var result = await supabaseClient.rpc('reservas_marcar', { p_viaje_id: viajeId, p_categoria: categoria, p_destino: reservaDestino(), p_detalle: detalle || {} });
      if (result.error) throw new Error(result.error.message);
    } catch (error) {
      delete reservasViaje.categorias[categoria];
      pintarVoucherReservas();
      console.warn('[reservas] no se pudo guardar', categoria, error);
    }
  }
  /* El marcado a mano, que es el de la agencia. Va por reservas_marcar_manual y
     no por el mismo que usa el clic del link, porque la base los separa: la
     abierta es la del clic de cualquiera, y la manual exige el correo de la
     agencia en el JWT. Si se usara la misma, el control de la página no sería
     más que una decoración —cualquiera que tocara el botón con las herramientas
     de developer la saltaría. */
  async function marcarReservadoManual(categoria, detalle) {
    if (!supabaseClient) await initAuth();
    var viajeId = viajeReservaId();
    if (!viajeId || !supabaseClient) return;
    if (!await esAgencia()) return;
    reservasViaje.categorias[categoria] = true;
    pintarVoucherReservas();
    try {
      var result = await supabaseClient.rpc('reservas_marcar_manual', { p_viaje_id: viajeId, p_categoria: categoria, p_destino: reservaDestino(), p_detalle: detalle || {} });
      if (result.error) throw new Error(result.error.message);
      guardarEstadoLocal(categoria, 'reservado');
      pintarVoucherReservas();
    } catch (error) {
      delete reservasViaje.categorias[categoria];
      pintarVoucherReservas();
      mostrarAvisoReserva(error.message || 'No pudimos guardar la reserva.');
    }
  }
  async function desmarcarReservado(categoria) {
    if (!supabaseClient) await initAuth();
    var viajeId = viajeReservaId();
    if (!viajeId || !supabaseClient) return;
    if (!await esAgencia()) return;
    delete reservasViaje.categorias[categoria];
    guardarEstadoLocal(categoria, '');
    pintarVoucherReservas();
    try {
      var result = await supabaseClient.rpc('reservas_desmarcar', { p_viaje_id: viajeId, p_categoria: categoria });
      if (result.error) throw new Error(result.error.message);
    } catch (error) {
      reservasViaje.categorias[categoria] = true;
      pintarVoucherReservas();
      mostrarAvisoReserva(error.message || 'No pudimos sacar la marca.');
    }
  }
  /* El aviso va arriba de la lista de rubros, no en un alert: el alert parte la
     pantalla y se pierde el scroll, y en un voucher de cuatro filas el error
     tiene que quedar al lado de la fila que falló. */
  function mostrarAvisoReserva(mensaje, tipo) {
    var modal = $('#booking-modal');
    if (!modal || modal.hidden || !modal.dataset.summaryText) return;
    var lista = modal.querySelector('.voucher-list');
    if (!lista) return;
    var previo = lista.querySelector('[data-reserva-aviso]');
    if (previo) previo.parentNode.removeChild(previo);
    var nota = document.createElement('li');
    nota.className = 'voucher-aviso' + (tipo === 'ok' ? ' is-ok' : '');
    nota.setAttribute('data-reserva-aviso', '');
    nota.textContent = mensaje;
    lista.appendChild(nota);
  }
  /* Repinta el voucher si está abierto. Se comprueba el dataset porque el modal
     se usa para el checkout también, y en ese momento no hay voucher que
     repintar: el innerHTML del checkout se perdería. */
  function pintarVoucherReservas() {
    /* Las reservas se leen de la red y llegan despues del primer pintado. Las dos
       cosas que dependen de ellas tienen que repintarse cuando llegan: el modal,
       que ya lo hacia, y el panel "Mi Viaje", que no. Sin esto el panel seguia
       diciendo "Sumado" en un vuelo que ya estaba reservado hasta que otra cosa
       hiciera recalcular el total, que no tiene por que pasar nunca.

       El panel se repinta siempre y sin mirar si esta visible: renderTripSummary
       es barato y el early return por "no hay datos" lo hace inocuo cuando
       todavia no hay viaje. */
    try { renderTripSummary(); } catch (e) { /* todavia no hay viaje que pintar */ }
    var modal = $('#booking-modal');
    if (!modal || modal.hidden) return;
    if (modal.dataset.summaryText) openItinerarySummaryModal({ repintado: true });
  }

  /* ---------- Resumen final del itinerario ----------
     Flota sobre la página: se abre en #booking-modal, con fondo oscurecido,
     botón de cerrar y scroll propio, y se llega con el CTA "Ver mi presupuesto"
     del panel "Mi Viaje". Se pinta cada vez que se abre, así que los números
     son los de este momento y no los de un recálculo anterior. */
  function openItinerarySummaryModal(opts) {
    /* opts.repintado: lo llama pintarVoucherReservas() para refrescar un modal ya
       abierto. Ese camino NO vuelve a pedir reservas ni a preguntar si es agencia:
       cada una de esas respuestas repintaba el modal, que las volvia a pedir, y el
       bucle reemplazaba los botones (X incluida) en medio del clic. */
    var _repintado = !!(opts && opts.repintado);
    if (!detailState || !detailState.meta) return;
    var modal = $('#booking-modal');
    // Si ya estaba abierto, se repinta en el mismo lugar en vez de volver arriba.
    var _dlgPrev = modal && !modal.hidden && modal.dataset.summaryText ? modal.querySelector('.booking-dialog') : null;
    var _scrollDlg = _dlgPrev ? _dlgPrev.scrollTop : 0, _scrollModal = _dlgPrev ? modal.scrollTop : 0;
    var flightSummary = getSelectedFlightSummary();
    // Solo la modalidad. El voucher antes decia "Recogida 1 hora después de la
    // llegada", una hora derivada del vuelo que el operador iba a cambiar. Ahora
    // dice "a coordinar", que es lo que realmente es hasta que el operador
    // responda.
    var transferState = detailState.transferWizard || { hotelName: hotelParaElTransfer() };
    // La etiqueta del WhatsApp. Con los dos tramos elegidos puede ser que difieran,
    // y mandarle al operador un solo "Transfer compartido" cuando uno de los dos
    // es privado es el error que hace que el pedido no se pueda tomar.
    var tl = transferTypeDe(detailState, 'llegada');
    var tv = transferTypeDe(detailState, 'vuelta');
    var nombreModo = function (tipo) { return tipo === 'private' ? 'privado' : 'compartido'; };
    var transferModeLabel = !tl && !tv ? 'A coordinar'
      : tl && tv && tl !== tv ? 'Ida ' + nombreModo(tl) + ' + vuelta ' + nombreModo(tv)
        : nombreModo(tl || tv);
    var selectedHotelName = findSelectedHotelLabel();
    var selectedHotelDetail = findSelectedHotelDetail();
    var hotelTotal = hotelSumado(detailState);
    // Única fuente de verdad para el monto del traslado: la misma función que
    // ya usan el widget "Mi Viaje" y "A dónde va tu plata", para que este
    // voucher nunca muestre un número distinto al resto de la pantalla.
    // Los dos tramos, para que el WhatsApp al operador y el total del voucher
    // cuenten lo mismo que el total de la pantalla.
    var transferTotal = detailState.transportMode === 'auto' ? 0 : trasladoSumado(detailState);
    var nights = Math.max(1, Number(detailState.meta.nights) || 1);
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var dailyCosts = getDestinationDailyCosts(detailState.meta.dest && detailState.meta.dest.key);
    var foodPerDay = Number(detailState.foodPerDay) || dailyCosts.food.moderado;
    var localPerDay = Number(detailState.localPerDay) || dailyCosts.transport.eco;
    var foodTotal = Math.round(foodPerDay * nights * pax);
    var localTotal = Math.round(localPerDay * nights * pax);
    var flightTotal = vueloSumado(detailState);
    // Con un medio terrestre el resumen habla del bus y no exige vuelo.
    var busMode = detailState.transportMode === 'bus';
    // Con auto propio el costo (combustible y peajes) es el transporte principal:
    // no es un traslado ni deja lugar para un vuelo sin elegir.
    var autoMode = detailState.transportMode === 'auto';
    var autoTotal = autoMode ? Math.round(Number(detailState.auto) || 0) : 0;
    var busTotal = busSumado(detailState);
    var selectedTours = detailState.selectedTours || [];
    var toursTotal = Number(detailState.toursTotal) || 0;
    var toursLabel = selectedTours.length ? selectedTours.length + (selectedTours.length === 1 ? ' actividad seleccionada' : ' actividades seleccionadas') : 'Sin actividades seleccionadas';
    var toursDetail = selectedTours.length ? selectedTours.map(function (tour) { return tour.title; }).join(', ') : 'Sumá actividades desde la sección de tours.';
    var totalGeneral = Number(getBudgetBreakdown(detailState).total) || (flightTotal + hotelTotal + transferTotal + foodTotal + localTotal + toursTotal);
    var transportLabel = Math.abs(localPerDay - dailyCosts.transport.confort) < Math.abs(localPerDay - dailyCosts.transport.eco) ? 'Confort' : 'Económico';
    var foodLabel = Math.abs(foodPerDay - dailyCosts.food.gourmet) < 3 ? 'Gourmet' : (Math.abs(foodPerDay - dailyCosts.food.casual) < 3 ? 'Casual' : 'Moderado');
    var summaryText = '✈️ ITINERARIO · ' + detailState.meta.dest.name + '\n' + '📅 Fechas: ' + detailState.meta.dep + ' → ' + detailState.meta.ret + ' (' + nights + ' noches)\n' + '👥 Viajeros: ' + pax + '\n\n' + (autoMode ? '🚗 Auto: ' + roadtripMeta() + ' · ' + money(autoTotal) : busMode ? '🚌 Bus: ' + busResumenCorto(detailState.meta) + ' · ' + money(busTotal) : '✈️ Vuelo: ' + vueloNombreCorto(flightSummary) + ' · ' + money(flightTotal)) + '\n' + '🏨 Hotel: ' + selectedHotelName + ' · ' + money(hotelTotal) + '\n' + (busMode || autoMode ? '' : '🚐 Traslado: ' + transferModeLabel + ' · ' + money(transferTotal) + '\n') + '🎟️ Tours: ' + toursLabel + ' · ' + money(toursTotal) + '\n\n' + '📍 PRESUPUESTO OPERATIVO EN DESTINO\n' + '🚕 Transporte local (' + transportLabel + '): ' + money(localPerDay) + '/día · ' + money(localTotal) + ' total\n' + '🍽️ Gastronomía (' + foodLabel + '): ' + money(foodPerDay) + '/día · ' + money(foodTotal) + ' total\n\n' + '💳 TOTAL GENERAL ESTIMADO: ' + money(totalGeneral);
    /* El itinerario que se manda por WhatsApp lleva el link del grupo, cuando ya
       existe. Es el mismo texto que ve la persona, asi que la otra recibe el
       viaje entero y el lugar donde repartirse, en un solo mensaje y sin que
       haya que mandarle dos cosas separadas. */
    var grupoTexto = enlaceGrupo()
      ? '\n\n\U0001F465 Para repartirse el total: ' + enlaceGrupo()
      : '';
    /* El link del grupo va al final del itinerario, que es el mismo texto que se
       manda por WhatsApp. Quedo definido despues de summaryText por que
       summaryText es una sola expresion larga: agregar el link al final, en una
       sentencia aparte, es mas barato de leer y de corregir que partir esa
       cadena en tres. */
    summaryText += grupoTexto;
    var flightBookUrl = flightWhatsappUrl(detailState, flightSummary, flightTotal);
    var busSel = busMode ? busElegido(detailState.meta) : null;
    var busTitle = busSel ? 'Bus · ' + esc(busSel.empresa) + (busSel.clase ? ' ' + esc(busSel.clase) : '') : 'Bus · tarifa estimada';
    var busLines = busSel
      ? '<p class="voucher-item__ruta">' + esc(busSel.ruta.origen) + ' &harr; ' + esc(busSel.ruta.destino) + '</p><p class="voucher-item__horarios">Sale ' + esc(busSel.ruta.salida) + ' · llega ' + esc(busSel.ruta.llegada) + ' · ' + esc(busSel.ruta.dias) + '</p>'
      : '<p class="voucher-item__detail">Ida y vuelta en bus semicama / cama.</p>' + (busServiceOptions(detailState.meta).length ? '<p class="voucher-item__aviso">Elegí un servicio en la sección de llegada para ver horarios.</p>' : '');
    // toursWhatsappUrl() ya no se usa acá y queda sin referencias: el "Reservar"
    // de tours abre el checkout, y checkoutWhatsappUrl() arma un mensaje que
    // incluye las actividades junto con lo demas. Se deja la funcion definida
    // hasta que se decida si se borra.
    // El alojamiento no tenía acción propia en la versión anterior, solo el
    // precio de referencia. Con la fila en una línea, el enlace de
    // disponibilidad entra en el mismo lugar que el de los otros rubros.
    var hotelBookUrl = detailState.selectedHotel === false ? null : bookingUrl(detailState.meta, { hotel: selectedHotelName });
    /* Un tramo del vuelo es una línea: acá no hacen falta el nombre completo del
       aeropuerto ni la aerolínea repetida, que ya están en el título de la fila. */
    function legLine(label, origin, destination, departureText, arrivalText, flightNumber) {
      return '<p class="voucher-item__line"><span class="voucher-item__tag">' + esc(label) + '</span>' + esc(airportCode(origin)) + ' ' + esc(departureText) + ' &rarr; ' + esc(airportCode(destination)) + ' ' + esc(arrivalText) + (flightNumber ? ' · ' + esc(flightNumber) : '') + '</p>';
    }
    // formatFlightDateTime() escribe "16 dic. 2026, 06:15 a. m.", que está hecho
    // para una tarjeta ancha. En una fila eso son tres líneas por tramo, así que
    // acá sale día-mes y hora; si el vuelo no trae la fecha cruda se usa el
    // texto largo como estaba.
    function flightTime(value, fallback) {
      var date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return fallback || '';
      return date.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' }).replace(/\./g, '') + ' ' + date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    // Los tramos crudos salen de la misma oferta que ya usa
    // getSelectedFlightSummary(); solo se leen para el formato corto.
    var selectedOffer = getSelectedFlightOffer();
    var outLeg = (selectedOffer && (selectedOffer.outbound || (Array.isArray(selectedOffer.slices) && selectedOffer.slices[0]))) || selectedOffer || {};
    var inLeg = (selectedOffer && (selectedOffer.inbound || (Array.isArray(selectedOffer.slices) && selectedOffer.slices[1]))) || null;
    // El ícono sale de los mismos CATEGORY_ICONS y del mismo color de categoría
    // que usa el panel "Mi Viaje" y el desglose, para que el mismo rubro se vea
    // igual en los tres lugares.
    function itemRow(category, title, detailMarkup, amount, ctaMarkup) {
      /* Cuando el rubro esta reservado la fila cambia de forma, no solo de
         texto: la pastilla de estado entra arriba de la bajada, en el lugar
         del aviso de "sin seleccionar", que ya no aplica, y el boton de
         reservar se va. En su lugar quedan el monto —que es el dato fijo, el
         que ya se pago o se debe— y un "Detalle" secundario. El monto nunca
         desaparece: es lo que la persona necesita para controlar. */
      var reservado = estadoReserva(category);
      var canal = canalDe(category);
      var cuerpo = detailMarkup
        /* El canal va siempre, reservado o no, y en el mismo lugar para los
           cuatro rubros. Es la bajada que da confianza: si el estado no dice
           de quien es el precio, el precio es un numero sin dueno. */
        + (canal.canal ? '<p class="voucher-item__canal">' + esc(category === 'alojamiento' ? 'Reservado a través de ' + canal.canal : canal.canal) + '</p>' : '');
      var lado = controlReserva(category)
        + (reservado ? '' : (ctaMarkup || ''));
      /* El color es del proveedor, no del rubro: con la paleta de rubros casi
         todas las filas salian del mismo azul. Va por parametro porque el
         style del span lo perdia contra el del svg. Ver categoryIcon(). */
      return '<li class="voucher-item' + (reservado ? ' is-reservado' : '') + '" data-rubro="' + esc(category) + '"><span class="voucher-item__icon">' + categoryIcon(category, colorProveedor(category)) + '</span>' +
        '<div class="voucher-item__body"><p class="voucher-item__title">' + title
          /* La pastilla va en la linea del titulo, no en una propia. Antes ocupaba
             una linea entera y la fila reservada daba 83px contra los 58 de las
             demas, cuando el pedido era de una linea o dos con bajada. */
          + (reservado ? '<span class="voucher-item__estado">' + chipReserva(category) + '</span>' : '')
          + '</p>' + cuerpo + '</div>' +
        '<div class="voucher-item__side"><b class="voucher-item__amount' + (amount ? '' : ' is-zero') + '">' + money(amount) + '</b>' + lado + '</div></li>';
    }

    // "Reservar" es un enlace cuando hay una URL y un botón apagado cuando no la
    // hay: que falte el vuelo o los tours se ve en el resumen, igual que se ve
    // en la lista de la página.
    /* El control de la agencia para poner y sacar el "Reservado" a mano.
       Solo se pinta si esAgencia(): para el resto es un string vacío, y el
       "Reservado" que ve el cliente es un <span> sin acción, no un botón. No
       alcanza con esconderlo acá —la base también lo rechaza— pero si se
       dejara el botón visible el cliente tocaría algo que no hace nada, que es
       peor que no mostrarlo.

       Va arriba del CTA y no al lado del monto para no ensuciar la columna de
       cifras, que es la que se lee de un vistazo. */
    function controlReserva(categoria) {
      if (!soyAgencia) return '';
      var reservado = reservasDe(categoria);
      return '<button type="button" class="voucher-marca' + (reservado ? ' is-on' : '') + '" data-marca-reserva="' + esc(categoria) + '" title="' +
        esc(reservado ? 'Sacar la marca de reservado' : 'Marcar como reservado: la reserva ya está confirmada') + '">' +
        '<span aria-hidden="true">' + (reservado ? '✓' : '+') + '</span>' +
        (reservado ? 'Reservado' : 'Marcar reservado') + '</button>';
    }
    /* Cuando el rubro ya está reservado, el enlace no se pinta: el link ya se
       usó y dejarlo vivo invitaba a volver a abrir Booking. Sale el estado.

       Para la agencia es un botón, que además sirve para deshacer. Para el
       cliente es un <span>: el "Reservado" es un dato, no algo que pueda tocar,
       y si fuera un botón el cliente vería algo pulsable que al tocar no le
       pasa nada. El title aclara que en vuelo y hotel quiere decir "hay una
       reserva en curso", porque el link no avisa si la compra terminó. */
    function reservadoCta(categoria, aviso) {
      if (estadoReserva(categoria) === 'Solicitado' && !soyAgencia) aviso = 'Tu solicitud está en proceso: la confirmamos con el operador.';
      var clase = estadoReserva(categoria) === 'Solicitado' ? ' is-solicitado' : '';
      var texto = '<span class="voucher-item__cta is-reserved' + clase + '" title="' + esc(aviso) + '">' + esc(reservadoLabel(categoria)) + '</span>';
      if (!soyAgencia) return texto;
      return '<button type="button" class="voucher-item__cta is-reserved' + clase + '" data-deshacer-reserva="' + esc(categoria) + '" title="' + esc(aviso) + '">' + esc(reservadoLabel(categoria)) + '</button>';
    }
    function reservadoLabel(categoria) {
      return estadoReserva(categoria) || 'Reservado';
    }
    /* El link de vuelta. Lo unico que hace es POSICIONAR: cuando la persona
       vuelve de Booking o de la aerolinea, el cotizador la trae a la fila que
       estaba configurando y le saca el parametro de la barra.

       Deliberadamente NO lleva ningun estado adentro. Un "?status=success" en
       la URL lo puede escribir cualquiera, y convertia "Reservado" en una
       declaracion del visitante: el mensaje al asesor decia "ya reserve vuelo y
       hotel" sobre reservas que no existian, y el CTA de reservar desaparecia
       como si estuviera pagado.

       Este parametro no mueve ningun estado, asi que un valor inventado no
       produce nada: la fila se resalta, se limpia la URL y el estado sigue
       siendo el de antes. La verdad la sigue poniendo la agencia. */
    /* Al volver de afuera: senalar la fila y limpiar la barra.
     *
     * La validacion del "vuelta" es contra el id del viaje que ya esta en esta
     * pagina, no contra nada externo. Si no coincide --o el viaje no existe-- se
     * ignora el parametro y se limpia igual: es mas honesto dejar la pantalla como
     * estaba que fingir que volvio de un lado que no corresponde. */
    function honrarLinkDeVuelta(modal) {
      if (!modal || !window.location.search) return;
      var params = new URLSearchParams(window.location.search);
      if (!params.has('vuelta') || !params.has('rubro')) return;
      var volver = params.get('vuelta');
      var rubro = params.get('rubro');
      var viaje = viajeReservaId();
      // Se limpia SIEMPRE, haya coincidido o no: dejar "?vuelta=..." en la barra
      // Invita a la gente a inventar parametros despues.
      var limpio = new URLSearchParams(window.location.search);
      limpio.delete('vuelta'); limpio.delete('rubro');
      var qs = limpio.toString();
      try {
        history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
      } catch (e) { /* sin history: se deja la barra como estaba */ }
      if (!viaje || volver !== viaje) return;
      if (['pasajes', 'alojamiento', 'traslados', 'tours'].indexOf(rubro) < 0) return;
      var fila = modal.querySelector('.voucher-item[data-rubro="' + rubro + '"]');
      if (!fila) return;
      fila.classList.add('is-tras-vuelta');
      try { fila.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { fila.scrollIntoView(); }
      window.setTimeout(function () { fila.classList.remove('is-tras-vuelta'); }, 2600);
    }

    function conLinkDeVuelta(url, categoria) {
      if (!url) return url;
      var id = viajeReservaId();
      if (!id) return url;
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      return url + sep + 'vuelta=' + encodeURIComponent(id) + '&rubro=' + encodeURIComponent(categoria);
    }
    function bookCta(url, label, labelFor, categoria) {
      if (estadoReserva(categoria)) return reservadoCta(categoria, 'Quitar la marca de reservado y volver a ' + label.toLowerCase() + '.');
      return url
        ? '<a class="voucher-item__cta" data-reservar-rubro="' + esc(categoria) + '" href="' + esc(conLinkDeVuelta(url, categoria)) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(labelFor) + '">' + esc(label) + '</a>'
        : '<button type="button" class="voucher-item__cta is-off" disabled>' + esc(label) + '</button>';
    }
    /* Las dos filas que reserva la app —tours y traslados— abren el checkout en
       su propia tarjeta, no un link afuera. El voucher lo abre "Ver mi
       presupuesto" y su trabajo es mostrar el total; reservar es otra accion y
       necesita los datos del viajero y el medio de pago.

       Cuando la fila no tiene nada elegido no sale un boton que no abre nada:
       sale el aviso, con el mismo tono que las otras filas sin elegir. */
    /* La columna de la derecha es la cifra y, cuando corresponde, un "Reservar"
       de dos palabras. Nada mas.

       Antes, cuando el rubro no tenia nada elegido, esta funcion devolvia un
       <p> con el aviso entero y el itemRow lo ponia DEBAJO del monto, en la misma
       columna. Ese texto largo se comia el ancho de la fila y el precio dejaba
       de estar contra el margen derecho. En el vuelo era peor: la misma frase
       aparecia dos veces en la misma fila, una en el cuerpo y otra al lado del
       monto.

       El aviso va ahora al cuerpo, con el resto de la bajada, y la derecha queda
       para el numero. */
    function reservarCta(activo, etiqueta, categoria) {
      if (estadoReserva(categoria)) return reservadoCta(categoria, 'Quitar la marca de reservado y volver a reservar.');
      if (!activo) return '';
      return '<button type="button" class="voucher-item__cta" data-reservar-pedido aria-label="' + esc(etiqueta) + '">Reservar</button>';
    }
    /* "Falta elegir" al cuerpo, con su propio tono: es una instruccion, no un
       dato del rubro, y por eso no comparte la tipografia de la bajada. */
    function avisoVoucher(texto) {
      return texto ? '<p class="voucher-item__aviso">' + esc(texto) + '</p>' : '';
    }
    /* Los tramos solo existen si hay vuelo. Sin oferta, legLine() imprimia el
       codigo de aeropuerto de undefined —que es "—"— con un "sin fecha" al lado:
       "IDA — sin fecha → — sin fecha". Un tramo sin origen, sin destino y sin
       hora no informa nada, y la fila queda mejor diciendo que falta elegir. */
    /* La ruta, y los horarios aparte.

       Antes era una linea por tramo con su flecha y su etiqueta "Ida" /
       "Vuelta", asi que en ida y vuelta salian dos flechas, dos etiquetas y
       los mismos dos airports repetidos, para decir la misma ruta dos veces.

       Ahora una sola linea con la ruta --con flecha doble cuando hay vuelta--
       y los horarios en una linea apagada debajo. El numero de vuelo se cae:
       es el dato que menos se lee de un voucher y el que mas ruido hace en
       una fila de este ancho. */
    var flightLines = '';
    if (flightSummary.selected) {
      var ruta = esc(airportCode(flightSummary.origin)) + (flightSummary.isRoundTrip ? ' &#8596; ' : ' &rarr; ') + esc(airportCode(flightSummary.destination));
      var horarios = 'Sale ' + esc(flightTime(outLeg.departure, flightSummary.departureText))
        + (flightSummary.isRoundTrip ? ' \u00b7 vuelve ' + esc(flightTime(inLeg && inLeg.departure, flightSummary.returnDepartureText)) : '');
      flightLines = '<p class="voucher-item__ruta">' + ruta + '</p><p class="voucher-item__horarios">' + horarios + '</p>';
    } else {
      flightLines = avisoVoucher('Elegí un vuelo en la sección de vuelos para ver sus horarios.');
    }
    var flightTitle = flightSummary.selected && flightSummary.airline
      ? 'Vuelo · ' + esc(flightSummary.airline)
      : 'Vuelo · sin seleccionar';
    // El voucher se lleva la persona al hotel, asi que el titulo tiene que
    // distinguir los dos tramos: con llegada y vuelta en modalidades distintas,
    // un "Traslado compartido" a secas no dice cuál de los dos es.
    var tl2 = transferTypeDe(detailState, 'llegada');
    var tv2 = transferTypeDe(detailState, 'vuelta');
    var transferTitle = !tl2 && !tv2 ? 'Traslado'
      : tl2 && tv2 && tl2 !== tv2
        ? 'Traslados · ida ' + (tl2 === 'private' ? 'privada' : 'compartida') + ', vuelta ' + (tv2 === 'private' ? 'privada' : 'compartida')
        : (tl2 === 'private' ? 'Traslado privado' : 'Traslado compartido');
    var notaVuelta = tv2 && tl2 && tv2 !== tl2 ? ' · incluye la vuelta' : '';
    var transferWhere = transferState.hotelName || hotelParaElTransfer();
    // "Recogida a coordinar" en vez de una hora derivada del vuelo. El voucher es
    // el documento que se lleva la persona al hotel y el que manda el operador:
    // ninguno de los dos puede dar por hecho una hora que todavia no existe.
    var transferNote = 'Recogida a coordinar' + (transferWhere && transferWhere !== 'Sin alojamiento' ? ' · hacia ' + esc(transferWhere) : '') + notaVuelta;
    var toursTitle = 'Tours y actividades' + (selectedTours.length ? ' · ' + selectedTours.length + (selectedTours.length === 1 ? ' elegida' : ' elegidas') : '');
    /* El CTA del traslado va al MISMO checkout que el de actividades. Sin
       modalidad elegida no hay nada que reservar, asi que en vez de un boton que
       no abre nada dice que falta elegirlo y lo dice con el mismo tono que las
       otras filas sin elegir ("Sin actividades seleccionadas"). */
    /* Sin modalidad no hay nada que reservar. El aviso va al cuerpo de la fila
       (antes iba debajo del monto, en la columna de la cifra) y el CTA de la
       derecha desaparece en vez de quedar como un boton que no abre nada. */
    var transferCta = !(tl2 || tv2) && detailState.transportMode !== 'bus' && detailState.transportMode !== 'auto'
      ? '<button type="button" class="voucher-item__cta is-elegir" data-detalle-rubro="traslados">Elegir traslado</button>'
      : reservarCta(tl2 || tv2, 'Reservar el traslado desde el aeropuerto', 'traslados');
    var transferNoteHtml = (tl2 || tv2 ? '' : avisoVoucher('Elegí un transfer en la sección de traslados.'))
      + '<p class="voucher-item__detail">' + transferNote + '</p>';
    // findSelectedHotelDetail() devuelve un texto generico cuando no encontró la
    // card; en ese caso no hay nada que decir y la fila queda solo con el monto.
    /* En un viaje combinado la fila de alojamiento necesita UNA linea por parada.
       El detalle de la ficha ya sabe las noches de su parada, asi que se leen de
       ahi en vez de recomputarlas: el resumen no puede decir 7 noches para un
       hotel del que 3 son en la otra parada. */
    var hotelesElegidos = selectedHotelsByStop();
    var multiHotel = hotelesElegidos.length > 1;
    var reparto = stayNights();
    function detalleParada(stop) {
      if (!multiHotel) return 'Hotel';
      if (reparto) return stop === 2 ? reparto.secondName : reparto.firstName;
      return 'Parada ' + (stop || 1);
    }
    function hotelLine(h) {
      var noches = h.nights != null ? h.nights : nights;
      return '<p class="voucher-item__line"><span class="voucher-item__tag">' + esc(detalleParada(h.stop)) + '</span>'
        + esc(h.name) + ' · ' + noches + (noches === 1 ? ' noche' : ' noches') + '</p>';
    }
    var hotelNote = multiHotel
      ? hotelesElegidos.map(hotelLine).join('')
      : '';  // "Precio consultado para N noches y N viajeros" ya esta en la cabecera del resumen
    // El titulo lleva el hotel cuando hay uno solo. Con dos ya no alcanza: el
    // nombre de arriba seria el de la ultima parada procesada y la lista de
    // abajo los dos, y se leeria como que el titulo ese de todo el viaje.
    var hotelTitle = multiHotel ? 'Alojamiento - ' + hotelesElegidos.length + ' hoteles' : (hotelElegido() ? 'Alojamiento - ' + esc(selectedHotelName) : 'Alojamiento - sin seleccionar');
    var destinoTotal = localTotal + foodTotal;
    /* El boton de reservar SOLO va aca, no en la card "Mi Viaje".
       Aca esta el pedido completo —el total, que rubros hay y cuales no—, y el
       boton muestra el total de lo que se reserva, que no es el total del viaje.
       En la card ese numero no aparecia en ningun lado: la accion decia
       "Reservar actividades y transfer" sin que se supiera por cuanto, al lado
       de "Ver mi presupuesto", que abre este mismo modal. Dos caminos para el
       mismo checkout, uno pegado al otro, y el que no decia el precio.

       data-reservar-pedido es el mismo atributo que usan los "Reservar" de las
       filas de traslado y actividades, con el mismo handler: los tres abren el
       checkout con el mismo pedido, asi que el voucher no necesita un camino
       nuevo ni un listener nuevo. */
    var pedido = checkoutPedido();
    var pedidoTotal = pedido.count ? money(checkoutTotals().total) : '';
    /* La herramienta grupal, como bloque propio y antes del pie.

       Abre la misma accion que el enlace chico del encabezado --data-split-trip
       en los dos casos--: son dos entradas, no dos acciones. El bloque se
       queda con la version larga, que es la que explica que hace, y el enlace
       del encabezado con la corta, que es la que alcanza cuando ya elegiste
       viajar acompañado.

       Un <button> y no un <a>: no lleva a otra pagina, abre el reparto del
       grupo. Un <a> sin href no es tabulable. */
    /* El asistente, en tres pasos y en el orden en que hay que hacerlos.

       El estado de cada paso sale de la misma marca de reserva que ya
       usaba el resto del modal, para que no haya dos verdades: paso
       seleccionado, paso pendiente. Lo unico nuevo es el boton de confirmar,
       que hace falta en los dos externos y no en el tercero.

       El paso externo lleva dos cosas: el link para abrir y el toque de
       confirmacion. Se explica en el texto de la nota mas abajo, porque
       Y no es un parche: es el unico momento en que el dato es cierto. La
       nota de canales de mas abajo lo explica en una frase. */
    function pasoExternoHecho(categoria) { return reservasDe(categoria); }
    function pasosMarkup() {
      var extVuelo = busMode ? true : pasoExternoHecho('pasajes');
      var extHotel = pasoExternoHecho('alojamiento');
      var terrChequeado = Boolean(pedido.count);
      var paso = function (n, titulo, bajada, hecho, actual, accion) {
        return '<li class="voucher-step' + (hecho ? ' is-done' : '') + (actual ? ' is-now' : '') + '">'
          + '<span class="voucher-step__n" aria-hidden="true">' + (hecho ? '&#10003;' : n) + '</span>'
          + '<div class="voucher-step__text"><b>' + esc(titulo) + '</b><span>' + bajada + '</span></div>'
          + (hecho ? '' : accion) + '</li>';
      };
      /* El botón de confirmar es de la agencia, no del cliente.

         Antes se pintaba para cualquiera y la RPC que lo atiende --
         reservas_marcar_manual -- arranca con "if (!await esAgencia()) return",
         así que un cliente lo veía, lo apretaba y no pasaba nada. Sin error, sin
         aviso: el control se apagaba en silencio. Eso es peor que no tenerlo,
         porque promete una confirmación y se la traga.

         Para el cliente queda un texto que además explica de dónde sale la marca
         en vez de dejarlo adivinar. Lo que marca la reserva sigue siendo el
         link externo que abre la persona y la confirmación que hace la agencia. */
      var confirma = function (cat, que) {
        if (!soyAgencia) return '<span class="voucher-step__hint">La marca la pone la agencia</span>';
        return '<button type="button" class="voucher-step__btn" data-confirmar-reserva="' + esc(cat) + '"'
          + ' title="Confirm&aacute; que ya lo reservaste en ' + esc(que) + '">Ya lo reserv&eacute;</button>';
      };
      var markup = '<section class="voucher-steps"><h3 class="voucher-steps__title">Para completar tu viaje</h3><ol>';

      // Paso 1: el vuelo.
      var vBajada = flightSummary.selected
        ? esc(flightSummary.airline || '') + ' &middot; ' + money(flightTotal)
        : 'Todav&iacute;a no elegiste vuelo';
      var vAccion = '';
      if (flightSummary.selected && flightBookUrl) {
        vAccion = '<a class="voucher-step__btn is-link" href="' + esc(flightBookUrl) + '" target="_blank" rel="noopener noreferrer" data-reservar-rubro="pasajes">Ver en Google Flights</a>';
      } else if (flightSummary.selected) {
        vAccion = confirma('pasajes', 'laerol&iacute;nea');
      } else {
        vAccion = '<span class="voucher-step__hint">Elegilo en la secci&oacute;n de vuelos</span>';
      }
      if (busMode) markup += paso(1, 'Bus', esc(busSel ? busResumenCorto(detailState.meta) : 'Tarifa estimada') + ' &middot; ' + money(busTotal), false, false, '<span class="voucher-step__hint">Compralo con la empresa</span>');
      else markup += paso(1, 'Vuelo', vBajada, extVuelo, !extVuelo, vAccion);

      // Paso 2: el alojamiento.
      var hBajada = hotelBookUrl
        ? esc(selectedHotelName) + ' &middot; ' + money(hotelTotal)
        : 'Eleg&iacute; tu hotel';
      var hAccion = '';
      if (hotelBookUrl) {
        hAccion = '<a class="voucher-step__btn is-link" href="' + esc(hotelBookUrl) + '" target="_blank" rel="noopener noreferrer" data-reservar-rubro="alojamiento">Ver en Booking</a>';
      } else {
        hAccion = confirma('alojamiento', 'Booking');
      }
      markup += paso(2, 'Alojamiento', hBajada, extHotel, !extVuelo && !extHotel, hAccion);

      // Paso 3: el terrestrial, que es el unico que lleva la app.
      var tAccion = terrChequeado
        ? ''
        : '<button type="button" class="voucher-step__btn" data-reservar-pedido>Coordinar</button>';
      markup += paso(3, 'Traslados y actividades',
        terrChequeado ? 'Coordinados con la agencia' : 'Los coordinamos nosotros',
        terrChequeado, extVuelo && extHotel && !terrChequeado, tAccion);

      markup += '</ol></section>';
      return markup;
    }

    /* Quien cobra cada rubro, segun el transporte elegido: con vuelo los pasajes
       se pagan directo con la aerolinea; con bus, con la empresa de bus (y no hay
       traslado de aeropuerto). El nombre sale de la eleccion cuando existe. */
    var canalesNombre = busMode
      ? (busSel ? '<b>' + esc(busSel.empresa) + '</b>' : 'la empresa de bus')
      : (flightSummary.selected && flightSummary.airline ? 'la aerol\u00ednea <b>' + esc(flightSummary.airline) + '</b>' : 'la aerol\u00ednea');
    var canalesTexto = '<p class="voucher-canales">El alojamiento se paga en <b>Booking</b>, los pasajes directo con ' + canalesNombre
      + ', y ' + (busMode ? 'las actividades' : 'los traslados y actividades') + ' con nosotros.</p>';
    /* El grupo va arriba, pegado al total: es lo que se hace apenas se ve el
       numero. Con grupo creado el bloque es el link para invitar (copiar,
       WhatsApp, abrir la cuenta); sin grupo, un solo boton que lo crea con este
       presupuesto ya cargado como gastos iniciales (ver grupoPresetDatos). */
    var linkGrupo = enlaceGrupo();
    var dividirBloque = '<aside class="voucher-split' + (linkGrupo ? ' is-activo' : '') + '">'
      + '<div class="voucher-split__head">' + brandIcon('dividir')
      + '<div class="voucher-split__text">'
      + '<h3>' + (linkGrupo ? 'Invitá a tus amigos al grupo' : '¿Viajás en grupo?') + '</h3>'
      + '<p>' + (linkGrupo
        ? 'Compartí este link: cada uno se suma con su nombre y carga lo que pagó. El presupuesto ya está como gastos iniciales.'
        : 'Creá la cuenta del grupo con este presupuesto ya cargado y llevá la cuenta de quién pagó cada cosa.') + '</p>'
      + '</div></div>'
      + (linkGrupo
        ? '<input class="voucher-split__link" type="text" readonly value="' + esc(linkGrupo) + '" aria-label="Link del grupo" onfocus="this.select()">'
          + '<div class="voucher-split__actions">'
          + '<button type="button" class="voucher-split__btn is-main" data-grupo-copiar="' + esc(linkGrupo) + '">Copiar link</button>'
          + '<a class="voucher-split__btn" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent('Sumate a la cuenta del viaje a ' + detailState.meta.dest.name + ': ' + linkGrupo) + '">WhatsApp</a>'
          + '<a class="voucher-split__btn" href="' + esc(linkGrupo) + '">Ver la cuenta</a></div>'
        : '<div class="voucher-split__actions">'
          + '<button type="button" class="voucher-split__btn is-main" data-grupo-crear>Crear cuenta e invitar amigos</button>'
          + '<button type="button" class="voucher-split__btn" data-split-trip>Ver cómo dividir</button></div>')
      + '</aside>';

    // Sin nada que reservar no se dibuja el boton apagado ni su nota: era ruido.
    var reservarTodo = !pedido.count ? '' : '<div class="voucher-reserve">'
      + '<button type="button" class="voucher-reserve__btn"' + (pedido.count ? ' data-reservar-pedido' : ' disabled') + '><span>'
      + (pedido.count ? 'Reservar ' + (pedido.tours.length && pedido.hasTransfer ? 'actividades y transfer' : pedido.hasTransfer ? 'transfer' : pedido.tours.length + (pedido.tours.length === 1 ? ' actividad' : ' actividades')) : 'Elegí algo para reservar')
      + '</span>' + (pedidoTotal ? '<em>' + pedidoTotal + '</em>' : '') + '</button>'
      + (pedido.count ? '' : '<p class="voucher-reserve__nota">Elegí un transfer o una actividad para poder reservar.</p>')
      + '</div>';
    var dividirEnlace = '<span class="voucher-hero__pp"><span>' + money(Math.round(totalGeneral / pax)) + ' por persona</span>'
      + '<button type="button" class="voucher-hero__split" data-split-trip>Ver cómo dividir este monto</button></span>';
    cerrarTodosLosModales();
    modal.innerHTML = '<div class="booking-dialog voucher-dialog" role="dialog" aria-modal="true" aria-labelledby="itinerary-summary-title"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button>' +
      '<header class="voucher-head"><span class="voucher-kicker">Resumen del presupuesto</span><h2 id="itinerary-summary-title">Tu viaje a ' + esc(detailState.meta.dest.name) + '</h2><p>' + esc(storyDateRange(detailState.meta)) + ' · ' + nights + (nights === 1 ? ' noche' : ' noches') + ' · ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + '</p></header>' +
      '<div class="voucher-hero"><div class="voucher-hero__row"><div class="voucher-hero__figure"><span>Total estimado</span><strong>' + money(totalGeneral) + '</strong></div>' + dividirEnlace + '</div><p>' + (autoMode ? 'Auto, alojamiento, actividades y lo que vas a gastar cada día en destino.' : busMode ? 'Bus, alojamiento, actividades y lo que vas a gastar cada día en destino.' : 'Vuelo, alojamiento, traslado, actividades y lo que vas a gastar cada día en destino.') + '</p></div>' +      /* Los diferenciales van pegados al precio y antes del listado: es la
         pregunta que uno se hace justo despues de ver el total. */
      dividirBloque +
      ventajasMarkup +

      '<ul class="voucher-list">' +
      (autoMode ? itemRow('auto', 'Auto propio', '<p class="voucher-item__detail">' + esc(roadtripMeta()) + '</p><p class="voucher-item__detail">Combustible y peajes</p>', autoTotal, '') : busMode ? itemRow('bus', busTitle, busLines, busTotal, '') : itemRow('pasajes', flightTitle, flightLines, flightTotal, flightSummary.selected ? bookCta(flightBookUrl, 'Reservar vuelo', 'Reservar el vuelo en ' + flightSummary.airline, 'pasajes') : '<button type="button" class="voucher-item__cta is-elegir" data-detalle-rubro="pasajes">Elegir vuelos</button>')) +
      itemRow('alojamiento', hotelTitle, hotelNote, hotelTotal, !hotelElegido() ? '<button type="button" class="voucher-item__cta is-elegir" data-detalle-rubro="alojamiento">Elegir hotel</button>' : hotelBookUrl ? bookCta(hotelBookUrl, 'Reservar hotel', 'Ver disponibilidad de ' + selectedHotelName, 'alojamiento') : '') +
      (busMode || autoMode ? '' : itemRow('traslados', transferTitle, transferNoteHtml, transferTotal, transferCta)) +
      itemRow('tours', toursTitle, selectedTours.length ? '<p class="voucher-item__detail">' + esc(toursDetail) + '</p>' : avisoVoucher(toursDetail), toursTotal, reservarCta(selectedTours.length, 'Reservar las actividades', 'tours')) +
      '</ul>' +
      /* "Gastos en destino" era una caja con fondo y radio dentro del modal, que
         ya es una caja: caja dentro de caja, y el unico bloque del modal con
         bordes propios. Ahora son las MISMAS filas del resto, separadas por una
         linea y con un encabezado chico. El modal ya dice donde empieza cada
         zona con un separador; no hace falta una segunda caja adentro. */
      '<section class="voucher-destino"><h3 class="voucher-destino__title">Gastos en destino<span>Por día y total del viaje</span></h3>'
      + '<ul class="voucher-destino__list">'
      + '<li><span class="voucher-destino__name">Transporte local <em>' + transportLabel + '</em></span><span class="voucher-destino__dia">' + money(localPerDay) + '/día</span><b class="voucher-destino__monto">' + money(localTotal) + '</b></li>'
      + '<li><span class="voucher-destino__name">Gastronomía <em>' + foodLabel + '</em></span><span class="voucher-destino__dia">' + money(foodPerDay) + '/día</span><b class="voucher-destino__monto">' + money(foodTotal) + '</b></li>'
      + '</ul>'
      + '<p class="voucher-destino__total"><span>Total en destino</span><b>' + money(destinoTotal) + '</b></p></section>' +
      /* La nota de canales, y es la que da la tranquilidad que se busca.

       La idea de fondo --todo junto y alguien que lo coordine-- se dice
       entera. Lo que no se hace es sostenerla con un proveedor que no existe:
       no hay integracion con Duffel, ni ruta, ni clave, ni webhook, y
       .env.example dice que se eligio SerpAPI porque Duffel y Amadeus piden
       aprobacion. Decir "Respaldo Duffel" seria una promesa que el producto no
       puede cumplir.

       Y el vuelo tampoco es una gigante que te respalda: Google Flights es un
       METABUSCADOR. El precio y el link son reales, pero la compra termina en
       la aerolinea o en una agencia. Booking si es intermediario real, y ahi
       el respaldo es cierto. */
      canalesTexto +
      /* Por que el paso externo tiene un boton de confirmar y el terrestre no.

       Porque el pago del vuelo y del hotel pasa por un sitio del que la app
       no recibe ningun aviso: no hay transaccion propia ni webhook al que
       colgar el cambio. El unico dato cierto es el que declara la persona, asi
       que se lo preguntamos una vez y lo anotamos, en vez de suponerlo y
       mostrarle un "Comprado" que podria ser falso.

       El paso terrestre no necesita ese boton porque ese pago lo lleva la app:
       se marca solo al completar el checkout. */
      reservarTodo +
      /* ABAJO, UN SOLO BOTON SOLIDO.

         Habia dos botones del mismo tamano compitiendo: "Elegi algo para
         reservar" (mostaza) y "Compartir en Instagram" (52px, con degradado
         fucsia de la marca y una sombra). Dos CTAs de igual peso en el pie, y el
         de compartir encima del de comprar. El degradado, aparte, era el unico
         color ajeno de toda la app en modo oscuro.

         Ahora: el CTA de reserva arriba, solo, y las tres acciones de utilidad
         en una barra de la misma altura, mismo borde fino y misma tinta. El
         menu "Compartir" junta WhatsApp, la tarjeta de Instagram y copiar el
         texto, que antes eran tres botones y uno de ellos gigante. */
      '<div class="voucher-actions">' +
      /* Tres utilidades, misma caja. WhatsApp sale de la barra y se queda
         adentro del menu: antes estaba en los dos lados, con el mismo icono
         y el mismo texto, a 300px de distancia. En la barra queda por ser el
         atajo de un toque, que es como se usa compartir un itinerario. */
      '<div class="voucher-share"><button type="button" class="voucher-chip" data-share-menu aria-expanded="false" aria-controls="voucher-share-menu">' + brandIcon('compartir') + '<span class="voucher-btn__label">Compartir</span><svg class="voucher-share__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
      '<div class="voucher-share__menu" id="voucher-share-menu" hidden>' +
      '<button type="button" data-share-whatsapp>' + brandIcon('whatsapp') + '<span>Enviar por WhatsApp</span></button>' +
      '<button type="button" data-share-story>' + brandIcon('instagram') + '<span class="voucher-btn__label">Tarjeta para Instagram</span></button>' +
      '<button type="button" data-copy-summary>' + brandIcon('copiar') + '<span class="voucher-btn__label">Copiar el texto del viaje</span></button>' +
      '</div></div>' +
      '<button type="button" class="voucher-chip voucher-chip--main' + (pedido.count ? ' is-secondary' : '') + '" data-coordinar-asesor title="Abrir WhatsApp con el resumen y lo que falta coordinar">' + brandIcon('whatsapp') + '<span class="voucher-btn__label">Coordinar con asesor</span></button>' +
      '<button type="button" class="voucher-chip" data-save-trip aria-label="Guardar este viaje">' + brandIcon('guardar') + '<span class="voucher-btn__label">Guardar</span></button>' +
      '</div>';
    modal.dataset.summaryText = summaryText;
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    if (_dlgPrev && (_scrollDlg || _scrollModal)) {
      var _dlgNuevo = modal.querySelector('.booking-dialog');
      if (_dlgNuevo) _dlgNuevo.scrollTop = _scrollDlg;
      modal.scrollTop = _scrollModal;
    }
    honrarLinkDeVuelta(modal);
    /* Se pide la lista de reservados al abrir, no antes: es una lectura de
       red y el voucher se abre desde un botón, así que pedirla con la
       propuesta le sobra un round-trip a cada cambio de hotel o de fecha que
       nadie está mirando. Si la respuesta llega con el voucher ya abierto,
       cargarReservasViaje() lo repinta solo. */
    if (!_repintado) initAuth().then(function () { cargarReservasViaje(); });
    /* Lo mismo con "soy de la agencia": decide si las filas traen el control de
       marcar, así que tiene que estar resuelto antes del próximo repintado.
       controlReserva() lee la variable, no espera: el chequeo se cachea y solo
       vuelve a latir en el primer render. */
    if (!_repintado) {
      var _eraAgencia = soyAgencia;
      initAuth().then(esAgencia).then(function (agencia) { if (agencia && !_eraAgencia) pintarVoucherReservas(); });
    }
  }
  function syncDailyBudgetState() {
    if (!detailState || !detailState.meta) return;
    var nights = Math.max(1, Number(detailState.meta.nights) || 1);
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var dailyCosts = getDestinationDailyCosts(detailState.meta.dest && detailState.meta.dest.key);
    var defaults = getBudgetDefaults((detailState.meta.dest && detailState.meta.dest.key) || (detailState.meta && detailState.meta.dest && detailState.meta.dest.name) || 'brazil');
    var defaultFood = Number(detailState.parts && detailState.parts.comidas) ? (Number(detailState.parts.comidas) / Math.max(1, nights * pax)) : 0;
    var defaultLocal = Number(detailState.parts && detailState.parts.local) ? (Number(detailState.parts.local) / Math.max(1, nights * pax)) : 0;
    if (detailState.meta.hotelType === 'all-inclusive') { detailState.foodPerDay = 0; detailState.parts.comidas = 0; }
    // El modo 'none' es una deselección explícita de la persona: el estimado del
    // destino no la pisa, porque ya decidió no sumar ese rubro.
    else if ((!Number.isFinite(Number(detailState.foodPerDay)) || Number(detailState.foodPerDay) <= 0) && !detailState.foodPerDayTouched && detailState.foodBudgetMode !== 'none') detailState.foodPerDay = defaultFood || defaults.foodPerDayUsd;
    if ((!Number.isFinite(Number(detailState.localPerDay)) || Number(detailState.localPerDay) <= 0) && !detailState.localPerDayTouched && detailState.localBudgetMode !== 'none') detailState.localPerDay = defaultLocal || defaults.localPerDayUsd;
    detailState.foodPerDay = Math.max(0, Number(detailState.foodPerDay) || 0);
    detailState.localPerDay = Math.max(0, Number(detailState.localPerDay) || 0);
    detailState.parts.comidas = Math.round((detailState.foodPerDay || 0) * nights * pax);
    detailState.parts.local = Math.round((detailState.localPerDay || 0) * nights * pax);
  }
  /* ---------- pintado pesado, coalescido por frame ----------
     recalcularTotalViaje() se llama desde muchos lugares, y dos de ellos son
     listeners de 'input' sin throttle (el slider de estadía dividida y los
     campos de monto diario). Un 'input' en un range dispara a la tasa de
     refresco, así que cada gesto producia ~60 recalculos por segundo, y cada
     uno reparseaba dos innerHTML completos (el desglose y el panel "Mi Viaje")
     más un querySelectorAll sobre todo el documento.

     Los totales chicos (el número grande, las filas del desglose) se siguen
     actualizando de forma síncrona: son asignaciones de un textContent y no
     cuestan nada. Lo caro — los dos innerHTML — se agrupa: si dentro del mismo
     frame llegan 12 recálculos, se pinta una sola vez al final. */
  var heavyPaintQueued = false;
  function queueHeavyRepaint() {
    if (heavyPaintQueued) return;
    heavyPaintQueued = true;
    var done = false;
    var run = function () {
      if (done) return;
      done = true;
      heavyPaintQueued = false;
      // Si en el frame de espera se desarmó la vista de detalle (el usuario
      // volvió a las propuestas), no hay nada que pintar.
      var view = $('#vista-detalle');
      if (!detailState || (view && view.classList.contains('oculto'))) return;
      var breakdown = document.querySelector('[data-proposal-breakdown]');
      if (breakdown) breakdown.innerHTML = proposalBreakdownHead() + proposalBreakdownContent(detailState);
      renderTripSummary();
      // El panel "Mi Viaje" y el desglose se repintan en cada recálculo: es el
      // momento natural para volver a resolver qué filas pueden saltar, porque
      // las secciones destino acaban de cambiar (modo de transporte, hoteles,
      // presupuesto diario). Ahora corre una vez por frame, en vez de anidado
      // dentro de renderTripSummary(), que además lo llamaba dos veces por
      // recálculo.
      syncBudgetJumpTargets();
    };
    // rAF para no pintar fuera de ciclo, Y un setTimeout como red de seguridad.
    // rAF NO se dispara en una pestaña en segundo plano (el navegador no
    // pinta), y ese es justo el caso de esta app: la persona abre la propuesta
    // y se va a WhatsApp a comparar precios, con la pestaña detrás. Con solo
    // rAF el panel "Mi Viaje" y el desglose se quedaban sin pintar hasta que
    // volviera a la pestaña. Con cualquiera de los dos que dispare primero,
    // pasa; el flag `done` hace que el segundo sea no-op.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    window.setTimeout(run, 50);
  }
  function recalcularTotalViaje() {
    if (!detailState) return;
    syncDailyBudgetState();
    var parts = detailState.parts;
    var roadtrip = detailState.transportMode === 'auto';
    var transferCost = getSelectedTransferAmount(detailState);
    // trasladoDelViaje() reemplaza la estimacion del modelo cuando hay modalidad
    // elegida, en vez de sumarle el precio de la tabla encima. Sumar las dos era
    // el doble conteo: ver el comentario de la funcion.
    var transport = roadtrip ? detailState.auto : trasladoSumado(detailState);
    var budget = getBudgetBreakdown(detailState);
    var total = budget.total;
    var totalEl = document.querySelector('[data-detail-total]');
    if (totalEl) totalEl.textContent = money(total);
    var perPersonEl = document.querySelector('[data-detail-total-pp]');
    if (perPersonEl) perPersonEl.textContent = money(Math.round(total / Math.max(1, Number(detailState.meta.pax) || 1))) + ' por persona';
    var rows = document.querySelectorAll('[data-cost-category]');
    Array.prototype.forEach.call(rows, function (row) {
      var category = row.getAttribute('data-cost-category');
      var value = category === 'bus' ? busSumado(detailState) : category === 'pasajes' ? vueloSumado(detailState) : category === 'alojamiento' ? hotelSumado(detailState) : category === 'traslados' ? transport : category === 'auto' ? (roadtrip ? detailState.auto : 0) : category === 'local' && roadtrip ? 0 : (parts[category] || 0);
      var valueEl = row.querySelector('[data-cost-value]');
      if (valueEl) valueEl.textContent = money(Number(value) || 0);
    });
    queueHeavyRepaint();
  }
  function getSelectedFlightOffer() {
    if (!detailState) return null;
    var offers = Array.isArray(detailState.flightOffers) ? detailState.flightOffers : [];
    var selectedId = detailState.selectedFlightId || (detailState.selectedOffer && detailState.selectedOffer.id);
    if (selectedId) {
      var match = offers.find(function (offer) { return String(offer.id) === String(selectedId); });
      if (match) return match;
    }
    if (detailState.selectedOffer && detailState.selectedOffer.airline) {
      var fallback = offers.find(function (offer) { return String(offer.airline) === String(detailState.selectedOffer.airline); });
      if (fallback) return fallback;
    }
    if (detailState.selectedOffer && (detailState.selectedOffer.outbound || detailState.selectedOffer.departure)) return detailState.selectedOffer;
    return offers.length ? offers[0] : null;
  }
  function dailyBudgetControls() {
    if (!detailState || !detailState.meta) return '';
    var nights = Math.max(1, Number(detailState.meta.nights) || 1);
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var dailyCosts = getDestinationDailyCosts(detailState.meta.dest && detailState.meta.dest.key);
    var foodValue = Number(detailState.foodPerDay) || Number(detailState.parts && detailState.parts.comidas ? (detailState.parts.comidas / Math.max(1, nights * pax)) : 0) || dailyCosts.food.moderado;
    var localValue = Number(detailState.localPerDay) || Number(detailState.parts && detailState.parts.local ? (detailState.parts.local / Math.max(1, nights * pax)) : 0) || dailyCosts.transport.eco;
    var foodOptions = [
      { key: 'casual', label: 'Económico', description: 'Supermercado, panaderías y puestos.', value: dailyCosts.food.casual },
      { key: 'moderado', label: 'Medio (Recomendado)', description: 'Buffets por kilo y restaurantes.', value: dailyCosts.food.moderado },
      { key: 'gourmet', label: 'Gourmet', description: 'Restaurantes top y paradores de playa.', value: dailyCosts.food.gourmet }
    ];
    var localOptions = [
      { key: 'econ', label: 'Económico', description: 'Ómnibus y líneas urbanas', value: dailyCosts.transport.eco },
      { key: 'medio', label: 'Medio', description: 'Mixto: algo de ómnibus y algo de app', value: dailyCosts.transport.medio },
      { key: 'confort', label: 'Confort', description: 'Taxis y transporte privado por app', value: dailyCosts.transport.confort }
    ];
    function optionMarkup(options, kind) {
      var mode = kind === 'food' ? detailState.foodBudgetMode : detailState.localBudgetMode;
      // Con el modo 'none' no hay monto elegido: no se marca ninguna caja, ni
      // aunque el estimado del destino coincida con algún preset.
      var current = mode === 'none' ? 0 : (kind === 'food' ? foodValue : localValue);
      var presets = options.map(function (option) {
        /* El nivel preseleccionado sale del perfil del viaje (ver PRESET_POR_NIVEL),
           no de parecerse al monto: los escalones del transporte local se separan
           5-10 USD, menos que la tolerancia, y la marca caia en el vecino. La
           tolerancia queda solo para viajes guardados sin nivel. */
        var presetKey = kind === 'food' ? detailState.foodPresetKey : detailState.localPresetKey;
        var selected = mode === 'preset' && (presetKey ? presetKey === option.key : Math.abs(current - option.value) < 6);
        return '<button type="button" class="daily-budget__option' + (selected ? ' is-selected' : '') + '" aria-pressed="' + selected + '" data-daily-kind="' + kind + '" data-daily-key="' + option.key + '" data-daily-value="' + option.value + '"><span class="daily-budget__option-title">' + esc(option.label) + '</span><span class="daily-budget__option-copy">' + esc(option.description) + '</span><strong>' + money(option.value) + '/día</strong></button>';
      }).join('');
      var customSelected = mode === 'custom';
      var customValue = kind === 'food' ? detailState.foodCustomValue : detailState.localCustomValue;
      // El input se muestra en la moneda elegida (que es la que la persona
      // tiene en la cabeza) pero lo que se guarda es la base: customValue
      // sigue siendo USD y se convierte acá y en el handler. Asi el presupuesto
      // nunca se pisa con un número de otra moneda.
      // Ojo con el separador: el value de un <input type="number"> tiene que
      // ir con punto, porque la especifiacion descarta el valor si no es un
      // float valido. Con coma el campo se muestra vacio. El punto se ve junto
      // al símbolo, que es la convención de los campos numéricos.
      /* El monto del personalizado se escribe en la MISMA tipografia y el mismo
         tamano del precio de los presets. Antes el <input> iba en 16px dentro de
         una caja con borde, al lado de un "R$ 78,15/dia" de 24px: la tercera
         card no parecia parte de la misma fila, parecia un formulario pegado
         al lado de dos precios. La caja se saco para que se lea como un precio
         mas; sigue siendo un input, asi que el foco se muestra con un anillo
         para que se vea que se puede escribir ahi. */
      /* "Monto planeado" y no "Monto por dia": la unidad ya aparece al lado
         como "/dia", y el campo va dentro de una card que se llama
         "Personalizado", una al lado de "Economico" y "Confort", que tambien
         son montos diarios. Decirlo dos veces ("Monto por dia" y "/dia")
        repetia la misma idea y hacia que la etiqueta se leyera como el titulo
         de un sub-bloque, cuando es el nombre del campo. El aria-label sigue
         diciendo "diario" porque ahi si describe el dato, no lo rotula. */
      var input = '<label class="daily-budget__planned"><span>Monto planeado</span><div class="daily-budget__input-wrap"><span class="daily-budget__input-symbol">' + esc(monedaActiva().simbolo) + '</span><input type="number" min="0" step="1" inputmode="decimal" value="' + (customValue == null ? '' : esc(aMoneda(customValue).toFixed(decimalesDe(monedaActiva().code, aMoneda(customValue))))) + '" placeholder="Ej: 30" data-daily-' + (kind === 'food' ? 'food' : 'local') + ' aria-label="Monto diario planeado para ' + (kind === 'food' ? 'comidas' : 'transporte local') + '"><span class="daily-budget__input-unit">/día</span></div></label>';
      var custom = customSelected
        ? '<div class="daily-budget__option daily-budget__option--custom is-selected" data-daily-kind="' + kind + '-custom"><span class="daily-budget__option-title">Personalizado</span>' + input + '</div>'
        : '<button type="button" class="daily-budget__option daily-budget__option--custom" aria-pressed="false" data-daily-kind="' + kind + '-custom"><span class="daily-budget__option-title">Personalizado</span><span class="daily-budget__option-copy">Definí tu propio presupuesto</span><strong class="daily-budget__prompt"><span class="daily-budget__prompt-ico" aria-hidden="true">✎</span>Ingresar monto</strong></button>';
      return presets + custom;
    }
    // El nº de columnas sale de la cantidad de opciones. Con 3 columnas y
    // cuatro cajas (tres presets + "Personalizado") la cuarta caía sola en una
    // fila y dejaba la retícula descompensada; con 2 columnas el bloque de
    // comidas queda 2x2 y el de transporte, 3 en línea. La caja del input es
    // además más alta que las otras, así que en el CSS la fila se iguala con
    // grid-auto-rows:1fr.
    function optionsGrid(options, kind) {
      var total = options.length + 1;
      return '<div class="daily-budget__options daily-budget__options--cols-' + (total >= 4 ? 2 : total) + '">' + optionMarkup(options, kind) + '</div>';
    }
    /* La etiqueta "Valores estimados" del encabezado.

       Estos dos rubros NO son precios reales y la app lo dice en todas partes
       menos acá: `rubroEsReal()` los marca 'estimado' en el desglose del detalle
       y el modelo solo admite 'real' para 'pasajes' (ver lib/model.js). Un
       encabezado de la sección que no lo aclara deja que estas cajas se lean con
       la misma confianza que el vuelo, que sí viene consultado.

       Sale de la MISMA regla que el desglose y no de una constante escrita a
       mano: si un día estos rubros pasan a ser reales, la etiqueta se cae sola en
       vez de quedar mintiendo. */
    function etiquetaDeEstimado(cats) {
      var algunaReal = cats.some(function (c) { return rubroEsReal(null, c, detailState && detailState.meta); });
      return algunaReal ? '' : '<small>Valores estimados</small>';
    }
    /* El titulo de cada bloque va FUERA de la caja, no adentro.

       Antes cada grupo era una caja con borde que empezaba por su propio titulo
       ("Transporte local" dentro del rectangulo, igual que "Comidas"), y con dos
       grupos abajo los dos titulos quedaban encerrados y la pagina se leia como
       dos bloques mas y no como dos secciones. Ahora el h2 es hermano de la caja:
       el titulo manda y la caja es lo que se elige adentro.

       El "Valores estimados" va con el titulo y no dentro de la caja por lo
       mismo: es una aclaracion sobre la seccion, no sobre las tarjetas. */
    return '<section class="detail-section daily-budget" aria-label="Presupuesto diario configurado">' +
      '<h2>Personalizá tus costos diarios</h2>' +
      '<h3 class="daily-budget__group-title">Transporte local' + etiquetaDeEstimado(['local']) + '</h3>' +
      '<div class="daily-budget__group" data-budget-anchor="local">' +
      optionsGrid(localOptions, 'local') +
      '</div>' +
      '<h3 class="daily-budget__group-title">Comidas' + etiquetaDeEstimado(['comidas']) + '</h3>' +
      '<div class="daily-budget__group" data-budget-anchor="comidas">' +
      optionsGrid(foodOptions, 'food') +
      '</div>' +
      /* La frase "Se recalcula automaticamente para toda la duracion del viaje"
         se saco. No hacia falta decir: es lo que ya pasa, el monto se prorratea
         por las noches de cada parada, y decirlo ocupaba una linea debajo de las
         dos grillas de opciones, que es donde estaba el ojo. Si queda duda de si
         el monto es diario o total, lo dicen los "/dia" de cada tarjeta. */
      '</section>';
  }
  // --- Deselección con un segundo clic -----------------------------------------
  // En las secciones con tarjetas elegibles (presupuesto diario, alojamiento y
  // transfer), volver a hacer clic en la opción ya elegida la saca del
  // presupuesto. Deseleccionar pone el rubro en 0, no lo devuelve al estimado:
  // un clic más en la misma tarjeta lo recupera, y el estimado del destino
  // sigue disponible recargando los hoteles o el tipo de alojamiento.
  function aplicarPresupuestoDiario(kind, mode, value) {
    if (!detailState || !detailState.meta) return;
    var nights = Math.max(1, Number(detailState.meta.nights) || 1);
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var perDay = mode === 'none' ? 0 : Math.max(0, Number(value) || 0);
    detailState[kind + 'BudgetMode'] = mode;
    detailState[kind + 'PerDay'] = perDay;
    detailState[kind + 'PerDayTouched'] = true;
    detailState.parts[kind === 'food' ? 'comidas' : 'local'] = Math.round(perDay * nights * pax);
  }
  function currentDailyValue(kind) {
    if (!detailState) return 0;
    return kind === 'food' ? Number(detailState.foodPerDay) || 0 : Number(detailState.localPerDay) || 0;
  }
  function repintarPresupuestoDiario() {
    recalcularTotalViaje();
    var section = document.querySelector('.daily-budget');
    if (section) section.innerHTML = dailyBudgetControls();
  }
  /* Los importes de hotel y de traslado tambien salen de money(), asi que
     cambian con la moneda, pero vivian en secciones que nadie repintaba. Es el
     mismo bug que el de los costos diarios, dos veces mas.

     No se vuelven a pedir al servidor: los datos ya estan en detailState.meta, asi
     que se rehace el HTML con los mismos generadores. Y no se recalcula el
     presupuesto despues, porque los totales en la base no cambian al cambiar la
     moneda: saltaria el numero que la persona ya eligio. La lista de hoteles
     vuelve a marcar lo que estaba marcado (ver hotelElegidoEnEstaLista). */
  /* Que hacer cuando cambian los viajeros con una propuesta abierta.

     Los botones +/- solo cambiaban S.pax y el numero del contador, asi que
     detailState se quedaba con el numero de viajeros anterior. Las partes que
     son por persona (comidas y transporte local) seguian con el total viejo:
     con 4, 3 y 2 viajeros el total daba $209.074, $177.217 y $105.560, cuando
     de 2 a 3 deberia crecer 50% y crecia 67,9%. Los vuelos no tenian el
     problema porque se vuelven a consultar.

     Se recalcula desde el valor por persona por dia, que es el unico dato que
     no depende de cuantos van. No se tocan alojamiento ni traslados: una
     habitacion no sale mas cara por ser tres, y el traslado ya viene por
     persona desde el modelo.

     Si la persona puso "Sin sumar" en comidas o en transporte, se respeta y se
     deja en cero: recalcular un cero porque cambio el numero de viajeros seria
     desconocer su decision. */
  function alCambiarViajeros() {
    if (detailState && detailState.meta) {
      var noches = Math.max(1, Number(detailState.meta.nights) || 1);
      var pax = Math.max(1, Number(S.pax) || 1);
      detailState.meta.pax = pax;
      if (detailState.foodBudgetMode !== 'none') {
        detailState.parts.comidas = Math.round((Number(detailState.foodPerDay) || 0) * noches * pax);
      }
      if (detailState.localBudgetMode !== 'none') {
        detailState.parts.local = Math.round((Number(detailState.localPerDay) || 0) * noches * pax);
      }
      try { repintarPresupuestoDiario(); } catch (e) { console.error('No se pudo repintar al cambiar los viajeros', e); }
      // El total del transfer depende de cuantos viajan: el compartido se cobra
      // por persona. El badge de la cabecera de la seccion muestra ese total, asi
      // que sin repintarla, cambiar de 2 a 3 personas dejaba "R$ 70 total" al
      // lado de un presupuesto que ya pide R$ 105.
      var traslado = document.querySelector('[data-official-transfer]');
      if (traslado) traslado.outerHTML = transferCard(detailState.meta);
      renderTripSummary();
    }
    schedule();
  }
  function repintarPreciosEnMoneda() {
    if (!detailState || !detailState.meta) return;
    // .hotel-options es lo que devuelve el generador una vez cargaron los hoteles;
    // .hotel-options-loading es solo el placeholder y lo maneja
    // loadHotelRecommendations.
    var listaHoteles = document.querySelector('[data-hotels-block]');
    if (listaHoteles && detailState.meta.hotelsLoaded) {
      listaHoteles.outerHTML = hotelOptions(detailState.meta, detailState.hotel);
    }
    var traslado = document.querySelector('[data-official-transfer]');
    if (traslado) traslado.outerHTML = transferCard(detailState.meta);
    /* Los tours tambien tienen precios y money() los convierte, asi que sin
       esto cambiar de moneda dejaba la seccion con el simbolo viejo: el
       selector decia UYU y las cards seguian diciendo "US$ 28". Es el mismo
       motivo por el que hotel y traslado estan mas arriba: las secciones se
       redibujan con outerHTML, no se les cambia un simbolo y listo.

       El marcado se regenera, asi que los checkboxes vuelven apagados y hay que
       restaurarlos por titulo, que es la misma clave que usa la carga de un
       viaje guardado. Si no se restauraran, cambiar de moneda deseleccionaba
       las actividades que la persona habia elegido y las sacaba del total. */
    // El bloque entero (titulo + placa), no la placa: ver el comentario de
    // loadHotelRecommendations(). Con la placa sola, este repintado metia un
    // segundo "Tours y experiencias en ..." adentro de la seccion.
    var tours = document.querySelector('[data-tours-block]');
    if (tours) {
      var markupTours = localToursMarkup(detailState.meta);
      // Si el marcado nuevo viniera vacio se deja la seccion como estaba:
      // borrarla dejaria un hueco sin una sola card, que se lee como un error.
      if (markupTours) {
        var elegidos = (detailState.selectedTours || []).map(function (t) { return t.title; });
        var estabaAbierto = tours.classList.contains('local-tours--expanded');
        tours.outerHTML = markupTours;
        var toursNuevos = document.querySelector('.local-tours');
        if (toursNuevos && elegidos.length) {
          Array.prototype.slice.call(toursNuevos.querySelectorAll('[data-tour-choice]')).forEach(function (input) {
            if (elegidos.indexOf(input.getAttribute('data-tour-title')) < 0) return;
            input.checked = true;
            var card = input.closest('[data-tour-card]');
            if (card) card.classList.add('is-added');
          });
        }
        // "Ver más tours" es un estado del DOM, no del modelo: sin restaurarlo
        // la persona que habia desplegado las 11 actividades volvia a ver solo
        // las tres de siempre.
        if (toursNuevos && estabaAbierto) {
          toursNuevos.classList.add('local-tours--expanded');
          var masTours = toursNuevos.querySelector('[data-toggle-more-tours]');
          if (masTours) {
            masTours.setAttribute('aria-expanded', 'true');
            masTours.innerHTML = 'Ver menos tours <span aria-hidden="true">⌃</span>';
          }
        }
        // El panel "Mi Viaje" lleva el boton de reservar, y las elegidas que
        // cambian lo que hay que confirmar.
        renderTripSummary();
      }
    }
  }
  function deseleccionarHotel(stop) {
    if (!detailState) return;
    // En un viaje combinado la deseleccion es por parada: tocar dos veces la
    // misma card saca el hotel de ESA parada y deja el de la otra, que es lo que
    // uno espera. Sin el parametro se caian los dos y el presupuesto bajaba a
    // cero sin que se hubiera tocado nada.
    if (detailState.multiStay && stop) {
      var habia = staySelectedTotal(stop);
      setStaySelectedTotal(stop, null);
      if (habia == null) return;
      updateMultiStayPricing();
      sincronizarTrasladoOficial();
      return;
    }
    detailState.selectedHotel = false;
    detailState.hotelDecided = true;
    detailState.selectedHotelTotal = null;
    detailState.selectedHotelName = '';
    detailState.hotel = 0;
    var checked = document.querySelector('[data-hotel-total]:checked');
    if (checked) checked.checked = false;
    sincronizarTrasladoOficial();
  }
  function deseleccionarTransfer(leg) {
    if (!detailState) return;
    // Sin `leg` se limpian los dos tramos: es lo que llama el cambio de
    // transporte y el "empezar de nuevo", donde ninguno debe quedar elegido.
    if (leg === 'vuelta') detailState.transferTypeVuelta = '';
    else if (leg === 'llegada') detailState.transferType = '';
    else { detailState.transferType = ''; detailState.transferTypeVuelta = ''; }
    detailState.transfer = trasladoDelViaje(detailState);
    var section = document.querySelector('[data-official-transfer]');
    if (section) section.outerHTML = transferCard(detailState.meta);
    sincronizarTrasladoOficial();
    renderTripSummary();
  }
  function formatFlightDateTime(value) {
    if (!value) return 'sin fecha';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-UY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function getSelectedFlightSummary() {
    if (!detailState) return { airline: 'Vuelo seleccionado', summary: 'Todavía no elegiste un vuelo.', selected: false };
    var offer = getSelectedFlightOffer();
    /* Antes el relleno de "airline" era la palabra "Vuelo seleccionado" y el
       resumen armaba igual la linea de tramos, asi que sin vuelo elegido la fila
       decia "Vuelo · Vuelo seleccionado" y debajo "IDA — sin fecha → — sin fecha":
       dos em dash de airportCode(undefined) con un "sin fecha" al lado. Decir que
       algo esta seleccionado cuando no lo esta es peor que no decir nada: la
       persona cree que ya eligio. Ahora hay un selected explicito y cada que usa
       el resumen decide que decir. */
    if (!offer) return { airline: '', summary: 'Todavía no elegiste un vuelo.', selected: false };
    var airline = offer.airline || detailState.selectedFlight || 'Vuelo sin nombre';
    var outbound = offer && (offer.outbound || offer);
    var departureValue = outbound && outbound.departure ? outbound.departure : (offer && offer.departure);
    var arrivalValue = outbound && outbound.arrival ? outbound.arrival : (offer && offer.arrival);
    var departureText = formatFlightDateTime(departureValue);
    var arrivalText = formatFlightDateTime(arrivalValue);
    var flightNumber = (offer && (offer.flight_number || (offer.outbound && offer.outbound.flight_number))) || '';
    var inboundFlightNumber = offer && offer.inbound && offer.inbound.flight_number || '';
    var originAirport = offer && (offer.departure_airport || (offer.outbound && offer.outbound.origin));
    var destinationAirport = offer && (offer.arrival_airport || (offer.outbound && offer.outbound.destination));
    var route = '';
    if (offer) {
      var origin = airportCode(originAirport);
      var destination = airportCode(destinationAirport);
      route = ' · ' + origin + ' → ' + destination;
    }
    return {
      airline: airline,
      summary: 'Transfer sincronizado para ' + airline + route + ' · Vuelo seleccionado el ' + departureText + (arrivalText && arrivalText !== 'sin fecha' ? ' · llegada ' + arrivalText : ''),
      departureText: departureText,
      arrivalText: arrivalText,
      selected: true,
      route: route
    };
  }
  /* Como se nombra un vuelo en un dato corto: "_aerolinea_ · _numero_".
     Tres lugares (el resumen del checkout, el bloque del transfer y el mensaje de
     WhatsApp) concatenaban vuelo.airline y vuelo.flightNumber a mano, y con
     airline vacio eso daba " · " o "undefined · AR1234" en el mensaje. Cuando no
     hay vuelo elegido dice "Sin seleccionar", que es lo que es. */
  function vueloNombreCorto(vuelo) {
    if (!vuelo || !vuelo.selected || !vuelo.airline) return 'Sin seleccionar';
    return vuelo.airline + (vuelo.flightNumber ? ' · ' + vuelo.flightNumber : '');
  }
  function sincronizarTrasladoOficial() {
    if (!detailState) return;
    // La modalidad elegida se suma al presupuesto inmediatamente. Vuelo y hotel
    // solo son requisitos para coordinar el traslado, no para cotizar su costo.
    // getSelectedTransferAmount() es la única fuente de verdad del monto, para
    // que este total nunca se desincronice del que muestran Mi Viaje y el
    // desglose "A dónde va tu plata".
    // trasladoDelViaje() y no getSelectedTransferAmount(): con dos tramos, el
    // monto guardado tiene que ser el de los dos. Y sin elegir ninguno devuelve
    // 0, que es lo que esta linea tiene que dejar para que el total no sume un
    // traslado que nadie pidio.
    detailState.transfer = detailState.transportMode === 'flight'
      ? (transferTypeDe(detailState, 'llegada') || transferTypeDe(detailState, 'vuelta') ? trasladoDelViaje(detailState) : 0)
      : 0;
    recalcularTotalViaje();
  }
  function actualizarPasajes(section, price, airline) {
    if (!detailState || !Number.isFinite(price) || price <= 0) return;
    detailState.flight = Math.round(price); detailState.baseFlight = detailState.flight;
    if (airline) detailState.selectedFlight = airline;
    if (section) section.setAttribute('data-selected-flight-price', String(detailState.flight));
    sincronizarTrasladoOficial();
  }
  function actualizarAlojamiento(price, selectedByUser, stop) {
    if (!detailState || !Number.isFinite(price) || price <= 0) return;
    // El flag se levanta antes de recalcular el reparto multihotel: si el
    // alojamiento estaba deseleccionado, updateMultiStayPricing() necesita saber
    // que esta vez hay una elección real y no un 0 heredado.
    if (selectedByUser) { detailState.selectedHotel = true; detailState.hotelDecided = true; detailState.selectedHotelTotal = Math.round(price); }
    if (detailState.multiStay && selectedByUser) {
      // stop 1 o 2: cada parada guarda su propio hotel. Con un solo numero
      // compartido, elegir en el segundo grupo pisaba el primero y la primera
      // parada volvía a cobrarse con el promedio del modelo.
      setStaySelectedTotal(stop === 2 ? 2 : 1, price);
      updateMultiStayPricing();
    } else { detailState.hotel = Math.round(price); }
    if (selectedByUser) {
      var checked = document.querySelector('[data-hotel-total]:checked');
      if (checked) {
        var card = checked.closest('[data-hotel-option]');
        if (card) {
          var label = card.querySelector('h3');
          if (label) detailState.selectedHotelName = label.textContent.trim();
        }
      }
    }
    sincronizarTrasladoOficial();
  }
  function currentRoadtripTotal() {
    if (!detailState || !detailState.roadtrip) return 0;
    if (detailState.roadtripVehicleType === 'ev') return roadtripEvFigures(detailState.roadtrip, detailState.roadtripEv || {}).totalUsd;
    return Number(detailState.roadtrip.totalUsd) || 0;
  }
  // Parte de estado de actualizarTransporte, sin DOM. Existe separada para que
  // showProposalView() pueda fijar el estado ANTES de construir el markup: antes
  // construía el flow una vez, lo metía en el innerHTML, y enseguida lo
  // sobreescribía con un segundo transportFlow() idéntico. Ese segundo parseo
  // además se llevaba por delante el prompt .flight-results (lo que el usuario
  // iba a tocar) y reseteaba data-flight-step y data-flight-requested.
  function syncTransportState(autoEnabled) {
    if (!detailState) return;
    detailState.transportMode = autoEnabled ? 'auto' : 'flight';
    detailState.auto = autoEnabled ? currentRoadtripTotal() : 0;
    detailState.flight = autoEnabled ? 0 : detailState.baseFlight;
    detailState.parts.traslados = autoEnabled ? 0 : detailState.baseTraslados + (detailState.multiStay ? Number(detailState.multiStay.transferBetweenUsd) || 0 : 0);
  }
  function actualizarTransporte(autoEnabled) {
    if (!detailState) return;
    syncTransportState(autoEnabled);
    var flow = document.querySelector('[data-transport-flow]');
    if (flow) {
      // Reemplazar, en vez de ocultar, evita que controles de vuelos o transfers
      // queden disponibles en el DOM cuando el usuario eligió auto (y viceversa).
      flow.innerHTML = transportFlow(detailState.meta, detailState.flight, autoEnabled);
    }
    sincronizarTrasladoOficial();
  }
  function actualizarRoadtrip(kmPerLiter) {
    if (!detailState || !detailState.roadtrip) return;
    var r = detailState.roadtrip;
    var consumption = Number(kmPerLiter);
    if (!Number.isFinite(consumption) || consumption < 3 || consumption > 40) return;
    r.kmPerLiter = consumption;
    r.liters = Math.round((Number(r.roundTripKm) / consumption) * 10) / 10;
    r.fuelUsd = Math.round(r.liters * Number(r.fuelPriceUsd));
    r.totalUsd = r.fuelUsd + Number(r.tollsUsd);
    var litersEl = document.querySelector('[data-roadtrip-liters]');
    var fuelEl = document.querySelector('[data-roadtrip-fuel]');
    var totalEl = document.querySelector('[data-roadtrip-total]');
    if (litersEl) litersEl.textContent = r.liters + ' litros';
    if (fuelEl) fuelEl.textContent = money(r.fuelUsd);
    if (totalEl) totalEl.textContent = money(r.totalUsd);
    if (detailState.transportMode === 'auto' && detailState.roadtripVehicleType !== 'ev') detailState.auto = r.totalUsd;
    recalcularTotalViaje();
  }
  function actualizarModeloRoadtrip(model) {
    var manual = document.querySelector('[data-roadtrip-consumption]');
    var manualLabel = document.querySelector('[data-roadtrip-consumption-label]');
    if (!manual) return;
    var custom = model === 'custom';
    if (manualLabel) manualLabel.hidden = !custom;
    manual.disabled = !custom;
    if (!custom) {
      manual.value = ROADTRIP_VEHICLES[model];
      actualizarRoadtrip(ROADTRIP_VEHICLES[model]);
    } else {
      manual.focus();
    }
  }
  function actualizarRoadtripEv(patch) {
    if (!detailState || !detailState.roadtrip) return;
    detailState.roadtripEv = Object.assign({}, detailState.roadtripEv, patch);
    var figures = roadtripEvFigures(detailState.roadtrip, detailState.roadtripEv);
    var kwhEl = document.querySelector('[data-roadtrip-ev-kwh]');
    var rateEl = document.querySelector('[data-roadtrip-ev-rate]');
    var electricityEl = document.querySelector('[data-roadtrip-ev-electricity]');
    var totalEl = document.querySelector('[data-roadtrip-ev-total]');
    var rangeEl = document.querySelector('[data-roadtrip-ev-range]');
    if (kwhEl) kwhEl.textContent = figures.kwh + ' kWh';
    if (rateEl) rateEl.textContent = moneyPrecise(figures.kwhPrice);
    if (electricityEl) electricityEl.textContent = money(figures.electricityUsd);
    if (totalEl) totalEl.textContent = money(figures.totalUsd);
    if (rangeEl) rangeEl.textContent = figures.usableRangeKm + ' km';
    // La autonomía cambia con el modelo elegido, así que el plan de paradas
    // tiene que recalcularse acá y no quedarse con el del modelo anterior.
    var stopsEl = document.querySelector('[data-roadtrip-stops]');
    if (stopsEl) stopsEl.innerHTML = roadtripStopsInnerHtml(roadtripStopsPlan(detailState.roadtrip.roundTripKm, true, figures.usableRangeKm), true);
    if (detailState.transportMode === 'auto' && detailState.roadtripVehicleType === 'ev') detailState.auto = figures.totalUsd;
    recalcularTotalViaje();
  }
  function cambiarVehiculoRoadtrip(type) {
    if (!detailState || (type !== 'combustion' && type !== 'ev')) return;
    if (detailState.roadtripVehicleType === type) return;
    detailState.roadtripVehicleType = type;
    if (detailState.transportMode === 'auto') detailState.auto = currentRoadtripTotal();
    var flow = document.querySelector('[data-transport-flow]');
    if (flow) flow.innerHTML = transportFlow(detailState.meta, detailState.flight, true);
    recalcularTotalViaje();
  }
  function roadtripCard(meta, autoSelected) {
    return '';
  }
  function roadtripEvFigures(r, ev) {
    var preset = EV_VEHICLES[ev.modelKey] || EV_VEHICLES.byd_dolphin;
    var kwhPer100 = Number(ev.kwhPer100km) || preset.kwhPer100km;
    var batteryKwh = Number(ev.batteryKwh) || preset.batteryKwh;
    var kwhPrice = Number(ev.kwhPrice) > 0 ? Number(ev.kwhPrice) : DEFAULT_KWH_PRICE_USD;
    var kwh = Math.round((r.roundTripKm / 100) * kwhPer100 * 10) / 10;
    var electricityUsd = Math.round(kwh * kwhPrice);
    var usableRangeKm = Math.max(50, Math.round((batteryKwh * 0.8) / kwhPer100 * 100));
    return { modelKey: ev.modelKey || 'byd_dolphin', kwhPer100km: kwhPer100, batteryKwh: batteryKwh, kwhPrice: kwhPrice, kwh: kwh, electricityUsd: electricityUsd, tollsUsd: r.tollsUsd, totalUsd: electricityUsd + r.tollsUsd, usableRangeKm: usableRangeKm };
  }
  function roadtripCalculator(meta) {
    var r = meta.roadtrip;
    if (!r) return '';
    var vType = (detailState && detailState.roadtripVehicleType) || 'combustion';
    var isEv = vType === 'ev';
    var ev = roadtripEvFigures(r, (detailState && detailState.roadtripEv) || {});
    var stopsPlan = roadtripStopsPlan(r.roundTripKm, isEv, ev.usableRangeKm);

    var vehicleTabs = '<div class="roadtrip-vtabs" role="tablist">' +
      '<button type="button" class="roadtrip-vtab' + (!isEv ? ' is-active' : '') + '" data-roadtrip-vtype="combustion" role="tab" aria-selected="' + !isEv + '">⛽ Combustible</button>' +
      '<button type="button" class="roadtrip-vtab' + (isEv ? ' is-active' : '') + '" data-roadtrip-vtype="ev" role="tab" aria-selected="' + isEv + '">🔋 Eléctrico</button>' +
      '</div>';

    var combustionPanel = '<div class="transport-card transport-detail" data-roadtrip-calculator' + (isEv ? ' hidden' : '') + '><label for="roadtrip-model">Modelo o consumo del auto<select id="roadtrip-model" data-roadtrip-model><option value="onix">Chevrolet Onix · 13 km/l</option><option value="gol" selected>VW Gol · 12 km/l</option><option value="argo">Fiat Argo · 12,5 km/l</option><option value="hilux">Toyota Hilux · 9 km/l</option><option value="kwid">Renault Kwid · 15 km/l</option><option value="custom">Personalizado (Ingresar manual)</option></select></label><label for="roadtrip-consumption" data-roadtrip-consumption-label hidden>Consumo personalizado (km por litro)<input id="roadtrip-consumption" type="number" inputmode="decimal" min="3" max="40" step="0.1" value="' + esc(r.kmPerLiter || 12) + '" data-roadtrip-consumption disabled></label><p>⛽ Combustible: <span data-roadtrip-liters>' + r.liters + ' litros</span> × ' + money(r.fuelPriceUsd) + '/l = <b data-roadtrip-fuel>' + money(r.fuelUsd) + '</b></p><p>🚧 Peajes estimados: <b>' + money(r.tollsUsd) + '</b></p><p>🚗 Total Auto / Roadtrip: <b data-roadtrip-total>' + money(r.totalUsd) + '</b></p></div>';

    var evOptionsMarkup = Object.keys(EV_VEHICLES).map(function (key) { return '<option value="' + key + '"' + (key === ev.modelKey ? ' selected' : '') + '>' + esc(EV_VEHICLES[key].label) + '</option>'; }).join('');
    var evPanel = '<div class="transport-card transport-detail" data-roadtrip-ev-panel' + (!isEv ? ' hidden' : '') + '><label for="roadtrip-ev-model">Modelo eléctrico<select id="roadtrip-ev-model" data-roadtrip-ev-model>' + evOptionsMarkup + '</select></label><label for="roadtrip-ev-price">Tarifa de carga (' + esc(monedaActiva().simbolo) + ' por kWh)<input id="roadtrip-ev-price" type="number" inputmode="decimal" min="0.05" max="2" step="0.01" value="' + esc(ev.kwhPrice) + '" data-roadtrip-ev-price></label><p>🔋 Energía: <span data-roadtrip-ev-kwh>' + ev.kwh + ' kWh</span> × <span data-roadtrip-ev-rate>' + moneyPrecise(ev.kwhPrice) + '</span>/kWh = <b data-roadtrip-ev-electricity>' + money(ev.electricityUsd) + '</b></p><p>🚧 Peajes estimados: <b>' + money(ev.tollsUsd) + '</b></p><p>🚗 Total Auto Eléctrico: <b data-roadtrip-ev-total>' + money(ev.totalUsd) + '</b></p><p>🔌 Autonomía real estimada: <b data-roadtrip-ev-range>' + ev.usableRangeKm + ' km</b> por carga (80% de batería, sin apurar el 20% restante)</p><p class="cost-note">* Tarifa de carga pública estimada; confirmá el precio real en tu red de carga antes de salir.</p></div>';

    var routeCard = '<div class="transport-card roadtrip-route"><div class="roadtrip-route__stat"><span>Ruta ida y vuelta</span><b>' + r.roundTripKm + ' km</b></div><div class="roadtrip-route__stat"><span>Manejo estimado</span><b>' + r.hours + ' hs</b></div><div class="roadtrip-route__stat"><span>Destino</span><b>' + esc(meta.dest.name) + '</b></div></div>';

    var showStops = isEv || r.roundTripKm >= 600;
    var stopsPanel = showStops ? ('<details class="roadtrip-stops" data-roadtrip-stops' + (isEv ? ' open' : '') + '>' + roadtripStopsInnerHtml(stopsPlan, isEv) + '</details>') : '';

    return '<section class="transport-options roadtrip-planner" data-budget-anchor="auto">' + vehicleTabs + combustionPanel + evPanel + routeCard + stopsPanel + '</section>';
  }
  /* Dibujo de las dos opciones de transfer, en lugar del emoji.
     El emoji (🚐 y 🚗) se veía distinto en cada sistema operativo y además
     no decía nada: las dos opciones son un auto, lo único que las separa es
     cuántas personas van adentro. El dibujo dice justamente eso: la van alta
     lleva tres cabezas en la ventanilla y el auto bajo lleva una sola, con el
     asiento de atrás vacío. También por eso son dos vehículos de silueta muy
     distinta (una caja alta, el otro una sedan) y no el mismo dibujo con dos
     colores: se tienen que diferenciar de un vistazo.
     Trazo como CATEGORY_ICONS, así que heredan el color del estado y no hay
     que dar crédito de licencia. */
  function transferArt(key) {
    var ico = 'class="transfer-choice__art" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    if (key === 'shared') {
      // Van de traslado. Tres cabezas, y de paso se ve que es más alta y
      // angosta que el auto: la diferencia de silueta es la primera señal.
      return '<svg ' + ico + '>' +
        '<path d="M2.4 15.4V10.4l1.9-3.4A2.4 2.4 0 0 1 6.1 6h10.8a2.4 2.4 0 0 1 1.9.9l2.2 3.5v5"/>' +
        '<path d="M2.4 15.4h18.6"/>' +
        '<rect x="4.5" y="7.6" width="14.4" height="5.4" rx="1.2"/>' +
        '<circle cx="8" cy="10.3" r="1.2"/><circle cx="11.7" cy="10.3" r="1.2"/><circle cx="15.4" cy="10.3" r="1.2"/>' +
        '<circle cx="6.8" cy="17.4" r="2.1"/><circle cx="16.8" cy="17.4" r="2.1"/>' +
        '</svg>';
    }
    // Auto privado. Una sola cabeza, bien adentro y adelante en la ventanilla,
    // y la mitad de atrás vacía: ahí no viaja nadie. Sin montante en el medio:
    // cuando lo dibujaba, el montante y la cabeza quedaban pegados a 34px y no
    // se distinguían. La ventana sola ya dice "un solo ocupante". El techo va
    // más bajo que el de la van a propósito (6.4 contra 9.4 de alto): con la
    // cabina al mismo nivel los dos dibujos se leían como el mismo vehículo.
    return '<svg ' + ico + '>' +
      '<path d="M2.2 15.4v-2.8h3.2L7.8 9h5.6l2.2 3.6h2.2a2.8 2.8 0 0 1 2 2.8"/>' +
      '<path d="M2.2 15.4h17.6"/>' +
      '<path d="M5.9 12.2 8.1 9.4h5.1l2.1 2.8Z"/>' +
      '<circle cx="12.4" cy="10.8" r="1.25"/>' +
      '<circle cx="6.6" cy="17.4" r="2.1"/><circle cx="15.6" cy="17.4" r="2.1"/>' +
      '</svg>';
  }
  /* Un tramo del transfer en un viaje de dos paradas.

     Un tramo de llegada trae shared y private, que son los dos precios que se
     ofrecen para elegir; el compartido ya viene multiplicado por los viajeros.
     0 en shared significa que no hay van compartida a ese destino (isla), y la
     card no se dibuja.
     Un tramo entre paradas trae amount, porque no hay modalidad que elegir: se
     cobra siempre y ya esta en el total. Por eso lleva auto:true y se pinta
     como fila y no como cards.

     El multiStay se lee de state y, si no esta, de meta. El server lo manda en
     meta.multiStay y showProposalView lo copia a detailState.multiStay con el
     reparto de noches, asi que los dos tienen los datos; el fallback es para
     los caminos que llaman a transferCard(detailState.meta) sin haber pasado
     por showProposalView. */
  function tramosTransfer(state) {
    var meta = (state && state.meta) || {};
    var precios = transferPreciosDe(meta);
    var pax = Math.max(1, Number((meta && meta.pax) || (state && state.pax) || (typeof S !== 'undefined' && S && S.pax)) || 1);
    var tramos = [];
    if (meta.dest) {
      var aero = precios.aeropuerto ? 'Aeropuerto de ' + precios.aeropuerto + (precios.iata ? ' (' + precios.iata + ')' : '') : 'Aeropuerto';
      var comun = { auto: false, shared: precios.soloPrivado ? 0 : precios.compartido * pax, private: precios.privado, note: precios.km ? precios.km + ' km' : '' };
      // Los tramos van en el orden en que se recorren: primero se llega, después
      // se vuelve. Cada uno con SU modalidad elegida (transferType y
      // transferTypeVuelta), y por eso se pueden cambiar por separado.
      tramos.push(Object.assign({}, comun, { key: 'llegada', selected: transferTypeDe(state, 'llegada'), from: aero, to: meta.dest.name }));
      tramos.push(Object.assign({}, comun, { key: 'vuelta', selected: transferTypeDe(state, 'vuelta'), from: meta.dest.name, to: aero }));
    }
    var ms = (state && state.multiStay) || (meta && meta.multiStay) || null;
    if (ms && ms.transfer && ms.stays && ms.stays.length === 2) {
      var entre = ms.transfer;
      // El server ya lo calculo con la misma formula (model.comboTransfer), asi
      // que el numero no se reimprime aca: se usa el que vino. La modalidad es
      // "auto" porque es un solo pasaje por persona y no hay nada que elegir.
      tramos.push({
        key: 'entre', auto: true, selected: '',
        amount: Math.max(0, Number(entre.totalUsd) || 0),
        from: ms.stays[0].name,
        to: ms.stays[1].name,
        note: entre.distanceKm ? entre.distanceKm + ' km' + (entre.hours ? ' · ' + entre.hours + ' h' : '') : '',
        ferry: entre.mode === 'ferry'
      });
    }
    return tramos;
  }
  /* ¿Este tramo conviene con Uber en vez de con transfer?

     El criterio son DOS condiciones, no una sola distancia. La distancia sola no
     alcanza: un transfer de 12 km cuesta lo mismo que uno de 20 (el piso de la
     tabla), asi que el numero de km no explica por que conviene una cosa u otra.
     Lo que decide es el PRECIO, y la distancia es la que dice si un transfer
     corto tiene sentido o si ya es un viaje en si mismo.

     Los dos numeros salen de data/transfer-precios.json y no estan puestos a ojo:
     `appRideUsd` es el precio de un Uber/99 verificado para la ruta (5 destinos lo
     tienen) y el resto cae en el modelo de distancia, con el mismo piso de US$ 20
     que la tabla. Con los 5 destinos que sí tienen precio de app verificado, el
     corte cae limpio y no hay zona gris:

       ssa   24 km   app US$ 11   vs compartido US$ 20  -> Uber gana
       igu   14 km   app US$  8   vs compartido US$ 20  -> Uber gana
       poa    9 km   app US$  7   vs compartido US$ 20  -> Uber gana
       bcm   96 km   app US$ 42   vs compartido US$ 25  -> transfer gana
       gram 109 km   app US$ 43   vs compartido US$ 25  -> transfer gana

     O sea que el precio ya separa los casos sin necesitar el km: donde el Uber
     gana es porque es un piso de app contra un piso de transfer, y donde pierde
     es porque la distancia sube el precio. El km se consulta igual, porque en un
     destino sin precio de app verificado es la unica señal disponible.

     El margen es deliberado: 12 km y 25 km, de los dos lados. Un tramo de 20 km
     queda en "cercano" y uno de 30 en "transfer", que es donde不能让 el umbral
     depender de un decimal. */
  var UMBRAL_CERCANO_KM = 25;
  var UMBRAL_LEJOS_KM = 12;
  function tramoEsCercano(precios, pax) {
    if (!precios || precios.soloPrivado) return false;
    var km = Number(precios.km) || 0;
    if (km <= 0) return false;
    var app = Number(precios.appRideUsd) || 0;
    var compartido = Number(precios.compartido) || 0;
    // Con precio de app verificado manda el precio, que es el dato real.
    if (app > 0) return app < compartido;
    // Sin el, la distancia con un margen a cada lado. Un tramo de menos de 12 km
    // es un traslado de barrio y uno de mas de 25 km ya es un viaje: en el medio
    // no hay dato para decidir y se ofrece el transfer, que es lo seguro.
    return km <= UMBRAL_CERCANO_KM;
  }

  function transferCard(meta) {
    var selected = detailState && detailState.transferType || '';
    // Los precios salen de la tabla por destino (public/transfer-precios.js, que
    // se genera desde data/transfer-precios.json). Antes estaban escritos aca como
    // 30 y 150, iguales para los 44 destinos, y no coincidian con el 35 por
    // pasajero que mandaba el server: tres numeros para el mismo precio.
    var t = transferPreciosDe(meta);
    // Ni la sugerencia de recogida ni los chips de horario. Antes aca se
    // derivaba la hora del vuelo y se proponia "1 hora despues", con tres chips
    // para adjustarla. Eso es coordinar una cita que todavia no existe: el
    // transfer no tiene hora hasta que el operador la confirma, y una app que
    // propone 15:20 sin saber si el vuelo llega a tierra a esa hora esta
    // inventando el dato mas importante del traslado. El horario se coordina
    // por WhatsApp, que es donde el operador lo cierra.
    var modoNota = t.modo && t.modo !== 'car'
      ? '<p class="cost-note">' + esc(t.nota || 'A este destino no se llega en transfer por carretera.') + '</p>'
      : '';
    var paxT = Math.max(1, Number((detailState && detailState.meta && detailState.meta.pax) || S.pax) || 1);
    /* Las dos modalities, armadas UNA vez y despues pintadas por tramo.

        Antes `cards` era un string ya、勤 escolhido con el `selected` de un solo
        tramo, asi que con dos tramos habia que armarlo dos veces con el estado
        distinto. Ahora es una funcion de (selected) y cada tramo la llama con lo
        suyo: el boton lleva data-transfer-leg, y el click sabe a que tramo
        pertenece. */
    var opciones = [
      { key: 'shared', amount: t.compartido, title: 'Transfer compartido', desc: 'Compartís el vehículo con otros pasajeros. Se cobra por persona.' },
      { key: 'private', amount: t.privado, title: 'Transfer privado', desc: 'Vehículo exclusivo para los que viajan. Se cobra el auto, no por persona.' }
    ].filter(function (card) {
      // A una isla no hay van compartida: el unico traslado es el vuelo. Mostrar
      // la card con precio 0 seria ofrecer un transfer gratis.
      if (card.key === 'shared' && t.soloPrivado) return false;
      return !(card.amount <= 0);
    });
    function cardsDe(leg, selectedLeg) {
      return opciones.map(function (card) {
        var isSelected = selectedLeg === card.key;
        /* El precio, con su unidad explicita.

           El compartido se cobra POR PERSONA y el privado POR VEHICULO, asi que
           el numero solo no dice cuanto le toca a cada uno: con dos personas, un
           compartido de R$52 y un privado de R$104 son el mismo total, y sin la
           unidad la comparacion invita a elegir el privado pensando que sale la
           mitad. Se muestra el unitario en grande y, en el compartido, el total
           del grupo debajo. En el privado no hay unitario porque no existe. */
        var precio = card.key === 'shared'
          ? money(card.amount) + '<span class="transfer-choice__unit"> por persona</span>' +
            (paxT > 1 ? '<span class="transfer-choice__total"> · ' + money(card.amount * paxT) + ' los ' + paxT + '</span>' : '')
          : money(card.amount) + '<span class="transfer-choice__unit"> por vehículo</span>';
        return '<button type="button" class="transfer-choice' + (isSelected ? ' is-selected' : '') + '" data-transfer-choice="' + card.key + '" data-transfer-leg="' + leg + '" data-transfer-amount="' + card.amount + '" aria-pressed="' + (isSelected ? 'true' : 'false') + '">' +
          /* Icono y titulo en una fila propia. El <strong> estaba dentro de
             __body, que con la card en columna hacia que el titulo quedara en
             una banda y el icono en otra. */
          '<span class="transfer-choice__head">' + transferArt(card.key) + '<strong>' + card.title + '</strong></span>' +
          '<span class="transfer-choice__body"><small>' + card.desc + '</small></span>' +
          '<b class="transfer-choice__price">' + precio + '</b></button>';
      }).join('');
    }
    /* Sin boton de reservar aca. Elegir la modalidad suma al presupuesto —igual
       que una card de actividades— y la reserva se pide desde "Mi Viaje", que es
       donde ya estan los dos pedidos juntos: el de actividades y el de traslado.
       Un boton por seccion obligaba a recordar en cual de las dos estabas, y el
       de actividades ya estaba en la cabecera de su seccion, asi que la app
       tenia tres caminos distintos para la misma accion. */
    var total = getSelectedTransferAmount(detailState);
    /* El total de arriba se saco. El monto ya esta en cada card, al lado del
       nombre ("R$ 104,20" y "R$ 156,30"), asi que arriba repetia la misma
       informacion en un tamano mas grande, y ademas era el unico numero de la
       seccion que no se movia al cambiar de modalidad: se elegia el privado y
       el total de arriba seguia diciendo el del compartido durante un instante.
       El total del viaje, ese si, esta en "Mi Viaje". */
    /* Los tramos. En un destino solo es el de siempre: una fila de llegadas y
       las dos cards. En dos paradas son DOS traslados distintos y son de otra
       naturaleza: el de la segunda parada no sale del aeropuerto, sino del hotel
       de la primera. Presentarlos como si los dos fueran "desde el aeropuerto"
       era falso, y antes el segundo ni siquiera aparecia como opcion: su monto
       entraba al total a ciegas, sin fila, sin modalidad y sin poder sacarlo. */
    var tramos = tramosTransfer(detailState);
    /* La nota de "ya esta en tu total" la dibuja cada tramo por su cuenta (ver
       filasTramos), no una sola vez aca: con dos tramos, el de vuelta puede estar
       en privado y el de llegada en compartido, y la nota tiene que ir donde
       corresponde. Solo se rotula "ya incluido" el COMPARTIDO porque el privado se
       elige por el usuario y no hay nada que aclarar.

       Sin la nota, marcar el compartido por defecto es una card amarilla que
       cambia una cifra y no dice por que. Y el total SI cambia: la estimacion del
       modelo queda reemplazada por el precio de la tabla (ver trasladoDelViaje),
       que en los 45 destinos es mas caro -- entre 1% y 4% del total del viaje. */
    var filasTramos = tramos.map(function (tramo) {
      /* El badge dice SOLO el nombre del servicio. Antes repetia la ruta entera
         con los mismos kilometros que ya estan en la bajada de arriba
         ("Aeropuerto Internacional de Salvador (SSA) → Praia do Forte, 62 km"),
         y con eso la fila de cada tramo tenia la misma informacion dos veces a
         distinta escala. La ruta y los km viven arriba; el badge identifica el
         tipo de traslado y nada mas. */
      var cabeza = '<div class="transfer-leg"><div class="transfer-leg__head"><span class="transfer-leg__badge">' + esc(tramo.ferry ? 'Ferry' : 'Transfer') + '</span>' +
        '<strong>' + esc(tramo.from) + ' → ' + esc(tramo.to) + '</strong>' +
        '</div>';
      if (tramo.auto) {
        // No es una eleccion: es un pasaje que ya esta en el total. Sin card,
        // sin radio y sin "Agregar", porque no hay nada que agregar.
        return cabeza + '<p class="transfer-leg__auto">' + (tramo.ferry ? 'Un pasaje de ferry por persona' : 'Un transfer por persona entre las paradas') + ': <b>' + money(tramo.amount) + '</b>. Se coordina con el operador al reservar.</p></div>';
      }
      if (tramo.key === 'llegada' || tramo.key === 'vuelta') {
        /* El tramo corto se dice ANTES de las cards, no despues. Es una
           recomendacion sobre si conviene o no contratar un transfer, asi que si
           va debajo se lee como el pie de un formulario que la persona ya dio por
           hired. Con el transfer por defecto de este modulo, sin este bloque
           estaria ofreciendo un traslado corto sin decir que no hace falta. */
        var cercano = tramoEsCercano(t, paxT);
        var consejo = cercano
          ? '<p class="transfer-advice"><span class="transfer-advice__ico" aria-hidden="true">💡</span><b>Para este tramo estás cerquísima.</b> Te conviene más tomarte un Uber o taxi local ' +
            (tramo.key === 'vuelta' ? 'para volver al aeropuerto' : 'al llegar') + ': sale menos que el transfer y no tenés que reservarlo. Si igual preferís que te recojan, elegí una opción abajo.</p>'
          : '';
        return cabeza + consejo + '<div class="transfer-choice-grid">' + cardsDe(tramo.key, tramo.selected) + '</div>' +
          (tramo.selected === 'shared' ? '<p class="transfer-choice-note">Incluido para tu comodidad. Si preferís otro, podés cambiar a privado.</p>' : '') +
          '</div>';
      }
      return cabeza + '</div>';
    }).join('');
    /* Un solo nombre para la placa, siempre.

       Antes el titulo salia del contenido: "Tus traslados" cuando el viaje tenia
       tramo entre paradas y "Traslados y Conexiones" cuando no. Asi el mismo
       bloque se llamaba de dos maneras segun el destino, y peor: cambiaba solo
       al tocar un transfer, porque el repintado vuelve a armar el titulo desde
       los tramos y en un viaje de dos paradas aparecia "Tus traslados" debajo
       del "Traslados y Conexiones" que ya estaba en pantalla. El nombre de una
       seccion no puede depender de lo que se eligio adentro: si el contenido
       cambia, el titulo se queda. */
    /* El titulo y la descripción van FUERA de la caja, como hermano. Antes el h2
       estaba adentro de .official-transfer__head, o sea dentro del rectangulo con
       borde, y la seccion se leia como una tarjeta mas en vez de como un bloque
       con su nombre.

       Y por eso los dos van juntos dentro de un <div data-official-transfer>, que
       es lo que reemplazan las actualizaciones en caliente. El marcador estaba
       solo en la caja y el titulo suelto afuera, así que cada repintado
       (cambiar deAeropuerto, de tramo, de numero de viajeros, cambiar la
       moneda) reemplazaba la caja por el markup COMPLETO y dejaba el titulo
       viejo, con lo que el h3 se acumulaba: seis "Traslados y Conexiones" uno
       abajo del otro después de seis cambios. El marcador tiene que alcanzar
       todo lo que devuelve esta función, o el repintado tiene que devolver
       solo la caja; y lo primero además evita que el titulo y la caja puedan
       quedar desalineados por un error de a medio camino. */
    /* El titulo va solo, sin bajada.

       La bajada decia "Elegí cómo querés llegar a tu alojamiento en Búzios desde
       Aeroporto Internacional do Galeão (GIG), a 174 km." y repetia el nombre del
       destino, el aeropuerto con su código y los kilómetros: los tres datos ya
       estan en el encabezado de cada tramo ("Aeropuerto de Galeão (GIG) →
       Búzios") y el km vive ahi como nota. Encima el titulo de la seccion se
       llama "Traslados y Conexiones", o sea que la bajada no aportaba ni el
       destino ni el precio ni la accion: era la misma frase con mas palabras.

       Y la accion ("Elegí") ya no hacía falta: con el compartido elegido por
       defecto no hay nada que elegir hasta que la persona quiera cambiarlo, y
       esa chance se anuncia con la nota de "Incluido para tu comodidad" que ya
       esta en cada card. */
    return '<div class="transfer-block" data-official-transfer>' +
      '<h3 class="block-title">Traslados y Conexiones</h3>' +
      '<section class="transport-options official-transfer" data-budget-anchor="traslados">' +
      modoNota +
      filasTramos +
      (selected ? '<p class="transfer-hint">El horario de recogida lo coordinás con el operador al reservar.</p>' : '') +
      '</section></div>';
  }

  /* Empresas de bus con horario y tarifa publicados (public/buses.js). Solo hay
     datos para Montevideo -> Porto Alegre y Florianopolis. Cada servicio (empresa
     + clase) es una opcion elegible: al elegirla, el pasaje del presupuesto pasa
     a ser su tarifa de ida x2 (ida y vuelta) x personas, convertida de $U con la
     tasa de la app. Una tarifa null (TTL no la publica) se puede elegir igual,
     pero el presupuesto conserva la estimacion y la tarjeta dice "Consultar". */
  function busServiceOptions(meta) {
    var servicios = typeof CS_BUS_SERVICES !== 'undefined' ? CS_BUS_SERVICES : null;
    var destKey = meta && meta.dest && meta.dest.key;
    if (!servicios || !destKey || String(meta.origin || S.origin || 'MVD').toUpperCase() !== 'MVD') return [];
    var out = [];
    servicios.forEach(function (co) {
      var ida = co.rutas.filter(function (r) { return r.dest === destKey && r.origen === 'Montevideo'; });
      var vuelta = co.rutas.filter(function (r) { return r.dest === destKey && r.origen !== 'Montevideo'; });
      if (!ida.length) return;
      var opciones = [];
      ida.forEach(function (r) {
        if (r.idaDiamanteUyu != null) {
          opciones.push({ id: co.empresa + '|' + destKey + '|semicama', clase: 'Semicama', uyu: r.idaUyu, ruta: r });
          opciones.push({ id: co.empresa + '|' + destKey + '|diamante', clase: 'Diamante', uyu: r.idaDiamanteUyu, ruta: r });
        } else {
          opciones.push({ id: co.empresa + '|' + destKey + '|unica', clase: '', uyu: r.idaUyu, ruta: r });
        }
      });
      out.push({ co: co, opciones: opciones, vuelta: vuelta });
    });
    return out;
  }
  function busServicesMarkup(meta) {
    var grupos = busServiceOptions(meta);
    if (!grupos.length) return '';
    var tasaUyu = tasaDe('UYU');
    var elegido = detailState && detailState.busChoice;
    var hoy = new Date().toISOString().slice(0, 10);
    function uyu(n) { return '$U ' + Number(n).toLocaleString('es-UY'); }
    var cards = grupos.map(function (g) {
      var co = g.co;
      var vencido = co.vigencia && co.vigencia < hoy;
      var filas = g.opciones.map(function (o) {
        var r = o.ruta;
        var sigDia = r.llegada < r.salida ? '<sup title="Llega al día siguiente">+1</sup>' : '';
        var tarifa = o.uyu != null
          ? '<b>' + uyu(o.uyu) + '</b>' + (tasaUyu ? '<small>&asymp; ' + money(o.uyu / tasaUyu) + '</small>' : '')
          : '<span class="bus-opt__na">Consultar tarifa</span>';
        return '<li><label class="bus-opt">'
          + '<input class="bus-opt__input" type="radio" name="bus-choice" data-bus-choice="' + esc(o.id) + '" data-bus-uyu="' + (o.uyu == null ? '' : o.uyu) + '"' + (elegido === o.id ? ' checked' : '') + '>'
          + '<span class="bus-opt__main"><span class="bus-opt__times">' + esc(r.salida) + ' <i aria-hidden="true">&rarr;</i> ' + esc(r.llegada) + sigDia + '</span>'
          + '<span class="bus-opt__days">' + esc(r.dias) + (o.clase ? ' &middot; ' + esc(o.clase) : '') + '</span></span>'
          + '<span class="bus-opt__fare">' + tarifa + '</span></label></li>';
      }).join('');
      var vueltaTxt = g.vuelta.length
        ? '<p class="bus-co__ret">Vuelta: ' + g.vuelta.map(function (r) { return esc(r.dias) + ' ' + esc(r.salida) + ' &rarr; ' + esc(r.llegada); }).join(' &middot; ') + '</p>'
        : '';
      var aviso = vencido
        ? 'Horario publicado hasta el ' + co.vigencia.split('-').reverse().join('/') + ': confirmalo con la empresa.'
        : 'Tarifas por tramo de ida. Confirmalas con la empresa antes de comprar.';
      return '<article class="bus-co"><header class="bus-co__head"><span class="bus-co__logo">' + esc(co.empresa) + '</span>'
        + '<span class="bus-co__route">Montevideo &rarr; ' + esc(meta.dest.name) + '</span></header>'
        + '<ul class="bus-co__list">' + filas + '</ul>' + vueltaTxt + '<p class="bus-co__note">' + esc(aviso) + '</p></article>';
    }).join('');
    var limpiar = elegido ? '<button type="button" class="bus-companies__clear" data-bus-clear>Volver a la tarifa estimada</button>' : '';
    return '<div class="bus-companies">' + cards + limpiar + '</div>';
  }
  /* El servicio de bus elegido en la seccion de llegada, o null si no hay. */
  function busElegido(meta) {
    var id = detailState && detailState.busChoice;
    if (!id) return null;
    var grupos = busServiceOptions(meta);
    for (var i = 0; i < grupos.length; i++) {
      for (var j = 0; j < grupos[i].opciones.length; j++) {
        if (grupos[i].opciones[j].id === id) return { empresa: grupos[i].co.empresa, clase: grupos[i].opciones[j].clase, ruta: grupos[i].opciones[j].ruta };
      }
    }
    return null;
  }
  function busResumenCorto(meta) {
    var b = busElegido(meta);
    return b ? b.empresa + (b.clase ? ' ' + b.clase : '') + ' · ' + b.ruta.salida + ' → ' + b.ruta.llegada : 'Bus semicama / cama (tarifa estimada)';
  }
  /* Aplica la eleccion al presupuesto. El precio base (la estimacion del
     modelo) se guarda la primera vez para poder volver a el. */
  function actualizarBus(id, uyuTxt) {
    if (!detailState || !detailState.parts) return;
    if (detailState.baseBus == null) detailState.baseBus = Number(detailState.parts.bus) || 0;
    var uyuN = uyuTxt === '' || uyuTxt == null ? null : Number(uyuTxt);
    var tasa = tasaDe('UYU');
    var pax = Math.max(1, Number(detailState.meta && detailState.meta.pax) || 1);
    detailState.busChoice = id || null;
    detailState.parts.bus = id && uyuN != null && Number.isFinite(uyuN) && tasa
      ? Math.round(uyuN / tasa * 2 * pax)
      : detailState.baseBus;
    renderTripSummary();
    recalcularTotalViaje();
  }

  function transportFlow(meta, budget, mode) {
    var selectedMode = typeof mode === 'string' ? mode : mode ? 'auto' : 'flight';
    if (selectedMode === 'auto') return roadtripCalculator(meta);
    if (selectedMode === 'bus') return '<h2 class="block-title">Llegada a destino (Bus)</h2>' + '<h3 class="block-title">Bus semicama / cama</h3>' + '<p class="sub block-sub">Estimación de pasaje ida y vuelta desde ' + esc(originCityName(meta.origin || S.origin)) + ' hasta ' + esc(meta.dest.name) + '.</p>' + '<section class="transport-options bus-itinerary" data-budget-anchor="bus"><p>El presupuesto incluye el pasaje terrestre; no requiere transfer de aeropuerto.</p><p class="cost-note">La tarifa de bus es estimada y debe confirmarse con el operador para las fechas elegidas.</p>' + busServicesMarkup(meta) + '</section>';
    /* El h2 agrupa y los h3 nombran cada bloque; los tres van FUERA de las cajas.
       Antes el h2 de vuelos y el h2 del transfer eran hermanos sueltos, cada uno
       con su caja, y el de vuelo estaba duplicado: uno en el section de afuera y
       otro adentro del box de busqueda. */
    return '<section class="detail-section" data-budget-anchor="pasajes">' +
      '<h2>Llegada a destino (Vuelos y Traslado)</h2>' +
      '<h3 class="block-title">Vuelos</h3>' +
      flightSearch(meta, budget) +
      transferCard(meta) +
      '</section>';
  }
  function localTransportDescription(meta) {
    var key = String((meta && meta.dest && meta.dest.key) || '').toLowerCase();
    var map = {
      buz: 'Movilidad en vans, taxis locales y caminatas.',
      rio: 'Movilidad en Uber, metro y caminatas.',
      fln: 'Movilidad en vans, taxis y caminatas.',
      sao: 'Movilidad en metro, Uber y caminatas.',
      ssa: 'Movilidad en vans, taxis y caminatas.',
      igu: 'Movilidad en taxis, vans y caminatas.',
      poa: 'Movilidad en colectivos, taxis y caminatas.',
      rec: 'Movilidad en taxis, vans y caminatas.',
      for: 'Movilidad en taxis, vans y caminatas.',
      mcz: 'Movilidad en taxis, vans y caminatas.',
      nat: 'Movilidad en taxis, vans y caminatas.',
      pip: 'Movilidad en taxis, vans y caminatas.',
      default: 'Movilidad local con transporte público y caminatas.'
    };
    return map[key] || map.default;
  }
  function breakdownRows() {
    if (!detailState) return '';
    var roadtrip = detailState.transportMode === 'auto';
    var categories = roadtrip ? ['auto', 'alquiler', 'alojamiento', 'comidas'] : detailState.transportMode === 'bus' ? ['bus', 'alquiler', 'alojamiento', 'comidas', 'local'] : ['pasajes', 'alquiler', 'alojamiento', 'comidas', 'local', 'traslados'];
    return categories.map(function (category) {
      if (category === 'auto' && !roadtrip) return '';
      var label = CATS.filter(function (c) { return c[0] === category; })[0][1];
      var value = category === 'bus' ? busSumado(detailState) : category === 'pasajes' ? vueloSumado(detailState) : category === 'alojamiento' ? hotelSumado(detailState) : category === 'traslados' ? (Number(detailState.parts.traslados) || 0) + getSelectedTransferAmount(detailState) : category === 'auto' ? detailState.auto : detailState.parts[category];
      return '<div data-cost-category="' + category + '"><span>' + label + '</span><b data-cost-value>' + money(Number(value) || 0) + '</b></div>';
    }).join('');
  }
  /* ------------------------------------------------------------------
     Guia Secreta. El contenido ya no esta en el cliente.

     Antes public/guias.js era un .js estatico que index.html cargaba antes que
     este archivo: 66 KB con la guia de los 88 destinos, bajables con curl sin
     cuenta y sin comprar nada. Y con el, un candado que no podia ser secreto:
     el texto ya estaba en el DOM, asi que se leia con el verificador de
     elementos, con un lector de pantalla y con window.print().

     Ahora el contenido esta en lib/guias.js, que el server no sirve. Se pide
     por /api/guia y el server responde 403 salvo que el cliente traiga el
     token que se firma cuando el destino tiene hoteles con precio real de
     Booking (ver guiaToken() en server.js). Sin token esta funcion no
     devuelve nada y la seccion no se dibuja: no queda texto borroso que
     despues se pueda leer igual.

     QUE NO ES UN SECRETO
     El token prueba que el cliente paso por la busqueda de hoteles de ese
     destino, no que pago. Quien llame a /api/hoteles con fechas validas
     consigue un token. Para cerrarlo de verdad hay que atarlo a la sesion del
     usuario, que es el paso que falta.

     Tres cosas que esta seccion hace distinto:

     - El veredicto de comida. detailState.foodPerDay es el presupuesto
       diario de comida por pasajero que ya calcula el modelo (app.js:3647).
       La guia compara los precios contra ese numero y dice si alcanzan. Sin
       eso, una lista de lugares no dice si el viaje le alcanza a la persona.

     - Los tours no vienen en la guia. Se piden con toursFor(), la misma
       funcion de la seccion de experiencias, asi que hay una sola lista de
       actividades y un solo lugar donde se rotula el precio.
     ------------------------------------------------------------------ */
  /* La guia se pide sola y se guarda por destino. Es una llamada que va a
    earer al travel summary y a re-pintar la seccion, asi que no se puede
     resolver con un await en medio del render: el resto de la pagina tiene
     que salir ya. Se carga en paralelo con los hoteles y, cuando llega, se
     pinta sola.
     Un token por destino, en memoria: no va a localStorage porque es una
     credencial de 30 minutos y guardar credenciales en disco es justamente
     lo que el token evita. Al recargar la pagina se pide de nuevo. */
  var guiaCache = {};
  var guiaPedidas = {};
  function pedirGuiaSecreta(destKey, done) {
    if (!destKey) return;
    // El guard mira la GUIA, no la entrada. guardarTokenGuia() crea la entrada
    // con el token solo, antes de que haya guia: si el guard preguntara por la
    // entrada, creeria que ya la tiene, devolveria null y no volveria a pedir
    // nunca. La entrada sin guia es justamente el estado normal de partida.
    var yaEsta = guiaCache[destKey] && guiaCache[destKey].guia;
    if (yaEsta) { done(yaEsta); return; }
    if (guiaPedidas[destKey]) return;
    guiaPedidas[destKey] = true;
    var token = guiaCache[destKey] && guiaCache[destKey].token;
    var url = '/api/guia?dest=' + encodeURIComponent(destKey) + (token ? '&token=' + encodeURIComponent(token) : '');
    fetch(url).then(function (r) {
      // 403 es la respuesta normal de quien no reservo con Booking: no es un
      // error que haya que reportar, es la guia cerrada.
      if (r.status === 403 || r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      if (data && data.guia) { guiaCache[destKey] = { guia: data.guia, token: token || null }; done(data.guia); return; }
      // 403 o 404 no es un fallo: es la guia cerrada para este destino. Se
      // marca como resuelta para no repreguntar en cada repintado.
      guiaPedidas[destKey] = false;
      done(null);
    }).catch(function () {
      // Un fallo de red si se reintenta: si no, un 500 dejaria la guia
      // cerrada para siempre en esta sesion.
      guiaPedidas[destKey] = false;
      done(null);
    });
  }
  function guardarTokenGuia(destKey, token) {
    if (!destKey || !token) return;
    guiaCache[destKey] = guiaCache[destKey] || {};
    guiaCache[destKey].token = token;
  }
  function guiaYaDe(destKey) {
    return (guiaCache[destKey] && guiaCache[destKey].guia) || null;
  }
  /* El candado de la Guia Secreta. Se dibuja en vez de no dibujar nada para que
     se vea que la seccion existe: es el premio de llegar hasta el hotel, y sin
     la promesa a la vista no hay nada que empuje a tocar "Ver disponibilidad".
     No lleva contenido de la guia ni una parte: si alguien la lee con el
     verificador de elementos, encuentra el mismo texto que la pagina de cierre.

     El candado es un SVG con dos piezas —el arco y el cuerpo— en vez del emoji
     🔒. El emoji se ve distinto en cada sistema operativo, que es el mismo
     problema que ya se corrigio en los iconos de los transfers: dos personas en
     la misma pantalla ven candados distintos. Ademas el emoji no se puede abrir.

     Las dos piezas se separan porque el candado se ABRE: cuando la guia llega,
     .is-open corre el arco hacia un costado y le da un giro, como el Cerrojo
     de una caja fuerte. El giro es una rotacion de transform, no una transicion
     de width, asi que no hay layout y no salta nada. */
  /* El path del arco cierra en y=12, dos unidades ADENTRO del cuerpo (que
     arranca en y=10). Con el cierre exacto en y=10 las patas se tocaban al
     borde y medio trazo de cada una caia de un lado, asi que cerrado se veia
     apenas rozando en lugar de metido en la cerradura. Con y=12 entra 1.8px
     medidos, que es lo que hace que se lea "cerrado", y al abrir el translateY
     de -5 lo saca entero del cuerpo. */
  function guiaLockIcon() {
    return '<svg class="guia-lock__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path class="guia-lock__shackle" d="M8 12V7.4a4 4 0 0 1 8 0V12"/>' +
      '<rect class="guia-lock__body" x="4.5" y="10" width="15" height="10.5" rx="2.2"/>' +
      '</svg>';
  }
  function guiaCandado(meta) {
    var destino = meta && meta.dest ? meta.dest.name : '';
    return '<section class="guia-lock" data-guia-lock aria-labelledby="guia-lock-title">' +
      '<div class="guia-lock__head"><span class="guia-lock__eyebrow">GUÍA SECRETA</span>' +
      '<h2 id="guia-lock-title">La Guía Secreta de ' + esc(destino) + '</h2></div>' +
      '<div class="guia-lock__body"><span class="guia-lock__icon" aria-hidden="true">' + guiaLockIcon() + '</span>' +
      '<p class="guia-lock__texto">Desbloqueá los secretos de la ciudad al elegir tu hotel. Al reservar tu alojamiento, accederás automáticamente a nuestras recomendaciones exclusivas de gastronomía y experiencias locales, curadas por expertos, que no encontrarás en las guías tradicionales.</p></div>' +
      '</section>';
  }
  /* Se pide la guia recien cuando la persona toca la reserva de un hotel. Ese
     gesto es el que el server quiere como prueba: no "busco este destino" sino
     "estoy por reservar aca". */
  function abrirGuiaPorReserva(destKey) {
    if (!destKey || !detailState || !detailState.meta) return;
    var meta = detailState.meta;
    if (!meta.dest || meta.dest.key !== destKey) return;
    pedirGuiaSecreta(destKey, function (guia) {
      if (!guia) return;
      // Reemplaza el candado en el lugar que ya ocupaba. Si el render inicial
      // ya habia pintado la guia (porque ya estaba en cache de una sesion
      // anterior), pintarGuiaEnDetalle() no hace nada y el candado no esta.
      var lock = document.querySelector('[data-guia-lock]');
      if (lock && lock.parentElement) {
        var envoltura = document.createElement('div');
        envoltura.innerHTML = guiaSecreta(meta, guia);
        var seccion = envoltura.firstElementChild;
        if (seccion) {
          seccion.setAttribute('data-guia-destino', meta.dest.key);
          /* El candado se ABRE antes de ser cambiado por la guia.
             Sin esta pausa el .is-open no llega a verse: el replaceChild es
             sincronico y el siguiente frame ya tiene la guia en pantalla, asi
             que la transicion de 340ms del arco se corta en el primer cuadro y
             lo unico que se ve es un cambio seco. Con 420ms se alcanza a ver el
             arco descuelgar y despues entra la guia —que es la recompensa, y
             tiene que parecer que se abrio algo.

             Si la persona cambio de destino o cerro el modal mientras tanto, el
             candado ya no esta en el DOM y la comprobacion lo salta. */
          lock.classList.add('is-open');
          window.setTimeout(function () {
            if (!lock.parentElement) return;
            lock.parentElement.replaceChild(seccion, lock);
            if (seccion.scrollIntoView) seccion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 420);
        }
        return;
      }
      pintarGuiaEnDetalle(guia, meta);
    });
  }
  /* Cuando la guia llega, se inserta sola al final de la vista de detalle.
     No se re-pinta la pagina entera: eso recalcularia el presupuesto y
     saltarian todos los numeros, que es justo lo que el usuario esta
     mirando. Solo se agrega el bloque que faltaba. */
  function pintarGuiaEnDetalle(guia, meta) {
    if (!guia || !meta || !meta.dest) return;
    var main = document.querySelector('.detail-main');
    if (!main) return;
    // Si el render inicial ya la habia pintado, no hay nada que hacer.
    if (main.querySelector('[data-guia-destino]')) return;
    if (document.querySelector('[data-guia-destino="' + meta.dest.key + '"]')) return;
    var html;
    try { html = guiaSecreta(meta, guia); } catch (error) { console.error('Error al pintar la guia', error); return; }
    if (!html) return;
    var envoltura = document.createElement('div');
    envoltura.innerHTML = html;
    var seccion = envoltura.firstElementChild;
    if (!seccion) return;
    seccion.setAttribute('data-guia-destino', meta.dest.key);
    /* Este camino agrega la guia al final sin pasar por el candado — es el que
       corre cuando la pagina se armo sin el (render que no pasa por
       guiaCandado). Si el candado esta en pantalla, se abre igual y recien
       despues se inserta la guia; si no esta, se inserta directo. */
    var lockAbajo = main.querySelector('[data-guia-lock]');
    if (!lockAbajo) { main.appendChild(seccion); return; }
    lockAbajo.classList.add('is-open');
    window.setTimeout(function () {
      if (!lockAbajo.parentElement) return;
      lockAbajo.parentElement.replaceChild(seccion, lockAbajo);
      if (seccion.scrollIntoView) seccion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 420);
  }
  function guiaSecreta(meta, guia) {
    if (!meta || !meta.dest) return '';
    // Sin guia se dibuja el CANDADO, no nada. La Guia Secreta es el premio de
    // llegar hasta el hotel: si la seccion no esta, nadie sabe que existe y no
    // hay nada que empuje a tocar "Ver disponibilidad". Con el candado a la vista
    // la oferta se entiende sola.
    //
    // El fallback de antes era la guia de Florianopolis, asi que Gramado veia
    // "busca prato executivo en el centro de Florianopolis": un destino
    // mostrando los consejos de otro.
    if (!guia) return guiaCandado(meta);

    var foodPerDay = Math.round(Number(detailState && detailState.foodPerDay) || 0);

    function bloque(seccion, etiqueta, cuerpo) {
      if (!cuerpo) return '';
      return '<div class="guia-bloque" data-guia-seccion="' + esc(seccion) + '">' +
        '<h3 class="guia-bloque__titulo">' + etiqueta + '</h3>' + cuerpo + '</div>';
    }
    function chips(valores) {
      return valores.filter(Boolean).map(function (v) { return '<span class="guia-tag">' + esc(v) + '</span>'; }).join('');
    }
    function etiquetaPrecio(valor) {
      if (typeof valor !== 'number') return '';
      return '<span class="guia-precio">' + (valor === 0 ? 'Gratis' : money(valor)) + '</span>';
    }
    function fotoDe(item) {
      if (!item.foto) return '';
      return '<div class="guia-foto"><img src="' + esc(item.foto) + '" alt="' + esc(item.name) + '" loading="lazy"></div>';
    }

    var cuerpo = '';

    // Veredicto de comida. Va primero porque es la pregunta que responde la
    // pagina entera: si el viaje me alcanza.
    var conPrecio = (guia.comer || []).filter(function (c) { return typeof c.usd === 'number'; });
    if (foodPerDay > 0 && conPrecio.length) {
      var alcanzan = conPrecio.filter(function (c) { return c.usd <= foodPerDay; });
      if (alcanzan.length) {
        cuerpo += '<div class="guia-veredicto"><b>Con US$' + foodPerDay + ' por día y persona</b> te alcanzan: ' +
          alcanzan.slice(0, 3).map(function (c) { return esc(c.name.toLowerCase()); }).join(', ') +
          (alcanzan.length > 3 ? ' y ' + (alcanzan.length - 3) + ' más.' : '.') + '</div>';
      } else {
        var barato = conPrecio.reduce(function (min, c) { return c.usd < min.usd ? c : min; });
        cuerpo += '<div class="guia-veredicto guia-veredicto--malo"><b>Con US$' + foodPerDay +
          ' por día esta guía no alcanza.</b> Lo más barato que aparece cuesta ' + money(barato.usd) +
          '. Conviene revisar el presupuesto de comida antes de cerrar el vuelo.</div>';
      }
    }

    if ((guia.temporada || {}).nota) {
      cuerpo += bloque('temporada', '🗓️ Cuándo ir', '<p class="guia-nota">' + esc(guia.temporada.nota) + '</p>');
    }

    if ((guia.beaches || []).length) {
      var beaches = guia.beaches.map(function (b) {
        return '<article class="guia-item' + (b.foto ? ' guia-item--foto' : '') + '">' + fotoDe(b) +
          '<div class="guia-item__cuerpo">' +
          '<div class="guia-item__head"><b>' + esc(b.name) + '</b>' + chips([b.zona]) + '</div>' +
          '<p class="guia-nota">' + esc(b.vibe) + '</p>' +
          (b.cuando ? '<p class="guia-nota guia-nota--chica"><b>Cuándo:</b> ' + esc(b.cuando) + '</p>' : '') +
          '</div></article>';
      }).join('');
      cuerpo += bloque('beaches', '🏖️ Qué playa ir', '<div class="guia-lista">' + beaches + '</div>');
    }

    if ((guia.atracciones || []).length) {
      var atracciones = guia.atracciones.map(function (a) {
        return '<article class="guia-item">' +
          '<div class="guia-item__head"><b>' + esc(a.name) + '</b>' + chips([a.zona, a.dur]) + etiquetaPrecio(a.usd) + '</div>' +
          '<p class="guia-nota">' + esc(a.nota) + '</p></article>';
      }).join('');
      cuerpo += bloque('atracciones', '📍 Qué ver', '<div class="guia-lista">' + atracciones + '</div>');
    }

    if ((guia.comer || []).length) {
      var comer = guia.comer.map(function (c) {
        var clase = '';
        if (foodPerDay > 0 && typeof c.usd === 'number') {
          clase = c.usd <= foodPerDay ? ' guia-precio--cabe' : ' guia-precio--pasa';
        }
        return '<article class="guia-item">' +
          '<div class="guia-item__head"><b>' + esc(c.name) + '</b>' + chips([c.tipo, c.zona, c.momento]) +
          (typeof c.usd === 'number' ? '<span class="guia-precio' + clase + '">' + money(c.usd) + '</span>' : '') + '</div>' +
          '<p class="guia-nota">' + esc(c.nota) + '</p></article>';
      }).join('');
      cuerpo += bloque('comer', '🍽️ Dónde comer', '<div class="guia-lista">' + comer + '</div>');
    }

    // Tours: salen de meta.tours, que el server leyo de Supabase.
    var tours = toursFor(meta.dest.key, meta.dest.name, meta) || [];
    if (tours.length) {
      var precioReal = false; // el precio es referencial, no de un operador que reserve
      var lista = tours.slice(0, 3).map(function (t) {
        var datos = [];
        if (t.rating) datos.push('★ ' + Number(t.rating).toFixed(1));
        if (t.freeCancellation) datos.push('Cancelación gratis');
        datos.push(precioReal ? 'Precio real' : 'Precio referencial');
        return '<article class="guia-item">' +
          '<div class="guia-item__head"><b>' + esc(t.title) + '</b><span class="guia-precio">' + money(t.price) + '</span></div>' +
          '<p class="guia-nota guia-nota--chica">' + esc(datos.join(' · ')) + '</p>' +
          (t.description ? '<p class="guia-nota">' + esc(t.description) + '</p>' : '') + '</article>';
      }).join('');
      cuerpo += bloque('tours', '🎟️ Tours recomendados',
        '<p class="guia-nota guia-nota--chica">' + tours.length + ' en este destino. ' +
        (precioReal ? 'Precios de las fechas que estás mirando.' : 'Precios referenciales.') + '</p>' +
        '<div class="guia-lista">' + lista + '</div>');
    }

    if ((guia.hacer || []).length) {
      var hacer = guia.hacer.map(function (h) {
        return '<article class="guia-item">' +
          '<div class="guia-item__head"><b>' + esc(h.name) + '</b>' + chips([h.zona, h.dur]) + etiquetaPrecio(h.usd) + '</div>' +
          '<p class="guia-nota">' + esc(h.nota) + '</p></article>';
      }).join('');
      cuerpo += bloque('hacer', '🧭 Qué hacer', '<div class="guia-lista">' + hacer + '</div>');
    }

    if ((guia.tips || []).length) {
      var tips = guia.tips.map(function (t) {
        return '<div class="guia-tip"><b>' + esc(t.titulo) + '</b><p>' + esc(t.texto) + '</p></div>';
      }).join('');
      cuerpo += bloque('tips', '💡 Tips locales', '<div class="guia-tips">' + tips + '</div>');
    }

    if (!cuerpo) return '';

    var pie = '<div class="guia-pie">Precios de comida orientativos, confirmá en el lugar. ' +
      (meta.dest.region ? 'Región: ' + esc(meta.dest.region) + '. ' : '') + 'Generado por CuántoSale.</div>';

    // Créditos de fotos. CC BY y CC BY-SA no permiten usar una imagen sin
    // atribuir al autor y nombrar la licencia.
    var creditos = (typeof FOTO_CREDITOS !== 'undefined' && FOTO_CREDITOS) ? FOTO_CREDITOS : {};
    var usadas = (guia.beaches || []).filter(function (b) { return b.foto && creditos[b.foto]; });
    if (usadas.length) {
      pie += '<div class="guia-creditos"><b>Fotos</b> (Wikimedia Commons): ' +
        usadas.map(function (b) {
          return esc(b.name) + ' — ' + esc(creditos[b.foto].autor) + ', ' + esc(creditos[b.foto].licencia);
        }).join(' · ') + '.</div>';
    }

    return '<section class="food-guide guia" aria-labelledby="guia-title">' +
      '<div class="food-guide-head"><span aria-hidden="true">🧭</span><div>' +
      '<h2 id="guia-title">Guía Secreta de ' + esc(meta.dest.name) + '</h2>' +
      '<p>' + esc(guia.resumen) + '</p></div></div>' +
      '<div class="guia-body">' + cuerpo + pie + '</div></section>';
  }

  function flightSearch(meta, budget) {
    return '<section class="flight-search" aria-label="Vuelos"><div><p>Precios reales directo de la aerolínea</p></div>' +
      '<div class="flight-filters" aria-label="Filtros de vuelos"><div><b>Escalas</b><button type="button" data-flight-stop="all" aria-pressed="true">Todos</button><button type="button" data-flight-stop="0">Directos</button><button type="button" data-flight-stop="1">1 escala</button><button type="button" data-flight-stop="2">2+ escalas</button></div><div><b>Horario de salida</b><button type="button" data-flight-time="all" aria-pressed="true">Todo el día</button><button type="button" data-flight-time="morning">Mañana</button><button type="button" data-flight-time="afternoon">Tarde</button><button type="button" data-flight-time="night">Noche</button></div></div>' +
      '<div class="flight-results" aria-live="polite"><div class="flight-search-prompt"><p>Buscá tarifas actuales y compará horarios y|scaleas para tu ruta.</p><button type="button" class="btn btn-primary" data-start-flight-search>Buscar vuelos disponibles</button></div></div></section>';
  }
  function flightTime(value) {
    if (!value) return 'Horario no disponible';
    return new Date(value).toLocaleString('es-UY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function airportLabel(airport) {
    airport = airport || {};
    return (airport.code ? airport.code + ' · ' : '') + (airport.name || 'Aeropuerto no informado');
  }
  function airportCode(airport) { return airport && airport.code ? airport.code : '—'; }
  function isCarrascoOffer(offer) {
    // Defensa adicional en el navegador: esta SPA cotiza únicamente desde MVD.
    // Nunca se muestra una alternativa originada en otro aeropuerto.
    return airportCode(offer && offer.departure_airport) === 'MVD';
  }
  function normalizeCabinClass(value) {
    value = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (value.indexOf('business') >= 0) return 'business';
    if (value.indexOf('premium_economy') >= 0 || value.indexOf('premium') >= 0) return 'premium_economy';
    if (value.indexOf('first') >= 0) return 'first';
    return value === 'economy' || value.indexOf('economy') >= 0 ? 'economy' : '';
  }
  function cabinClassLabel(cabinClass) {
    return ({ economy: 'Economy', premium_economy: 'Premium Economy', business: 'Business', first: 'First' })[cabinClass] || 'Cabina no informada';
  }
  function cabinClassesForStyle(style) {
    if (style === 'ahorro') return ['economy'];
    if (style === 'comodo') return ['premium_economy', 'business'];
    return ['economy', 'premium_economy'];
  }
  function filterFlightOffersByCabin(offers, style, fallbackClass) {
    var preferred = cabinClassesForStyle(style);
    var taggedOffers = offers.map(function (offer) {
      var cabinClass = normalizeCabinClass(offer.cabin_class || offer.cabinClass || offer.cabin_label || fallbackClass) || 'economy';
      return Object.assign({}, offer, { cabin_class: cabinClass, cabin_label: offer.cabin_label || cabinClassLabel(cabinClass) });
    });
    var matching = taggedOffers.filter(function (offer) { return preferred.indexOf(offer.cabin_class) >= 0; });
    if (style === 'comodo' && matching.length === 0) {
      return taggedOffers.filter(function (offer) { return offer.cabin_class === 'economy'; });
    }
    return matching;
  }
  function flightHour(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? -1 : date.getHours();
  }
  function filteredFlightOffers(section, offers) {
    var stop = section.getAttribute('data-flight-stop') || 'all';
    var time = section.getAttribute('data-flight-time') || 'all';
    return offers.filter(function (offer) {
      if (!isCarrascoOffer(offer)) return false;
      var stops = Number(offer.stops) || 0;
      var stopOk = stop === 'all' || (stop === '2' ? stops >= 2 : stops === Number(stop));
      var hour = flightHour(offer.departure);
      var timeOk = time === 'all' || (time === 'morning' && hour >= 5 && hour < 12) || (time === 'afternoon' && hour >= 12 && hour < 18) || (time === 'night' && (hour >= 18 || (hour >= 0 && hour < 5)));
      return stopOk && timeOk;
    }).sort(function (a, b) { return (a.price_usd == null ? Infinity : a.price_usd) - (b.price_usd == null ? Infinity : b.price_usd); });
  }
  /** De la lista ordenada por precio, se queda con la opción más barata y, si existe,
   * una segunda con una diferencia relevante de precio, cabina u horario. Evita
   * abrumar con una lista larga de tarjetas casi idénticas por tramo. */
  function pickTopFlightOffers(offers) {
    if (!offers.length) return offers;
    var primary = offers[0];
    var second = null;
    for (var i = 1; i < offers.length; i++) {
      var candidate = offers[i];
      var bothPriced = primary.price_usd != null && candidate.price_usd != null;
      var priceDiff = bothPriced ? Math.abs(candidate.price_usd - primary.price_usd) : 0;
      var priceRatio = bothPriced && primary.price_usd > 0 ? priceDiff / primary.price_usd : 0;
      var differentCabin = candidate.cabin_class !== primary.cabin_class;
      var hourDiff = Math.abs(flightHour(candidate.departure) - flightHour(primary.departure));
      var differentSchedule = hourDiff >= 3;
      if (differentCabin || priceRatio >= 0.15 || (differentSchedule && priceDiff >= 40)) {
        second = candidate;
        break;
      }
    }
    return second ? [primary, second] : [primary];
  }
  function flightSummaryCard(offer) {
    // Iconos en SVG inline y no emoji: el proyecto ya usa iconos propios y los
    // emoji se veían distintos entre Android y iOS.
    var iconInfo = '<svg class="fi" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v5M10 6.3v.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    var iconSwap = '<svg class="fi" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M16 7a6.5 6.5 0 0 0-11.4-2M4 13a6.5 6.5 0 0 0 11.4 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.2 2.4v3.2h3.2M15.8 17.6v-3.2h-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // La API devuelve el precio del GRUPO, no el de una persona: la misma ruta y
    // fechas dan US$ 249 para 1 adulto y US$ 499 para 2. Se muestra de grande el
    // precio POR PASAJERO, que es como el usuario compara viajes, y el total
    // del grupo debajo, que es lo que se suma de verdad al presupuesto.
    //
    // Importante: lo que se suma al presupuesto sigue siendo el total (lo usa
    // actualizarPasajes y parts.pasajes del modelo). Esto es solo presentación.
    // Lo que no se puede es rotular el total como "por pasajero": daría un
    // número que no es el que se paga.
    var pax = (detailState && detailState.meta && Number(detailState.meta.pax)) || 1;
    var total = offer.price_usd === null ? null : Number(offer.price_usd);
    var priceText;
    var priceSub = '';
    if (total === null) {
      priceText = esc(offer.original_price + ' ' + (offer.original_currency || ''));
    } else if (pax > 1) {
      priceText = money(Math.round(total / pax));
      priceSub = '<span class="flight-summary-pax">por pasajero</span>' +
        '<span class="flight-summary-total-group">' + money(total) + ' total · ' + pax + ' viajeros</span>';
    } else {
      priceText = money(total);
      priceSub = '<span class="flight-summary-pax">1 viajero · precio total</span>';
    }
    // Fin del bloque de precio.
    var logo = offer.logo ? '<img src="' + esc(offer.logo) + '" alt="" class="flight-logo">' : '<span class="flight-logo-fallback" aria-hidden="true">✈️</span>';
    var cabin = offer.cabin_label || cabinClassLabel(offer.cabin_class);

    // La vuelta siempre va de la llegada a la salida. Los horarios no vienen en
    // la respuesta de la API, pero el sentido del viaje sí se sabe, y la línea
    // se muestra igual: omitirla hacía leer la tarjeta como un pasaje de ida.
    var backFrom = airportCode(offer.arrival_airport);
    var backTo = airportCode(offer.departure_airport);
    var backRoute = (backFrom && backFrom !== '—' ? backFrom : 'destino') + ' → ' + (backTo && backTo !== '—' ? backTo : 'origen');

    return '<div class="flight-summary-card">' +
      '<div class="flight-summary-head">' + logo + '<b>' + esc(offer.airline) + '</b>' + (cabin ? '<span class="flight-badge cabin-badge">' + esc(cabin) + '</span>' : '') + '</div>' +
      '<div class="flight-summary-line">' +
        '<span class="flight-summary-tag">Ida</span>' +
        '<span class="flight-summary-path">' + esc(routeOf(offer.outbound, offer)) + '</span>' +
        '<span class="flight-summary-when">Sale ' + esc(flightTime(offer.departure)) + ' · Llega ' + esc(flightTime(offer.arrival)) + '</span>' +
      '</div>' +
      '<div class="flight-summary-line is-muted">' +
        '<span class="flight-summary-tag">Vuelta</span>' +
        '<span class="flight-summary-path">' + esc(backRoute) + '</span>' +
        '<span class="flight-summary-when">Horarios sujetos a confirmación en el sitio oficial</span>' +
      '</div>' +
      '<div class="flight-summary-total"><span class="flight-summary-total-label">Tarifa final · Ida y vuelta</span>' +
        '<b class="flight-summary-total-value">' + priceText + '</b>' + priceSub + '</div>' +
      (offer.book_url ? '<a class="btn btn-primary flight-summary-book" href="' + esc(offer.book_url) + '" target="_blank" rel="noopener noreferrer">Reservar en Google Flights</a>' : '') +
      '<button type="button" class="flight-summary-change" data-change-flight>' + iconSwap + 'Elegir otro vuelo</button>' +
      '<p class="flight-summary-foot">' + iconInfo + '<span>Tarifa final de ida y vuelta con ' + esc(offer.airline) + '. Al hacer clic, completás la reserva de forma segura en Google Flights.</span></p>' +
      '</div>';
  }

  // "MVD → GIG" de un tramo, con los nombres de aeropuerto si el tramo existe.
  function routeOf(leg, offer) {
    var from = leg && leg.origin ? airportCode(leg.origin) : airportCode(offer && offer.departure_airport);
    var to = leg && leg.destination ? airportCode(leg.destination) : airportCode(offer && offer.arrival_airport);
    return (from || '—') + ' → ' + (to || '—');
  }
  function getFlightSelectionState() {
    if (!detailState) return null;
    if (!detailState.flightSelection) {
      // `outbound` y `done` son las dos etapas que quedan: elegir y confirmar.
      // `inbound` ya no se usa (no hay una segunda búsqueda que hacer).
      detailState.flightSelection = { stage: 'outbound', outboundId: null, inboundId: null };
    }
    return detailState.flightSelection;
  }
  // `expectedMeta` y `requestId` los pasa searchFlights y sirven para descartar
  // una respuesta que ya no corresponde a la propuesta abierta. El camino de
  // los filtros los omite a propósito: ahí la respuesta es el estado local.
  function flightResponseIsCurrent(requestId, expectedMeta) {
    return requestId === flightRequestId && !!detailState && detailState.meta === expectedMeta;
  }
  function renderFlightOffers(el, data, budget, expectedMeta, requestId) {
    if (expectedMeta && !flightResponseIsCurrent(requestId, expectedMeta)) return;
    data = data && typeof data === 'object' ? data : {};
    var style = (detailState && detailState.meta && detailState.meta.style) || data.style || S.style || 'eq';
    var offers = filterFlightOffersByCabin((Array.isArray(data.offers) ? data.offers : []).filter(isCarrascoOffer), style, data.cabin_class);
    if (!offers.length) {
      el.innerHTML = '<div class="flight-empty"><p>' + esc(data.error || 'No hay vuelos disponibles para esta búsqueda. Probá con otras fechas.') + '</p><button type="button" class="btn btn-secondary" data-retry-flight-search>Intentar de nuevo</button></div>';
      var emptySection = el.closest('.flight-search');
      if (emptySection) emptySection.removeAttribute('data-flight-requested');
      return;
    }
    var section = el.closest('.flight-search');
    if (detailState) detailState.flightOffers = offers;
    var state = getFlightSelectionState();
    var flightStep = section.getAttribute('data-flight-step') || (state && state.stage) || 'outbound';
    var stepLabel = 'Ida';
    var titleEl = section.querySelector('h2');
    var subtitleEl = section.querySelector('p');
    if (titleEl) titleEl.textContent = flightStep === 'done' ? 'Itinerario seleccionado' : 'Vuelos desde Montevideo';
    if (subtitleEl) subtitleEl.textContent = flightStep === 'done'
      ? 'Este es el itinerario que se sumó a tu presupuesto.'
      : 'Te mostramos la opción más conveniente y, si aporta algo distinto, una alternativa. El precio es de ida y vuelta.';
    var visible = filteredFlightOffers(section, offers);
    if (flightStep === 'done' && state && state.outboundId) {
      var doneOffer = visible.find(function (offer) { return String(offer.id) === String(state.outboundId); }) || offers.find(function (offer) { return String(offer.id) === String(state.outboundId); });
      if (doneOffer) {
        el.innerHTML = flightSummaryCard(doneOffer);
        if (doneOffer.price_usd !== null) actualizarPasajes(section, Number(doneOffer.price_usd), doneOffer.airline);
        return;
      }
    }
    if (flightStep === 'outbound') {
      visible = pickTopFlightOffers(visible);
      // Mientras el usuario no confirmó un itinerario, el presupuesto refleja
      // la tarifa más barata que encontró el buscador, no una estimación estática.
      //
      // Solo la PRIMERA vez que llegan las ofertas. Antes se recalculaba en
      // cada repintado, y el camino de los filtros vuelve a pintar la lista:
      // marcar "2+ escalas" (peor tarifa) hacía subir el total solo, y
      // "Directos" lo bajaba. Un control de filtro no puede cambiar el precio.
      if (state && !state.outboundId && !detailState.flightAutoPriced && visible.length && visible[0].price_usd !== null) {
        detailState.flightAutoPriced = true;
        actualizarPasajes(section, Number(visible[0].price_usd), visible[0].airline);
      }
    }
    if (!visible.length) { el.innerHTML = '<p class="flight-empty">No hay vuelos que coincidan con estos filtros.</p>'; return; }
    el.innerHTML = '<div class="flight-cards">' + visible.map(function (offer) {
      var logo = offer.logo ? '<img src="' + esc(offer.logo) + '" alt="" class="flight-logo">' : '<span class="flight-logo-fallback" aria-hidden="true">✈️</span>';
      var price = offer.price_usd === null ? esc(offer.original_price + ' ' + (offer.original_currency || '')) : money(offer.price_usd);
      var isRoundTrip = offer.trip_type === 'round_trip';
      // Solo se conoce el tramo de ida (`flights[]` trae un único segmento),
      // así que la tarjeta muestra ese. El precio que acompaña sí es el total de
      // ida y vuelta, y por eso el pie lo dice explícito.
      var displayedLeg = offer.outbound || offer;
      var originAirport = displayedLeg && displayedLeg.origin
        ? displayedLeg.origin
        : offer.departure_airport;
      var destinationAirport = displayedLeg && displayedLeg.destination
        ? displayedLeg.destination
        : offer.arrival_airport;
      var routeLabel = esc(airportCode(originAirport) || '---') + ' → ' + esc(airportCode(destinationAirport) || '---');
      var departText = flightTime((displayedLeg && displayedLeg.departure) || offer.departure);
      var arrivalText = flightTime((displayedLeg && displayedLeg.arrival) || offer.arrival);
      var primaryButtonText = isRoundTrip
        ? (flightStep === 'done' ? 'Itinerario seleccionado' : 'Sumar al presupuesto')
        : (flightStep === 'done' ? 'Vuelo seleccionado' : 'Agregar a presupuesto');
      var stageBadge = isRoundTrip
        ? '<span class="flight-badge">Ida y vuelta</span>'
        : '<span class="flight-badge">' + esc(offer.recommendation || 'Opción estratégica') + '</span>';
      var cabinBadge = '<span class="flight-badge cabin-badge">' + esc(offer.cabin_label || cabinClassLabel(offer.cabin_class)) + '</span>';
      var isSelected = !!(detailState && detailState.selectedFlightId && String(detailState.selectedFlightId) === String(offer.id));
      var priceKnown = offer.price_usd !== null && Number.isFinite(Number(offer.price_usd));
      // El vuelo NO se vende acá: SerpAPI devuelve precios de búsqueda y un
      // link, no una oferta que reserving. El botón lleva a Google Flights con
      // la búsqueda ya armada, que es donde el usuario termina comprando.
      var bookLink = offer.book_url
        ? '<a class="btn btn-secondary flight-buy-link" href="' + esc(offer.book_url) + '" target="_blank" rel="noopener noreferrer">Ver y reservar en Google Flights</a>'
        : '';
      return '<article class="flight-card within-budget' + (isSelected ? ' is-selected' : '') + '"><div class="flight-airline">' + logo + '<b>' + esc(offer.airline) + '</b>' + cabinBadge + stageBadge + '</div>' +
        '<div class="flight-route"><div><small>' + routeLabel + '</small><small>Salida · ' + esc(airportLabel(originAirport)) + '</small><b>' + esc(departText) + '</b></div><span aria-hidden="true">→</span><div><small>Llegada · ' + esc(airportLabel(destinationAirport)) + '</small><b>' + esc(arrivalText) + '</b></div>' + (isRoundTrip ? '<small class="flight-route__note">Horarios de la ida. El precio es del viaje completo.</small>' : '') + '</div>' +
        '<div class="flight-footer"><span class="flight-badge' + (offer.stops === 0 ? ' direct' : '') + '">' + (offer.stops === 0 ? 'Directo' : offer.stops + (offer.stops === 1 ? ' escala' : ' escalas')) + '</span><span class="flight-duration">' + esc(offer.duration || '') + '</span>' +
        '<div class="flight-price"><small>' + (offer.trip_type === 'round_trip' ? 'Precio final · Ida y vuelta' : 'Precio final · Solo ida') + '</small><b>' + price + '</b></div></div>' +
        '<div class="flight-card__actions"><button type="button" class="select-flight btn btn-primary"' + (priceKnown ? '' : ' disabled title="No pudimos obtener un precio en USD para esta opción."') + ' aria-pressed="' + (isSelected ? 'true' : 'false') + '" data-select-flight="' + esc(offer.id) + '" data-passenger-ids="' + esc(JSON.stringify(offer.passenger_ids || [])) + '" data-offer-price="' + esc(priceKnown ? offer.price_usd : '') + '" data-offer-currency="' + esc(offer.original_currency || 'USD') + '" data-offer-airline="' + esc(offer.airline) + '">' + (isSelected ? 'Vuelo seleccionado' : (priceKnown ? primaryButtonText : 'Sin precio en USD')) + '</button>' + bookLink + '</div></article>';
    }).join('') + '</div>';
  }
  function searchFlights(meta, section) {
    var box = section.querySelector('.flight-results');
    var budget = 0;
    if (!box || section.getAttribute('data-flight-requested') === '1') return;
    section.setAttribute('data-flight-requested', '1');
    // Identidad de esta búsqueda: si el usuario abre otra propuesta mientras
    // el buscador responde, la respuesta vieja se descarta en vez de pisar el
    // presupuesto de la nueva. Se aborta además la petición en vuelo para no
    // gastar cuota de un resultado que nadie va a ver.
    var requestId = ++flightRequestId;
    if (flightController) { try { flightController.abort(); } catch (e) { } }
    box.innerHTML = '<div class="flight-skeleton" aria-label="Buscando vuelos" role="status"><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div><span class="sr-only">Buscando tarifas actuales…</span></div>';
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    flightController = controller;
    var timeout = window.setTimeout(function () { if (controller) controller.abort(); }, 20000);
    fetch('/api/vuelos/buscar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origen: meta.origin || S.origin || 'MVD', destino: meta.dest.key, fecha_ida: meta.dep, fecha_vuelta: meta.ret, pasajeros: meta.pax, style: meta.style || S.style || 'eq' }), signal: controller ? controller.signal : undefined })
      .then(async function (response) {
        window.clearTimeout(timeout);
        var text = await response.text();
        var data = { offers: [] };
        if (text.trim()) {
          try { data = JSON.parse(text); } catch (e) { data = { offers: [], error: 'La API devolvió una respuesta inválida.' }; }
        }
        if (!response.ok && !data.error) data.error = 'No pudimos consultar vuelos ahora. Probá de nuevo en unos minutos.';
        renderFlightOffers(box, data, budget, meta, requestId);
      })
      .catch(function (e) {
        window.clearTimeout(timeout);
        if (requestId !== flightRequestId) return;
        section.removeAttribute('data-flight-requested');
        box.innerHTML = '<div class="flight-empty"><p>' + esc(e && e.name === 'AbortError' ? 'La búsqueda está tardando más de lo esperado. Podés volver a intentarlo.' : e && e.message || 'No pudimos buscar vuelos ahora.') + '</p><button type="button" class="btn btn-secondary" data-retry-flight-search>Intentar de nuevo</button></div>';
      });
  }
  function persistSelectedOffer(button) {
    if (!button || !detailState) return null;
    var offerId = button.getAttribute('data-select-flight') || button.getAttribute('data-offer-id') || '';
    var offerPrice = Number(button.getAttribute('data-offer-price') || 0) || 0;
    var offerAirline = button.getAttribute('data-offer-airline') || 'Vuelo seleccionado';
    var currency = button.getAttribute('data-offer-currency') || 'USD';
    var passengerIds = [];
    try { passengerIds = JSON.parse(button.getAttribute('data-passenger-ids') || '[]'); } catch (e) { passengerIds = []; }
    detailState.selectedFlightId = offerId;
    detailState.selectedFlight = offerAirline;
    detailState.flight = Math.round(offerPrice);
    detailState.baseFlight = detailState.flight;
    var completeOffer = Array.isArray(detailState.flightOffers) && detailState.flightOffers.find(function (offer) { return String(offer.id) === String(offerId); });
    detailState.selectedOffer = Object.assign({}, completeOffer || {}, { id: offerId, airline: offerAirline, price: offerPrice, currency: currency, passengerIds: passengerIds });
    return detailState.selectedOffer;
  }
  /* Un modal abierto a la vez, y cerrar uno se lleva a todos.

     No es arbitrario: la hoja pone
     html:has(.booking-modal:not([hidden])) body{overflow:hidden}, asi que con
     CUALQUIER .booking-modal sin [hidden] la pagina entera deja de scrollear.
     Los cinco de index.html comparten esa clase, con lo cual lo que apaga el
     scroll no es el modal que se esta viendo sino cualquiera que quede
     abierto. Si se abren dos y se cierra el de arriba, el de abajo sigue
     apretando el scroll sin que haya nada a la vista que lo explique. */
  function cerrarTodosLosModales() {
    Array.prototype.forEach.call(document.querySelectorAll('.booking-modal'), function (m) {
      m.hidden = true; m.setAttribute('aria-hidden', 'true'); m.innerHTML = '';
    });
  }
  function closeBookingForm() {
    cerrarTodosLosModales();
  }
  // Pinta la marca de destino elegido sobre las cards que ya estan en el DOM.
  // Se usa al volver del detalle, donde la grilla no se vuelve a renderizar.
  // La clave sale de data-dest-key, que se escribe al armar la card.
  function pintarDestinoSeleccionado() {
    var cards = document.querySelectorAll('#destination-results .destination-card[data-dest-key]');
    Array.prototype.forEach.call(cards, function (card) {
      card.classList.toggle('is-selected', card.getAttribute('data-dest-key') === selectedDestKey);
    });
  }
  // Misma idea que pintarDestinoSeleccionado, para las propuestas de un destino
  // (#results). El id sale de data-propuesta-card, que se escribe en el <article>
  // al armar la card, así el marcado se puede repintar sin volver a renderizar la
  // lista entera (que tira abajo los "ver desglose" abiertos y el scroll).
  //
  // El atributo NO puede ser data-propuesta-id como el del botón: el handler que
  // abre la propuesta matchea [data-propuesta-id] y, si el article lo llevara,
  // cualquier clic dentro de la card abriría el detalle en vez de elegirla.
  function pintarPropuestaSeleccionada() {
    var cards = document.querySelectorAll('#results .opt[data-propuesta-card]');
    Array.prototype.forEach.call(cards, function (card) {
      card.classList.toggle('propuesta-seleccionada', card.getAttribute('data-propuesta-card') === selectedPropuestaId);
    });
  }

  // Elegir una tarjeta sin salir de la lista. La card entera es la zona sensible:
  // el clic elige, esté donde esté. También sobre "Ver desglose", que además
  // despliega el reparto, porque elegir y mirar el reparto son el mismo gesto.
  //
  // Lo único que se excluye es "Ver propuesta": ese abre el detalle, y ahí la
  // card queda elegida igual (lo escribe handleProposalNavigation), pero la
  // navegación no se puede cancelar.
  //
  // El clic es propio y no el de "Ver propuesta" a propósito. Atado a ese botón,
  // marcar una card te sacaba de la lista y el cuadro amarillo no se veía nunca:
  // el gesto de comparar dos propuestas es mirarlas, y para eso hay que quedarse.
  function handleProposalSelect(e) {
    var card = e.target.closest && e.target.closest('#results [data-propuesta-card]');
    if (!card) return;
    if (e.target.closest('.btn-ver-propuesta, a, input, label, select, textarea')) return;
    e.preventDefault();
    e.stopPropagation();
    var id = card.getAttribute('data-propuesta-card');
    // Segundo clic en la misma la desmarca: elegir no es un estado irreversible.
    selectedPropuestaId = selectedPropuestaId === id ? null : id;
    selectedPropuestaFor = selectedPropuestaId
      ? S.dep + '|' + S.ret + '|' + S.pax + '|' + S.budget
      : null;
    pintarPropuestaSeleccionada();
  }
  function renderDestinationResults(data) {
    var el = $('#destination-results');
    // Destino que quedó abierto en la última visita. Al volver de "Volver a
    // todos los destinos" la card sigue marcada, así se ve cuál se estaba
    // mirando sin tener que acordarse. Se limpia solo si cambian los filtros,
    // porque con otros dates el destino elegido puede no ser el mismo.
    var mismatch = selectedDestKey && selectedDestFor !== (data.meta ? data.meta.dep + '|' + data.meta.ret + '|' + data.meta.pax + '|' + data.meta.budget : '');
    if (mismatch) { selectedDestKey = null; selectedDestFor = null; }
    var fits = DESTINATION_GROUPS.map(function (group) {
      var options = data.options.filter(function (option) { return group.keys.indexOf(option.dest.key) >= 0 && option.fits; });
      if (!options.length) return null;
      var best = options.slice().sort(function (a, b) { return a.total - b.total; })[0];
      return Object.assign({}, best, { dest: Object.assign({}, best.dest, { name: group.label }), featuredGroup: group.id });
    }).filter(Boolean).sort(function (a, b) { return a.total - b.total; });
    var cards = fits.map(function (option, index) {
      // Sólo las categorías con costo: una fila en US$ 0 es ruido en un
      // desglose que la persona abre para entender de dónde sale el precio.
      // El asterisco en los rubros estimados es el mismo que en la tarjeta de
      // propuestas (una sola funcion decide), para que estas dos listas no
      // expliquen lo mismo de dos maneras.
      var rubros = CATS.filter(function (c) { return Number(option.parts[c[0]]) > 0; });
      var hayEstimado = rubros.some(function (c) { return !rubroEsReal(option, c[0], data.meta); });
      var rows = rubros.map(function (c) {
        var asterisco = rubroEsReal(option, c[0], data.meta)
          ? ''
          : '<sup class="opt__est" aria-label="precio estimado" title="Precio estimado">*</sup>';
        return '<div><span>' + c[1] + '</span><b>' + moneyCero(option.parts[c[0]]) + asterisco + '</b></div>';
      }).join('');
      var notaDesglose = hayEstimado
        ? '<p class="opt__nota"><sup class="opt__est">*</sup> Precio estimado. <b>"Ver propuesta"</b> lo congela.</p>'
        : '';
      var photo = DEST_PHOTOS[option.dest.key];
      var location = [option.dest.region, option.dest.country || 'Brasil'].filter(Boolean).join(' - ');
      // Comparte la anatomía de la tarjeta de propuesta (opt__*): precio arriba
      // a la derecha, las dos acciones siempre a la vista y el desglose debajo.
      // Las dos listas de la app muestran el mismo tipo de dato y tienen que
      // leerse igual.
      var bodyId = 'destino-desglose-' + index;
      return '<article class="destination-card' + (option.fits ? ' fits' : '') + (selectedDestKey === option.dest.key ? ' is-selected' : '') + '" data-opt-card data-dest-key="' + esc(option.dest.key) + '">' +
        (photo
          ? '<div class="destination-banner destination-banner-photo"><img src="' + esc(photo) + '" alt="' + esc(option.dest.name) + '" loading="lazy"></div>'
          : '<div class="destination-banner destination-banner-' + esc(option.dest.key) + '" aria-hidden="true"><span>' + (option.dest.key === 'rio' ? '🌴' : option.dest.key === 'sao' ? '🏙️' : option.dest.key === 'igu' ? '🌊' : '☀️') + '</span></div>') +
        '<div class="destination-card-body">' +
        '<div class="opt__head destination-card-top"><div class="opt__main">' +
        '<h3>' + esc(option.dest.name) + '</h3>' +
        (location ? '<p class="destination-location">' + esc(location) + '</p>' : '') +
        '<p>' + esc(option.title.replace(/Vuelo desde Montevideo/g, 'Vuelo desde ' + originCityName(data.meta.origin))) + '. ' + esc(subtituloDe(option)) + '</p></div>' +
        '<div class="opt__price destination-total"><small>' + etiquetaTotal(data.meta.pax) + '</small><b>' + moneyCero(option.total) + '</b><span>' + moneyCero(option.pp) + ' por persona</span></div></div>' +
        '<div class="destination-card-tags"><span class="mini g">¡Entra en tu presupuesto!</span></div>' +
        '<div class="opt__actions">' +
        '<button type="button" class="opt__disclosure" data-opt-toggle aria-expanded="false" aria-controls="' + bodyId + '"><span class="opt__disclosure-text">Ver desglose</span><span class="opt__chevron" aria-hidden="true">›</span></button>' +
        '<button type="button" class="btn-ver-propuesta opt__cta" data-propuesta-dest="' + esc(option.dest.key) + '">Ver propuesta<span class="opt__arrow" aria-hidden="true">›</span></button>' +
        '</div>' +
        '<div class="opt__body" id="' + bodyId + '" hidden>' + rows + notaDesglose + '</div>' +
        '</div>' +
        '</article>';
    }).join('');
    var titleBudget = Number(data.meta.budget).toLocaleString('es-UY');
    el.innerHTML = '<section class="destination-results-section"><h2>🌍 Destinos disponibles para tu presupuesto de USD $' + titleBudget + '</h2>' +
      '<p class="sub">Estimaciones para ' + data.meta.pax + (data.meta.pax === 1 ? ' viajero' : ' viajeros') + ', ordenadas de menor a mayor costo.</p>' +
      (fits.length ? '<div class="destination-cards">' + cards + '</div>' : '<div class="notice">No encontramos destinos dentro de ese presupuesto. Probá aumentando el monto o ajustando las fechas.</div>') + '</section>';
  }
  function findDestinations() {
    var budget = S.budget;
    var el = $('#destination-results');
    if (!budget || budget < 1) { el.innerHTML = '<div class="notice">Ingresá un presupuesto máximo para buscar destinos.</div>'; return; }
    if (!S.dep || !S.ret) { el.innerHTML = '<div class="notice">Elegí las fechas de ida y vuelta antes de buscar destinos.</div>'; return; }
    massSearch = true;
    setHighlightsVisible(false);
    $('#results').innerHTML = '';
    el.innerHTML = renderLoadingState('Buscando destinos para tu presupuesto…');
    var qs = new URLSearchParams({ dep: S.dep, ret: S.ret, pax: S.pax, budget: budget, style: S.style, origin: S.origin });
    fetch('/api/cotizar-todos?' + qs.toString())
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'No pudimos buscar destinos.');
        renderDestinationResults(res.j);
      })
      .catch(function (e) { el.innerHTML = '<div class="notice">' + esc(e.message || 'No pudimos buscar destinos ahora.') + '</div>'; });
  }
  function notice(msg) { $('#results').innerHTML = '<div class="notice">' + esc(msg) + '</div>'; }
  function renderLoadingState(label) {
    var text = label || 'Buscando la mejor propuesta…';
    return '<section class="sec"><div class="loading-shell" aria-live="polite"><div class="loading-status">' + esc(text) + '</div><div class="skeleton skeleton-hero"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div><div class="skeleton-grid"><div class="skeleton-box"></div><div class="skeleton-box"></div></div><div class="skeleton-grid multi"><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div></div></div></section>';
  }

  /* ---------- pedido al servidor ---------- */
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 250); }

  function run() {
    var el = $('#results');
    if (!S.dep || !S.ret) {
      notice('Elegí las fechas de ida y vuelta para ver el costo.');
      if (pendingDestinationScroll) scrollToDestinationResults();
      return;
    }
    if (S.dest === 'todos') { return; }
    // Hay una búsqueda real en marcha: los destacados ya cumplieron su función
    // de puerta de entrada, así que se van de la vista.
    setHighlightsVisible(false);
    renderTransportSelector();
    if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    var mine = ctrl;
    el.classList.add('loading');
    el.innerHTML = renderLoadingState('Buscando ofertas para tu viaje…');
    var transportParam = S.transport === 'roadtrip' ? 'auto' : S.transport;
    var qs = new URLSearchParams({ dest: S.dest, dep: S.dep, ret: S.ret, pax: S.pax, budget: S.budget, style: S.style, transport: transportParam, origin: S.origin, subcategory: S.subcategory, second: S.second, hotel_type: S.hotelType });
    fetch('/api/cotizar?' + qs.toString(), { signal: mine.signal })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          notice(res.j.error || 'No pudimos calcular tu viaje.');
          if (pendingDestinationScroll) scrollToDestinationResults();
          return;
        }
        render(res.j);
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return;
        notice('No pudimos calcular ahora. Probá de nuevo en un momento.');
        if (pendingDestinationScroll) scrollToDestinationResults();
      })
      .then(function () { if (ctrl === mine) el.classList.remove('loading'); });
  }

  /* ---------- pantalla ---------- */
  function byId(list, id) { if (!Array.isArray(list)) return null; for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i]; return null; }
  /* La etiqueta del número grande de la card.

     El precio grande es el TOTAL del grupo y abajo va el de una persona, sin
    decirlo: "R$ 13.848" y "R$ 6.924 por persona" se leen como un número y su
     mitad, y en una lista de alternativas la confusión es entre cards. La
     tarjeta de destino ya decía "Gran total"; la de propuesta no decía nada y
     por eso una se entendía y la otra no. Las dos usan esta. */
  function etiquetaTotal(pax) {
    var n = Number(pax) || 1;
    return 'Total para ' + n + (n === 1 ? ' pasajero' : ' pasajeros');
  }

  /* El origen de la búsqueda. `detailState.meta.origin` es el que el server
     devolvió para ESTA búsqueda; `S.origin` es el del formulario y se resetea al
     abrir un viaje guardado. Dentro del detalle el que vale es el primero, así
     que el título no puede leer solo S.origin: mostraba MVD en un viaje que
     había arrancado en PDP. */
  function origenDeLaBusqueda() {
    return (detailState && detailState.meta && detailState.meta.origin) || S.origin;
  }

  function titleOf(p) {
    var originAirport = originLabel(origenDeLaBusqueda());
    var mode = p.mode === 'auto' ? 'Viaje en auto desde ' + originAirport : p.mode === 'bus' ? 'Bus semicama/cama desde ' + originAirport : 'Vuelo desde ' + originAirport;
    // El nombre del hotel sale del TIER DE LA PROPUESTA y no de hotelType. Antes
    // usaba la seleccion global y por eso una misma card decia "Hotel
    // Equilibrado" en el titulo y "Hostel u hotel simple" en el subtitulo: dos
    // Accommodation tiers distintos en dos lineas de la misma tarjeta. El
    // hotelType elegido arriba es el filtro de la busqueda, no lo que trae esta
    // propuesta.
    var hotel = alojamientoDe(p);
    return mode + ' + ' + hotel;
  }

  /* El alojamiento de una propuesta, con nombre comercial.

     `tierDesc` (lib/model.js) es el dato crudo: "Hostel u hotel simple", "Hotel 3
     estrellas", "Hotel 4 estrellas". Sirve para el modelo, no para una tarjeta: el
     primero es una categoría amplia, no un producto, y "Hotel 3 estrellas" no dice
     nada de por qué una propuesta cuesta más que la de al lado.

     El nombre tiene que ser el mismo en el título y en el subtítulo. Antes cada
     uno lo sacaba de un lado distinto y por eso se contradecían.

     OJO con `ti`: es el ÍNDICE del for de lib/model.js (`for (let t = 0; ...)`),
     no la clave. Por eso el mapa es un array y no un objeto. Y `hotelType` NO
     describe el nivel: es el filtro que eligió la persona y viene igual en las
     nueve propuestas, así que si mandara sobre el texto las tres volverían a
     decir lo mismo. Solo manda cuando es un tipo con contenido propio
     (all-inclusive, resort, boutique), donde sí cambia lo que incluye. */
  var ALOJAMIENTO_TIER = ['Alojamiento económico', 'Hotel categoría estándar', 'Hotel categoría superior'];
  var ALOJAMIENTO_TIPO = { 'all-inclusive': 'All Inclusive', resort: 'Resort', boutique: 'Hotel boutique' };
  function alojamientoDe(p) {
    if (!p) return ALOJAMIENTO_TIER[1];
    if (p.hotelType && ALOJAMIENTO_TIPO[p.hotelType]) return ALOJAMIENTO_TIPO[p.hotelType];
    if (typeof p.ti === 'number') return ALOJAMIENTO_TIER[p.ti] || ALOJAMIENTO_TIER[1];
    // Por si `ti` llegara como clave y no como índice.
    return { eco: ALOJAMIENTO_TIER[0], medio: ALOJAMIENTO_TIER[1], confort: ALOJAMIENTO_TIER[2] }[p.ti] || ALOJAMIENTO_TIER[1];
  }

  /* El trayecto del subtitulo, en una sola forma para los cinco modos.

     `dur` viene del modelo como un texto ya armado y con el modo repetido
     adentro: "unas 1 h de vuelo", "unas 6 h con escala", "unas 8 h en total",
     "unas 22 h", "unas 11 h de manejo". Al anteponerle el modo se leia "Vuelo
     unas 1 h de vuelo". Se saca la parte que el modo ya dice y se deja el dato
     comparativo: "~1 h", "~6 h con escala". */
  function trayectoDe(p) {
    var d = String((p && p.dur) || '').trim();
    if (!d) return '';
    var soloModo = /^(de vuelo|por tierra|en total|con escala|de manejo)\.?$/i;
    d = d.replace(/\s+(de vuelo|por tierra|de manejo)\.?$/i, '');
    d = d.replace(/^en total$/i, 'en total');
    var m = d.match(/(\d+)\s*h/);
    if (m) d = '~' + m[1] + ' h' + d.slice(m.index + m[0].length);
    /* "con escala" del modelo es un texto fijo por destino, no un dato del
       vuelo: salia incluso con vuelo directo. Se saca, y la condicion la pone
       la tarifa consultada (quote.transfers = cantidad de escalas). Sin tarifa
       real no se sabe, asi que no se afirma nada. */
    d = d.replace(/\s*con escala\.?$/i, '');
    if (p.quote && typeof p.quote.transfers === 'number' && /^~\d+ h$/.test(d)) {
      d += p.quote.transfers === 0 ? ' directo' : ' con escala';
    }
    if (soloModo.test(d)) d = '';
    return d;
  }

  /* Duracion estimada del transfer aeropuerto -> hotel, en horas enteras, a
     ~60 km/h (el ritmo de los datos de data/distancias-aeropuerto.json). Sale de
     los km de CS_TRANSFER_PRICES; sin km (barco, vuelo) no se inventa. */
  function transferHorasDe(p) {
    var tabla = (typeof CS_TRANSFER_PRICES !== 'undefined' && CS_TRANSFER_PRICES) ? CS_TRANSFER_PRICES[p && p.dk] : null;
    if (!tabla) return 0;
    if (tabla.modo === 'ferry') return 4;
    if (tabla.modo !== 'car' || !(tabla.km > 0)) return 0;
    return Math.max(1, Math.round(tabla.km / 60));
  }

  /* El subtitulo de la tarjeta, con la misma estructura para los tres niveles:
     [trayecto] · [traslado] · [alojamiento].

     El traslado va sin duracion a proposito: `parts.traslados` es un monto y en
     todo el modelo no existe cuando tarda el transfer del aeropuerto. Inventar
     "2 h de traslado" seria el mismo problema que marcar como real un precio
     estimado. */
  function subtituloDe(p) {
    var modo = p.mode === 'auto' ? 'Auto' : p.mode === 'bus' ? 'Bus' : p.mode === 'ferry' ? 'Ferry' : 'Vuelo';
    var trayecto = trayectoDe(p);
    var horasTransfer = transferHorasDe(p);
    var traslado = horasTransfer ? 'Transfer ~' + horasTransfer + ' h' : 'Transfer al hotel';
    var alojamiento = alojamientoDe(p);
    return [trayecto ? modo + ' ' + trayecto : modo, traslado, alojamiento].join(' · ');
  }
  /* Si un rubro de una propuesta viene de un precio real o de una estimación.

     Es la única definición del tema, y la usan las dos vistas: la pastillita
     "real"/"estimado" del desglose del detalle y el asterisco del desglose de la
     tarjeta. Tenerlas separadas era pedir que se separaran: aparecio una vez una
     pastilla que decia "estimado" al lado de un numero que ya era real, y la
     contradiccion se leia como un error de la app.

     Dos casos hacen que un rubro sea real, y ninguno viene de la lista:

     - el model's `sources`, que solo marca 'real' para `pasajes` y solo cuando
       hay tarifa de vuelo consultada (ver lib/model.js);
     - el alojamiento, cuando ya se cargaron los hoteles de Booking para estas
       fechas. Antes de cargarlos, el número es una estimación de mercado y por
       eso no cuenta. */
  function rubroEsReal(p, cat, meta) {
    if (p && p.sources && p.sources[cat] === 'real') return true;
    if (cat === 'alojamiento' && meta && meta.hotelsLoaded) return true;
    return false;
  }
  function srcTag(p, cat, live) {
    if (!live) return '';
    // Solo `pasajes` puede llegar como 'real' (ver lib/model.js). El resto de
    // categorias son estimaciones propias y se muestran como tales.
    return rubroEsReal(p, cat) ? '<span class="src real">real</span>' : '<span class="src">estimado</span>';
  }
  function costNote(cat, meta, p) {
    var city = esc(meta.dest.name);
    var localNotes = {
      buz: 'Movilidad en vans, taxis locales y caminatas.',
      rio: 'Movilidad en Uber, metro y caminatas.',
      fln: 'Movilidad en vans, taxis y caminatas.',
      sao: 'Movilidad en metro, Uber y caminatas.',
      ssa: 'Movilidad en vans, taxis y caminatas.',
      igu: 'Movilidad en taxis, vans y caminatas.',
      poa: 'Movilidad en colectivos, taxis y caminatas.',
      rec: 'Movilidad en taxis, vans y caminatas.',
      for: 'Movilidad en taxis, vans y caminatas.',
      mcz: 'Movilidad en taxis, vans y caminatas.',
      nat: 'Movilidad en taxis, vans y caminatas.',
      pip: 'Movilidad en taxis, vans y caminatas.',
      default: 'Movilidad local con transporte público y caminatas.'
    };
    var text = {
      pasajes: 'Tarifa aérea en tiempo real.',
      alojamiento: 'Estimación oficial para estadía en ' + city + '.',
      comidas: 'Valor de referencia para comer y beber en ' + city + '.',
      local: localNotes[String(meta && meta.dest && meta.dest.key ? meta.dest.key.toLowerCase() : '')] || localNotes.default,
      traslados: 'Servicio oficial Aeropuerto ⇄ Hotel.',
      auto: 'Combustible y peajes de la ruta ida y vuelta.'
    };
    return '<small class="cost-note">' + (text[cat] || 'Detalle del viaje.') + '</small>';
  }

  function getLocalTransportFromData(data) {
    if (!data) return null;
    var local = data.meta && (data.meta.localTransport || data.meta.transporteLocal) ? (data.meta.localTransport || data.meta.transporteLocal) : data.localTransport;
    if (!local || !Number(local.totalUsd) && !Number(local.total_usd)) return null;
    var total = Number(local.totalUsd || local.total_usd || 0);
    return { totalUsd: total, dailyUsd: Number(local.dailyUsd || local.daily_usd || 0), multiplier: Number(local.multiplier || 1), totalDays: Number(local.totalDays || local.total_days || 0) };
  }
  function normalizeLocalTransportInProposal(data, proposal) {
    if (!proposal || !proposal.parts) return proposal;
    var local = getLocalTransportFromData(data);
    if (!local) return proposal;
    var nextLocal = Math.round(Number(local.totalUsd) || 0);
    var previousLocal = Number(proposal.parts.local) || 0;
    var delta = nextLocal - previousLocal;
    var nextParts = Object.assign({}, proposal.parts, { local: nextLocal });
    var baselineTotal = Number(proposal.total) || 0;
    var nextTotal = Math.max(0, Math.round(baselineTotal + delta));
    var pax = Number(data && data.meta && data.meta.pax) || Number(proposal.pax) || 1;
    return Object.assign({}, proposal, { parts: nextParts, total: nextTotal, pp: Math.round(nextTotal / Math.max(1, pax)) });
  }
  function normalizeLocalTransportInList(data) {
    if (!data || !Array.isArray(data.list)) return data && data.list ? data.list : [];
    var local = getLocalTransportFromData(data);
    if (!local) return data.list;
    return data.list.map(function (proposal) { return normalizeLocalTransportInProposal(data, proposal); });
  }
  function isRoadtripDestinationAllowed(destKey) {
    var key = String(destKey || S.dest || '').toLowerCase();
    return ['rio', 'bue', 'fln', 'bcm', 'gram', 'canela', 'igu', 'poa', 'camboriu', 'bombinhas', 'rosa'].indexOf(key) >= 0;
  }
  function getAvailableTransportModes(destKey) {
    var key = String(destKey || S.dest || 'todos').toLowerCase();
    // El bus solo se ofrece donde hay empresas con horario y tarifa cargados (public/buses.js).
    var busDestinations = ['fln', 'poa'];
    var modes = [{ value: 'flight', label: 'Vuelo' }];
    if (busDestinations.indexOf(key) >= 0) modes.push({ value: 'bus', label: 'Bus' });
    if (isRoadtripDestinationAllowed(key)) modes.push({ value: 'auto', label: 'Auto / Roadtrip' });
    return modes;
  }
  function renderTransportSelector() {
    var wrap = document.getElementById('transport-selector');
    if (!wrap) return;
    var key = String(S.dest || 'todos').toLowerCase();
    var modes = getAvailableTransportModes(key);
    var current = String(S.transport || 'flight').toLowerCase();
    if (current === 'roadtrip') current = 'auto';
    if (current === 'auto' && !isRoadtripDestinationAllowed(key)) current = 'flight';
    if (!modes.some(function (mode) { return mode.value === current; })) current = modes[0].value;
    S.transport = current;
    wrap.innerHTML = modes.map(function (mode) {
      return '<button type="button" data-transport-mode="' + mode.value + '" aria-pressed="' + (mode.value === current ? 'true' : 'false') + '">' + esc(mode.label) + '</button>';
    }).join('');
  }
  /*
   * Barras del calendario de precios. `realFlight` en un punto dice que el
   * total de esa fecha viene de precios de vuelo reales y no del modelo: la
   * barra real se dibuja con otra tinta y la etiqueta lo aclara.
   *
   * La altura se normaliza contra el mínimo y el máximo del conjunto. Cuando
   * todos los totales son iguales (mx === mn) se usan alturas medias en vez de
   * dividir por cero, que devolvía NaN y dejaba las barras sin alto.
   */
  function tipsSectionHtml(data) {
    var out = '<section class="sec" data-tips-section><h2>Dónde podés ahorrar</h2><p class="sub">Comparamos fechas, rutas y alojamiento con la propuesta principal.</p><div class="panel">';
    if (data.tips && data.tips.length) {
      out += data.tips.map(function (t) {
        var title = t.title, text = t.text, btn = '';
        if (t.kind === 'fecha') {
          var n = Math.abs(t.shift);
          title = 'Salí el ' + dLong(parse(t.dep));
          text = n + (n === 1 ? ' día ' : ' días ') + (t.shift < 0 ? 'antes' : 'después') + ', con la misma cantidad de noches.';
          btn = '<button type="button" class="apply" data-shift="' + t.shift + '">Usar estas fechas</button>';
        }
        return '<div class="tip"><div class="save">−' + money(t.save) + '</div><div><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p>' + btn + '</div></div>';
      }).join('');
    } else {
      out += '<p style="margin:0">Con estas fechas y esta ruta ya estás en una muy buena combinación.</p>';
    }
    return out + '</div></section>';
  }

  /*
   * Recalcula el bloque de ahorro con la serie ya actualizada.
   *
   * El tip de "salí el día X y ahorrá $Y" sale del mínimo de la serie, así que
   * con precios reales el ahorro puede ser distinto al estimado. Dejarlo viejo
   * haría que el gráfico dijera una cosa y el tip otra.
   *
   * Se replica la regla de `tipsFor()` del modelo (umbral de US$15) para no
   * tener que volver a pedir la cotización completa por un bloque de texto.
   */
  function renderTips(data) {
    var host = document.querySelector('[data-tips-section]');
    if (!host || !data || !data.series || !data.series.length) return;
    var list = byId(normalizeLocalTransportInList(data), data.recId) || (data.list || [])[0];
    if (!list) return;
    var best = null;
    data.series.forEach(function (x) {
      if (typeof x.total !== 'number' || !isFinite(x.total)) return;
      if (!best || x.total < best.total) best = x;
    });
    var tips = [];
    if (best && best.shift !== 0 && list.total - best.total >= 15) {
      tips.push({ kind: 'fecha', save: list.total - best.total, shift: best.shift, dep: best.dep });
    }
    data.tips = tips;
    host.outerHTML = tipsSectionHtml(data);
  }

  /*
   * El punto más barato de la serie y, aparte, si la fecha elegida ES ese punto.
   *
   * Las dos cosas se usan juntas y por eso viven acá y no en la barra: cuando tu
   * fecha ya es la más barata, "Tu fecha" y "La más barata" nombran la MISMA
   * barra. Se las seguía mostrando como dos referencias y el gráfico quedaba
   * contradiciéndose: una barra amarilla con dos llaves en la leyenda y la
   * pregunta de por qué una fecha era las dos cosas.
   */
  function cheapestPoint(series) {
    var best = null;
    (Array.isArray(series) ? series : []).forEach(function (x) {
      if (typeof x.total !== 'number' || !isFinite(x.total)) return;
      if (!best || x.total < best.total) best = x;
    });
    return best;
  }
  function curIsCheapest(series) {
    var list = Array.isArray(series) ? series : [];
    var best = cheapestPoint(list);
    var cur = list.filter(function (x) { return x.shift === 0; })[0];
    return !!(cur && best && cur === best);
  }
  // La frase que avisa que no hay nada que mejorar. Va en el subtítulo del
  // gráfico, que es donde se lee antes de mirar las barras.
  function cheapestIsCurNote(series) {
    var list = Array.isArray(series) ? series : [];
    if (!curIsCheapest(list)) return '';
    return ' Tu fecha ya es la más barata de las ' + list.length + (list.length === 1 ? ' fecha comparada.' : ' fechas comparadas.');
  }
  // Leyenda del gráfico. Cuando tu fecha es la más barata queda UNA sola
  // pastilla, con el color que tiene la barra (mostaza), y no dos.
  function priceChartLegend(series, realCount) {
    var list = Array.isArray(series) ? series : [];
    var todas = list.length > 0 && realCount === list.length;
    var refs = curIsCheapest(list)
      ? '<span class="l-merged">Tu fecha: ya es la más barata</span>'
      : '<span class="l1">Tu fecha</span><span class="l2">La más barata</span>';
    return '<div class="legend" data-calendar-legend>' + refs + '<span' + (todas ? ' class="l3"' : '') + '>Otras fechas</span></div>';
  }

  function priceChartBars(series) {
    var list = Array.isArray(series) ? series : [];
    if (!list.length) return '';
    var mn = Infinity, mx = -Infinity, best = null;
    list.forEach(function (x) {
      if (typeof x.total !== 'number' || !isFinite(x.total)) return;
      if (x.total < mn) { mn = x.total; best = x; }
      if (x.total > mx) mx = x.total;
    });
    if (!isFinite(mn)) return '';
    return list.map(function (x) {
      var total = typeof x.total === 'number' && isFinite(x.total) ? x.total : mn;
      var ht = mx === mn ? 82 : 34 + 96 * ((total - mn) / (mx - mn));
      var d = parse(x.dep);
      var cls = 'bar' + (x.shift === 0 ? ' cur' : '') + (x === best ? ' best' : '') + (x.realFlight ? ' real' : ' est');
      var base = 'Salir el ' + dLong(d) + ': ' + money(total) + (x.realFlight ? ' (precio real)' : ' (estimado)');
      return '<button type="button" class="' + cls + '" data-shift="' + x.shift + '" aria-label="' + esc(base) + '">' +
        '<span class="v">' + moneySolo(total) + '</span><span class="b" style="height:' + ht.toFixed(1) + 'px"></span>' +
        '<span class="d"><b>' + d.getDate() + '</b>' + d.toLocaleDateString('es-UY', { month: 'short' }) + '</span></button>';
    }).join('');
  }

  /*
   * Pide los precios reales de las fechas vecinas y reemplaza las barras.
   *
   * Son 15 búsquedas, o sea 15 créditos, así que el pedido se hace una sola vez
   * por propuesta y nunca se reintenta solo: si falla, el gráfico se queda con
   * la estimación y el aviso lo dice. El server ya cachea por punto, así que
   * volver a esta pantalla no vuelve a cobrar.
   */
  function loadPriceCalendar(data) {
    if (!data || !data.meta || data.__calendarAsked) return;
    var meta = data.meta;
    if (!meta.dest || !meta.dep || !meta.ret || !meta.pax) return;
    data.__calendarAsked = true;

    var query = new URLSearchParams({
      dest: meta.dest.key, dep: meta.dep, ret: meta.ret,
      pax: String(meta.pax), style: meta.style || S.style || 'eq',
      origin: meta.origin || S.origin || 'MVD'
    });
    var box = document.querySelector('[data-calendar-chart]');
    if (!box) return;
    fetch('/api/vuelos/calendario?' + query.toString(), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (result) {
        // El proposal abierto puede haber cambiado mientras volaba la respuesta.
        if (lastData !== data) return;
        var puntos = result && Array.isArray(result.puntos) ? result.puntos : [];
        if (!puntos.length) return;
        var byShift = {};
        puntos.forEach(function (p) { byShift[p.shift] = p; });

        var real = 0;
        data.series = data.series.map(function (x) {
          var punto = byShift[x.shift];
          if (!punto || !punto.real || !punto.pp) return x;
          // El server ya devino el total recalculado con el vuelo real, pero el
          // navegador no confía en eso para pintar: rehace la misma cuenta.
          // Si `estFlightBase` faltara, se descarta el punto en vez de sumar un
          // vuelo sobre un total que ya lo incluía.
          if (typeof x.estFlightBase !== 'number') return x;
          var total = Math.max(1, Math.round(x.total - x.estFlightBase + punto.pp * meta.pax));
          real += 1;
          return Object.assign({}, x, { total: total, realFlight: true, flightPP: punto.pp });
        });
        if (!real) return;
        box.innerHTML = priceChartBars(data.series);
        // La leyenda se vuelve a pintar porque el cheapest puede cambiar con los
        // precios reales: si la fecha elegida era la más barata por estimación y
        // con los datos reales deja de serlo, la pastilla única tiene que volver
        // a ser dos. Con la leyenda vieja quedaba diciendo "ya es la más barata"
        // sobre un gráfico que ya mostraba otra barra amarilla.
        var legendBox = document.querySelector('[data-calendar-legend]');
        if (legendBox) legendBox.outerHTML = priceChartLegend(data.series, real);

        var note = document.querySelector('[data-calendar-note]');
        if (note) {
          note.textContent = 'Costo total en ' + monedaActiva().simbolo + ' si salís antes o después, con las mismas noches. ' +
            real + ' de ' + data.series.length + ' fechas con precio de vuelo real' +
            (real < data.series.length ? '; las demás son estimaciones.' : '.') +
            ' Tocá una barra para usarla.' + cheapestIsCurNote(data.series);
        }
        // Se redibuja el "dónde podés ahorrar" porque el ahorro depende del
        // mínimo de la serie, que con precios reales puede haber cambiado.
        renderTips(data);
      })
      .catch(function () { /* el gráfico estimado ya está en pantalla */ });
  }

  function render(data) {
    lastData = data;
    // La propuesta elegida ya no corresponde a esta búsqueda si cambiaron las
    // fechas, la cantidad de gente o el presupuesto. Se cae la marca sola, como
    // pasa con selectedDestKey: si no, el marco queda en una card que ya no es
    // la que se está mirando.
    if (selectedPropuestaId && selectedPropuestaFor !== (data.meta ? data.meta.dep + '|' + data.meta.ret + '|' + data.meta.pax + '|' + data.meta.budget : '')) {
      selectedPropuestaId = null;
      selectedPropuestaFor = null;
    }
    S.hotelType = data.meta.hotelType || S.hotelType;
    var live = data.meta.mode === 'live';
    if (!isRoadtripDestinationAllowed(data.meta.dest.key) && S.transport === 'auto') S.transport = 'flight';
    // El servidor ya devuelve, en la misma categoría elegida, todos los medios
    // de transporte reales para el destino (vuelo, bus y auto cuando aplica),
    // así que "Todas las propuestas" los compara directamente sin volver a
    // filtrarlos acá por el selector de transporte.
    var list = normalizeLocalTransportInList(data);
    var rec = byId(list, S.proposalId) || byId(list, data.recId);
    if (!rec && list.length) rec = list[0];
    // Sin propuestas no hay nada que pintar. Antes seguia adelante con `rec`
    // en undefined y reventaba mas abajo en `data.tips.length`,
    // `data.series.forEach` o `p.sources.pasajes`; ese throw caia en el catch
    // generico de run(), que muestra "No pudimos calcular ahora", o sea que
    // "no hay propuestas para estas fechas" se le comunicaba al usuario como
    // falla del servidor. Reintentaba, cobraba el mismo mensaje y se iba.
    if (!rec) {
      notice('No encontramos propuestas para estas fechas. Probá otras fechas o subí un poco el presupuesto.');
      if (pendingDestinationScroll) scrollToDestinationResults();
      return;
    }
    // Respuestas parciales: el servidor puede mandar la lista sin tips, sin
    // series o sin sources y la vista tiene que aguantarlo igual.
    if (!Array.isArray(data.tips)) data.tips = [];
    if (!Array.isArray(data.series)) data.series = [];
    if (!rec.sources) rec.sources = {};
    var dep = parse(data.meta.dep), ret = parse(data.meta.ret), pax = data.meta.pax, budget = data.meta.budget;
    var cheapest = byId(list, data.cheapestId), cozy = byId(list, data.cozyId);

    var chip = $('#chip');
    if (chip) chip.textContent = '';
    // El pie dice qué es real y qué es de referencia, rubro por rubro. Decir
    // "alojamiento, comidas, traslados y buses son valores de referencia" era
    // falso para dos de los cuatro: el alojamiento llega con tarifa de Booking
    // para tus fechas y el bus con la tarifa del operador, y los dos se pueden
    // volver a consultar. Comidas y traslados dentro del destino son lo que
    // sale del modelo de costos diarios, y eso no se puede corregir con una
    // consulta: por eso son los dos que quedan como referencia.
    $('#foot').innerHTML = (live
      ? '<p><b>Vuelos:</b> tarifa aérea real al momento de la búsqueda, por persona. Puede cambiar hasta que reserves. <b>Alojamiento, comidas, traslados y buses:</b> valores de referencia.</p>'
      : '<p><b>Estimaciones iniciales.</b> Consultá la sección de vuelos en el detalle para buscar tarifas en tiempo real. Alojamiento y buses son valores reales; comidas y traslados en destino son valores de referencia.</p>')
      + '<details class="foot-credits" data-foot-credits><summary>Créditos de las fotos</summary>' +
      '<p>Fotos de <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>, bajo licencia libre. ' +
      'Cada autor y licencia se detalle más abajo.</p><ul data-foot-credits-list></ul></details>';

    // Los créditos se cargan después de pintar para no frenar el primer render.
    cargarCreditosFotos().then(function () {
      var lista = document.querySelector('[data-foot-credits-list]');
      if (!lista) return;
      // El DOM se serializaba UNA VEZ POR CREDITO: documentElement.innerHTML
      // fuerza un recorrido completo de nodos, atributos y src de cada <img> de
      // la página, y FOTO_CREDITOS tiene 35 entradas. Eran 35 serializaciones
      // completas por cada render(), y render() corre en cada búsqueda y en
      // cada cambio de moneda. Ahora se lee una sola vez y se busca en el texto.
      var htmlPagina = document.documentElement.innerHTML;
      var usadas = Object.keys(FOTO_CREDITOS).filter(function (url) {
        return htmlPagina.indexOf(url) >= 0;
      });
      if (!usadas.length) return;
      lista.innerHTML = usadas.sort().map(function (url) {
        var c = fotoCreditosDe(url);
        return '<li>' + esc(c.autor) + ' &middot; ' + esc(c.licencia) + '</li>';
      }).join('');
    });

    var pct = Math.min(100, Math.round(rec.total / Math.max(budget, 1) * 100));
    var status = data.fits
      ? 'Entra en tu presupuesto. Te sobran ' + money(budget - rec.total) + '.'
      : 'Ninguna opción entra en ' + money(budget) + '. La más barata te deja ' + money(rec.total - budget) + ' por encima.';
    var sourceBadge = live ? 'Precios reales' : 'Precios estimados';
    var sourcePill = '<span class="tag ghost source-pill">' + esc(sourceBadge) + '</span>';

    var h = '';
    h += '<section class="sec"><div class="hero">' +
      '<div class="tags tags--main"><span class="tag">' + (data.fits ? 'La más conveniente para vos' : 'La más barata que encontramos') + '</span></div>' +
      '<div class="tags tags--meta"><span class="tag ghost">' + esc(data.meta.dest.name) + '</span>' +
      '<span class="tag ghost">' + data.meta.nights + ' noches</span>' + sourcePill + '</div>' +
      '<h3>' + esc(titleOf(rec)) + '</h3>' +
      '<p class="meta">' + dLong(dep) + ' a ' + dLong(ret) + ', ' + pax + (pax === 1 ? ' persona' : ' personas') + '. Trayecto ' + esc(trayectoDe(rec)) + '.</p>' +
      '<div class="perf"><i></i><i></i></div>' +
      '<div class="nums"><div><small>Costo total del viaje</small><span class="big">' + money(rec.total) + '</span></div>' +
      '<div><small>Por persona</small><span class="pp">' + money(rec.pp) + '</span></div></div>' +
      '<div class="budget"><div class="track"><div class="fill' + (data.fits ? '' : ' over') + '" style="width:' + pct + '%"></div></div><p>' + status + '</p></div>' +
      '</div></section>';

    var activeCats = CATS.filter(function (c) { return Number(rec.parts[c[0]]) > 0; });
    var stack = activeCats.map(function (c) { return '<span style="width:' + (rec.parts[c[0]] / rec.total * 100) + '%;background:var(' + c[2] + ')"></span>'; }).join('');
    var leg = activeCats.map(function (c) {
      var v = rec.parts[c[0]];
      return '<div><i style="background:var(' + c[2] + ')"></i><span>' + c[1] + '<em>' + Math.round(v / rec.total * 100) + '%</em>' + srcTag(rec, c[0], live) + costNote(c[0], data.meta, rec) + '</span><b>' + money(v) + '</b></div>';
    }).join('');
    var breakdownSection = '<section class="sec"><h2>A dónde se va la plata</h2><p class="sub">El costo real incluye mucho más que el pasaje.</p>' +
      '<div class="panel"><div class="stack" role="img" aria-label="Distribución del costo">' + stack + '</div><div class="leg">' + leg + '</div></div></section>';

    h += tipsSectionHtml(data);

    // ---- "Mismo viaje, otra fecha"
    // Las barras arrancan estimadas (así se ven al instante) y se reemplazan por
    // precios reales cuando vuelve /api/vuelos/calendario. Se distinguen con
    // `realFlight`: una barra real sin marca sería una promesa que la app no
    // puede cumplir, y el gráfico dice textualmente que es una estimación.
    var calendarBox = '<div class="chart" data-calendar-chart>' + priceChartBars(data.series) + '</div>';
    var realCount = data.series.filter(function (x) { return x.realFlight; }).length;
    h += '<section class="sec"><h2>Mismo viaje, otra fecha</h2><p class="sub" data-calendar-note>Costo total en ' + esc(monedaActiva().simbolo) + ' si salís antes o después, con las mismas noches. Tocá una barra para usarla.' + esc(cheapestIsCurNote(data.series)) + '</p>' +
      '<div class="panel">' + calendarBox +
      priceChartLegend(data.series, realCount) + '</div></section>';

    // La tarjeta tiene dos acciones y dos superficies distintas: "Ver propuesta"
    // abre el detalle completo y "Ver desglose" despliega el reparto por categoría
    // sin salir de la lista. Antes la única pista era que toda la tarjeta fuera
    // clickeable: en escritorio se adivinaba, en el celu no se veía, y el botón
    // real ("Ver propuesta") sólo aparecía después de desplegar la tarjeta.
    // `otraGama` ya no dibuja nada: antes ponía una pastilla "Otro nivel" en las
    // cards que entraron por la regla de "la más barata" o por la del 20%. No
    // decía nada que las otras no dijeran y comía el ancho de la fila de tags.
    var proposalMarkup = function (p, index, otraGama) {
      var tags = '';
      if (p.id === rec.id) tags += '<span class="mini y">Recomendada</span>';
      if (cheapest && p.id === cheapest.id) tags += '<span class="mini">Más barata</span>';
      if (cozy && p.id === cozy.id) tags += '<span class="mini">Más cómoda</span>';
      if (live && p.sources && p.sources.pasajes === 'real') tags += '<span class="mini g">Pasaje real</span>';
      tags += p.total <= budget ? '<span class="mini g">Entra en tu presupuesto</span>' : '<span class="mini r">Se pasa por ' + money(p.total - budget) + '</span>';
      /* El desglose de la tarjeta marca con un asterisco lo que NO es un precio
         real, y abajo dice qué hacer para ver los que sí lo son.

         El asterisco va pegado a la cifra y no en el nombre del rubro a
         propósito: el nombre se lee de un vistazo y es lo que la persona compara
         entre tarjetas, mientras que el asterisco tiene que pegarse al número
         que es el que se está mirando. Con un asterisco por rubro, la primera
         fila con * invita a desconfiar de las cinco que vienen abajo.

         La nota va siempre que haya un solo asterisco, y no en todas las cards:
         si no hay nada estimado no hay nada que aclarar. `rubroEsReal()` es la
         misma función que decide la pastillita "real/estimado" del detalle, así
         que las dos vistas no pueden contradecirse. */
      var rubros = CATS.filter(function (c) { return Number(p.parts[c[0]]) > 0; });
      var hayEstimado = rubros.some(function (c) { return !rubroEsReal(p, c[0], data.meta); });
      var rows = rubros.map(function (c) {
        var asterisco = rubroEsReal(p, c[0], data.meta)
          ? ''
          : '<sup class="opt__est" aria-label="precio estimado" title="Precio estimado">*</sup>';
        return '<div><span>' + c[1] + '</span><b>' + moneyCero(p.parts[c[0]]) + asterisco + '</b></div>';
      }).join('');
      var nota = hayEstimado
        ? '<p class="opt__nota"><sup class="opt__est">*</sup> Precio estimado. <b>"Ver propuesta"</b> lo congela.</p>'
        : '';
      var bodyId = 'opt-desglose-' + index;
      return '<article class="opt' + (p.id === selectedPropuestaId ? ' propuesta-seleccionada' : '') + '" data-opt-card data-propuesta-card="' + esc(p.id) + '">' +
        '<div class="opt__head">' +
          '<div class="opt__main"><div class="t">' + esc(titleOf(p)) + '</div><div class="s">' + esc(subtituloDe(p)) + '</div><div class="tg">' + tags + '</div></div>' +
          '<div class="opt__price"><small>' + etiquetaTotal(data.meta.pax) + '</small><b>' + moneyCero(p.total) + '</b><span>' + moneyCero(p.pp) + ' por persona</span></div>' +
        '</div>' +
        '<div class="opt__actions">' +
          '<button type="button" class="opt__disclosure" data-opt-toggle aria-expanded="false" aria-controls="' + bodyId + '"><span class="opt__disclosure-text">Ver desglose</span><span class="opt__chevron" aria-hidden="true">›</span></button>' +
          '<button type="button" class="btn-ver-propuesta opt__cta" data-propuesta-id="' + esc(p.id) + '">Ver propuesta<span class="opt__arrow" aria-hidden="true">›</span></button>' +
        '</div>' +
        '<div class="opt__body" id="' + bodyId + '" hidden>' + rows + nota + '</div>' +
      '</article>';
    };
    /* Qué propuestas se muestran y con qué título.

       El filtro de siempre fue "misma gama que la recomendada", y con eso passaban
       dos cosas malas. La primera es que el subtítulo hablaba de "nivel de
       alojamiento", una palabra que no aparece en ningún control de la pantalla:
       arriba se elige un TIPO DE VIAJE, no un nivel de hotel. Decir una cosa y
       ofrecer otra es la razón de que el texto no significara nada.

       La segunda es que el filtro era demasiado cerrado. Si estabas en
       Equilibrado y el server te devolvía una sola propuesta de ese nivel, la
       sección se quedaba con una sola card y no decías ni que ya estaba
       optimizada ni que no había nada mejor. Con una lista de una, "Todas las
       propuestas" no es información: es ruido.

       Por eso ahora, además del mismo nivel, entran DOS cosas:

       1. la propuesta más barata de todas, siempre. Si estás en Equilibrado y
          solo hay una en ese nivel, igual querés ver la más barata: es la
          respuesta a la pregunta que viniste a hacer.
       2. las que se pasan por menos del 20% del presupuesto. Son las que
          estabas a punto de comprar y el filtro por nivel te las ocultaba.

       Con una sola propuesta la sección se llama "Tu propuesta" y dice que ya
       está optimizada, porque con una card el título "Todas las propuestas"
       promete una comparación que no existe. */
    var allProposals = list.concat(Array.isArray(data.alternatives) ? data.alternatives : []).filter(function (proposal, index, proposals) {
      return proposal.mode !== 'avion_ba' && proposals.findIndex(function (candidate) { return candidate.id === proposal.id; }) === index;
    });
    var conPrecio = allProposals.filter(function (p) { return typeof p.total === 'number' && isFinite(p.total); });
    var masBarata = conPrecio.slice().sort(function (a, b) { return a.total - b.total; })[0] || null;
    // 20% del presupuesto, o 0 si no hay presupuesto puesto: con tope 0 la regla
    // no deja pasar nada y el filtro queda en "mismo nivel", que es el
    // comportamiento de antes y no inventa un margen sobre un número que no está.
    var topeCerca = Number(budget) > 0 ? Number(budget) * 1.2 : 0;
    var sameTier = conPrecio.filter(function (p) {
      if (p.ti === rec.ti) return true;
      if (masBarata && p.id === masBarata.id) return true;
      return topeCerca > 0 && p.total <= topeCerca;
    }).sort(function (a, b) { return a.total - b.total; });
    var estilo = nombreEstiloViaje(data.meta.style || S.style);
    var verDetalle = 'Tocá <b>Ver propuesta</b> para abrir el detalle o <b>Ver desglose</b> para ver cómo se arma el precio.';
    var opts = sameTier.map(function (p) { return proposalMarkup(p, sameTier.indexOf(p), p.ti !== rec.ti); }).join('');
    if (sameTier.length <= 1) {
      h += '<section class="sec"><div class="sec__head"><h2>Tu propuesta</h2></div>' +
        '<p class="sub">Esta propuesta ya está optimizada: es la más barata que encontramos para estas fechas y no hay una alternativa más barata. ' + verDetalle + '</p>' +
        '<div class="opts">' + opts + '</div></section>';
    } else {
      // El texto del encabezado es UNO para las dos variantes. Decía "del mismo
      // nivel que el tipo de viaje que elegiste" followed de una frase sobre el
      // orden, y con el orden dentro de la misma oración se leía como una sola
      // frase larga. La regla del filtro (mismo tier, más la más barata, más lo
      // que cae cerca del presupuesto) ya la dice el código de arriba; acá alcanza
      // con decir qué se muestra y cómo viene.
      h += '<section class="sec"><div class="sec__head"><h2>Todas las propuestas</h2></div>' +
        '<p class="sub">Mostramos alternativas <b>' + esc(estilo) + '</b> adaptadas a tu presupuesto, ordenadas de menor a mayor precio.</p>' +
        '<div class="opts">' + opts + '</div></section>';
    }

    var el = $('#results');
    el.innerHTML = h;
    var ch = el.querySelector('.chart'), cu = el.querySelector('.bar.cur');
    if (ch && cu) ch.scrollLeft = cu.offsetLeft - ch.clientWidth / 2 + cu.offsetWidth / 2;
    if (pendingDestinationScroll) window.setTimeout(scrollToDestinationResults, 50);
    // Los precios reales de las fechas vecinas llegan después de que la propuesta
    // ya está en pantalla: son 15 búsquedas y no tiene sentido hacerlas esperar
    // al resultado principal, que es lo que el usuario vino a ver.
    loadPriceCalendar(data);
    // Le avisa a pwa.js que ya hay algo que ver. El prompt de instalación se
    // pide por intención, no por tiempo: hasta acá no tenía sentido ofrecerlo.
    try { window.dispatchEvent(new CustomEvent('cuantosale:resultados')); } catch (e) { /* sin CustomEvent */ }
  }
  function scrollToDestinationResults() {
    var results = $('#results');
    pendingDestinationScroll = false;
    if (results) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function multiStayMarkup(state) {
    var trip = state && state.multiStay;
    if (!trip || !trip.stays || trip.stays.length !== 2) return '';
    var nights = Math.max(1, Number(trip.totalNights) || 1);
    var firstNights = Math.max(1, Math.min(nights - 1, Number(trip.firstNights) || Math.floor(nights / 2)));
    var secondNights = nights - firstNights;
    var first = trip.stays[0], second = trip.stays[1];
    // Los nombres de las paradas salen de trip.stays, no de una lista escrita a
    // mano. Estaba fija en "Búzios → Arraial do Cabo" porque el único par que
    // existía era ese; con los 88 la frase de logística le decía a alguien que
    // venía a Paraty + Ilha Grande que su vuelo iba a Búzios y Arraial.
    /* La frase nombra el aeropuerto por el que se entra y se sale, y NO promete
       los transfers. Antes decia "Incluye los transfers desde y hacia el
       aeropuerto", y con dos paradas eso era falso por partida doble: el
       traslado a la segunda parada no sale del aeropuerto sino del hotel de la
       primera, y el de la vuelta se hire aparte. Peor: se eligio la modalidad
       del primer tramo, asi que el total de traslados cambia segun lo que se
       toque en la seccion, y prometer un total cerrado en un cartel es mentir
       mientras esa seccion siga abierta.

       Lo que si es real y no cambia: el vuelo entra y sale por ese aeropuerto. */
    var logistics = 'Vuelo ida y vuelta por ' + trip.hub.name + ' (' + trip.hub.iata + '). El transfer a cada parada se elige y se coordina aparte.';
    return '<section class="multistay-panel" aria-labelledby="multistay-title" data-multistay-panel>' +
      '<div class="multistay-panel__head"><div><span class="multistay-panel__eyebrow">ITINERARIO MULTIDESTINO</span><h2 id="multistay-title">Distribuí tus noches</h2></div><span class="multistay-panel__total">' + nights + (nights === 1 ? ' noche' : ' noches') + ' en total</span></div>' +
      (nights > 1 ? '<div class="multistay-panel__stays"><div class="multistay-panel__stay"><strong>' + esc(first.name) + '</strong><span><b data-multistay-first-nights>' + firstNights + '</b> ' + (firstNights === 1 ? 'noche' : 'noches') + '</span><small data-multistay-first-cost>' + money(0) + ' alojamiento estimado</small></div>' +
      '<label class="multistay-panel__slider"><span class="sr-only">Noches en ' + esc(first.name) + '</span><input type="range" min="1" max="' + (nights - 1) + '" step="1" value="' + firstNights + '" data-multistay-split aria-valuetext="' + firstNights + ' noches en ' + esc(first.name) + ', ' + secondNights + ' en ' + esc(second.name) + '"></label>' +
      '<div class="multistay-panel__stay"><strong>' + esc(second.name) + '</strong><span><b data-multistay-second-nights>' + secondNights + '</b> ' + (secondNights === 1 ? 'noche' : 'noches') + '</span><small data-multistay-second-cost>' + money(0) + ' alojamiento estimado</small></div></div>' : '<p class="multistay-panel__hint">Para dividir la estadía entre localidades necesitás al menos 2 noches.</p>') +
      '<p class="multistay-panel__logistics">✈️ ' + esc(logistics) + '</p><p class="multistay-panel__hint">El traslado entre las dos paradas se estima con la distancia entre ellas. El alojamiento pasa a ser real cuando elegís un hotel en cada parada.</p></section>';
  }
  function updateMultiStayPricing() {
    if (!detailState || !detailState.multiStay) return;
    var trip = detailState.multiStay;
    var totalNights = Math.max(1, Number(trip.totalNights) || 1);
    var firstNights = totalNights > 1 ? Math.max(1, Math.min(totalNights - 1, Number(trip.firstNights) || 1)) : totalNights;
    var secondNights = totalNights - firstNights;
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var rooms = Math.ceil(pax / 2);
    var typeFactor = hotelTypeFactor(detailState.meta.hotelType);
    var firstStayCost;
    // Costo de cada parada. Si hay hotel elegido para ESA parada, se prorratea el
    // total de Booking por la proporcion de noches que cae ahi. Si no, se usa el
    // promedio del modelo para las noches de esa parada.
    //
    // Antes la segunda parada no tenia rama propia: caia siempre en el promedio,
    // por mas que la seccion de hoteles mostrara solo los de la primera. Era un
    // numero sin origen que se sumaba al total junto a un hotel real.
    var rates1 = trip.stays[0].nightlyRates || [];
    var rates2 = trip.stays[1].nightlyRates || [];
    var elegido1 = staySelectedTotal(1), elegido2 = staySelectedTotal(2);
    firstStayCost = elegido1 != null
      ? Math.round(elegido1 * firstNights / totalNights)
      : Math.round(rates1.slice(0, firstNights).reduce(function (sum, rate) { return sum + Number(rate || 0); }, 0) * rooms * typeFactor);
    var secondStayCost = elegido2 != null
      ? Math.round(elegido2 * secondNights / totalNights)
      : Math.round(rates2.slice(firstNights, totalNights).reduce(function (sum, rate) { return sum + Number(rate || 0); }, 0) * rooms * typeFactor);
    trip.firstNights = firstNights;
    trip.firstStayCost = firstStayCost;
    trip.secondStayCost = secondStayCost;
    // Un alojamiento deseleccionado a propósito se mantiene en 0 aunque se mueva
    // el splitter de noches: el 0 es una decisión, no un dato sin cargar.
    detailState.hotel = detailState.selectedHotel === false ? 0 : firstStayCost + secondStayCost;
    var firstCount = document.querySelector('[data-multistay-first-nights]');
    var secondCount = document.querySelector('[data-multistay-second-nights]');
    var firstCost = document.querySelector('[data-multistay-first-cost]');
    var secondCost = document.querySelector('[data-multistay-second-cost]');
    var slider = document.querySelector('[data-multistay-split]');
    if (firstCount) firstCount.textContent = String(firstNights);
    if (secondCount) secondCount.textContent = String(secondNights);
    // La etiqueta del costo cambia segun de donde sale el numero. Decir
    // "alojamiento estimado" al lado de un hotel real de Booking es mentir por
    // omision, y era lo que pasaba con la segunda parada: era siempre estimado y
    // decia lo mismo que la primera, que si era real.
    if (firstCost) firstCost.textContent = money(firstStayCost) + (elegido1 != null ? ' elegido en Booking' : ' alojamiento estimado');
    if (secondCost) secondCost.textContent = money(secondStayCost) + (elegido2 != null ? ' elegido en Booking' : ' alojamiento estimado');
    if (slider) slider.setAttribute('aria-valuetext', firstNights + ' noches en ' + trip.stays[0].name + ', ' + secondNights + ' en ' + trip.stays[1].name);
  }
  function changeHotelType(type) {
    if (!detailState || !detailState.meta || !HOTEL_TYPE_LABELS[type]) return;
    var current = detailState.meta.hotelType;
    if (current === type) return;
    detailState.meta.hotelType = type;
    detailState.hotelType = type;
    detailState.meta.hotelsLoaded = false;
    detailState.meta.hotels = [];
    detailState.meta.hotelBudgetPerNight = null;
    detailState.selectedHotelName = 'Estimación · Hotel ' + HOTEL_TYPE_LABELS[type];
    // Cambiar el tipo vuelve a cargar los hoteles con el recomendado elegido, así
    // que acá sí hay una selección (la anterior deseleccionada se descarta).
    detailState.selectedHotel = true;
    detailState.selectedHotelTotal = null;
    if (detailState.multiStay) {
      // Las dos paradas: el tipo de alojamiento es uno solo, asi que cambiarlo
      // invalida los dos hoteles elegidos. Dejar el de la primera metía un
      // "boutique" de Rio junto a la lista ya filtrada de la segunda, que puede
      // no tener ninguno.
      detailState.multiStay.selectedStayTotals = {};
      updateMultiStayPricing();
    } else {
      detailState.hotel = Math.round(detailState.originalHotelEstimate * hotelTypeFactor(type));
    }
    detailState.parts.comidas = type === 'all-inclusive' ? 0 : detailState.originalMealEstimate;
    detailState.foodPerDayTouched = type === 'all-inclusive';
    detailState.foodPerDay = type === 'all-inclusive' ? 0 : (detailState.originalMealEstimate / Math.max(1, Number(detailState.meta.nights) * Number(detailState.meta.pax)));
    // Cambiar el tipo de alojamiento no deshace una deselección: si la persona
    // saqué comidas del presupuesto, siguen fuera hasta que elija una opción.
    if (detailState.foodBudgetMode === 'none') { detailState.parts.comidas = 0; detailState.foodPerDay = 0; detailState.foodPerDayTouched = true; }
    S.hotelType = type;
    if (detailState.proposal) {
      var title = document.querySelector('.detail-summary h2');
      if (title) title.textContent = titleOf(detailState.proposal);
    }
    var hotelSection = document.querySelector('[data-hotels-block]');
    if (hotelSection) hotelSection.outerHTML = hotelLoading(detailState.meta);
    recalcularTotalViaje();
    loadHotelRecommendations(detailState.meta, detailState.hotel);
  }
  /* El filtro de disponibilidad. A diferencia del de tipo, NO invalida los
     hoteles ni vuelve a pedir nada: la lista con los reales y los estimados ya
     está en `meta.hotels`, y separarla es una cuestión de pintado.

     Lo que sí hay que hacer es elegir de nuevo. Filtrar deja la lista más
     corta, así que el hotel que estaba marcado puede quedar fuera y el radio
     marcado desaparecería: el total del presupuesto seguiría usando ese hotel
     mientras la pantalla no muestra ninguna ficha elegida, que es el peor
     estado posible (se está cobrando algo que no se ve). Por eso, si el
     elegido ya no está en la lista, se marca el primero que quede, como hace
     la carga inicial. Si la lista queda vacía no se toca nada: la selección
     anterior sigue mandando y el estado vacío de la sección lo dice.

     Se repinta la sección entera en vez de esconder y mostrar cards: es lo que
     ya hacen el resto de los cambios de la lista, y el marcado del hotel elegido
     depende del DOM final. */
  function showProposalView(proposal, data) {
    var view = $('#vista-detalle'), content = $('#detalle-contenido');
    var isRoadtrip = proposal.mode === 'auto';
    var selectedTransportMode = proposal.mode === 'auto' ? 'auto' : proposal.mode === 'bus' ? 'bus' : 'flight';
    proposal = normalizeLocalTransportInProposal(data, proposal);
    var selectedHotelTotal = hotelTotalForRate(data.meta, proposal.parts.alojamiento, 1);
    // El checkout arranca de cero con cada viaje: los datos del viajero que
    // quedaron del pedido anterior no son del viaje nuevo, y una referencia
    // vieja pegada al mensaje de WhatsApp seria el error mas dificil de ver.
    checkoutState = { step: 0, form: {}, payment: '' };
    detailState = { parts: Object.assign({}, proposal.parts), flight: proposal.parts.pasajes, baseFlight: proposal.parts.pasajes, baseTraslados: proposal.parts.traslados, hotel: selectedHotelTotal, toursTotal: 0, selectedTours: [], auto: isRoadtrip ? Number(proposal.parts.auto) : 0, transfer: 0, transportMode: selectedTransportMode, hotelType: data.meta.hotelType || S.hotelType, originalHotelEstimate: Number(proposal.baseHotelCost) || Number(proposal.parts.alojamiento) || 0, originalMealEstimate: Number(proposal.baseMealCost) || Number(proposal.parts.comidas) || 0, proposal: proposal, roadtrip: proposal.roadtrip || data.meta.roadtrip, roadtripVehicleType: 'combustion', roadtripEv: {}, meta: data.meta, selectedFlightId: '', selectedFlight: '', selectedOffer: null, selectedHotel: true, selectedHotelTotal: selectedHotelTotal, selectedHotelName: 'Hotel recomendado', localBudgetMode: 'preset', foodBudgetMode: 'preset', localCustomValue: null, foodCustomValue: null, flightAutoPriced: false };
    /* El compartido arranca elegido.

       El total del traslado ya lo tiene el modelo como estimacion, y desde que
       trasladoDelViaje() REEMPLAZA esa estimacion por el precio de la tabla
       cuando hay modalidad, elegir el compartido no pisa el total: lo cambia por
       el dato real, que es mas barato en la mayoria de los destinos.

       Se elige el compartido y no el privado porque el privado no escala con la
       cantidad de gente: se cobra por vehiculo, asi que para cuatro personas sale
       mucho mas caro que cuatro pasajes de van. Arrancar en el mas caro seria
       arrancar por la opcion que casi nadie quiere.

       A un destino sin van compartida (una isla) NO se preselecciona nada:
       getSelectedTransferAmount() devuelve 0 para 'shared' si soloPrivado, y
       quedaria una card marcada con un precio de 0. */
    if (selectedTransportMode === 'flight' && detailState) {
      var preciosTransfer = transferPreciosDe(data.meta);
      if (!preciosTransfer.soloPrivado && preciosTransfer.compartido > 0 && !tramoEsCercano(preciosTransfer, pax)) {
        /* Los DOS tramos arrancan en compartido. Es lo que hace que el total los
           incluya sin que la persona tenga que decidir nada, y es coherente con
           la nota "Incluido para tu comodidad" de cada tarjeta.

           EXCEPTO en un tramo corto. Si el sistema le esta diciendo "acá te
           conviene un Uber", dejarle preseleccionado un transfer seria
           contradecirse en la misma pantalla: la card amarilla y el consejo
           "--Para este tramo estás cerquísima--" diciendo cosas opuestas. En ese
           caso no se preselecciona nada y el total no suma el traslado, que es
           lo que el consejo invite a hacer.

           ESTO DUPLICA EL COSTO DEL TRANSFER cuando aplica: la tabla es "solo
           ida" y ahora se cobran las dos. data/transfer-precios.json decia, en
           _meta, que la app solo sumaba el de llegada; esa decision quedo
           escrita y ahora es al reves. Es una decision de negocio, no un
           descuido. */
        // Sin precarga: el traslado suma cuando la persona elige una modalidad
        // (ver trasladoElegido()). Antes arrancaba en 'shared' en los dos tramos.
      }
    }
    var nights = Math.max(1, Number(data.meta.nights) || 1);
    var pax = Math.max(1, Number(data.meta.pax) || 1);
    if (data.meta.multiStay && data.meta.multiStay.stays && data.meta.multiStay.stays.length === 2) {
      detailState.multiStay = Object.assign({}, data.meta.multiStay, { totalNights: nights, firstNights: Math.max(1, Math.floor(nights / 2)) });
      detailState.baseTraslados = Number(proposal.parts.traslados) || 0;
      detailState.parts.traslados = detailState.baseTraslados + (Number(detailState.multiStay.transferBetweenUsd) || 0);
      updateMultiStayPricing();
    }
    /* Perfil del viaje -> nivel de los costos diarios. Es el mismo mapeo que usa
       lib/model.js calc() para armar parts.comidas y parts.local (ti 0/1/2), asi
       que la caja marcada coincide con el monto que ya esta en el total. */
    var PRESET_POR_NIVEL = { food: ['casual', 'moderado', 'gourmet'], local: ['econ', 'medio', 'confort'] };
    var nivelPerfil = Math.min(2, Math.max(0, Number(proposal.ti)));
    if (Number.isFinite(nivelPerfil) && proposal.ti != null) {
      detailState.foodPresetKey = PRESET_POR_NIVEL.food[nivelPerfil];
      detailState.localPresetKey = PRESET_POR_NIVEL.local[nivelPerfil];
    }
    detailState.foodPerDay = Number((Number(detailState.parts.comidas) / Math.max(1, nights * pax)).toFixed(2)) || 0;
    detailState.localPerDay = Number((Number(detailState.parts.local) / Math.max(1, nights * pax)).toFixed(2)) || 0;
    data.meta.officialTransfer = data.meta.officialTransfer || { compartido: 0, privado: 0, personas: 0, appRideUsd: null };
    // El estado de transporte se fija acá, antes de construir el markup, para
    // que el flujo se pinte una sola vez con los valores definitivos. Antes se
    // armaba, se insertaba y enseguida se sobreescribía con un segundo
    // transportFlow() de contenido idéntico.
    if (selectedTransportMode === 'auto' || selectedTransportMode === 'flight') syncTransportState(isRoadtrip);
    var renderSafe = function (fn, fallback) { try { return fn(); } catch (error) { console.error('Error al renderizar detalle', error); return fallback; } };
    var breakdownMarkup = renderSafe(function () { return proposalBreakdownMarkup(detailState); }, '<section class="proposal-breakdown"><h2>Desglose del viaje</h2></section>');
    var dailyBudgetMarkup = renderSafe(function () { return dailyBudgetControls(); }, '');
    var transportMarkup = renderSafe(function () { return transportFlow(detailState.meta, detailState.flight, selectedTransportMode); }, '');
    var hotelsMarkup = renderSafe(function () { return data.meta.hotelsLoaded ? hotelOptions(data.meta, proposal.parts.alojamiento) : hotelLoading(data.meta); }, '<section class="hotel-options">Cargando alojamientos…</section>');
    var toursMarkup = renderSafe(function () { return localToursMarkup(data.meta); }, '');
    // La Guia Secreta no se pinta todavia: depende de si el server nos abre la
    // puerta, y eso no se sabe hasta que responde /api/guia. Se pinta sola
    // cuando llega (pintarGuiaEnDetalle). El fallback del renderSafe era un
    // "Recomendaciones" vacio que ademas mentia: sin guia no hay nada que
    // recomendar.
    var foodMarkup = renderSafe(function () { return guiaSecreta(data.meta, guiaYaDe(data.meta.dest.key)); }, '');
    content.innerHTML = '<div class="detail-layout"><div class="detail-main">' +
      '<section class="detail-summary"><span class="tag">Propuesta seleccionada</span><h2>' + esc(titleOf(proposal)) + '</h2><p><b class="detail-summary__destino">' + esc(data.meta.dest.name) + '</b>' + (data.meta.subcategory ? ' · ' + esc(data.meta.subcategory) : '') + ' · ' + data.meta.nights + (data.meta.nights === 1 ? ' noche' : ' noches') + '</p><strong data-detail-total>' + money(proposal.total) + '</strong><span class="detail-summary__per-person" data-detail-total-pp>' + money(Math.round(proposal.total / pax)) + ' por persona</span></section>' +
      '<nav class="steps" data-steps aria-label="Pasos del presupuesto">' + renderSafe(function () { return pasosMarkup(); }, '') + '</nav>' +
      renderSafe(function () { return multiStayMarkup(detailState); }, '') +
      '<div data-transport-flow>' + transportMarkup + '</div>' +
      hotelsMarkup + toursMarkup + dailyBudgetMarkup +
      /* "A donde va tu plata" va ANTES de la Guia Secreta, no despues.

         Antes estaba al final de todo y el comentario de arriba explicaba por
         que: primero elegis, despues miras donde fue la plata. Ese
         razonamiento era bueno cuando la guia era un bloque de texto al final,
         y dejo de serlo cuando la guia se puso arriba por su cuenta y quedo
         siendo el bloque mas alto de la seccion: el desglose quedo debajo de
         un muro de texto, y para ver el reparto de la plata habia que
         scrollear toda la guia.

         Ademas el desglose es el bloque accionable: cada fila salta a la
         seccion donde esa plata se cambia. Va antes de la guia porque las dos
         cosas responden la misma pregunta --donde va la plata-- y el reparto
         primero: ahi estan las cuentas, y la guia dice como cuidarlas. */
      breakdownMarkup + foodMarkup +
      '</div></div>';
    updateMultiStayPricing();
    $('#btn-volver').textContent = massSearch ? '⬅ Volver a todos los destinos' : '⬅ Volver a las propuestas';
    // El estado ya está fijado arriba: acá solo queda reflejar el traslado
    // oficial y pintar los totales UNA vez. Antes, actualizarTransporte()
    // re-armaba el flujo y disparaba un segundo renderTripSummary() encima del
    // primero, y renderTripSummary() se volvía a llamar acá: tres breakdowns y
    // tres paneles "Mi Viaje" para abrir una propuesta.
    sincronizarTrasladoOficial();
    $('#vista-principal').classList.add('oculto');
    view.classList.remove('oculto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Hoteles y vuelos no dependen uno del otro, así que van juntos. Antes los
    // hoteles iban por requestIdleCallback con timeout de 1.2s (que bajo presión
    // de main thread los difería hasta ese límite) y los vuelos 80ms después por
    // setTimeout: en la práctica los vuelos salían primero y el usuario veía las
    // tarifas aereas antes de que los hoteles empezaran siquiera a cargar. El
    // proposal se armaba en dos fases visibles en vez de una.
    var liveFlightSection = content.querySelector('.flight-search');
    var pending = [];
    if (!data.meta.hotelsLoaded) {
      pending.push(function () { return loadHotelRecommendations(data.meta, proposal.parts.alojamiento); });
    }
    // Las actividades van aparte de los hoteles: si vuelven, la
    // pantalla ya esta pintada con los tours locales y recien despues se
    // reemplazan por los reales.
    if (!data.meta.actividadesCargadas) {
    }
    if (detailState.transportMode === 'flight' && liveFlightSection) {
      pending.push(function () { return searchFlights(data.meta, liveFlightSection); });
    }
    if (pending.length) {
      if (typeof Promise !== 'undefined' && Promise.allSettled) {
        // allSettled y no all: que falle un proveedor no debe impedir que el
        // otro se pinte.
        Promise.allSettled(pending.map(function (run) {
          try { return run(); } catch (e) { return Promise.reject(e); }
        }));
      } else {
        pending.forEach(function (run) { try { run(); } catch (e) { /* sin soporte */ } });
      }
    }
  }

  // Resumen de vuelo real: reemplaza cualquier texto genérico del voucher.
  function getSelectedFlightSummary() {
    if (!detailState) return { airline: 'Vuelo seleccionado', summary: 'Todavía no elegiste un vuelo.' };
    var offer = getSelectedFlightOffer();
    var airline = offer && offer.airline || detailState.selectedFlight || 'Vuelo seleccionado';
    var outbound = offer && (offer.outbound || offer) || {};
    var inbound = offer && offer.inbound || {};
    var departure = outbound.departure || offer && offer.departure;
    var arrival = inbound.arrival || offer && offer.arrival || outbound.arrival;
    var origin = outbound.origin || offer && offer.departure_airport || {};
    var destination = outbound.destination || offer && offer.arrival_airport || {};
    var flightNumber = offer && (offer.flight_number || outbound.flight_number) || '';
    var inboundFlightNumber = inbound.flight_number || '';
    var numbers = flightNumber ? 'Vuelo ' + flightNumber + (inboundFlightNumber ? ' · regreso ' + inboundFlightNumber : '') : 'Número de vuelo no informado';
    var summary = numbers + ' · ' + (origin.name || origin.code || 'Origen no informado') + ' → ' + (destination.name || destination.code || 'Destino no informado') + ' · salida ' + formatFlightDateTime(departure) + ' · llegada ' + formatFlightDateTime(arrival);
    return { airline: airline, summary: summary, departureText: formatFlightDateTime(departure), arrivalText: formatFlightDateTime(arrival), route: ' · ' + airportCode(origin) + ' → ' + airportCode(destination), flightNumber: flightNumber, inboundFlightNumber: inboundFlightNumber, origin: origin, destination: destination };
  }

  // Voucher round-trip summary: keep both legs and the original offer total.
  /* Esta es la TERCERA declaracion de getSelectedFlightSummary() en el archivo
     (las otras dos estan mas arriba, en la zona de los helpers) y como es una
     function declaration la ULTIMA que gana: las de arriba nunca se ejecutan. No
     se tocan porque no se van a borrar sin revisar los otros usos — hay ocho
     llamadas—, pero el selected:false de acá si es el que ve el resumen. */
  function getSelectedFlightSummary() {
    /* offer = getSelectedFlightOffer() || detailState.selectedOffer || {}: con el
       {} del final, offer nunca es null y por eso "Vuelo seleccionado" salia
       SIEMPRE,-elected o no. Un vuelo sin elegir no tienecodigo de aeropuerto, y
       airportCode(undefined) devuelve "—", asi que el tramo se imprimia como
       "IDA — sin fecha → — sin fecha". selected:false es lo que le permite al
       resumen no armar el tramo y decir que falta elegir. */
    if (!detailState) return { airline: '', summary: 'No hay un vuelo seleccionado.', selected: false };
    var picked = getSelectedFlightOffer();
    var offer = picked || detailState.selectedOffer || {};
    if (!picked && !offer.airline) return { airline: '', summary: 'No hay un vuelo seleccionado.', selected: false };
    var airline = offer.airline || detailState.selectedFlight || 'Vuelo sin nombre';
    function normalizeLeg(leg, slice) {
      leg = leg || {};
      var hasMappedData = (leg.origin && (leg.origin.code || leg.origin.iata_code || leg.origin.name)) ||
        (leg.destination && (leg.destination.code || leg.destination.iata_code || leg.destination.name)) || leg.departure || leg.arrival;
      if (hasMappedData) return leg;
      var segments = slice && Array.isArray(slice.segments) ? slice.segments : [];
      var first = segments[0] || {};
      var last = segments[segments.length - 1] || {};
      var originAirport = first.origin || {};
      var destinationAirport = last.destination || {};
      var carrier = first.marketing_carrier || first.operating_carrier || {};
      return {
        origin: { code: originAirport.iata_code || '', name: originAirport.name || '' },
        destination: { code: destinationAirport.iata_code || '', name: destinationAirport.name || '' },
        departure: first.departing_at || null,
        arrival: last.arriving_at || null,
        flight_number: first.flight_number || '',
        airline: carrier.name || ''
      };
    }
    var slices = Array.isArray(offer.slices) ? offer.slices : [];
    var outbound = normalizeLeg(offer.outbound || {}, slices[0]) || offer;
    var inbound = normalizeLeg(offer.inbound || {}, slices[1]);
    if (!outbound.origin && !outbound.destination) outbound = offer.outbound || offer;
    var origin = outbound.origin || offer.departure_airport || {};
    var destination = outbound.destination || offer.arrival_airport || {};
    var departure = outbound.departure || offer.departure;
    var arrival = outbound.arrival;
    var returnOrigin = inbound.origin || (inbound.departure || inbound.arrival ? {} : destination);
    var returnDestination = inbound.destination || (inbound.departure || inbound.arrival ? {} : origin);
    var returnDeparture = inbound.departure;
    var returnArrival = inbound.arrival;
    var flightNumber = offer.flight_number || outbound.flight_number || '';
    var inboundFlightNumber = inbound.flight_number || '';
    var inboundAirline = inbound.airline || airline;
    var isRoundTrip = offer.trip_type === 'round_trip' || slices.length > 1 || !!(inbound.departure || inbound.arrival);
    var outboundText = (flightNumber ? 'Vuelo ' + flightNumber : 'Numero de vuelo no informado') + ' · ' + (origin.name || origin.code || 'Origen') + ' (' + (airportCode(origin) || '---') + ') -> ' + (destination.name || destination.code || 'Destino') + ' (' + (airportCode(destination) || '---') + ') · salida ' + formatFlightDateTime(departure) + ' · llegada ' + formatFlightDateTime(arrival);
    var inboundText = isRoundTrip ? ((inboundFlightNumber ? 'Vuelo ' + inboundFlightNumber : 'Numero de vuelo no informado') + ' · ' + (returnOrigin.name || returnOrigin.code || 'Destino') + ' (' + (airportCode(returnOrigin) || '---') + ') -> ' + (returnDestination.name || returnDestination.code || 'Origen') + ' (' + (airportCode(returnDestination) || '---') + ') · salida ' + formatFlightDateTime(returnDeparture) + ' · llegada ' + formatFlightDateTime(returnArrival)) : '';
    return { airline: airline, outboundAirline: outbound.airline || airline, inboundAirline: inboundAirline, summary: isRoundTrip ? 'Ida: ' + outboundText + ' | Vuelta: ' + inboundText + ' · tarifa ida y vuelta incluida' : outboundText, departureText: formatFlightDateTime(departure), arrivalText: formatFlightDateTime(arrival), returnDepartureText: formatFlightDateTime(returnDeparture), returnArrivalText: formatFlightDateTime(returnArrival), route: ' · ' + airportCode(origin) + ' -> ' + airportCode(destination), flightNumber: flightNumber, inboundFlightNumber: inboundFlightNumber, origin: origin, destination: destination, returnOrigin: returnOrigin, returnDestination: returnDestination, isRoundTrip: isRoundTrip, outboundText: outboundText, inboundText: inboundText, selected: true };
  }

  function openDestinationProposal(key, savedTrip) {
    // Se marca acá y no en el click del handler: esta es la unica ruta por la
    // que se abre una propuesta, asi que el estado no queda desincronizado si
    // mañana se agrega otra forma de entrar.
    selectedDestKey = key || null;
    selectedDestFor = S.dep + '|' + S.ret + '|' + S.pax + '|' + S.budget;
    var qs = new URLSearchParams({ dest: key, dep: S.dep, ret: S.ret, pax: S.pax, budget: S.budget, style: S.style, origin: S.origin, subcategory: S.subcategory, second: S.second, hotel_type: S.hotelType });
    return fetch('/api/cotizar?' + qs.toString()).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
      if (!res.ok) throw new Error(res.j.error || 'No pudimos cargar la propuesta.');
      showProposalView(byId(res.j.list, res.j.recId), res.j);
      if (savedTrip) { applySavedTripToDetail(savedTrip); window.setTimeout(openItinerarySummaryModal, 0); }
      return true;
    }).catch(function (e) {
      // Se devuelve el motivo y no un null pelado. Antes devolvia null, y el
      // que abria la propuesta desde un viaje guardado convertia ese null en
      // "No pudimos cargar la propuesta guardada.", un mensaje que no dice
      // nada. Y como este aviso va al mismo #results, el genérico pisaba al
      // bueno y el usuario se quedaba sin saber qué faltaba.
      //
      // El caso que mas aparece: /api/cotizar responde 400 con un mensaje
      // claro cuando las fechas del viaje guardado no sirven, asi que un
      // viaje guardado de hace un mes ya no se puede abrir nunca. El aviso
      // bueno es "La fecha de ida tiene que ser a partir de manana".
      notice(e.message);
      return { error: e.message || 'No pudimos cargar la propuesta.' };
    });
  }

  // Captura los botones dinámicos antes que cualquier listener en burbujeo.
  // Es el ÚNICO punto de entrada de "Ver propuesta": los CTA viven en dos
  // contenedores distintos (#results y #destination-results) y antes cada uno
  // tenía su propio listener para [data-propuesta-dest]. Como este corre en
  // captura y corta la propagación, esos dos nunca llegaban a ejecutarse: eran
  // código muerto que hacía creer que el selector apuntaba al elemento
  // equivocado. Si se agrega otra lista de propuestas, el handler va acá.
  function handleProposalNavigation(e) {
    var button = e.target.closest && e.target.closest('.btn-ver-propuesta,[data-propuesta-id],[data-propuesta-dest]');
    if (!button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var destination = button.getAttribute('data-propuesta-dest');
    if (destination) {
      // #dest es el <div> del combobox, no un <select>: su propiedad "value" está
      // definida con Object.defineProperty y el setter llama a setDestDisplay,
      // que es lo que refresca la etiqueta y marca la opción del menú.
      S.dest = destination;
      $('#dest').value = destination;
      openDestinationProposal(destination);
      return;
    }
    var proposalId = button.getAttribute('data-propuesta-id');
    // Abrir una propuesta ES elegirla. El marco mostaza lo lleva la elegida, así
    // que el estado se escribe acá y no en el handler de la card: esta es la
    // unica ruta por la que se abre una propuesta de #results.
    if (proposalId) {
      selectedPropuestaId = proposalId;
      selectedPropuestaFor = S.dep + '|' + S.ret + '|' + S.pax + '|' + S.budget;
    }
      var proposal = lastData && (byId(lastData.list, proposalId) || byId(lastData.alternatives, proposalId) || byId(lastData.roadtripList, proposalId));
    if (proposal) {
      try { showProposalView(proposal, lastData); } catch (error) { console.error('No pudimos abrir la propuesta', error); notice('No pudimos abrir esta propuesta. Probá nuevamente.'); }
    } else {
      notice('La propuesta ya no está disponible. Volvé a buscar para actualizarla.');
    }
  }

  // "Ver desglose" despliega el reparto por categoría dentro de la tarjeta, sin
  // cambiar de vista. Vive en el documento y no en un contenedor porque el mismo
  // botón aparece en dos listas distintas: las propuestas de un destino
  // (#results) y los destinos que entran en el presupuesto (#destination-results).
  //
  // El texto del botón acompaña al estado ("Ver desglose" / "Ocultar desglose").
  // Con un rótulo fijo, un botón que además abre y cierra se lee como un
  // enlace a otra pantalla, que es justo lo que NO hace.
  function handleBreakdownToggle(e) {
    var toggle = e.target.closest && e.target.closest('[data-opt-toggle]');
    if (!toggle) return;
    e.preventDefault(); e.stopPropagation();
    var card = toggle.closest('[data-opt-card]');
    var body = card && card.querySelector('.opt__body');
    if (!body) return;
    var abrir = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(abrir));
    toggle.classList.toggle('is-open', abrir);
    if (card) card.classList.toggle('is-open', abrir);
    var texto = toggle.querySelector('.opt__disclosure-text');
    if (texto) texto.textContent = abrir ? 'Ocultar desglose' : 'Ver desglose';
    alternarDesglose(body, abrir);
  }

  /* Abrir y cerrar el desglose con la altura animada.

     Antes era `body.hidden = !abrir`: el contenido aparecía de golpe y la
     tarjeta se estiraba de un tirón, con la tarjeta de abajo saltando en el
     mismo fotograma. Con la altura animada el borde de la tarjeta se separa
     solo mientras las filas van apareciendo, así que el desglose se despliega
     DENTRO de su tarjeta y la de abajo baja a la vez, sin superponerse.

     Se anima `height` y no `grid-template-rows: 0fr -> 1fr` porque el alto
     final depende de cuántos rubros tenga la propuesta, de si la nota entra en
     una línea o en dos y del ancho de la pantalla: el 1fr lo resuelve solo,
     el alto hay que medirlo.

     La medición va con `scrollHeight` DESPUÉS de sacar el `hidden`, porque con
     `display:none` no hay caja y medir ahí da 0. Después de animar se borra el
     `height` en línea para que la tarjeta vuelva a medir sola: si el texto se
     reacomoda (se gira el celu, cambia el número de viajeros) un alto fijo se
     queda corto y deja la última fila cortada.

     Con `prefers-reduced-motion` la transición no se aplica y el alto salta de
     golpe, que es lo que se pide al sistema; el estado final es el mismo. Por eso
     la animación se resuelve enteramente en CSS y acá no hay que preguntar. */
  var desgloseTimer = null;
  function alternarDesglose(body, abrir) {
    if (desgloseTimer) { clearTimeout(desgloseTimer); desgloseTimer = null; }
    if (abrir) {
      body.hidden = false;
      // Dos fotogramas: uno para pintar el estado abierto y otro para aplicar el
      // alto final. Con los dos cambios en el mismo, el navegador no tiene un
      // valor anterior del que arrancar la transición y el desglose aparece de
      // golpe.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { body.style.height = body.scrollHeight + 'px'; });
      });
    } else {
      // Al revés: primero se fija el alto actual como punto de partida, y en el
      // siguiente fotograma se colapsa a cero. Sin el alto intermedio el cierre
      // también es un salto.
      body.style.height = body.scrollHeight + 'px';
      requestAnimationFrame(function () { requestAnimationFrame(function () { body.style.height = '0px'; }); });
    }
    desgloseTimer = setTimeout(function () {
      desgloseTimer = null;
      body.style.height = '';
      if (!abrir) body.hidden = true;
    }, 320);
  }

  /* ---------- cuentas y viajes guardados ---------- */
  var supabaseClient = null;
  var authUser = null;
  var pendingTripSave = false;
  var tripSaveInProgress = false;
  var authReadyPromise = Promise.resolve();
  var authInitPromise = null;
  var supabaseSdkPromise = null;
  function loadSupabaseSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (supabaseSdkPromise) return supabaseSdkPromise;
    supabaseSdkPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('No pudimos cargar el servicio de cuenta.')); };
      document.head.appendChild(script);
    });
    return supabaseSdkPromise;
  }

  async function guardarViaje(datosVuelo) {
    if (!supabaseClient) throw new Error('Supabase todavía no está configurado.');
    if (!datosVuelo || typeof datosVuelo !== 'object') throw new Error('Faltan los datos del vuelo.');
    var userResult = await supabaseClient.auth.getUser();
    if (userResult.error) throw new Error('No pudimos verificar tu sesión.');
    var user = userResult.data && userResult.data.user;
    if (!user) throw new Error('Debés iniciar sesión para guardar un viaje.');
    var payload = {
      user_id: user.id,
      origin: datosVuelo.origin || datosVuelo.origen || null,
      destination: datosVuelo.destination || datosVuelo.destino || null,
      departure_date: datosVuelo.departure_date || datosVuelo.fecha_ida || null,
      return_date: datosVuelo.return_date || datosVuelo.fecha_vuelta || null,
      total_price: Number(datosVuelo.total_price || datosVuelo.total_amount || datosVuelo.precio_total) || 0,
      flight_details: datosVuelo.flight_details || datosVuelo.detalles_vuelo || {}
    };
    var result = await supabaseClient.from('trips').insert(payload).select().single();
    if (result.error && /permission denied|row-level security|42501/i.test(result.error.message || '')) {
      var fallback = { user_id: user.id, title: (payload.destination || 'Viaje') + ' · ' + (payload.departure_date || ''), destination_key: datosVuelo.destination_key || (payload.flight_details && payload.flight_details.destination_key) || '', destination_name: payload.destination || 'Brasil', departure_date: payload.departure_date, return_date: payload.return_date, total_amount: payload.total_amount, currency: payload.currency, details: payload.flight_details || {} };
      var fallbackResult = await supabaseClient.from('user_trips').insert(fallback).select().single();
      if (!fallbackResult.error) return fallbackResult.data;
    }
    if (result.error) throw new Error('No pudimos guardar el viaje: ' + result.error.message);
    return result.data;
  }
  window.guardarViaje = guardarViaje;

  function authDisplayName(user) {
    var metadata = user && user.user_metadata || {};
    return metadata.full_name || metadata.name || (user && user.email) || 'Mi cuenta';
  }
  function closeAccountModal(id) {
    cerrarTodosLosModales();
  }
  function openAuthModal(message) {
    var modal = $('#auth-modal');
    if (!modal) return;
    if (authUser) { openTripsModal(); return; }
    cerrarTodosLosModales();
    modal.innerHTML = '<div class="booking-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button type="button" class="booking-close" data-close-auth aria-label="Cerrar">×</button><span class="account-kicker">CuántoSale</span><h2 id="auth-title">Guardá tus viajes</h2><p class="booking-note">Creá una cuenta para conservar presupuestos e itinerarios en la nube.</p>' + (message ? '<p class="booking-error">' + esc(message) + '</p>' : '') + '<button type="button" class="oauth-button" data-google-auth>Continuar con Google</button><div class="account-divider"><span>o con tu email</span></div><form id="auth-form"><label>Correo electrónico<input required type="email" name="email" autocomplete="email"></label><label>Contraseña<input required minlength="6" type="password" name="password" autocomplete="current-password"></label><div class="account-form-actions"><button type="submit" class="confirm-booking" data-auth-action="signin">Iniciar sesión</button><button type="button" class="account-button account-button--secondary" data-auth-action="signup">Crear cuenta</button></div><p class="account-status" data-auth-status aria-live="polite"></p></form></div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    var first = modal.querySelector('input'); if (first) first.focus();
  }
  async function openTripsModal() {
    var modal = $('#trips-modal');
    if (!modal) return;
    await authReadyPromise;
    if (!authUser) { pendingTripSave = false; openAuthModal('Iniciá sesión para ver tus viajes.'); return; }
    cerrarTodosLosModales();
    modal.innerHTML = '<div class="booking-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="trips-title"><button type="button" class="booking-close" data-close-trips aria-label="Cerrar">×</button><span class="account-kicker">Tu cuenta</span><h2 id="trips-title">Mis viajes</h2><p class="booking-note">Itinerarios guardados por ' + esc(authDisplayName(authUser)) + '.</p><div class="saved-trips" data-saved-trips><p class="account-status">Cargando tus viajes...</p></div><button type="button" class="account-button account-button--secondary" data-signout>Cerrar sesión</button></div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    loadSavedTrips(modal);
  }
  function renderAuthState(user) {
    authUser = user || null;
    // La respuesta de es_agencia() depende de quién está con sesión, así que se
    // invalida cada vez que la sesión cambia. Sin esto el cache era un false
    // eterno: si abría el voucher sin estar logueado, el botón de "Marcar
    // reservado" no le aparecía nunca más ni después de loguearse, y la única
    // forma de verlo era recargar con F5.
    agenciaConsultado = false; soyAgencia = false;
    var button = $('#auth-button'), trips = $('#trips-button');
    if (button) { var avatar = authUser && authUser.user_metadata && (authUser.user_metadata.avatar_url || authUser.user_metadata.picture); button.innerHTML = authUser ? (avatar ? '<img class="account-avatar" src="' + esc(avatar) + '" alt="">' : '👤 ') + esc(authDisplayName(authUser)) : 'Iniciar sesión'; button.setAttribute('aria-label', authUser ? 'Abrir cuenta de ' + authDisplayName(authUser) : 'Iniciar sesión'); }
    if (trips) trips.hidden = !authUser;
  }
  /* ---------- Login para las acciones del resumen ----------
     Ver el resumen es libre. Lo que pide cuenta es lo que cambia un estado o abre
     una reserva: Reservar (hotel, vuelo, traslado, actividades), Elegir vuelos y
     Dividir gastos. Al tocarlo sin sesion no se ejecuta: se anota que se queria
     hacer (y el viaje, para poder reabrirlo aunque el login recargue la pagina,
     como con Google o la confirmacion por correo) y se abre el modal de cuenta.
     Con la sesion iniciada se vuelve al resumen, a la misma fila.

     Se guarda en localStorage y no en sessionStorage a proposito: el link de
     confirmacion del correo suele abrirse en otra pestana. */
  var ACCION_KEY = 'cuantosale_accion_pendiente';
  var ACCION_TTL_MS = 30 * 60 * 1000;
  var ACCIONES_CON_LOGIN = ['data-reservar-rubro', 'data-marca-reserva', 'data-confirmar-reserva', 'data-deshacer-reserva', 'data-reservar-pedido', 'data-split-trip'];
  var MENSAJE_LOGIN = 'Iniciá sesión para guardar los cambios en tu viaje y gestionar tus reservas.';
  var authInitTerminado = false;
  function describirAccion(el) {
    var attr = ACCIONES_CON_LOGIN.filter(function (a) { return el.hasAttribute(a); })[0] || '';
    var fila = el.closest('[data-rubro]');
    return { attr: attr, valor: attr ? el.getAttribute(attr) || '' : '', rubro: fila ? fila.getAttribute('data-rubro') : '' };
  }
  async function pedirLogin(accion) {
    var ctx = null;
    try { ctx = tripPayload(); } catch (e) { ctx = null; }
    try { localStorage.setItem(ACCION_KEY, JSON.stringify({ accion: accion, ctx: ctx, t: Date.now() })); } catch (e) { /* modo privado */ }
    authReadyPromise = initAuth();
    await authReadyPromise;
    if (!supabaseClient) { openAuthModal('Falta configurar SUPABASE_ANON_KEY en las variables de entorno del despliegue.'); return; }
    if (authUser) { retomarAccionPendiente(); return; }
    openAuthModal(MENSAJE_LOGIN);
  }
  // Devuelve true si frena la accion. Sin Supabase configurado no hay forma de
  // pedir cuenta: no se bloquea, para no dejar el resumen sin acciones.
  function exigirLogin(e, el) {
    if (authUser) return false;
    if (authInitTerminado && !supabaseClient) return false;
    e.preventDefault(); e.stopPropagation();
    pedirLogin(describirAccion(el));
    return true;
  }
  function esperarVoucher(ms) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function mirar() {
        var modal = $('#booking-modal');
        if (modal && !modal.hidden && modal.dataset.summaryText && modal.querySelector('.voucher-list')) return resolve(true);
        if (Date.now() - t0 > ms) return resolve(false);
        window.setTimeout(mirar, 120);
      })();
    });
  }
  async function retomarAccionPendiente() {
    var raw = null;
    try { raw = localStorage.getItem(ACCION_KEY); } catch (e) { raw = null; }
    if (!raw || !authUser) return;
    try { localStorage.removeItem(ACCION_KEY); } catch (e) { /* nada */ }
    var pend = null;
    try { pend = JSON.parse(raw); } catch (e) { pend = null; }
    if (!pend || !pend.accion || Date.now() - (pend.t || 0) > ACCION_TTL_MS) return;
    closeAccountModal('auth-modal');
    var ctx = pend.ctx;
    var meta = detailState && detailState.meta;
    var mismoViaje = !!(meta && ctx && meta.dest && meta.dest.key === ctx.destination_key && meta.dep === ctx.departure_date && meta.ret === ctx.return_date);
    var modal = $('#booking-modal');
    if (!mismoViaje) {
      if (!ctx) return;
      try { await loadTrip(ctx); } catch (e) { notice(e && e.message || 'No pudimos reabrir tu viaje.'); return; }
    } else if (modal && (modal.hidden || !modal.dataset.summaryText)) {
      openItinerarySummaryModal();
    }
    if (!await esperarVoucher(5000)) return;
    var a = pend.accion, attr = a.attr, valor = a.valor;
    if (attr === 'data-detalle-rubro') { closeBookingForm(); jumpToBudgetSection(valor); return; }
    if (attr === 'data-split-trip' || attr === 'data-marca-reserva' || attr === 'data-confirmar-reserva' || attr === 'data-deshacer-reserva') {
      var boton = modal.querySelector('[' + attr + (attr === 'data-split-trip' ? '' : '="' + valor + '"') + ']');
      if (boton) boton.click();
      return;
    }
    // Reservar hotel/vuelo abre otra pestana y el navegador no la deja abrir sin
    // un toque de la persona: se la deja en la misma fila, lista para tocar.
    var fila = a.rubro ? modal.querySelector('[data-rubro="' + a.rubro + '"]') : null;
    if (fila) {
      try { fila.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { fila.scrollIntoView(); }
      fila.classList.add('is-tras-vuelta');
      window.setTimeout(function () { fila.classList.remove('is-tras-vuelta'); }, 2600);
    }
    mostrarAvisoReserva('Listo, ya iniciaste sesión. Tocá de nuevo el botón para reservar.', 'ok');
  }
  function tripPayload() {
    if (!detailState || !detailState.meta) return null;
    var budget = getBudgetBreakdown(detailState);
    return {
      user_id: authUser ? authUser.id : null,
      title: (detailState.meta.dest && detailState.meta.dest.name || 'Viaje') + ' · ' + (detailState.meta.dep || ''),
      destination_key: detailState.meta.dest && detailState.meta.dest.key || S.dest,
      destination_name: detailState.meta.dest && detailState.meta.dest.name || 'Brasil',
      departure_date: detailState.meta.dep || null,
      return_date: detailState.meta.ret || null,
      nights: Math.max(1, Number(detailState.meta.nights) || 1),
      travelers: Math.max(1, Number(detailState.meta.pax) || S.pax || 1),
      transport_mode: detailState.transportMode || 'flight',
      food_per_day: Number(detailState.foodPerDay) || 0,
      local_per_day: Number(detailState.localPerDay) || 0,
      total_amount: Number(budget.total) || 0,
      currency: 'USD',
      details: { destination_key: detailState.meta.dest && detailState.meta.dest.key || S.dest, origin: detailState.meta.origin || S.origin, subcategory: detailState.meta.subcategory || S.subcategory || '', parts: detailState.parts || {}, flight: detailState.selectedOffer || { id: detailState.selectedFlightId || '', airline: detailState.selectedFlight || '', price: detailState.flight || 0 }, hotel: { name: findSelectedHotelLabel(), total: detailState.hotel || 0 }, transfer: detailState.transfer || 0, transferType: detailState.transferType || '', transferTypeVuelta: detailState.transferTypeVuelta || '', busChoice: detailState.busChoice || '', busTotal: Number(detailState.parts && detailState.parts.bus) || 0, tours: detailState.selectedTours || [], budget: budget, queryBudget: S.budget, style: detailState.meta.style || S.style, hotelType: detailState.meta.hotelType || S.hotelType, roadtrip: detailState.roadtrip || null }
    };
  }
  async function saveCurrentTrip(options) {
    var skipTripsModal = options && options.skipTripsModal;
    if (!supabaseClient) { authReadyPromise = initAuth(); await authReadyPromise; }
    if (!supabaseClient) { openAuthModal('Falta configurar SUPABASE_ANON_KEY en las variables de entorno del despliegue.'); return false; }
    if (!authUser) { pendingTripSave = true; try { var draft = tripPayload(); if (draft) sessionStorage.setItem('cuantosale_pending_trip_data', JSON.stringify(draft)); sessionStorage.setItem('cuantosale_pending_trip', '1'); } catch (error) {} openAuthModal(); return false; }
    if (tripSaveInProgress) return false;
    var payload = tripPayload();
    if (!payload) { try { payload = JSON.parse(sessionStorage.getItem('cuantosale_pending_trip_data') || 'null'); } catch (error) { payload = null; } }
    if (!payload) { alert('Abrí una propuesta antes de guardar el viaje.'); return false; }
    payload.user_id = authUser.id;
    tripSaveInProgress = true;
    var result;
    try {
      result = await guardarViaje({ origin: originLabel(payload.details.origin || S.origin), destination: payload.destination_name, destination_key: payload.destination_key, departure_date: payload.departure_date, return_date: payload.return_date, total_price: payload.total_amount, flight_details: Object.assign({}, payload.details, { transport_mode: payload.transport_mode, food_per_day: payload.food_per_day, local_per_day: payload.local_per_day, travelers: payload.travelers, total_amount: payload.total_amount }) });
    } catch (error) {
      tripSaveInProgress = false;
      openAuthModal(error.message);
      return false;
    }
    tripSaveInProgress = false;
    pendingTripSave = false;
    try { sessionStorage.removeItem('cuantosale_pending_trip'); sessionStorage.removeItem('cuantosale_pending_trip_data'); } catch (error) {}
    if (!skipTripsModal) await openTripsModal();
    return true;
  }
  async function loadSavedTrips(modal) {
    var box = modal.querySelector('[data-saved-trips]');
    var userResult = await supabaseClient.auth.getUser();
    var user = userResult.data && userResult.data.user;
    if (userResult.error || !user) { box.innerHTML = '<p class="booking-error">Tu sesión expiró. Volvé a iniciar sesión para ver tus viajes.</p>'; renderAuthState(null); return; }
    renderAuthState(user);
    var result = await supabaseClient.from('trips').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (result.error && /permission denied|row-level security|42501/i.test(result.error.message || '')) {
      var legacyResult = await supabaseClient.from('user_trips').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!legacyResult.error) {
        result = { data: legacyResult.data.map(function (trip) { return { id: trip.id, destination: trip.destination_name, departure_date: trip.departure_date, return_date: trip.return_date, total_amount: trip.total_amount, flight_details: trip.details || {}, created_at: trip.created_at }; }), error: null };
      }
    }
    if (result.error) { box.innerHTML = '<p class="booking-error">No se pudieron cargar tus viajes porque la tabla todavía no tiene permisos RLS configurados. Ejecutá <strong>supabase_trips_rls_fix.sql</strong> en el SQL Editor de Supabase y recargá.</p>'; return; }
    if (!result.data.length) { box.innerHTML = '<p class="account-status">Todavía no guardaste viajes.</p>'; return; }
    var seenTrips = new Set();
    var uniqueTrips = result.data.filter(function (trip) {
      var key = [trip.destination, trip.departure_date, trip.return_date, trip.total_price || trip.total_amount, trip.offer_id || ''].join('|') || trip.id;
      if (seenTrips.has(String(key))) return false;
      seenTrips.add(String(key));
      return true;
    });
    if (!uniqueTrips.length) { box.innerHTML = '<p class="account-status">Todavía no guardaste viajes.</p>'; return; }
    // Render deduplicated trips directly so every button maps to box._trips.
    box.innerHTML = uniqueTrips.map(function (trip) { return '<article class="saved-trip"><div><strong>' + esc(trip.destination || 'Viaje guardado') + '</strong><span data-trip-total="' + esc(trip.id) + '">' + esc(trip.departure_date || '') + ' → ' + esc(trip.return_date || '') + ' · ' + money(Number(trip.total_price || trip.total_amount) || 0) + '</span></div><button type="button" class="account-button" data-load-trip="' + esc(trip.id) + '">Cargar</button><button type="button" class="account-button account-button--secondary" data-refresh-trip="' + esc(trip.id) + '">Actualizar precio</button><button type="button" class="account-button account-button--danger" data-delete-trip="' + esc(trip.id) + '" aria-label="Borrar viaje">🗑️</button></article>'; }).join('');
    box._trips = uniqueTrips;
    return;
  }
  async function deleteSavedTrip(tripId) {
    if (!supabaseClient || !tripId) return;
    var userResult = await supabaseClient.auth.getUser();
    var user = userResult.data && userResult.data.user;
    if (!user) return;
    var result = await supabaseClient.from('trips').delete().eq('id', tripId).eq('user_id', user.id);
    if (result.error && /permission denied|row-level security|42501/i.test(result.error.message || '')) result = await supabaseClient.from('user_trips').delete().eq('id', tripId).eq('user_id', user.id);
    if (result.error) { alert('No pudimos borrar el viaje: ' + result.error.message); return; }
    await openTripsModal();
  }
  // Reconsulta /api/cotizar con los mismos parámetros de búsqueda guardados y
  // persiste el total recalculado, sin tocar el resto del snapshot (hotel,
  // vuelo o traslado elegidos siguen siendo los que el usuario ya confirmó).
  async function refreshTripPrice(tripId, button) {
    if (!supabaseClient || !tripId) return;
    var box = $('#trips-modal').querySelector('[data-saved-trips]');
    var trip = box && box._trips && box._trips.find(function (item) { return String(item.id) === String(tripId); });
    if (!trip) { notice('No pudimos encontrar ese viaje guardado.'); return; }
    var details = trip.details || trip.flight_details || {};
    var originalText = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = 'Actualizando...'; }
    try {
      var destKey = await resolveSavedDestinationKey(trip, details);
      if (!destKey) throw new Error('No pudimos identificar el destino para actualizar el precio.');
      var params = new URLSearchParams({
        dest: destKey,
        dep: trip.departure_date || '',
        ret: trip.return_date || '',
        pax: String(Number(trip.travelers) || Number(details.travelers) || 1),
        budget: String(Number(details.queryBudget) || 0),
        style: details.style || 'comodo',
        origin: details.origin === 'PDP' ? 'PDP' : 'MVD',
        subcategory: details.subcategory || '',
        hotel_type: details.hotelType || ''
      });
      var res = await fetch('/api/cotizar?' + params.toString());
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No pudimos actualizar el precio.');
      var rec = data.list && data.list.find(function (p) { return p.id === data.recId; });
      if (!rec) throw new Error('No encontramos una propuesta recomendada para este viaje.');
      var userResult = await supabaseClient.auth.getUser();
      var user = userResult.data && userResult.data.user;
      if (!user) throw new Error('Tu sesión expiró. Volvé a iniciar sesión.');
      var updateResult = await supabaseClient.from('trips').update({ total_amount: rec.total }).eq('id', tripId).eq('user_id', user.id);
      if (updateResult.error && /permission denied|row-level security|42501/i.test(updateResult.error.message || '')) {
        updateResult = await supabaseClient.from('user_trips').update({ total_amount: rec.total }).eq('id', tripId).eq('user_id', user.id);
      }
      if (updateResult.error) throw new Error('No pudimos guardar el precio actualizado: ' + updateResult.error.message);
      trip.total_amount = rec.total; trip.total_price = rec.total;
      var totalLabel = box.querySelector('[data-trip-total="' + tripId + '"]');
      if (totalLabel) totalLabel.textContent = (trip.departure_date || '') + ' → ' + (trip.return_date || '') + ' · ' + money(rec.total);
    } catch (error) {
      notice(error.message || 'No pudimos actualizar el precio.');
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText || 'Actualizar precio'; }
    }
  }
  function applySavedTripToDetail(trip) {
    if (!detailState || !trip) return;
    var details = trip.details || trip.flight_details || {};
    detailState.parts = Object.assign({}, detailState.parts || {}, details.parts || {});
    detailState.transportMode = trip.transport_mode || details.transport_mode || detailState.transportMode || 'flight';
    detailState.foodPerDay = Number(trip.food_per_day) || Number(details.food_per_day) || Number(details.foodPerDay) || detailState.foodPerDay || 0;
    detailState.localPerDay = Number(trip.local_per_day) || Number(details.local_per_day) || Number(details.localPerDay) || detailState.localPerDay || 0;
    detailState.transfer = Number(details.transfer) || 0;
    detailState.transferType = details.transferType || detailState.transferType || '';
    /* El tramo de vuelta se guarda aparte. Un viaje guardado antes de que
       existiera no tiene el campo, y en ese caso se deja como estaba: se hereda
       el de llegada para que un viaje viejo no aparezca con la mitad de los
       traslados marcados como "no incluido". */
    detailState.transferTypeVuelta = details.transferTypeVuelta || detailState.transferTypeVuelta || '';
    if (details.busChoice) {
      if (detailState.baseBus == null) detailState.baseBus = Number(detailState.parts && detailState.parts.bus) || 0;
      detailState.busChoice = String(details.busChoice);
      if (Number(details.busTotal) > 0 && detailState.parts) detailState.parts.bus = Math.round(Number(details.busTotal));
    }
    detailState.selectedTours = Array.isArray(details.tours) ? details.tours : [];
    detailState.toursTotal = detailState.selectedTours.reduce(function (sum, tour) { return sum + (Number(tour.price) || 0); }, 0);
    detailState.selectedTours.forEach(function (tour) {
      var input = Array.prototype.slice.call(document.querySelectorAll('[data-tour-choice]')).find(function (item) { return item.getAttribute('data-tour-title') === tour.title; });
      if (input) input.checked = true;
    });
    if (details.hotel) {
      detailState.hotel = Number(details.hotel.total) || detailState.hotel; detailState.hotelDecided = true;
      detailState.selectedHotel = true;
      detailState.selectedHotelTotal = Math.round(Number(details.hotel.total) || 0) || null;
      detailState.selectedHotelName = details.hotel.name || detailState.selectedHotelName;
      var hotelOptions = document.querySelectorAll('[data-hotel-option]');
      Array.prototype.forEach.call(hotelOptions, function (option) {
        var title = option.querySelector('h3');
        var input = option.querySelector('[data-hotel-total]');
        var matchesName = title && details.hotel.name && normalizeDestinationText(title.textContent) === normalizeDestinationText(details.hotel.name);
        var matchesTotal = input && Number(input.getAttribute('data-hotel-total')) === Number(details.hotel.total);
        if (input && (matchesName || (!details.hotel.name && matchesTotal))) {
          input.checked = true;
          detailState.selectedHotelName = title ? title.textContent.trim() : detailState.selectedHotelName;
        }
      });
    }
    if (details.flight && details.flight.id) {
      detailState.selectedOffer = details.flight;
      detailState.selectedFlightId = details.flight.id;
      detailState.selectedFlight = details.flight.airline || detailState.selectedFlight;
      detailState.flight = Number(details.flight.price) || detailState.flight;
      detailState.baseFlight = detailState.flight;
    }
    actualizarTransporte(detailState.transportMode === 'auto');
    renderTripSummary();
  }
  function normalizeDestinationText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  async function resolveSavedDestinationKey(trip, details) {
    var key = trip.destination_key || details.destination_key || '';
    if (key && key !== 'todos') return key;
    var name = normalizeDestinationText(trip.destination || trip.destination_name || '');
    try {
      var response = await fetch('/api/destinos');
      var list = await response.json();
      var match = Array.isArray(list) && list.find(function (item) { return normalizeDestinationText(item.name) === name || normalizeDestinationText(item.name).indexOf(name) >= 0 || name.indexOf(normalizeDestinationText(item.name)) >= 0; });
      return match && match.key || '';
    } catch (error) { return ''; }
  }
  async function loadTrip(trip) {
    var details = trip.details || trip.flight_details || {};
    S.dest = await resolveSavedDestinationKey(trip, details) || S.dest; S.dep = trip.departure_date || S.dep; S.ret = trip.return_date || S.ret; S.pax = Number(trip.travelers) || Number(details.travelers) || S.pax; S.style = details.style || S.style; S.budget = Number(details.queryBudget) || S.budget; S.transport = trip.transport_mode || details.transport_mode || S.transport; S.origin = details.origin === 'PDP' ? 'PDP' : (details.origin === 'MVD' ? 'MVD' : S.origin); S.subcategory = details.subcategory || ''; S.hotelType = details.hotelType || inferHotelType(S.subcategory) || hotelTypeForStyle(S.style);
    var originInput = $('#origin-input'); if (originInput) originInput.value = originLabel(S.origin);
    if ($('#dep')) $('#dep').value = S.dep; if ($('#ret')) $('#ret').value = S.ret; syncDateRangeFields(); if ($('#pax')) $('#pax').textContent = S.pax; if ($('#bud')) $('#bud').value = S.budget;
    if (typeof openDestinationProposal === 'function' && S.dest !== 'todos') {
      closeAccountModal('trips-modal');
      var opened = await openDestinationProposal(S.dest, trip);
      // Se re-lanza el motivo que devuelva, no un texto generico: si el
      // viaje guardado tiene fechas vencidas o vacias, el 400 de
      // /api/cotizar ya lo dice bien y ese texto es el que tiene que llegar.
      if (opened && opened.error) throw new Error(opened.error);
    }
    else alert('No pudimos identificar el destino guardado. Volvé a buscar la propuesta y guardala nuevamente.');
  }
  /* Bloqueo de scroll de la pagina: solo mientras haya un modal visible y con
     contenido. Se recalcula cada vez que un modal cambia (hidden o contenido),
     asi ningun camino de cierre --login, cerrar, reabrir el viaje-- deja el
     documento trabado. */
  function syncScrollLock() {
    var abierto = Array.prototype.some.call(document.querySelectorAll('.booking-modal'), function (m) {
      return !m.hidden && m.firstElementChild;
    });
    document.documentElement.classList.toggle('modal-lock', abierto);
    if (!abierto) { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; }
  }
  (function vigilarModales() {
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(syncScrollLock);
    Array.prototype.forEach.call(document.querySelectorAll('.booking-modal'), function (m) {
      obs.observe(m, { attributes: true, attributeFilter: ['hidden'], childList: true });
    });
    syncScrollLock();
  })();
  function initAuth() {
    if (supabaseClient) return Promise.resolve();
    if (authInitPromise) return authInitPromise;
    authInitPromise = (async function () {
      try {
        await loadSupabaseSdk();
        var configResponse = await fetch('/api/config');
        var config = await configResponse.json();
        if (!config.supabaseUrl || !config.supabaseAnonKey) { console.warn('Falta SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY en las variables de entorno del despliegue.'); return; }
        supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
        try { pendingTripSave = sessionStorage.getItem('cuantosale_pending_trip') === '1'; } catch (error) {}
        var sessionResult = await supabaseClient.auth.getSession();
        renderAuthState(sessionResult.data && sessionResult.data.session && sessionResult.data.session.user);
        if (pendingTripSave && authUser) window.setTimeout(saveCurrentTrip, 0);
        if (authUser) window.setTimeout(retomarAccionPendiente, 0);
        supabaseClient.auth.onAuthStateChange(function (_event, session) { renderAuthState(session && session.user); if (pendingTripSave && session && session.user) window.setTimeout(saveCurrentTrip, 0); if (session && session.user) window.setTimeout(retomarAccionPendiente, 0); });
      } catch (error) { authInitPromise = null; console.error('Supabase Auth no disponible', error); }
    })();
    authInitPromise.then(function () { authInitTerminado = true; });
    return authInitPromise;
  }

  /* ---------- formulario ---------- */
  /* ---------- Interruptor de tema claro / night ----------

     El tema se aplica en el <head> de index.html, antes del CSS, para que la
     pagina no se pinte con los tokens de :root y recien despues cambie (el
     destello). Eso resuelve la carga. Acá solo esta el click y el estado del
     boton.

     Que este aca y no en el head es a proposito: el head no puede esperar a
     que app.js exista, y el atributo ya puesto por el script del head es lo
     que evita el parpadeo. Si alguien borra ese script del head, el tema
     arranca en night y recien cuando carga app.js se corrige: se ve el
     destello. Por eso el boton arranca con aria-pressed en el HTML y esta
     funcion lo corrige de una.

     Guardar en localStorage y no en cookie: no se manda en cada request y no
     pesa. Se usa try/catch porque en modo privado localStorage tira, y en ese
     caso el tema funciona igual, solo que no se recuerda. */
  var THEME_KEY = 'cuantosale_tema';
  function temaActual() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'night';
  }
  // El tema que quiere el sistema operativo. El oscuro de la app (night mostaza)
  // es el default, asi que la pregunta es de una: "acaba el sistema en claro".
  function temaDelSistema() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'night';
  }
  // La eleccion guardada, o null si la persona todavia no toco el boton.
  // Null NO es lo mismo que 'night': null significa "no hay eleccion" y por eso
  // el tema sigue al sistema; 'night' es una eleccion explicita y manda sobre
  // el sistema para siempre.
  function temaGuardado() {
    try {
      var g = localStorage.getItem(THEME_KEY);
      return (g === 'light' || g === 'night') ? g : null;
    } catch (e) { return null; }
  }
  // `guardar` separado del resto a proposito. Antes aplicarTema() escribia SIEMPRE
  // en localStorage, y la llamaba tambien initThemeToggle() al arrancar: con solo
  // abrir la pagina en un celular en claro se guardaba 'light'. A partir de ahi
  // habia "eleccion guardada", asi que la app dejaba de seguir al sistema para
  // siempre, y un usuario que passer de claro a oscuro a la tarde se quedaba
  // viendo la pagina en claro sin poder explicar por que. Ahora seguir al sistema
  // no deja rastro: se escribe unicamente cuando alguien toca el boton.
  function aplicarTema(t, guardar) {
    var nuevo = t === 'light' ? 'light' : 'night';
    document.documentElement.setAttribute('data-theme', nuevo);
    if (guardar) {
      try { localStorage.setItem(THEME_KEY, nuevo); } catch (e) { /* modo privado */ }
    }
    // El color de la barra del celular lo toma el sistema del meta. Sin esto,
    // en claro la barra de arriba queda de night y queda una franja oscura
    // sobre una pagina clara.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', nuevo === 'light' ? '#F7F8FA' : '#0A101A');
    var btn = $('#theme-toggle');
    if (btn) {
      var noche = nuevo === 'night';
      btn.setAttribute('aria-pressed', noche ? 'true' : 'false');
      btn.setAttribute('title', noche ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }
  function initThemeToggle() {
    // Primero se sincroniza el boton con lo que el head ya aplico. Si se
    // hiciera solo en el click, el boton arrancaria diciendo night aunque la
    // persona ya estaba en claro. Sin `guardar`: esto no es una eleccion, es
    // el estado que el script del head ya resolvio.
    aplicarTema(temaActual(), false);
    var btn = $('#theme-toggle');
    if (btn) {
      // Un click SI es una eleccion: se guarda y a partir de ahi manda sobre el
      // sistema. Es la unica via por la que se escribe THEME_KEY.
      btn.addEventListener('click', function () {
        aplicarTema(temaActual() === 'light' ? 'night' : 'light', true);
      });
    }
    // Y al revés: si NO hay eleccion guardada, la app sigue al sistema en vivo.
    // Sin este listener el tema solo se resolvia en la carga, asi que cambiar el
    // celular de claro a oscuro a la tarde dejaba la pagina como estaba. Con
    // eleccion guardada el listener no hace nada: manda lo que la persona eligio.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: light)');
      var alCambiar = function () {
        if (temaGuardado()) return;
        aplicarTema(mq.matches ? 'light' : 'night', false);
      };
      if (mq.addEventListener) mq.addEventListener('change', alCambiar);
      else if (mq.addListener) mq.addListener(alCambiar);
    }
  }

  function init() {
    /* Volver a la vista de inicio.

       La comparten el logo del header y el boton "Volver" de la vista de
       detalle, y es una funcion y no dos porque los dos caminos tienen que
       hacer lo mismo: si el logo cerrara el detalle sin tocar los filtros y el
       boton los tocara, "ir a inicio" significaria dos cosas distintas segun por
       donde se entre.

       Vive adentro de init() porque el reset del destino usa `sel`, que es el
       nodo del selector de Destino y se arma en esta misma funcion. Al ser una
       declaracion de funcion, el hoisting la deja disponible para el listener
       del logo, que se engancha antes de que llegue a este bloque. */
    function volverAHome() {
      var detalle = $('#vista-detalle'), inicio = $('#vista-principal');
      if (detalle) detalle.classList.add('oculto');
      if (inicio) inicio.classList.remove('oculto');
      // Volviendo desde una busqueda de un solo destino, "el inicio" es la
      // lista de todos: por eso el boton de volver dice "Volver a todos los
      // destinos".
      if (massSearch) { S.dest = 'todos'; if (sel) sel.value = 'todos'; $('#btn-buscar-todos').hidden = false; setHighlightsVisible(true); }
      // Al volver, la card del destino que se estaba mirando queda marcada. Se
      // cambia la clase en el DOM en vez de renderizar la grilla entera: el
      // repintado completo tira abajo los "ver desglose" abiertos y la
      // posicion del scroll, y aca lo unico que cambia es un estado.
      pintarDestinoSeleccionado();
      pintarPropuestaSeleccionada();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    initThemeToggle();
    // El logo del header es la salida de la vista de propuesta. Esa vista ocupa
    // la pantalla entera y su unico boton para salir esta arriba de ella, asi
    // que con la pagina scrolleada hay que subir hasta encontrarlo; el logo
    // esta siempre visible. El listener va en el boton y no delegado en
    // document porque el header no se repinta nunca y asi no se filtra ningun
    // clic de los miles que hay abajo.
    var logo = $('#logo-home');
    if (logo) logo.addEventListener('click', function (e) { e.preventDefault(); volverAHome(); });
    var authButton = $('#auth-button'), tripsButton = $('#trips-button');
    if (authButton) authButton.addEventListener('click', function () { authReadyPromise = initAuth(); authReadyPromise.then(function () { if (authUser) openTripsModal(); else openAuthModal(); }); });
    if (tripsButton) tripsButton.addEventListener('click', function () { authReadyPromise = initAuth(); authReadyPromise.then(openTripsModal); });
    if (window.location.search.indexOf('code=') >= 0 || window.location.hash.indexOf('access_token=') >= 0) { authReadyPromise = initAuth(); }
    $('#trip-summary').addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-trip-summary-toggle]');
      if (toggle) {
        e.preventDefault();
        var summary = $('#trip-summary');
        summary.classList.toggle('minimized');
        toggle.setAttribute('aria-expanded', String(!summary.classList.contains('minimized')));
        return;
      }
      if (e.target.closest('[data-save-trip]')) { e.preventDefault(); saveCurrentTrip(); }
    });
    window.addEventListener('resize', syncTripSummaryViewport);
    $('#auth-modal').addEventListener('click', async function (e) {
      if (e.target.closest('[data-close-auth]') || e.target === $('#auth-modal')) return closeAccountModal('auth-modal');
      var google = e.target.closest('[data-google-auth]');
      if (google) { if (!supabaseClient) { openAuthModal('Falta configurar SUPABASE_ANON_KEY en las variables de entorno del despliegue.'); return; } google.disabled = true; var oauth = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } }); if (oauth.error) openAuthModal(oauth.error.message); return; }
      var signup = e.target.closest('[data-auth-action="signup"]');
      if (signup) {
        if (!supabaseClient) { openAuthModal('Falta configurar SUPABASE_ANON_KEY en las variables de entorno del despliegue.'); return; }
        var form = $('#auth-form'), status = form && form.querySelector('[data-auth-status]');
        if (!form || !form.reportValidity()) return;
        var result = await supabaseClient.auth.signUp({ email: form.email.value.trim(), password: form.password.value });
        if (status) status.textContent = result.error ? result.error.message : 'Revisá tu correo para confirmar la cuenta.';
      }
    });
    $('#auth-modal').addEventListener('submit', async function (e) {
      if (e.target.id !== 'auth-form') return;
      e.preventDefault();
      if (!supabaseClient) return;
      var form = e.target, status = form.querySelector('[data-auth-status]');
      var result = await supabaseClient.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
      if (result.error) { if (status) status.textContent = result.error.message; return; }
      closeAccountModal('auth-modal');
    });
    $('#trips-modal').addEventListener('click', async function (e) {
      if (e.target.closest('[data-close-trips]') || e.target === $('#trips-modal')) return closeAccountModal('trips-modal');
      var loadButton = e.target.closest('[data-load-trip]');
      if (loadButton) {
        e.preventDefault(); e.stopPropagation();
        var tripsBox = $('#trips-modal').querySelector('[data-saved-trips]');
        var tripId = loadButton.getAttribute('data-load-trip');
        var trip = tripsBox && tripsBox._trips && tripsBox._trips.find(function (item) { return String(item.id) === String(tripId); });
        loadButton.disabled = true;
        loadButton.dataset.originalText = loadButton.textContent;
        loadButton.textContent = 'Cargando...';
        (async function () {
          try {
            if (!trip && supabaseClient) {
              var userResult = await supabaseClient.auth.getUser();
              var user = userResult.data && userResult.data.user;
              if (user) {
                var fetched = await supabaseClient.from('trips').select('*').eq('id', tripId).eq('user_id', user.id).maybeSingle();
                trip = fetched.data || null;
              }
            }
            if (!trip) throw new Error('No pudimos encontrar ese viaje guardado.');
            await loadTrip(trip);
          } catch (error) {
            loadButton.disabled = false;
            loadButton.textContent = loadButton.dataset.originalText || 'Cargar';
            notice(error.message || 'No pudimos cargar el viaje.');
          }
        }());
        return;
      }
      var refreshButton = e.target.closest('[data-refresh-trip]');
      if (refreshButton) { e.preventDefault(); e.stopPropagation(); refreshTripPrice(refreshButton.getAttribute('data-refresh-trip'), refreshButton); return; }
      var deleteButton = e.target.closest('[data-delete-trip]');
      if (deleteButton) { e.preventDefault(); e.stopPropagation(); if (window.confirm('¿Borrar este viaje guardado?')) deleteSavedTrip(deleteButton.getAttribute('data-delete-trip')); return; }
      var logout = e.target.closest('[data-signout]');
      if (logout) { await supabaseClient.auth.signOut(); closeAccountModal('trips-modal'); }
    });
    var d0 = addDays(today, 80);
    S.dep = iso(d0); S.ret = iso(addDays(d0, 7));
    $('#dep').value = S.dep; $('#ret').value = S.ret;
    $('#dep').min = iso(addDays(today, 1)); $('#ret').min = iso(addDays(today, 2));
    syncDateRangeFields();
    var dateRangePanel = $('#date-range-panel');
    function openDateRange(which) {
      rangeCalendarStep = which === 'ret' && S.dep ? 'ret' : 'dep';
      var anchor = which === 'ret' ? (S.ret || S.dep) : S.dep;
      rangeCalendarMonth = anchor ? new Date(parse(anchor).getFullYear(), parse(anchor).getMonth(), 1, 12) : new Date(today.getFullYear(), today.getMonth(), 1, 12);
      dateRangePanel.hidden = false;
      $('#dep-trigger').setAttribute('aria-expanded', 'true');
      $('#ret-trigger').setAttribute('aria-expanded', 'true');
      renderDateRangeCalendar();
    }
    $('#dep-trigger').addEventListener('click', function () { openDateRange('dep'); });
    $('#ret-trigger').addEventListener('click', function () { openDateRange('ret'); });
    dateRangePanel.addEventListener('click', function (e) {
      e.stopPropagation();
      var nav = e.target.closest('[data-calendar-nav]');
      if (nav) {
        var amount = nav.getAttribute('data-calendar-nav') === 'next' ? 1 : -1;
        rangeCalendarMonth = new Date(rangeCalendarMonth.getFullYear(), rangeCalendarMonth.getMonth() + amount, 1, 12);
        renderDateRangeCalendar();
        return;
      }
      var day = e.target.closest('[data-range-date]');
      if (!day || day.disabled) return;
      var selectedDate = day.getAttribute('data-range-date');
      if (rangeCalendarStep === 'dep' || !S.dep || selectedDate <= S.dep) {
        S.dep = selectedDate;
        S.ret = '';
        rangeCalendarStep = 'ret';
        syncDateRangeFields();
        renderDateRangeCalendar();
        return;
      }
      S.ret = selectedDate;
      syncDateRangeFields();
      closeDateRangeCalendar();
      $('#ret-trigger').focus();
      schedule();
    });
    document.addEventListener('click', function (e) {
      if (dateRangePanel && !dateRangePanel.hidden && !e.target.closest('.date-range-picker')) closeDateRangeCalendar();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dateRangePanel && !dateRangePanel.hidden) {
        closeDateRangeCalendar();
        $('#dep-trigger').focus();
      }
    });
    $('#bud').value = S.budget;
    $('#pax').textContent = S.pax;
    renderTransportSelector();

    var sel = $('#dest');
    var trigger = document.getElementById('dest-trigger');
    var menu = document.getElementById('dest-menu');
    var destItems = [];
    var activeDestOption = null;

    function setDestDisplay(value) {
      var item = destItems.filter(function (entry) { return entry.value === value && (!S.subcategory || entry.subcategory === S.subcategory); })[0] || destItems.filter(function (entry) { return entry.value === value; })[0];
      var text = item ? item.label : 'Todos los destinos (Buscar por mi presupuesto)';
      if (S.subcategory && (!item || item.subcategory !== S.subcategory)) {
        // Un par invertido ya empieza con el nombre del destino: con destino
        // Fortaleza y par "Fortaleza + Natal" la barra quedaba diciendo
        // "Fortaleza · Fortaleza + Natal", que repite la palabra y no agrega nada.
        // Se muestra solo la parte que aporta: la segunda parada.
        var resto = S.subcategory;
        var base = item ? String(item.label || '') : '';
        if (base && resto.indexOf(base + ' + ') === 0) resto = resto.slice(base.length + 3);
        if (resto) text += ' · ' + resto;
      }
      if (trigger) trigger.value = text;
      if (menu) {
        Array.prototype.forEach.call(menu.querySelectorAll('.custom-select__option'), function (option) {
          var selected = option.getAttribute('data-dest-value') === value && (!S.subcategory || option.getAttribute('data-subcategory') === S.subcategory);
          option.classList.toggle('is-selected', selected);
          option.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
      // Re-filtrar aca y no solo al abrir el menu: el destino se cambia desde
      // el desplegable de arriba, que se puede tocar con este menu abierto. Sin
      // esto la lista seguia mostrando los pares del destino anterior: con
      // Buzios elegido y despues elegir Rio, seguian los dos pares de Buzios.
      filterComboOptions(comboTrigger.value);
      }
      clearActiveDestOption();
    }

    function normalizeDestQuery(value) {
      return String(value || '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    /* Decide si un desplegable (.custom-select) se abre hacia abajo o hacia
       arriba, y le deja la clase que lo invierte.

       El menu cuelga del control y por defecto se dibuja para abajo. En un
       celular, con el teclado abierto y el destino mas abajo del formulario, no
       hay lugar para 420px debajo del campo: el menu se salia de la pantalla y
       las ultimas opciones no se alcanzaban nunca. Abriendolo hacia arriba se
       ve entero y, si tampoco cabe, el max-height de la ventana (dvh) lo deja
       scrollear adentro.

       Se mide con la altura REAL del menu ya visible. Con display:none no hay
       caja, asi que medir antes de mostrar daria 0 y la decision seria siempre
       "abajo". Por eso openDestMenu()/openComboMenu() muestran primero y
       despues llaman a esto. */
    function elegirLadoDelMenu(root) {
      if (!root) return;
      var menu = root.querySelector('.custom-select__menu');
      var control = root.querySelector('.custom-select__control');
      if (!menu || !control || menu.hidden) return;
      var holguraAbajo = window.innerHeight - control.getBoundingClientRect().bottom;
      var holguraArriba = control.getBoundingClientRect().top;
      var alto = menu.offsetHeight || 0;
      // Se queda abajo mientras entre la mitad de la lista. Invertir por un
      // margen de diez pixeles hace que el menu salte de lado con cada scrol.
      root.classList.toggle('is-open-up', alto > 0 && holguraAbajo < alto && holguraArriba > holguraAbajo);
    }

    function clearActiveDestOption() {
      if (activeDestOption) activeDestOption.classList.remove('is-active');
      activeDestOption = null;
      if (trigger) trigger.removeAttribute('aria-activedescendant');
    }

    function filterDestOptions(query, preserveActive) {
      if (!menu) return [];
      var normalized = normalizeDestQuery(query);
      var iataQuery = /^[a-z]{3}$/.test(normalized) && Array.prototype.some.call(menu.querySelectorAll('button[data-dest-value]'), function (option) {
        return normalizeDestQuery(option.getAttribute('data-iata-codes') || '').split(/\s+/).indexOf(normalized) >= 0;
      });
      var visible = [];
      Array.prototype.forEach.call(menu.querySelectorAll('button[data-dest-value]'), function (option) {
        var iataCodes = normalizeDestQuery(option.getAttribute('data-iata-codes') || '').split(/\s+/);
        // El nombre visible de cada opción suele ser el barrio/zona (ej.
        // "Canasvieiras / Norte"), no la ciudad ("Florianópolis") — esa vive
        // solo en el título del grupo, así que hay que sumarla acá también.
        var searchable = normalizeDestQuery(option.textContent + ' ' + (option.getAttribute('data-iata-codes') || '') + ' ' + (option.getAttribute('data-hub-name') || ''));
        var matches = !normalized || (iataQuery ? iataCodes.indexOf(normalized) >= 0 : searchable.indexOf(normalized) >= 0);
        option.hidden = !matches;
        option.style.display = matches ? 'flex' : 'none';
        if (matches) visible.push(option);
      });
      Array.prototype.forEach.call(menu.querySelectorAll('.custom-select__group'), function (group) {
        var hasVisibleOption = !!group.querySelector('button[data-dest-value]:not([hidden])');
        group.hidden = !hasVisibleOption;
        group.style.display = hasVisibleOption ? 'block' : 'none';
        // La linea que separa los destinos sueltos de los pares se esconde
        // junto con el grupo: si ningun par quedo visible, la linea sola seria
        // un titulo sin nada debajo.
        Array.prototype.forEach.call(group.querySelectorAll('.custom-select__pairs-note'), function (note) {
          var hayPar = !!group.querySelector('button[data-subcategory*=" + "]:not([hidden])');
          note.hidden = !hayPar;
          note.style.display = hayPar ? 'block' : 'none';
        });
      });
      if (!preserveActive || activeDestOption && activeDestOption.hidden) clearActiveDestOption();
      return visible;
    }

    function setActiveDestOption(option) {
      clearActiveDestOption();
      if (!option || !trigger) return;
      activeDestOption = option;
      activeDestOption.classList.add('is-active');
      trigger.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }

    function closeDestMenu() {
      if (!menu || !trigger || !sel) return;
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      sel.classList.remove('is-open', 'is-open-up');
      setDestDisplay(S.dest);
    }

    function openDestMenu() {
      if (!menu || !trigger || !sel) return;
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      sel.classList.add('is-open');
      // Despues de mostrar, no antes: con el menu en hidden no tiene caja y la
      // medida de alto daria 0, con lo que la decision seria siempre "abajo".
      elegirLadoDelMenu(sel);
    }

    Object.defineProperty(sel, 'value', {
      get: function () { return S.dest; },
      set: function (value) {
        S.dest = String(value || 'todos');
        setDestDisplay(S.dest);
      },
      configurable: true
    });

    function updateDestinationMode() {
      var all = S.dest === 'todos';
      $('#btn-buscar-todos').hidden = !all;
      // Sin destino elegido no hay resultados: es el estado inicial, así que la
      // sección de destacados vuelve a estar disponible.
      if (all) { setHighlightsVisible(true); $('#results').innerHTML = ''; $('#destination-results').innerHTML = ''; }
    }
    function syncTransportSelection() {
      if (S.dest === 'todos') { S.transport = 'flight'; }
      if (S.transport === 'roadtrip') S.transport = 'auto';
      if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
      if (['flight', 'bus', 'auto'].indexOf(S.transport) < 0) S.transport = 'flight';
      renderTransportSelector();
    }
    // Que segunda parada declara una subcategoria, si declara alguna.
// Las subcategorias son la unica fuente de verdad de que combinaciones se
// ofrecen. El servidor despues valida que el par exista y sea alcanzable por
// tierra, pero que el par se ofrezca lo decide esta lista.
function secondKeyForSubcategory(subcategory, firstKey) {
  var needle = String(subcategory || '').trim();
  if (!needle || !firstKey) return '';
  var found = '';
  DESTINATION_GROUPS.forEach(function (group) {
    group.subcategories.forEach(function (sub) {
      if (found) return;
      if (String(sub.label || '').trim() === needle && sub.key === firstKey) found = sub.secondKey || '';
    });
  });
  return found;
}

function selectDestination(nextValue, subcategory, fromFeatured, requestedHotelType, secondKeyForzado) {
      var destinationKey = String(nextValue || 'todos');
      if (!destinationKey) return;
      if (!fromFeatured) featuredProposalSelection = null;
      S.dest = destinationKey; S.proposalId = ''; S.subcategory = String(subcategory || '');
  /* La segunda parada sale de la subcategoría, que es la fuente de verdad de qué
     pares se ofrecen. `secondKeyForzado` existe para el caso en que la subcategoria
     no está en la lista con ese nombre: un par leído al revés ("Fortaleza +
     Natal" cuando el dato dice "Natal + Fortaleza"). Ahí la segunda parada no se
     deduce del nombre sino de la opción que se eligió, y mandarla a buscar al
     nombre haría que el server cotizara un viaje de una sola parada.

     Se distingue "no vine" de "viene vacío" con undefined: si no viene nada se
     deduce del nombre, y un string vacío se respeta como "sin segunda parada". */
  S.second = secondKeyForzado != null
    ? String(secondKeyForzado)
    : secondKeyForSubcategory(S.subcategory, destinationKey);
      var inferredHotelType = requestedHotelType || inferHotelType(S.subcategory);
      S.hotelTypeExplicit = !!inferredHotelType;
      S.hotelType = inferredHotelType || hotelTypeForStyle(S.style);
      if (S.dest === 'todos') { S.transport = 'flight'; }
      else if (!isRoadtripDestinationAllowed(S.dest) && S.transport === 'auto') { S.transport = 'flight'; }
      setDestDisplay(S.dest);
      closeDestMenu();
      // El par también puede entrar por el desplegable de Destino: sin esto,
      // elegir "Búzios + Arraial do Cabo" desde el menú dejaba el control de
      // segunda parada mostrando un par viejo (o el placeholder).
      syncComboDisplay();
      massSearch = false; updateDestinationMode(); syncTransportSelection();
      if (S.dest !== 'todos') schedule();
    }
    var originInput = document.getElementById('origin-input');
    function readOriginCode(value) {
      var text = String(value || '').trim().toUpperCase();
      if (text === 'MVD' || /\(MVD\)$/.test(text)) return 'MVD';
      if (text === 'PDP' || /\(PDP\)$/.test(text)) return 'PDP';
      return '';
    }
    var originPicker = document.getElementById('origin-picker');
    var originMenu = document.getElementById('origin-menu');
    var originToggle = document.getElementById('origin-toggle');
    function filterOriginOptions(query) {
      if (!originMenu) return [];
      var normalized = normalizeDestQuery(query);
      var typedCode = readOriginCode(query);
      var visible = [];
      Array.prototype.forEach.call(originMenu.querySelectorAll('[data-origin-code]'), function (option) {
        var code = option.getAttribute('data-origin-code');
        var text = normalizeDestQuery(option.textContent + ' ' + code);
        var matches = !normalized || code === typedCode || text.indexOf(normalized) >= 0;
        option.hidden = !matches;
        option.style.display = matches ? 'grid' : 'none';
        if (matches) visible.push(option);
      });
      return visible;
    }
    function openOriginMenu() {
      if (!originMenu || !originInput) return;
      originMenu.hidden = false;
      originInput.setAttribute('aria-expanded', 'true');
      if (originToggle) originToggle.setAttribute('aria-expanded', 'true');
    }
    function closeOriginMenu(restoreValue) {
      if (!originMenu) return;
      originMenu.hidden = true;
      if (originInput) {
        originInput.setAttribute('aria-expanded', 'false');
        if (restoreValue) originInput.value = originLabel(S.origin);
      }
      if (originToggle) originToggle.setAttribute('aria-expanded', 'false');
    }
    function selectOrigin(code) {
      if (code !== 'MVD' && code !== 'PDP') return;
      var changed = S.origin !== code;
      S.origin = code;
      if (originInput) originInput.value = originLabel(code);
      closeOriginMenu(false);
      if (changed && S.dest !== 'todos') schedule();
    }
    function syncOriginFromInput(restoreLabel) {
      var code = readOriginCode(originInput && originInput.value);
      if (!code) {
        if (restoreLabel && originInput) originInput.value = originLabel(S.origin);
        return;
      }
      var changed = S.origin !== code;
      S.origin = code;
      if (restoreLabel && originInput) originInput.value = originLabel(code);
      if (changed && S.dest !== 'todos') schedule();
    }
    if (originInput) {
      originInput.addEventListener('focus', function () {
        if (originInput.value === originLabel(S.origin)) originInput.value = '';
        filterOriginOptions(originInput.value);
        openOriginMenu();
      });
      originInput.addEventListener('input', function () { syncOriginFromInput(false); filterOriginOptions(originInput.value); openOriginMenu(); });
      originInput.addEventListener('change', function () { syncOriginFromInput(true); });
      originInput.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { closeOriginMenu(true); return; }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          var options = filterOriginOptions(originInput.value);
          openOriginMenu();
          if (options[0]) options[0].focus();
        } else if (event.key === 'Enter') {
          var code = readOriginCode(originInput.value);
          if (code) { event.preventDefault(); selectOrigin(code); }
        }
      });
    }
    if (originMenu) {
      originMenu.addEventListener('pointerdown', function (event) { if (event.target.closest('[data-origin-code]')) event.preventDefault(); });
      originMenu.addEventListener('click', function (event) {
        var option = event.target.closest('[data-origin-code]');
        if (option) selectOrigin(option.getAttribute('data-origin-code'));
      });
      originMenu.addEventListener('keydown', function (event) {
        var option = event.target.closest('[data-origin-code]');
        if (event.key === 'Escape') { closeOriginMenu(true); if (originInput) originInput.focus(); }
        else if (event.key === 'Enter' && option) { event.preventDefault(); selectOrigin(option.getAttribute('data-origin-code')); if (originInput) originInput.focus(); }
      });
    }
    if (originToggle) {
      originToggle.addEventListener('click', function () {
        if (originMenu && !originMenu.hidden) closeOriginMenu(true);
        else { filterOriginOptions(''); openOriginMenu(); }
      });
    }
    var highlights = document.getElementById('destination-highlights');
    if (highlights) {
      loadFeaturedPrices(0);
      // Las pestañas de mes son botones, no un <select>: se escuchan por click.
      // Cada ventana trae sus propias fechas, así que al cambiar de mes se
      // actualizan también los campos de ida y vuelta del formulario.
      highlights.addEventListener('click', function (event) {
        var monthTab = event.target.closest('[data-feature-month]');
        if (monthTab) {
          var windowIndex = Number(monthTab.getAttribute('data-feature-month'));
          var window = featuredMonthWindows(6)[windowIndex];
          if (!window) return;
          // Sin force: la clave del cache ya incluye la ventana (depIso, retIso,
          // etc.), así que las entradas son perfectamente reutilizables. Con
          // force cada clic de pestaña de mes era un /api/destinos-destacados
          // nuevo: ir y volver entre dos meses N veces costaba N requests donde
          // alcanzaban con 2.
          loadFeaturedPrices(windowIndex);
          S.dep = window.depIso; S.ret = window.retIso;
          syncDateRangeFields();
          if (S.dest !== 'todos') { pendingDestinationScroll = true; schedule(); }
          return;
        }
        var arrow = event.target.closest('[data-feature-prev], [data-feature-next]');
        if (arrow) {
          var carousel = highlights.querySelector('.destination-highlights__carousel');
          if (!carousel) return;
          var forward = arrow.hasAttribute('data-feature-next');
          var atEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 4;
          var atStart = carousel.scrollLeft <= 4;
          if (carousel.scrollWidth <= carousel.clientWidth + 4) {
            if (forward) carousel.appendChild(carousel.firstElementChild);
            else carousel.insertBefore(carousel.lastElementChild, carousel.firstElementChild);
          } else if (forward && atEnd) carousel.scrollTo({ left: 0, behavior: 'smooth' });
          else if (!forward && atStart) carousel.scrollTo({ left: carousel.scrollWidth, behavior: 'smooth' });
          else carousel.scrollBy({ left: forward ? carousel.clientWidth : -carousel.clientWidth, behavior: 'smooth' });
          return;
        }
        var choose = event.target.closest('[data-feature-search]');
        if (!choose) return;
        var group = DESTINATION_GROUPS.filter(function (item) { return item.id === choose.getAttribute('data-feature-search'); })[0];
        var window = activeFeatureWindow();
        if (!group || !window) return;
        // Misma zona y mismas fechas que las de la tarjeta: el precio mostrado
        // y la propuesta que se abren tienen que ser la misma, siempre.
        var subcategory = featuredSubcategory(group, window);
        if (subcategory) {
          featuredProposalSelection = { monthIndex: window.month, subcategory: subcategory };
          S.dep = window.depIso; S.ret = window.retIso;
          syncDateRangeFields();
          pendingDestinationScroll = true;
          selectDestination(subcategory.key, subcategory.label, true, subcategory.hotelType);
        }
      });
    }
    function bindDestinationOption(option) {
      if (!option) return;
      option.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        selectDestination(option.getAttribute('data-dest-value'), option.getAttribute('data-subcategory'));
      };
    }
    document.addEventListener('pointerdown', function (event) {
      var option = event.target.closest && event.target.closest('#dest-menu button[data-dest-value]');
      if (!option || option.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      selectDestination(option.getAttribute('data-dest-value'), option.getAttribute('data-subcategory'));
    }, true);
    if (trigger) {
      trigger.addEventListener('click', function () {
        if (menu && menu.hidden) {
          trigger.value = '';
          filterDestOptions('');
          openDestMenu();
        }
      });
      trigger.addEventListener('focus', function () {
        if (menu && menu.hidden) {
          trigger.value = '';
          filterDestOptions('');
          openDestMenu();
        }
      });
      trigger.addEventListener('input', function () {
        var enteredOrigin = readOriginCode(trigger.value);
        if (enteredOrigin) {
          var originChanged = S.origin !== enteredOrigin;
          S.origin = enteredOrigin;
          if (originInput) originInput.value = originLabel(enteredOrigin);
          trigger.value = '';
          if (originChanged && S.dest !== 'todos') schedule();
        }
        filterDestOptions(trigger.value);
        openDestMenu();
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeDestMenu(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (menu.hidden) openDestMenu();
          var visible = filterDestOptions(trigger.value, true);
          if (!visible.length) return;
          var index = activeDestOption ? visible.indexOf(activeDestOption) : -1;
          index = e.key === 'ArrowDown' ? (index + 1) % visible.length : (index <= 0 ? visible.length - 1 : index - 1);
          setActiveDestOption(visible[index]);
        } else if (e.key === 'Enter' && menu && !menu.hidden) {
          e.preventDefault();
          var matches = filterDestOptions(trigger.value, true);
          var option = activeDestOption;
          if (!option) {
            var query = normalizeDestQuery(trigger.value);
            var destinations = matches.filter(function (candidate) { return candidate.getAttribute('data-dest-value') !== 'todos'; });
            option = (query && destinations.filter(function (candidate) {
              var label = candidate.querySelector('.custom-select__option-main');
              return label && normalizeDestQuery(label.textContent).indexOf(query) === 0;
            })[0]) || destinations[0] || matches[0];
          }
          if (option) selectDestination(option.getAttribute('data-dest-value'), option.getAttribute('data-subcategory'));
        }
      });
    }
    var comboRoot = document.getElementById('combo');
    var comboTrigger = document.getElementById('combo-trigger');
    var comboMenu = document.getElementById('combo-menu');
    var activeComboOption = null;

    document.addEventListener('click', function (e) {
      if (originPicker && !originPicker.contains(e.target)) closeOriginMenu(true);
      if (sel && !sel.contains(e.target)) closeDestMenu();
      if (comboRoot && !comboRoot.contains(e.target)) closeComboMenu();
    });

    /* ---------- segunda parada: los 95 pares ---------- */
    // El menú se arma una vez, al arrancar, con la misma data que el desplegable
    // de Destino (comboGroups()). No hay precios acá: el total de un par depende
    // de cuántas noches van en cada parada, así que un número en el menú sería
    // inventado.
    //
    // Cada opción lleva las DOS paradas en atributos: `data-combo-key` es la
    // primera y `data-combo-second` la segunda. El filtro usa las dos, que es lo
    // que hace que la ruta funcione en los dos sentidos, y el nombre visible lo
    // reescribe comboLabel() cuando el destino elegido es la segunda parada.
    function renderComboMenu() {
      if (!comboMenu) return;
      var bloques = comboGroups().map(function (entry) {
        var opciones = entry.pairs.map(function (sub) {
          return '<button type="button" class="custom-select__option" role="option" aria-selected="false"'
            + ' data-combo-key="' + esc(sub.key) + '" data-combo-second="' + esc(sub.secondKey) + '"'
            + ' data-combo-sub="' + esc(sub.label) + '"'
            + ' id="combo-option-' + esc(sub.key) + '-' + entry.pairs.indexOf(sub) + '">'
            + '<span class="custom-select__option-main">' + esc(sub.label) + '</span></button>';
        }).join('');
        return '<div class="custom-select__group" data-combo-group="' + esc(entry.group.id) + '"><span class="custom-select__group-title">'
          + '<span>' + esc(entry.group.label) + '</span>'
          + '<strong class="custom-select__group-count">' + entry.pairs.length + '</strong></span>'
          + opciones + '</div>';
      }).join('');
      // "Un solo destino" va primero y no es un par: es la vuelta atrás. Sin él
      // habría que tocar el desplegable de Destino para deshacer una elección.
      comboMenu.innerHTML = '<p class="combo-menu__hint" data-combo-hint></p>'
        + '<button type="button" class="custom-select__option combo-clear" role="option" aria-selected="false" data-combo-clear>'
        + '<span class="custom-select__option-main">Un solo destino</span>'
        + '<span class="custom-select__option-sub">Sacar la segunda parada</span></button>' + bloques;
    }

    /* El menú se filtra por el destino elegido, no solo por lo que se tipea.
       El control dice "¿Sumás una segunda parada?", asi que su pregunta es
       "sumarle otra a ESTE destino". Con Destino = Búzios ofrecer los pares del
       país entero no era un filtro: "Angra dos Reis + Ilha Grande" no es una
       segunda parada de Búzios, es otro viaje entero, y escribir Río ahí
       rompía la promesa del campo de arriba.

       EL FILTRO ES POR LAS DOS PARADAS, no solo por la primera. Un par define las
       dos paradas, así que pasa el filtro si el destino elegido es cualquiera de
       las dos: con Destino = Natal tiene que aparecer "Natal + Fortaleza", y con
       Destino = Fortaleza el mismo viaje al revés, "Fortaleza + Natal".

       Antes solo miraba key (la primera parada), y por eso el filtro era
       asimétrico: los pares se escriben una vez, en un orden, y desde el otro
       lado no había nada que mostrar. Con Destino = Fortaleza el menú quedaba
       vacío ("Desde Fortaleza no hay combinaciones de dos paradas") mientras que
       con Destino = Natal sí aparecía "Natal + Fortaleza". La misma ruta, en un
       sentido sí y en el otro no.

       La lista de datos NO se duplica: un par sigue siendo una entrada y lo que
       se invierte es la lectura, con comboInvertido() y comboLabel(). El server
       ya sabía ir en cualquier orden —cotiza con dest y second, y la
       combinabilidad la decide la geografía, que es simétrica—, así que el
       problema era solo de la lista. */
    function comboFiltraPorDestino() {
      return S.dest && S.dest !== 'todos' ? S.dest : '';
    }
    // ¿Este par se tiene que leer al reves? Sí cuando el destino elegido es la
    // SEGUNDA parada del par. El caso en que las dos sean iguales se excluye
    // explícitamente aunque no exista (prueba-pares.js lo corta): si existiera,
    // el par se mostraría dos veces y se cotizaría al reves sin querer.
    function comboInvertido(option) {
      var elegido = comboFiltraPorDestino();
      if (!elegido) return false;
      var a = option.getAttribute('data-combo-key');
      var b = option.getAttribute('data-combo-second');
      return !!b && b === elegido && a !== elegido;
    }
    // El nombre del par en el orden en que se va a cotizar. Es el único lugar
    // donde se decide el texto, y lo usan el filtro, la marca de "elegida" y la
    // elección. Si cada uno armara su propio nombre, el menú podría mostrar
    // "Fortaleza + Natal" y elegir una opción que cotiza Natal -> Fortaleza.
    function comboLabel(option) {
      var sub = option.getAttribute('data-combo-sub') || '';
      if (!comboInvertido(option)) return sub;
      var partes = sub.split(' + ');
      return partes.length === 2 ? partes[1] + ' + ' + partes[0] : sub;
    }
function comboNombreDestino() {
      var key = comboFiltraPorDestino();
      if (!key) return '';
      // El nombre sale del GRUPO, no de destItems: las opciones del desplegable
      // traen la zona ("Rio de Janeiro (Centro / Sur)", "Palermo / Zona Norte",
      // "Gramado Centro") y partir eso por " / " deja "Rio de Janeiro (Centro" y
      // "Centro". El grupo trae la ciudad, que es lo que la persona leyo en el
      // campo de arriba. Primero se saca el parentesis y despues el " / " porque
      // "Costa Verde (Ilhabela / Ubatuba / Paraty)" se parte por dentro del paren.
      var grupo = DESTINATION_GROUPS.filter(function (g) { return (g.keys || []).indexOf(key) >= 0; })[0];
      if (!grupo) return '';
      var label = String(grupo.label || "").replace(/\s*\([^)]*\)\s*/g, " ");
      return label.split(" / ")[0].trim();
    }
    function comboPasaElFiltro(option) {
      // "Un solo destino" no es un par: es una accion, y tiene que quedar
      // disponible siempre que haya algo que deshacer.
      if (option.hasAttribute('data-combo-clear')) return true;
      var elegido = comboFiltraPorDestino();
      if (!elegido) return true;
      // Las dos paradas, no solo la primera: este es el arreglo de la
      // bidireccionalidad. Con el destino elegido como segunda parada del par, el
      // par pasa igual y se muestra al reves.
      return option.getAttribute('data-combo-key') === elegido
        || option.getAttribute('data-combo-second') === elegido;
    }

    // El texto del control sale de S.subcategory en vez de guardarse aparte: es
    // el mismo string que la opción del desplegable, así que elegir el par por
    // cualquiera de los dos lados lo muestra en los dos.
    function syncComboDisplay() {
      if (!comboTrigger) return;
      var label = S.second ? S.subcategory : '';
      // Mientras el menú está abierto lo que hay en el input es la búsqueda en
      // curso, no la selección: pisarlo sería borrar lo que se está tipeando.
      if (comboMenu.hidden || document.activeElement !== comboTrigger) comboTrigger.value = label;
      if (!comboMenu) return;
      Array.prototype.forEach.call(comboMenu.querySelectorAll('.custom-select__option'), function (option) {
        // Se compara contra comboLabel() y no contra el atributo: si el par está
        // invertido, el texto guardado es "Fortaleza + Natal" y el atributo
        // canonico sigue diciendo "Natal + Fortaleza". Comparando el atributo,
        // cambiar de dirección dejaba el control sin marcar nada.
        var selected = !!label && comboLabel(option) === label;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
    }

    function clearActiveComboOption() {
      if (activeComboOption) activeComboOption.classList.remove('is-active');
      activeComboOption = null;
      if (comboTrigger) comboTrigger.removeAttribute('aria-activedescendant');
    }

    function filterComboOptions(query, preserveActive) {
      if (!comboMenu) return [];
      var normalized = normalizeDestQuery(query);
      var visible = [];
      var pares = [];
      Array.prototype.forEach.call(comboMenu.querySelectorAll('.custom-select__option'), function (option) {
        // Los dos filtros van juntos: el de destino es el que hace la lista
        // corta, y el de texto solo acota mas lo que ya quedo.
        var porDestino = comboPasaElFiltro(option);
        // El nombre se reescribe ANTES de filtrar por texto, y no solo si la
        // opción va a quedar visible: se reescribe siempre que el par quede
        // invertido. Con el nombre canonico, buscar "Fortaleza" con Destino =
        // Fortaleza no encontraba "Fortaleza + Natal" (decia "Natal +
        // Fortaleza") y el menu se leia como que no habia ningun resultado.
        var etiqueta = comboLabel(option);
        var texto = option.querySelector('.custom-select__option-main');
        if (texto && texto.textContent !== etiqueta) texto.textContent = etiqueta;
        var porTexto = !normalized || normalizeDestQuery(etiqueta).indexOf(normalized) >= 0;
        var matches = porDestino && porTexto;
        option.hidden = !matches;
        option.style.display = matches ? 'flex' : 'none';
        if (matches) {
          visible.push(option);
          if (!option.hasAttribute('data-combo-clear')) pares.push(option);
        }
      });
      // El grupo entero se va con sus opciones: un encabezado de región con
      // cero opciones debajo se lee como algo roto.
      Array.prototype.forEach.call(comboMenu.querySelectorAll('.custom-select__group'), function (group) {
        var hasVisible = !!group.querySelector('.custom-select__option:not([hidden])');
        group.hidden = !hasVisible;
        group.style.display = hasVisible ? 'block' : 'none';
      });
      // El encabezado del menu dice con que se esta filtrando, y avisa cuando no
      // hay nada. Sin el aviso, un destino sin combinaciones (Buenos Aires, Foz)
      // abre un menu vacio y se lee como que la pagina fallo.
      var hint = comboMenu.querySelector('[data-combo-hint]');
      if (hint) {
        var destino = comboNombreDestino();
        if (pares.length) {
          // "que arrancan en" era correcto solo cuando todos los pares tenian al
          // destino como primera parada. Con la bidireccionalidad puede estar
          // como segunda, asi que el texto tiene que cubrir los dos casos sin
          // mentir en ninguno: "con <destino>" sirve para los dos.
          hint.textContent = destino ? 'Combinaciones con ' + destino : 'Elegí las dos paradas';
          hint.hidden = !destino;
        } else {
          hint.textContent = destino
            ? 'Con ' + destino + ' no hay combinaciones de dos paradas.'
            : 'Elegí las dos paradas.';
          hint.hidden = false;
        }
      }
      if (!preserveActive || activeComboOption && activeComboOption.hidden) clearActiveComboOption();
      return visible;
    }

    function setActiveComboOption(option) {
      clearActiveComboOption();
      if (!option || !comboTrigger) return;
      activeComboOption = option;
      activeComboOption.classList.add('is-active');
      comboTrigger.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }

    function closeComboMenu() {
      if (!comboMenu || !comboTrigger || !comboRoot) return;
      comboMenu.hidden = true;
      comboTrigger.setAttribute('aria-expanded', 'false');
      comboRoot.classList.remove('is-open', 'is-open-up');
      syncComboDisplay();
    }

    function openComboMenu() {
      if (!comboMenu || !comboTrigger || !comboRoot) return;
      comboMenu.hidden = false;
      comboTrigger.setAttribute('aria-expanded', 'true');
      comboRoot.classList.add('is-open');
      elegirLadoDelMenu(comboRoot);
    }

    function chooseCombo(option) {
      if (!option) return;
      if (option.hasAttribute('data-combo-clear')) {
        // Sacar la segunda parada sin perder la zona: si la subcategoría actual
        // es un par se va, y si era una zona ("Ruta de Playas") se queda.
        //
        // La pregunta se hace con S.second y no con secondKeyForSubcategory(): un
        // par invertido ("Fortaleza + Natal" con Natal de primera) no existe en
        // DESTINATION_GROUPS con ese nombre, así que la busqueda daba vacio,
        // eraPar salia falso y "Un solo destino" no sacaba la segunda parada.
        // S.second es el estado real: si hay segunda parada, se saca.
        var eraPar = !!S.second;
        selectDestination(S.dest, eraPar ? '' : S.subcategory);
        return;
      }
      /* selectDestination() es el único camino para cotizar: saca el secondKey,
         arma la query con ?second= y dispara la búsqueda. Escribir la query a
         mano saltearía los dos primeros pasos y el par se cotizaría como si fuera
         de una sola parada.

         Cuando el par está invertido, el destino elegido ES la segunda parada del
         dato, así que cotizar el par tal cual cambiaría el destino por el otro
         sin avisar. Por eso se llama con la primera parada del dato como
         `secondKeyForzado`: el server recibe dest=<elegido> y second=<la otra>, que
         es el viaje que se está mostrando en pantalla. Sin ese quinto argumento
         el server buscaría el nombre invertido en DESTINATION_GROUPS, no lo
         encontraría y mandaría un viaje de una sola parada. */
      pendingDestinationScroll = true;
      selectDestination(
        comboFiltraPorDestino() || option.getAttribute('data-combo-key'),
        comboLabel(option),
        false,
        undefined,
        comboInvertido(option) ? option.getAttribute('data-combo-key') : undefined
      );
    }

    if (comboRoot && comboTrigger && comboMenu) {
      renderComboMenu();
      syncComboDisplay();
      // Se escucha por delegación sobre el menú, no por opción: son 89 botones.
      comboMenu.addEventListener('click', function (event) {
        var option = event.target.closest('.custom-select__option');
        if (!option || option.hidden) return;
        event.preventDefault();
        event.stopPropagation();
        chooseCombo(option);
        closeComboMenu();
      });
      comboTrigger.addEventListener('click', function () {
        if (comboMenu.hidden) { comboTrigger.value = ''; filterComboOptions(''); openComboMenu(); }
      });
      comboTrigger.addEventListener('focus', function () {
        if (comboMenu.hidden) { comboTrigger.value = ''; filterComboOptions(''); openComboMenu(); }
      });
      comboTrigger.addEventListener('input', function () {
        filterComboOptions(comboTrigger.value);
        openComboMenu();
      });
      comboTrigger.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeComboMenu(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (comboMenu.hidden) openComboMenu();
          var visibles = filterComboOptions(comboTrigger.value, true);
          if (!visibles.length) return;
          var i = activeComboOption ? visibles.indexOf(activeComboOption) : -1;
          i = e.key === 'ArrowDown' ? (i + 1) % visibles.length : (i <= 0 ? visibles.length - 1 : i - 1);
          setActiveComboOption(visibles[i]);
        } else if (e.key === 'Enter' && !comboMenu.hidden) {
          e.preventDefault();
          // Igual que el desplegable de Destino: Enter toma la opción activa, o
          // la primera que arranca con lo tipeado, o la primera que haya.
          var matches = filterComboOptions(comboTrigger.value, true);
          var option = activeComboOption;
          if (!option) {
            var q = normalizeDestQuery(comboTrigger.value);
            var conKey = matches.filter(function (candidate) { return !candidate.hasAttribute('data-combo-clear'); });
            option = (q && conKey.filter(function (candidate) {
              var label = candidate.querySelector('.custom-select__option-main');
              return label && normalizeDestQuery(label.textContent).indexOf(q) === 0;
            })[0]) || conKey[0] || matches[0];
          }
          if (option) { chooseCombo(option); closeComboMenu(); }
        }
      });
    }
    sel.addEventListener('change', function () {
      selectDestination(sel.value);
    });
    var transportSelector = $('#transport-selector');
    if (transportSelector) {
      transportSelector.addEventListener('click', function (e) {
        var button = e.target.closest('[data-transport-mode]');
        if (!button) return;
        S.transport = button.getAttribute('data-transport-mode');
        if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
        if (S.transport === 'bus' && getAvailableTransportModes(S.dest).every(function (mode) { return mode.value !== 'bus'; })) S.transport = 'flight';
        renderTransportSelector();
        if (S.dest !== 'todos') schedule();
      });
    }
    $('#btn-buscar-todos').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); findDestinations(); });
    $('.form').addEventListener('keydown', function (e) { if (e.key === 'Enter' && S.dest === 'todos') { e.preventDefault(); $('#btn-buscar-todos').click(); } });
    document.addEventListener('click', handleProposalNavigation, true);
    document.addEventListener('click', handleBreakdownToggle, true);
    document.addEventListener('click', handleProposalSelect, true);
    document.addEventListener('click', handleBudgetJump, true);
    $('#dep').addEventListener('change', function (e) {
      var old = S.dep && S.ret ? Math.round((parse(S.ret) - parse(S.dep)) / 864e5) : 7;
      S.dep = e.target.value;
      if (S.dep && (!S.ret || parse(S.ret) <= parse(S.dep))) { S.ret = iso(addDays(parse(S.dep), Math.max(old, 1))); $('#ret').value = S.ret; }
      syncDateRangeFields();
      schedule();
    });
    $('#ret').addEventListener('change', function (e) { S.ret = e.target.value; syncDateRangeFields(); schedule(); });
    $('#bud').addEventListener('input', function (e) { S.budget = Math.max(0, Number(e.target.value) || 0); schedule(); });
    $('#pm').addEventListener('click', function () { S.pax = Math.max(1, S.pax - 1); $('#pax').textContent = S.pax; alCambiarViajeros(); });
    $('#pp').addEventListener('click', function () { S.pax = Math.min(10, S.pax + 1); $('#pax').textContent = S.pax; alCambiarViajeros(); });
    $('#seg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.style = b.getAttribute('data-v');
      if (!S.hotelTypeExplicit) S.hotelType = hotelTypeForStyle(S.style);
      Array.prototype.forEach.call(document.querySelectorAll('#seg button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      schedule();
    });
    $('#trip-summary').addEventListener('click', function (e) {
      var summaryCta = e.target.closest('[data-summary-book]');
      if (!summaryCta) return;
      e.preventDefault(); e.stopPropagation();
      openItinerarySummaryModal();
    });
    $('#results').addEventListener('click', function (e) {
      var proposal = e.target.closest('[data-propuesta-id]');
      if (proposal) { e.preventDefault(); e.stopPropagation(); var proposalId = proposal.getAttribute('data-propuesta-id'); var selected = lastData && (byId(lastData.list, proposalId) || byId(lastData.alternatives, proposalId) || byId(lastData.roadtripList, proposalId)); if (selected) showProposalView(selected, lastData); return; }
      var selectedFlight = e.target.closest('[data-select-flight]');
      if (selectedFlight) {
        e.preventDefault(); e.stopPropagation();
        persistSelectedOffer(selectedFlight);
        actualizarPasajes(selectedFlight.closest('.flight-search'), Number(selectedFlight.getAttribute('data-offer-price')), selectedFlight.getAttribute('data-offer-airline'));
        return;
      }      var b = e.target.closest('[data-shift]'); if (!b) return;
      var s = Number(b.getAttribute('data-shift'));
      S.dep = iso(addDays(parse(S.dep), s)); S.ret = iso(addDays(parse(S.ret), s));
      syncDateRangeFields();
      schedule();
    });
    $('#vista-detalle').addEventListener('click', function (e) {
      var moreTours = e.target.closest('[data-toggle-more-tours]');
      if (moreTours) {
        e.preventDefault(); e.stopPropagation();
        var toursSection = moreTours.closest('.local-tours');
        if (!toursSection) return;
        var expanded = toursSection.classList.toggle('local-tours--expanded');
        moreTours.setAttribute('aria-expanded', String(expanded));
        moreTours.innerHTML = expanded ? 'Ver menos tours <span aria-hidden="true">⌃</span>' : 'Ver más tours (' + (toursSection.querySelectorAll('.local-tour').length - 3) + ') <span aria-hidden="true">⌄</span>';
        return;
      }
      var startFlightSearch = e.target.closest('[data-start-flight-search],[data-retry-flight-search]');
      if (startFlightSearch) {
        e.preventDefault(); e.stopPropagation();
        if (detailState) searchFlights(detailState.meta, startFlightSearch.closest('.flight-search'));
        return;
      }
      var busClear = e.target.closest('[data-bus-clear]');
      if (busClear && detailState) {
        e.preventDefault();
        Array.prototype.forEach.call(document.querySelectorAll('[data-bus-choice]'), function (r) { r.checked = false; });
        actualizarBus(null, '');
        var caja = busClear.closest('.bus-companies'); if (caja) busClear.remove();
        return;
      }
      var dailyBudgetCard = e.target.closest('[data-daily-kind]');
      if (dailyBudgetCard && detailState) {
        if (e.target.closest('input')) return;
        e.preventDefault(); e.stopPropagation();
        var kind = dailyBudgetCard.getAttribute('data-daily-kind');
        var isSelected = dailyBudgetCard.classList.contains('is-selected');
        if (kind === 'local-custom' || kind === 'food-custom') {
          var customKind = kind.split('-')[0];
          if (isSelected) {
            aplicarPresupuestoDiario(customKind, 'none', 0);
            repintarPresupuestoDiario();
            return;
          }
          // El monto tipeado queda guardado, así que volver a "Personalizado"
          // recupera lo que la persona había escrito. Si nunca escribió nada se
          // conserva el valor que había, para que elegir la casilla no borre el
          // rubro mientras escribe.
          var saved = detailState[customKind + 'CustomValue'];
          if (saved != null && Number.isFinite(Number(saved))) aplicarPresupuestoDiario(customKind, 'custom', saved);
          else detailState[customKind + 'BudgetMode'] = 'custom';
          repintarPresupuestoDiario();
          var customInput = document.querySelector('[data-daily-' + customKind + ']');
          if (customInput) customInput.focus();
          return;
        }
        var value = Number(dailyBudgetCard.getAttribute('data-daily-value')) || 0;
        // Sólo es un segundo clic si el monto que está en el presupuesto es
        // justamente el de esta tarjeta. Al abrir el viaje el resaltado es por
        // aproximación y puede señalar un preset vecino del estimado, y ese
        // primer clic tiene que elegir, no borrar.
        if (isSelected && Math.abs(currentDailyValue(kind) - value) < 0.5) value = null;
        // Elegir a mano otro nivel (o "Personalizado", arriba) pisa el del perfil.
        if (value != null) detailState[kind + 'PresetKey'] = dailyBudgetCard.getAttribute('data-daily-key') || '';
        aplicarPresupuestoDiario(kind, value == null ? 'none' : 'preset', value);
        repintarPresupuestoDiario();
        return;
      }
      /* Sin boton de agregar por tarjeta. La ficha entera es la zona sensible y
         el checkbox decide si la experiencia entra al viaje; el pedido se manda
         desde "Mi Viaje", que ya junta actividades y transfer. El boton hacia las
         dos cosas —elegir y abrir el checkout— y por eso era otra vez a elegir en
         que seccion estabas para no mandar el pedido a otro lado. */
      var tourDetail = e.target.closest('[data-tour-detail-open]');
      if (tourDetail) {
        e.preventDefault(); e.stopPropagation();
        openTourDetailModal(tourDetail);
        return;
      }
      // La tarjeta completa es la zona sensible: el checkbox va estirado con
      // position:absolute encima del article, asi que el clic llega al input y el
      // toggle es el nativo del navegador. Solo el boton de detalle se superpone
      // (z-index) y por eso se atiende antes, aca.
      var tourCard = e.target.closest('[data-tour-card]');
      if (tourCard && !e.target.closest('a,button,label')) {
        return;
      }
      if (e.target.closest('#btn-volver')) {
        e.preventDefault(); e.stopPropagation();
        volverAHome(); return;
      }
      // Hotel: el input es un radio nativo, así que el clic repetido no lo
      // desmarca solo, y uno nuevo llega con checked=true en los dos casos. La
      // diferencia la hace el total de la carta activa: si coincide con el que
      // está elegido, el clic es el segundo y deselecciona.
      // La Guia Secreta se abre con este clic: es el gesto de reservar. Va antes
      // del manejo de la card porque el selector de abajo excluye .hotel-booking
      // a proposito (dentro de un <label> el enlace no se puede pulsar bien), y
      // por lo tanto esta rama es la unica que lo ve.
      var reservar = e.target.closest && e.target.closest('.hotel-booking');
      if (reservar && detailState && detailState.meta && detailState.meta.dest) {
        abrirGuiaPorReserva(detailState.meta.dest.key);
      }
      var hotelCard = e.target.closest('[data-hotel-option]');
      var hotelChoice = e.target.closest('[data-hotel-total]');
      if ((hotelCard || hotelChoice) && !e.target.closest('.hotel-booking,.hotel-similar')) {
        var card = hotelCard || hotelChoice.closest('[data-hotel-option]');
        var hotelInput = card && card.querySelector('[data-hotel-total]');
        if (hotelInput) {
          // preventDefault NECESARIO ahora que la card entera es un <label>:
          // sin esto, el click en la imagen o en el nombre hace que el label
          // reenvíe un segundo click al radio, y ese segundo click volvía a
          // entrar acá con checked ya en true -> isActive -> deseleccionar. En
          // la práctica: tocar la card seleccionaba y deseleccionaba en el
          // mismo gesto. Cancelando la acción por defecto del label, este
          // handler queda como única fuente de verdad y checked se maneja acá.
          e.preventDefault();
          var total = Math.round(Number(hotelInput.getAttribute('data-hotel-total')) || 0);
          // Que parada es: 1 o 2 en un viaje combinado, '' en un destino solo.
          // Sin esto los dos grupos comparten un solo total guardado y elegir en
          // uno pisa el otro.
          var parada = Number(hotelInput.getAttribute('data-hotel-stop')) || 0;
          var elegido = parada ? staySelectedTotal(parada) : detailState.selectedHotelTotal;
          var isActive = hotelInput.checked && (parada ? elegido != null : detailState.selectedHotel !== false) && elegido != null && Math.round(Number(elegido)) === total;
          if (isActive) { hotelInput.checked = false; deseleccionarHotel(parada); return; }
          hotelInput.checked = true;
          var hotelName = card.querySelector('h3');
          if (hotelName) detailState.selectedHotelName = hotelName.textContent.trim();
          actualizarAlojamiento(total, true, parada);
        }
        return;
      }
      var transportChoice = e.target.closest('[name="transport-choice"]');
      if (transportChoice) {
        var chosenMode = ['auto', 'bus'].indexOf(transportChoice.value) >= 0 ? transportChoice.value : 'flight';
        if (chosenMode === 'auto' && !isRoadtripDestinationAllowed(detailState.meta.dest.key)) {
          return;
        }
        S.transport = chosenMode;
        if (chosenMode === 'bus') { detailState.transportMode = 'bus'; detailState.auto = 0; detailState.flight = 0; detailState.parts.traslados = 0; var busFlow = document.querySelector('[data-transport-flow]'); if (busFlow) busFlow.innerHTML = transportFlow(detailState.meta, 0, 'bus'); recalcularTotalViaje(); }
        else actualizarTransporte(chosenMode === 'auto');
        return;
      }
      var roadtripVtype = e.target.closest('[data-roadtrip-vtype]');
      if (roadtripVtype) { e.preventDefault(); cambiarVehiculoRoadtrip(roadtripVtype.getAttribute('data-roadtrip-vtype')); return; }
      var flightFilter = e.target.closest('[data-flight-stop],[data-flight-time]');
      if (flightFilter) {
        var flightSection = flightFilter.closest('.flight-search');
        if (flightFilter.hasAttribute('data-flight-stop')) flightSection.setAttribute('data-flight-stop', flightFilter.getAttribute('data-flight-stop'));
        if (flightFilter.hasAttribute('data-flight-time')) flightSection.setAttribute('data-flight-time', flightFilter.getAttribute('data-flight-time'));
        Array.prototype.forEach.call(flightSection.querySelectorAll('[data-flight-stop]'), function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-flight-stop') === (flightSection.getAttribute('data-flight-stop') || 'all'))); });
        Array.prototype.forEach.call(flightSection.querySelectorAll('[data-flight-time]'), function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-flight-time') === (flightSection.getAttribute('data-flight-time') || 'all'))); });
        if (detailState && detailState.flightOffers) renderFlightOffers(flightSection.querySelector('.flight-results'), { offers: detailState.flightOffers });
        return;
      }
      var transferChoice = e.target.closest('[data-transfer-choice]');
      if (transferChoice) {
        e.preventDefault(); e.stopPropagation();
        var mode = transferChoice.getAttribute('data-transfer-choice');
        var amount = Number(transferChoice.getAttribute('data-transfer-amount')) || 0;
        /* A que tramo pertenece el boton. Con un solo tramo venia sin atributo y
           era siempre el de llegada; ahora cada card dice el suyo, asi que se
           puede elegir el privado de ida y el compartido de vuelta sin que uno
           pise al otro. */
        var leg = transferChoice.getAttribute('data-transfer-leg') === 'vuelta' ? 'vuelta' : 'llegada';
        // Segundo clic en la modalidad ya elegida: ESE tramo deja de estar en el
        // presupuesto y su tarjeta vuelve al estado "elegí un tipo". Antes se
        // deseleccionaba el transfer entero, lo que con dos tramos dejaba al
        // otro sin eleccion.
        if (transferTypeDe(detailState, leg) === mode) { deseleccionarTransfer(leg); return; }
        if (leg === 'vuelta') detailState.transferTypeVuelta = mode;
        else detailState.transferType = mode;
        // El monto de `amount` es el UNITARIO de la modalidad. El total de los
        // dos tramos lo calcula trasladoDelViaje() con getSelectedTransferAmount()
        // de cada lado, que ya sabe multiplicar el compartido por la cantidad de
        // gente. Guardar el unitario acá y sumarlo abajo era una via a que el
        // total dejara de coincidir con el desglose.
        detailState.transfer = getSelectedTransferAmount(detailState);
        // El hotel se deja anotado apenas se elige el transfer, para que el
        // checkout venga con el destino escrito. El horario ya no se guarda: no
        // hay horario hasta que el operador lo confirme.
        detailState.transferWizard = detailState.transferWizard || {};
        /* hotelParaElTransfer() y no findSelectedHotelLabel(): esta linea se
           escribe una sola vez y el valor queda pegado en el estado. Si acá se
           copia la etiqueta, "Hotel recomendado" queda guardado como si fuera el
           nombre del hotel y de ahi en adelante ningun filtro lo saca mas: el
           campo del checkout y el mensaje de WhatsApp salen con un hotel que
           nadie eligio. */
        detailState.transferWizard.hotelName = detailState.transferWizard.hotelName || hotelParaElTransfer();
        var transferSectionEl = transferChoice.closest('[data-official-transfer]');
        if (transferSectionEl) transferSectionEl.outerHTML = transferCard(detailState.meta);
        sincronizarTrasladoOficial();
        // El panel "Mi Viaje" y el voucher leen de detailState, no del DOM: sin
        // esto la fila de traslados seguia diciendo "Sin traslados" con el
        // transfer recien elegido hasta que se abriera otra seccion.
        renderTripSummary();
        return;
      }
      var changeFlight = e.target.closest('[data-change-flight]');
      if (changeFlight && detailState) {
        e.preventDefault(); e.stopPropagation();
        var changeSection = changeFlight.closest('.flight-search');
        var changeState = getFlightSelectionState();
        changeState.stage = 'outbound'; changeState.outboundId = null; changeState.inboundId = null;
        changeSection.setAttribute('data-flight-step', 'outbound');
        if (detailState.flightOffers) renderFlightOffers(changeSection.querySelector('.flight-results'), { offers: detailState.flightOffers });
        return;
      }
      var selectedFlight = e.target.closest('[data-select-flight]');
      if (selectedFlight) {
        e.preventDefault(); e.stopPropagation();
        var offerId = selectedFlight.getAttribute('data-select-flight');
        var state = getFlightSelectionState();
        var section = selectedFlight.closest('.flight-search');
        // Una sola etapa: con SerpAPI el precio que trae la tarjeta ya es el
        // total de ida y vuelta, así que no hay una segunda elección que hacer.
        // Antes el flujo era elegir ida y después vuelta porque Duffel devolvía
        // los tramos por separado; contra esta API ese segundo paso no devolvía
        // nada y solo costaba un crédito extra.
        if (state) {
          state.stage = 'done';
          state.outboundId = offerId;
          state.inboundId = null;
          if (section) section.setAttribute('data-flight-step', 'done');
        }
        persistSelectedOffer(selectedFlight);
        actualizarPasajes(section, Number(selectedFlight.getAttribute('data-offer-price')), selectedFlight.getAttribute('data-offer-airline'));
        if (section && detailState && detailState.flightOffers) renderFlightOffers(section.querySelector('.flight-results'), { offers: detailState.flightOffers });
        return;
      }    });
    $('#vista-detalle').addEventListener('change', function (e) {
      var tourChoice = e.target.closest && e.target.closest('[data-tour-choice]');
      if (tourChoice && detailState) {
        var tour = { title: tourChoice.getAttribute('data-tour-title'), destination: tourChoice.getAttribute('data-tour-destination'), price: Number(tourChoice.getAttribute('data-tour-price')) || 0 };
        detailState.selectedTours = (detailState.selectedTours || []).filter(function (item) { return item.title !== tour.title; });
        if (tourChoice.checked) detailState.selectedTours.push(tour);
        detailState.toursTotal = detailState.selectedTours.reduce(function (sum, item) { return sum + item.price; }, 0);
        var tourCard = tourChoice.closest('[data-tour-card]');
                // El estado visual (borde ambar, tilde y "En tu viaje") lo lleva
        // :has() en CSS sobre el checkbox, asi que aca no hay que tocar texto
        // ni clases: solo se recalcula el total.
        if (tourCard) tourCard.classList.toggle('is-added', tourChoice.checked);
        // El boton de reservar vive en "Mi Viaje" y su etiqueta y su total
        // dependen de cuantas actividades hay: hay que repintar el panel, no solo
        // recalcular el total de la pagina.
        renderTripSummary();
        recalcularTotalViaje();
        return;
      }
      var busChoice = e.target.closest && e.target.closest('[data-bus-choice]');
      if (busChoice && busChoice.checked) { actualizarBus(busChoice.getAttribute('data-bus-choice'), busChoice.getAttribute('data-bus-uyu')); return; }
      var hotelChoice = e.target.closest && e.target.closest('[data-hotel-total]');
      if (hotelChoice && hotelChoice.checked) actualizarAlojamiento(Number(hotelChoice.getAttribute('data-hotel-total')), true);
      var consumption = e.target.closest && e.target.closest('[data-roadtrip-consumption]');
      if (consumption) actualizarRoadtrip(consumption.value);
      var roadtripModel = e.target.closest && e.target.closest('[data-roadtrip-model]');
      if (roadtripModel) actualizarModeloRoadtrip(roadtripModel.value);
      var evModel = e.target.closest && e.target.closest('[data-roadtrip-ev-model]');
      if (evModel) actualizarRoadtripEv({ modelKey: evModel.value, kwhPer100km: null, batteryKwh: null });
      var evPrice = e.target.closest && e.target.closest('[data-roadtrip-ev-price]');
      if (evPrice) actualizarRoadtripEv({ kwhPrice: Number(evPrice.value) || DEFAULT_KWH_PRICE_USD });
      var dailyFoodInput = e.target.closest && e.target.closest('[data-daily-food]');
      if (dailyFoodInput && detailState) {
        detailState.foodBudgetMode = 'custom';
        // Lo tipeado viene en la moneda activa: se guarda y se suma en la base.
        detailState.foodCustomValue = aBase(dailyFoodInput.value);
        detailState.foodPerDayTouched = true;
        detailState.foodPerDay = Math.max(0, aBase(dailyFoodInput.value));
        detailState.parts.comidas = Math.round(detailState.foodPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
      var dailyLocalInput = e.target.closest && e.target.closest('[data-daily-local]');
      if (dailyLocalInput && detailState) {
        detailState.localBudgetMode = 'custom';
        detailState.localCustomValue = aBase(dailyLocalInput.value);
        detailState.localPerDayTouched = true;
        detailState.localPerDay = Math.max(0, aBase(dailyLocalInput.value));
        detailState.parts.local = Math.round(detailState.localPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
    });
    $('#vista-detalle').addEventListener('keydown', function (e) {
      // El checkbox estirado es el unico control de la tarjeta y el espacio ya
      // lo resuelve el navegador. Solo sumamos Enter, que en un checkbox no
      // hace nada por defecto.
      var tourInput = e.target.closest && e.target.closest('[data-tour-choice]');
      if (!tourInput || e.key !== 'Enter') return;
      e.preventDefault();
      tourInput.checked = !tourInput.checked;
      tourInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    /* El tipo de alojamiento son botones, no un <select>, así que el cambio lo
       atiende un click y no un change. No llama a la API: la lista de cada tipo
       ya está en memoria, y filtrarla cuesta solo repintar, que es lo que ya
       hacía el <select>. */
    $('#vista-detalle').addEventListener('click', function (e) {
      var pill = e.target.closest && e.target.closest('[data-hotel-type]');
      if (!pill) return;
      e.preventDefault();
      changeHotelType(pill.getAttribute('data-hotel-type'));
    });
    /* Flechas para moverse entre los botones. Con role="radio" el teclado
       espera que el grupo entero sea una sola parada del tabulador y que las
       flechas lo recorran, como un grupo de radios de verdad. Sin esto los
       cuatro botones entran en el tabulador y el que está elegido pierde el
       foco tras cada repintado, porque tabindex se dibuja desde el estado y el
       DOM se rehace. */
    $('#vista-detalle').addEventListener('keydown', function (e) {
      var pill = e.target.closest && e.target.closest('[data-hotel-type]');
      if (!pill) return;
      var dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
        : (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0);
      if (!dir) return;
      e.preventDefault();
      var pills = Array.prototype.slice.call(pill.parentNode.querySelectorAll('[data-hotel-type]'));
      var i = pills.indexOf(pill);
      if (i < 0) return;
      var siguiente = pills[(i + dir + pills.length) % pills.length];
      siguiente.focus();
      changeHotelType(siguiente.getAttribute('data-hotel-type'));
    });
    $('#vista-detalle').addEventListener('input', function (e) {
      var staySlider = e.target.closest && e.target.closest('[data-multistay-split]');
      if (staySlider && detailState && detailState.multiStay) {
        detailState.multiStay.firstNights = Number(staySlider.value) || 1;
        updateMultiStayPricing();
        recalcularTotalViaje();
      }
      var consumption = e.target.closest && e.target.closest('[data-roadtrip-consumption]');
      if (consumption) actualizarRoadtrip(consumption.value);
      var evPriceInput = e.target.closest && e.target.closest('[data-roadtrip-ev-price]');
      if (evPriceInput) actualizarRoadtripEv({ kwhPrice: Number(evPriceInput.value) || DEFAULT_KWH_PRICE_USD });
      var dailyFoodInput = e.target.closest && e.target.closest('[data-daily-food]');
      if (dailyFoodInput && detailState) {
        detailState.foodBudgetMode = 'custom';
        // Lo tipeado viene en la moneda activa: se guarda y se suma en la base.
        detailState.foodCustomValue = aBase(dailyFoodInput.value);
        detailState.foodPerDayTouched = true;
        detailState.foodPerDay = Math.max(0, aBase(dailyFoodInput.value));
        detailState.parts.comidas = Math.round(detailState.foodPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
      var dailyLocalInput = e.target.closest && e.target.closest('[data-daily-local]');
      if (dailyLocalInput && detailState) {
        detailState.localBudgetMode = 'custom';
        detailState.localCustomValue = aBase(dailyLocalInput.value);
        detailState.localPerDayTouched = true;
        detailState.localPerDay = Math.max(0, aBase(dailyLocalInput.value));
        detailState.parts.local = Math.round(detailState.localPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
    });
    // Acciones del resumen final del itinerario, que se pinta adentro del modal.
    $('#booking-modal').addEventListener('click', function (e) {
      /* El resumen se mira sin cuenta; lo que cambia un estado o abre una reserva
         pide iniciar sesion. Solo en el resumen: el checkout comparte este modal. */
      var conLogin = e.target.closest(ACCIONES_CON_LOGIN.map(function (a) { return '[' + a + ']'; }).join(','));
      if (conLogin && this.dataset.summaryText && exigirLogin(e, conLogin)) return;
      /* Los botones del checkout viven acá adentro, no en #vista-detalle: el
         modal es hermano de la vista, asi que un listener puesto alla nunca
         los ve. Estaban primero en el de #vista-detalle y por eso "Continuar"
         no hacia nada. */
      var ckNext = e.target.closest('[data-checkout-next]');
      if (ckNext) {
        e.preventDefault();
        // readCheckoutForm() devuelve el primer control invalido y guarda todo
        // lo escrito. Se valida a mano porque el panel anterior ya salio del
        // DOM y reportValidity() sobre el noaria posible.
        var invalid = readCheckoutForm();
        if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
        /* La cuenta se crea desde el paso 1, que es el único momento en que el
           correo recién escrito está a mano. No se espera al resultado: el paso 2
           se abre igual y el aviso aparece cuando la cuenta esté lista. */
        if (checkoutState.step === 0) crearCuentaDesdeCheckout();
        gotoCheckoutStep(checkoutState.step + 1);
        return;
      }
      var ckBack = e.target.closest('[data-checkout-back]');
      if (ckBack) {
        e.preventDefault();
        readCheckoutForm();
        gotoCheckoutStep(checkoutState.step - 1);
        return;
      }
      var ckConfirm = e.target.closest('[data-checkout-confirm]');
      if (ckConfirm) {
        e.preventDefault();
        // El paso 2 no esta dentro de un <form>, asi que su validacion no la
        // hace el navegador. Se comprueba aca y el aviso se escribe en el
        // panel, no en un alert.
        if (!checkoutState.payment) {
          var panel = $('#booking-modal .checkout-panel');
          if (panel) {
            var warn = panel.querySelector('[data-checkout-pay-error]');
            if (!warn) {
              warn = document.createElement('p');
              warn.className = 'checkout-error';
              warn.setAttribute('data-checkout-pay-error', '');
              warn.textContent = 'Elegí un medio de pago para continuar.';
              panel.appendChild(warn);
            }
            warn.scrollIntoView({ block: 'nearest' });
          }
          return;
        }
        var checkoutUrl = checkoutWhatsappUrl();
        if (!checkoutUrl) { closeBookingForm(); return; }
        ckConfirm.disabled = true;
        window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
        /* Acá NO se marca traslado ni tour. El pedido por WhatsApp es una
           intención de la persona, no una reserva confirmada: esos dos rubros los
           coordina la agencia y el "Reservado" lo pone quien confirmó la
           reserva, desde el control del voucher. Si se marcara acá, el cliente
           vería su propio "Reservado" sin que nadie haya confirmado nada. */
        var enviado = checkoutTotals();
        if (enviado.tours.length) guardarEstadoLocal('tours', 'solicitado');
        if (enviado.transfer) guardarEstadoLocal('traslados', 'solicitado');
        closeBookingForm();
        return;
      }
      /* Vuelo y hotel: el clic en el link ES la reserva. El link abre WhatsApp o
         Booking en otra pestaña, así que este listener no lo cancela ni lo
         espera: marca y deja que el navegador siga su curso. Con preventDefault
         el voucher dejaría de servir para lo único que sirve, que es llegar al
         link. */
      var reservarRubro = e.target.closest('[data-reservar-rubro]');
      if (reservarRubro) {
        marcarReservado(reservarRubro.getAttribute('data-reservar-rubro'), {});
        return;
      }
      var desmarcarRubro = e.target.closest('[data-deshacer-reserva]');
      if (desmarcarRubro) {
        e.preventDefault();
        desmarcarReservado(desmarcarRubro.getAttribute('data-deshacer-reserva'));
        return;
      }
      var marcarRubro = e.target.closest('[data-marca-reserva]');
      if (marcarRubro) {
        e.preventDefault();
        var categoria = marcarRubro.getAttribute('data-marca-reserva');
        // Es un toggle: el mismo botón pone y saca la marca, que es lo que
        // hace falta para corregir una reserva mal puesta sin abrir otra cosa.
        if (reservasDe(categoria)) desmarcarReservado(categoria);
        else marcarReservadoManual(categoria, { por: 'agencia' });
        return;
      }
      if (e.target.closest('[data-close-booking]') || e.target === $('#booking-modal')) closeBookingForm();
      var saveTripButton = e.target.closest('[data-save-trip]');
      if (saveTripButton) { e.preventDefault(); saveCurrentTrip(); return; }
      var grupoCrearButton = e.target.closest('[data-grupo-crear]');
      if (grupoCrearButton) { e.preventDefault(); irAlGrupo(grupoCrearButton); return; }
      var grupoCopiarButton = e.target.closest('[data-grupo-copiar]');
      if (grupoCopiarButton) { e.preventDefault(); copiarTextoSplit(grupoCopiarButton, grupoCopiarButton.getAttribute('data-grupo-copiar')); return; }
      var splitTripButton = e.target.closest('[data-split-trip]');
      if (splitTripButton) { e.preventDefault(); openSplitModal(); return; }
      /* El menu "Compartir" y el copiado.

         El menu cierra solo cuando se elige algo y cuando se hace click afuera,
         y Escape lo cierra y le devuelve el foco al boton. Sin eso queda un menu
         abierto flotando sobre el modal sin forma obviousa de cerrarlo.

         Lo que cierra primero es cualquier otro menu de compartir abierto: si la
         persona abre el de otro rubro y toca este, los dos quedan abiertos. */
      var shareMenuButton = e.target.closest('[data-share-menu]');
      if (shareMenuButton) {
        e.preventDefault();
        var shareMenu = shareMenuButton.parentNode.querySelector('.voucher-share__menu');
        var abrir = shareMenu.hidden;
        Array.prototype.forEach.call(document.querySelectorAll('.voucher-share__menu'), function (otro) { otro.hidden = true; });
        Array.prototype.forEach.call(document.querySelectorAll('[data-share-menu]'), function (b) { b.setAttribute('aria-expanded', 'false'); });
        shareMenu.hidden = !abrir;
        shareMenuButton.setAttribute('aria-expanded', String(abrir));
        return;
      }
      var copyButton = e.target.closest('[data-copy-summary]');
      if (copyButton) {
        e.preventDefault();
        copySummaryText(copyButton);
        return;
      }
      var shareMenuOpen = e.target.closest('.voucher-share__menu');
      if (shareMenuOpen) {
        /* Cualquier opcion del menu lo cierra al ejecutar: la accion ya se esta
           haciendo y dejar el menu abierto encima tapa el resultado. */
        setTimeout(function () {
          Array.prototype.forEach.call(document.querySelectorAll('.voucher-share__menu'), function (m) { m.hidden = true; });
          Array.prototype.forEach.call(document.querySelectorAll('[data-share-menu]'), function (b) { b.setAttribute('aria-expanded', 'false'); });
        }, 0);
      }
      /* El toque de confirmar del paso externo.

         Es el unico momento en que el dato "este rubro esta reservado" es
         cierto: el link externo no avisa cuando termino de pagarse, asi que lo
         declara la persona. Se usa marcarReservadoManual, que ademas exige que
         quien toca sea la agencia --es una afirmacion sobre una reserva, no una
         accion de servicio--, y por lo tanto no le hace nada a un cliente.

         Para el cliente esto se ve igual: el paso queda marcado y el boton pasa a
         ser de la agencia. Un cliente que puede declararse una reserva propia
         puede hacer que el cotizador diga "reservado" por algo que no existe. */
      var confirmarPaso = e.target.closest('[data-confirmar-reserva]');
      if (confirmarPaso) {
        e.preventDefault();
        marcarReservadoManual(confirmarPaso.getAttribute('data-confirmar-reserva'), {});
        return;
      }
      /* El cierre: WhatsApp con el resumen y lo que falta. El mensaje lo arma
         mensajeCoordinar() y sale con el estado real, no con una plantilla que
         afirme reservas que todavia no pasaron. */
      var coordinar = e.target.closest('[data-coordinar-asesor]');
      if (coordinar) {
        e.preventDefault();
        var texto = mensajeCoordinar();
        if (!texto) return;
        window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener,noreferrer');
        return;
      }

      var whatsappButton = e.target.closest('[data-share-whatsapp]');
      if (whatsappButton) {
        e.preventDefault();
        var whatsappUrl = 'https://wa.me/?text=' + encodeURIComponent($('#booking-modal').dataset.summaryText || '');
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }
      var storyButton = e.target.closest('[data-share-story]');
      if (storyButton) { e.preventDefault(); shareStoryCard(storyButton); }
      /* El "Reservar" de la fila de traslados del voucher. Va al mismo checkout
         que el de "Mi Viaje", con los dos pedidos juntos. Antes abria un
         asistente propio del transfer, con otro formulario, y el voucher era el
         unico lugar desde donde se coordinate el traslado.

         Solo el boton del voucher: el de "Mi Viaje" esta en su propio listener,
         porque #trip-summary es hermano de la vista y no vive dentro del modal. */
      var reserveFromVoucher = e.target.closest('[data-reservar-pedido]');
      if (reserveFromVoucher) {
        e.preventDefault();
        closeBookingForm();
        openCheckout();
      }
      /* El "Detalle" de un rubro ya reservado.

         Cierra el modal antes de saltar, y en ese orden: saltar primero dejaba
         la pagina haciendo scroll detrás del modal, que sigue abierto encima, y
         elcloseBookingForm() devolvia el foco al boton que abrio el voucher, que
         ya no existia. Cerrando primero, el scroll se ve.

         Reusa el salto del panel "Mi Viaje" y el del desglose, asi que el
         destino es el mismo que el de las otras dos entradas. */
      var detalleRubro = e.target.closest('[data-detalle-rubro]');
      if (detalleRubro) {
        e.preventDefault();
        var categoria = detalleRubro.getAttribute('data-detalle-rubro');
        closeBookingForm();
        jumpToBudgetSection(categoria);
      }
    });
    /* Click afuera y Escape cierran el menu de compartir.

       El menu vive DENTRO del modal, asi que el listener va en document y no en
       #booking-modal: el click que lo cierra cae fuera del modal —en el fondo, o
       en la fila de arriba— y nunca llega al listener del modal. Sin esto el
       menu se queda abierto pegado al boton con el modal entero arriba.

       Escape devuelve el foco al boton que lo abrio, que es lo que espera
       alguien que abrio un menu con el teclado. */
    document.addEventListener('click', function (e) {
      if (e.target.closest('.voucher-share')) return;
      Array.prototype.forEach.call(document.querySelectorAll('.voucher-share__menu'), function (m) { m.hidden = true; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-share-menu]'), function (b) { b.setAttribute('aria-expanded', 'false'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var abierto = document.querySelector('.voucher-share__menu:not([hidden])');
      if (!abierto) return;
      abierto.hidden = true;
      var boton = abierto.parentNode.querySelector('[data-share-menu]');
      if (boton) { boton.setAttribute('aria-expanded', 'false'); boton.focus(); }
    });
    // Un logo de Commons que no carga no puede quedar como un cuadrado roto en
    // la ultima pantalla antes de mandar el pedido. El evento 'error' de una
    // imagen NO burbujea, asi que el listener va en fase de captura (el tercer
    // argumento): sin eso no llega nunca al modal y la tarjeta se queda rota.
    // Delegado y no un onerror en linea porque el paso se repinta entero en
    // cada cambio de paso y habria que volver a engancharlo cada vez.
    $('#booking-modal').addEventListener('error', function (e) {
      var img = e.target;
      if (!img || !img.classList || !img.classList.contains('checkout-pay__logo')) return;
      img.classList.add('is-broken');
    }, true);
    $('#booking-modal').addEventListener('change', function (e) {
      // Medio de pago del checkout. Se marca la tarjeta con la clase en vez de
      // repintar el paso entero: el repintado tiraria abajo el scroll y
      // perderia el foco del teclado a mitad de la eleccion.
      var payInput = e.target.closest('[name="checkout-payment"]');
      if (payInput) {
        checkoutState.payment = payInput.value;
        var labels = $('#booking-modal').querySelectorAll('[data-checkout-pay]');
        for (var i = 0; i < labels.length; i++) {
          labels[i].classList.toggle('is-selected', labels[i].contains(payInput));
        }
        var warn = $('#booking-modal').querySelector('[data-checkout-pay-error]');
        if (warn) warn.remove();
        return;
      }
    });
    $('#booking-modal').addEventListener('input', function (e) {
      var cardNumber = e.target.closest('[data-card-number]');
      if (cardNumber) cardNumber.value = cardNumber.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
      var cardExpiry = e.target.closest('[data-card-expiry]');
      if (cardExpiry) { var expiryValue = cardExpiry.value.replace(/\D/g, '').slice(0, 4); cardExpiry.value = expiryValue.length > 2 ? expiryValue.slice(0, 2) + '/' + expiryValue.slice(2) : expiryValue; }
    });

    fetch('/api/destinos').then(function (r) { return r.json(); }).then(function () {
      var menu = document.getElementById('dest-menu');
      destItems = [{ value: 'todos', label: 'Todos los destinos (Buscar por mi presupuesto)' }];
      if (menu) {
        menu.innerHTML = '<button id="dest-option-todos" type="button" class="custom-select__option is-selected" data-dest-value="todos" role="option" aria-selected="true"><span class="custom-select__option-main">🌍 Todos los destinos</span><span class="custom-select__option-sub">Buscar por mi presupuesto</span></button>';
        bindDestinationOption(menu.querySelector('#dest-option-todos'));
      }
      DESTINATION_HUBS.forEach(function (hub, hubIndex) {
        if (menu) {
          var groupWrap = document.createElement('div');
          groupWrap.className = 'custom-select__group';
          var groupTitle = document.createElement('span');
          groupTitle.className = 'custom-select__group-title';
          groupTitle.innerHTML = '<span class="custom-select__hub-icon" aria-hidden="true">🛬</span><span>' + esc(hub.name) + '</span><strong class="custom-select__hub-code">' + esc(hub.codes) + '</strong>';
          groupWrap.appendChild(groupTitle);
          // Los pares van al final del hub. Antes del primero va una linea que
          // los separa de los destinos sueltos: con 28 pares en Santa Catarina,
          // "Balneário Camboriú" al lado de "Balneário Camboriú + Itapema" se
          // confunden, y el filtro los deja pegados igual.
          var pairNoteDone = false;
          hub.options.forEach(function (item, optionIndex) {
            if (!pairNoteDone && item.subcategory && item.subcategory.indexOf(' + ') >= 0) {
              pairNoteDone = true;
              var pairNote = document.createElement('span');
              pairNote.className = 'custom-select__pairs-note';
              pairNote.textContent = 'Viajes de dos paradas';
              groupWrap.appendChild(pairNote);
            }
            var option = document.createElement('button');
            option.type = 'button';
            option.id = 'dest-option-' + hubIndex + '-' + optionIndex;
            option.className = 'custom-select__option';
            option.setAttribute('data-dest-value', item.key);
            option.setAttribute('data-iata-codes', item.codes || DEST_IATA_ALIASES[item.key] || IATA_BY_DEST[item.key] || '');
            option.setAttribute('data-hub-name', hub.name);
            option.setAttribute('data-subcategory', item.subcategory || '');
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            if (item.unavailable) { option.disabled = true; option.setAttribute('aria-label', item.label + ', próximamente'); }
            option.innerHTML = '<span class="custom-select__option-main">' + esc(item.label) + '</span>' + (item.unavailable ? '<span class="custom-select__option-sub">Próximamente</span>' : '');
            bindDestinationOption(option);
            groupWrap.appendChild(option);
            destItems.push({ value: item.key, label: item.label, subcategory: item.subcategory || '' });
          });
          menu.appendChild(groupWrap);
        }
      });

      sel.value = S.dest;
      filterDestOptions('');
      updateDestinationMode();
      run();
    }).catch(function () { notice('No pudimos cargar los destinos. Recargá la página.'); });
  }

  cargarTasas();
  init();

})();
