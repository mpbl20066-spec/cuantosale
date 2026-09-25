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
    ['tours', 'Tours y actividades', '--c6']
  ];
  function tour(destinations, destination, title, description, price, details) {
    return { destinations: destinations, destination: destination, title: title, description: description, price: price, details: details };
  }
  // Los precios recibidos para Florianópolis están en BRL; convertimos con la
  // cotización de venta PTAX del 23/09/2026 (R$5,1414 por US$1) y sumamos US$5.
  function florianopolisTourPrice(brl) { return Number((brl / 5.1414 + 5).toFixed(2)); }
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
    poa: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/IBPA_17398_-_Vista_a%C3%A9rea_da_Orla_Moacyr_Scliar%2C_na_capital._O_-_2018-10-02_-_Luciano_Lanes-PMPA_%28cropped%29.jpg/1920px-IBPA_17398_-_Vista_a%C3%A9rea_da_Orla_Moacyr_Scliar%2C_na_capital._O_-_2018-10-02_-_Luciano_Lanes-PMPA_%28cropped%29.jpg'
  };
  // Fotos reales por tipo de actividad (Wikimedia Commons), para que cada tarjeta
  // de tour muestre algo específico en vez de repetir siempre la foto del destino.
  var TOUR_CATEGORY_PHOTOS = {
    boat: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Escuna_de_passeio%2C_em_Florian%C3%B3polis-SC%2C_BRASIL.JPG/1920px-Escuna_de_passeio%2C_em_Florian%C3%B3polis-SC%2C_BRASIL.JPG',
    buggy: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Passeio_de_Buggy_nas_dunas_de_Genipabu_01.jpg/1920px-Passeio_de_Buggy_nas_dunas_de_Genipabu_01.jpg',
    kayak: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Starr-230301-6176-Cocos_nucifera-view_Molokini_and_Kahoolawe_with_stand_up_paddlers_kayakers_and_snorkelers-Kamaole_Beach_Park_Kihei-Maui_%2852746466170%29.jpg/1920px-Starr-230301-6176-Cocos_nucifera-view_Molokini_and_Kahoolawe_with_stand_up_paddlers_kayakers_and_snorkelers-Kamaole_Beach_Park_Kihei-Maui_%2852746466170%29.jpg'
  };
  function classifyTourPhoto(title) {
    var t = String(title || '').toLowerCase();
    if (/barco|lancha|schooner|escuna|catamar|jangada|volta.{0,3}ilha|vuelta a la isla/.test(t)) return 'boat';
    if (/buggy|4x4|jeep/.test(t)) return 'buggy';
    if (/kayak|paddle/.test(t)) return 'kayak';
    return null;
  }
  // Precios referenciales por persona en USD: incluyen margen operativo para venta manual.
  // Se muestran como orientación y siempre deben confirmarse según fecha, cupo y operador.
  var LOCAL_TOURS = [
    tour(['rio'], 'Río de Janeiro, Brasil', 'Cristo Redentor y Pan de Azúcar', 'Excursión guiada de día completo con entradas prioritarias y transporte.', 65, 'Incluye traslado desde hoteles de la zona sur, guía bilingüe y entradas al Corcovado y Pan de Azúcar. Salida aproximada a las 7:30 y regreso por la tarde. Llevar calzado cómodo, protector solar y una campera liviana.'),
    tour(['rio'], 'Río de Janeiro, Brasil', 'Full Day a Arraial do Cabo con paseo en barco', 'Playas de aguas cristalinas, navegación y parada para snorkel.', 55, 'Incluye traslado ida y vuelta desde Río, paseo en barco compartido y paradas en playas según las condiciones del mar. Jornada completa, normalmente de 6:30 a 19:00. Llevar traje de baño, toalla y efectivo para tasas locales o alimentación.'),
    tour(['buz'], 'Búzios, Brasil', 'Paseo en barco por las playas de Búzios', 'Navegación por João Fernandes, Azeda, Azedinha y otras calas de la península.', 48, 'Incluye embarque en el centro de Búzios, navegación con paradas para nadar y bebida de cortesía. La salida suele durar entre 3 y 4 horas y depende del viento. Se recomienda reservar por la mañana y llevar protector solar.'),
    tour(['buz'], 'Búzios, Brasil', 'City tour de Búzios en buggy', 'Recorrido panorámico por miradores, playas y la Rua das Pedras.', 42, 'Incluye buggy con conductor habilitado y recorrido por Orla Bardot, João Fernandes, Ferradura y Geribá. Duración aproximada de 4 horas, con horarios de mañana o tarde. Llevar ropa cómoda; el vehículo puede salpicar en algunos tramos.'),
    tour(['arraial'], 'Arraial do Cabo, Brasil', 'Passeio de barco por las Prainhas y Gruta Azul', 'Navegación por el Caribe brasileño con paradas para baño y fotos.', 50, 'Incluye transporte local hasta el muelle, paseo en barco y paradas en Praia do Farol, Prainhas do Pontal do Atalaia y Gruta Azul cuando el mar lo permite. Duración aproximada de 4 horas. El acceso a algunas playas depende de la Capitanía y del clima.'),
    tour(['arraial'], 'Arraial do Cabo, Brasil', 'Buceo de bautismo en aguas cristalinas', 'Experiencia introductoria con instructor y equipo completo.', 78, 'Incluye briefing, equipo de buceo, acompañamiento de instructor y una inmersión de iniciación. La actividad suele ocupar media jornada y requiere completar una ficha de salud. No se recomienda volar durante las horas posteriores al buceo.'),
    tour(['cabo'], 'Cabo Frio, Brasil', 'City tour histórico y playas de Cabo Frio', 'Recorrido por Praia do Forte, Canal do Itajuru y el barrio da Passagem.', 38, 'Incluye traslado urbano, guía local y paradas para fotos en Praia do Forte, Forte São Mateus y el centro histórico. Duración aproximada de 4 horas, con salida por la mañana. Ideal para combinar con un día libre de playa.'),
    tour(['cabo'], 'Cabo Frio, Brasil', 'Paseo en barco por el Canal y la Ilha do Japonês', 'Navegación corta con tiempo libre para baño y playa.', 35, 'Incluye embarcación compartida y parada en Ilha do Japonês, sujeta a la marea y al viento. Duración aproximada de 3 horas. Llevar agua, protector solar y efectivo para consumos en la playa.'),
    tour(['ilha'], 'Ilha Grande, Brasil', 'Vuelta a la isla en lancha rápida', 'Día de playas y calas con agua transparente alrededor de Ilha Grande.', 72, 'Incluye traslado en lancha compartida y paradas en Lagoa Azul, Caxadaço, Dois Rios o Lopes Mendes según el itinerario. Jornada de 6 a 7 horas. Llevar calzado para rocas, protector solar y una bolsa impermeable.'),
    tour(['ilha'], 'Ilha Grande, Brasil', 'Trilha guiada a Lopes Mendes', 'Caminata por la Mata Atlántica hasta una de las playas más famosas de la isla.', 35, 'Incluye guía local, orientación en la trilha y apoyo durante el recorrido. La caminata dura entre 4 y 5 horas con desniveles moderados. Usar calzado cerrado, llevar repelente, agua y algo para comer.'),
    tour(['paraty'], 'Paraty, Brasil', 'Schooner por las islas de Paraty', 'Paseo en barco por bahías, playas y aguas tranquilas de la Costa Verde.', 58, 'Incluye navegación en escuna, paradas para nadar y tiempo libre en playas protegidas. La actividad dura aproximadamente 5 horas y sale del centro histórico. Llevar toalla, protector solar y dinero para consumos a bordo.'),
    tour(['paraty'], 'Paraty, Brasil', 'City tour histórico y Cachoeira do Tobogã', 'Historia colonial, cachaçaria y naturaleza en un mismo recorrido.', 45, 'Incluye guía, caminata por el centro histórico, visita a una cachaçaria y traslado a la cascada del Tobogã. Duración aproximada de 5 horas. Usar calzado cómodo y tener en cuenta que la visita a la cascada depende de la lluvia.'),
    tour(['ilhabela'], 'Ilhabela, Brasil', 'Jeep tour por playas y cascadas', 'Recorrido 4x4 por la costa y la Mata Atlántica de Ilhabela.', 62, 'Incluye vehículo 4x4, conductor-guía y paradas en Praia da Fome, Jabaquara y una cascada del parque. Duración de 6 horas aproximadamente. Llevar repelente, calzado que pueda mojarse y protección contra el sol.'),
    tour(['ilhabela'], 'Ilhabela, Brasil', 'Paseo de barco a Castelhanos', 'Navegación y acceso a una de las playas más preservadas de la isla.', 82, 'Incluye transporte marítimo ida y vuelta, guía de navegación y tiempo libre en Castelhanos. Jornada completa, condicionada por oleaje y autorización del parque. Llevar comida ligera, agua y bolsa impermeable.'),
    tour(['ubatuba'], 'Ubatuba, Brasil', 'Paseo en barco por las islas de Ubatuba', 'Paradas para baño y snorkel en playas de la costa norte.', 58, 'Incluye embarcación compartida y paradas en Ilha Anchieta, Praia do Flamengo u otras playas según el mar. Duración aproximada de 5 horas. El acceso al parque puede requerir tasa local; confirmar antes de embarcar.'),
    tour(['ubatuba'], 'Ubatuba, Brasil', 'Trilha guiada a las cascadas de Ubatuba', 'Caminata de naturaleza con baño en piscinas naturales.', 40, 'Incluye guía local, orientación por senderos y entrada al área visitada cuando corresponde. Actividad de medio día con ritmo moderado. Llevar zapatillas con buen agarre, repelente, agua y traje de baño.'),
    tour(['angra'], 'Angra dos Reis, Brasil', 'Ilhas Paradisíacas en lancha', 'Día de navegación por Ilha Grande, Lagoa Azul y playas de Angra.', 75, 'Incluye lancha compartida, marinero y paradas para nadar en islas y calas seleccionadas por el operador. Duración de 6 a 7 horas. La ruta puede variar por viento; llevar toalla, protector solar y efectivo.'),
    tour(['angra'], 'Angra dos Reis, Brasil', 'Paseo de barco a Ilha de Cataguases', 'Experiencia de medio día con playas tranquilas y aguas transparentes.', 48, 'Incluye traslado al muelle y navegación con tiempo libre en Ilha de Cataguases y alrededores. Salidas por la mañana o la tarde según disponibilidad. No incluye almuerzo ni consumos personales.'),
    tour(['sao'], 'São Paulo, Brasil', 'City tour por Avenida Paulista y Centro Histórico', 'Arquitectura, mercados, barrios culturales y principales postales de la ciudad.', 52, 'Incluye guía local y recorrido por Avenida Paulista, Liberdade, Mercado Municipal, Sé y Beco do Batman según el tiempo. Duración aproximada de 6 horas. Usar calzado cómodo y conservar pertenencias en zonas concurridas.'),
    tour(['sao'], 'São Paulo, Brasil', 'Ruta gastronómica por Liberdade y Mercado Municipal', 'Degustación de sabores brasileños y asiáticos con acompañamiento local.', 68, 'Incluye guía gastronómico y degustaciones seleccionadas en Liberdade y el Mercado Municipal. Actividad de 4 horas, generalmente al mediodía. Avisar alergias o restricciones y confirmar qué consumos están incluidos.'),
    tour(['bho'], 'Belo Horizonte, Brasil', 'Pampulha y arquitectura de Niemeyer', 'Circuito cultural por el conjunto de Pampulha y sus jardines.', 45, 'Incluye transporte, guía y paradas en la Igreja de São Francisco, Museo de Arte y Casa do Baile. Duración aproximada de 4 horas. Los museos pueden tener horarios especiales; confirmar calendario antes de reservar.'),
    tour(['bho'], 'Belo Horizonte, Brasil', 'Experiencia de bares y comida mineira', 'Recorrido por mercados y bares tradicionales con sabores de Minas Gerais.', 62, 'Incluye acompañamiento local y degustaciones de porciones típicas en dos o tres paradas. Duración estimada de 3 horas, al final de la tarde. El menú puede variar y conviene informar restricciones alimentarias.'),
    tour(['curitiba'], 'Curitiba, Brasil', 'City tour en la Linha Turismo', 'Jardín Botánico, Ópera de Arame, Museo Oscar Niemeyer y parques.', 42, 'Incluye orientación de guía y recorrido por los principales puntos de Curitiba, con paradas para fotos. Duración aproximada de 5 horas. El orden puede cambiar por tránsito y horarios de museos.'),
    tour(['curitiba'], 'Curitiba, Brasil', 'Morretes en tren por la Serra do Mar', 'Viaje escénico en tren y almuerzo típico del litoral paranaense.', 98, 'Incluye traslado, tramo en tren panorámico sujeto a disponibilidad y orientación en Morretes. Jornada de día completo. El precio puede cambiar según la categoría del vagón; reservar con anticipación en fines de semana.'),
    tour(['porto'], 'Porto de Galinhas, Brasil', 'Piscinas naturales de Porto de Galinhas', 'Paseo en jangada con snorkel en arrecifes durante la marea baja.', 42, 'Incluye jangada y tiempo de baño en las piscinas naturales cuando la marea lo permite. La salida se define por la tabla de mareas y dura entre 1,5 y 2 horas. Llevar protector solar y confirmar si se requiere tasa ambiental.'),
    tour(['porto'], 'Porto de Galinhas, Brasil', 'Praia dos Carneiros y paseo en catamarán', 'Excursión de día completo a una de las playas más famosas de Pernambuco.', 65, 'Incluye traslado ida y vuelta, paseo en catamarán y paradas en bancos de arena o baño de arcilla cuando están disponibles. Salida temprano y regreso al atardecer. No siempre incluye almuerzo o bebidas.'),
    tour(['mcz'], 'Maceió, Brasil', 'Maragogi y piscinas naturales desde Maceió', 'Full day de playa con catamarán y aguas cristalinas del litoral norte.', 58, 'Incluye traslado desde Maceió y orientación para el paseo opcional a las Galés, siempre sujeto a marea baja. Jornada de 10 a 12 horas. Llevar efectivo, protector solar y confirmar el suplemento de catamarán.'),
    tour(['mcz'], 'Maceió, Brasil', 'São Miguel dos Milagres y Ruta Ecológica', 'Playas tranquilas, pueblos pesqueros y piscinas naturales del litoral alagoano.', 62, 'Incluye transporte ida y vuelta y paradas en playas de la Ruta Ecológica dos Milagres. Día completo con horarios sujetos a marea y clima. Se recomienda llevar agua, sombrero y reservar el paseo en jangada aparte si se desea.'),
    tour(['maragogi'], 'Maragogi, Brasil', 'Catamarán a las Piscinas Naturales (Galés)', 'Navegación con snorkel en arrecifes durante la marea baja.', 38, 'Incluye catamarán y tiempo en las piscinas naturales, sujeto a la tabla de mareas y autorización local. El embarque suele ser temprano. Equipo de snorkel puede tener costo adicional; llevar protector solar y no tocar el coral.'),
    tour(['maragogi'], 'Maragogi, Brasil', 'Buggy por playas del litoral norte', 'Recorrido por Antunes, Ponta do Mangue y playas cercanas.', 48, 'Incluye buggy con conductor y paradas panorámicas en playas del litoral norte. Duración aproximada de 4 horas. El paseo no incluye consumos en los beach clubs y puede cambiar por el estado de la arena.'),
    tour(['nat'], 'Natal, Brasil', 'Dunas de Genipabu en buggy', 'Aventura entre dunas, lagunas y playas con opción de emoción o paseo tranquilo.', 62, 'Incluye buggy con conductor habilitado, visita a Genipabu y paradas en lagunas y miradores. Jornada de medio día o día completo. Elegir con o sin emoción al contratar y llevar gafas de sol, pañuelo y agua.'),
    tour(['nat'], 'Natal, Brasil', 'Pipa desde Natal con Baía dos Golfinhos', 'Excursión costera con miradores, playas y tiempo libre en Pipa.', 58, 'Incluye traslado ida y vuelta desde Natal y paradas en Tibau do Sul, Cacimbinhas y Praia do Amor. Jornada de 10 horas aproximadamente. La observación de delfines depende del mar y de la naturaleza.'),
    tour(['pip'], 'Praia do Pipa, Brasil', 'Paseo en Buggy de Playa en Playa', 'Chapadão, Baía dos Golfinhos, Sibaúma y miradores de Pipa.', 48, 'Incluye buggy con conductor y recorrido por playas y miradores del litoral. Duración aproximada de medio día, con salida por la mañana o la tarde. Llevar ropa cómoda, protector solar y agua; algunos accesos dependen de la marea.'),
    tour(['pip'], 'Praia do Pipa, Brasil', 'Paseo en lancha para ver delfines', 'Navegación costera con baño y búsqueda responsable de fauna marina.', 42, 'Incluye lancha compartida, guía y navegación frente a las playas de Pipa. La actividad dura entre 2 y 3 horas y la fauna no puede garantizarse. Llevar traje de baño, sombrero y seguir las indicaciones del tripulante.'),
    tour(['trancoso'], 'Trancoso / Arraial d’Ajuda, Brasil', 'Praias do Espelho y Caraíva', 'Día completo por playas del litoral sur de Bahía.', 78, 'Incluye transporte ida y vuelta desde Trancoso, guía y paradas en Praia do Espelho y otros puntos de la costa. Salida temprano; el acceso puede tener tramos de camino irregular. Llevar calzado, agua y confirmar tasas o travesías incluidas.'),
    tour(['trancoso'], 'Trancoso / Arraial d’Ajuda, Brasil', 'City tour de Trancoso y Quadrado', 'Historia local, miradores y playas cercanas con tiempo libre.', 45, 'Incluye guía y traslado por el Quadrado histórico, Igreja de São João, miradores y una playa cercana. Duración aproximada de 4 horas, ideal para la tarde. Los consumos en restaurantes y beach clubs no están incluidos.'),
    tour(['ssa'], 'Salvador de Bahía, Brasil', 'Pelourinho, Elevador Lacerda y Mercado Modelo', 'Recorrido histórico y cultural por las postales de Salvador.', 48, 'Incluye guía local y recorrido por Pelourinho, Igreja do Bonfim, Mercado Modelo y Elevador Lacerda según horarios. Duración aproximada de 5 horas. Se recomienda ropa liviana y atención a las pertenencias en áreas concurridas.'),
    tour(['ssa'], 'Salvador de Bahía, Brasil', 'Bahía de Todos los Santos en schooner', 'Navegación con islas, música y tiempo para nadar.', 58, 'Incluye navegación en schooner por la bahía y parada en una isla, según el itinerario del día. Jornada de 6 horas aproximadamente. El almuerzo y las bebidas pueden ser opcionales; confirmar antes de embarcar.'),
    tour(['for'], 'Fortaleza / Jericoacoara, Brasil', 'Praia de Cumbuco y dunas en buggy', 'Excursión desde Fortaleza con lagoas, dunas y paseo opcional.', 55, 'Incluye traslado desde Fortaleza y tiempo libre en Cumbuco. El buggy por las dunas se contrata como complemento, con opción con o sin emoción. Jornada de 8 horas; llevar protector solar y efectivo.'),
    tour(['for'], 'Fortaleza / Jericoacoara, Brasil', 'Beach Park y costa de Aquiraz', 'Día de playa y parque acuático en la costa este de Ceará.', 72, 'Incluye traslado ida y vuelta desde Fortaleza y acceso al área seleccionada del parque si está disponible en la tarifa. Jornada completa. Confirmar calendario de funcionamiento y restricciones de altura de las atracciones.'),
    tour(['jericoacoara'], 'Jericoacoara, Brasil', 'Lagoa do Paraíso y Lagoa Azul en 4x4', 'Día de dunas, lagunas y hamacas sobre el agua.', 58, 'Incluye buggy o vehículo 4x4 compartido y paradas en las principales lagunas de Jeri. Duración aproximada de 7 horas. El itinerario depende del viento y del nivel de agua; llevar efectivo y protección solar.'),
    tour(['jericoacoara'], 'Jericoacoara, Brasil', 'Pôr do sol en la Duna y Pedra Furada', 'Circuito de tarde por los íconos naturales de Jericoacoara.', 35, 'Incluye traslado en buggy y acompañamiento local hasta Pedra Furada y la Duna do Pôr do Sol. Actividad de 4 horas, con regreso después del atardecer. Usar calzado para arena y llevar agua.'),
    tour(['morro'], 'Morro de São Paulo, Brasil', 'Volta à Ilha en lancha', 'Piscinas naturales, playas de Boipeba y paradas para baño.', 82, 'Incluye lancha compartida, guía y paradas en piscinas naturales de Moreré, Cueira y Cairu, según la marea. Jornada completa y sujeta al estado del mar. Llevar toalla, protector solar y efectivo para tasas o almuerzo.'),
    tour(['morro'], 'Morro de São Paulo, Brasil', 'Tirolesa y miradores de Morro', 'Aventura suave con vistas a la Primeira y Segunda Praia.', 38, 'Incluye orientación para la tirolesa y recorrido por los miradores principales. Actividad de medio día; la tirolesa puede cerrar por viento o lluvia. Usar calzado cómodo y guardar objetos sueltos.'),
    tour(['fernando'], 'Fernando de Noronha, Brasil', 'Baía dos Porcos y playas del Mar de Dentro', 'Circuito guiado por miradores y playas de aguas transparentes.', 88, 'Incluye traslado interno, guía ambiental y paradas en Sancho, Baía dos Porcos y miradores según acceso. Jornada de 6 horas. Las tasas del parque y preservación pueden cobrarse aparte; llevar snorkel y agua.'),
    tour(['fernando'], 'Fernando de Noronha, Brasil', 'Paseo en barco con snorkel y puesta de sol', 'Navegación por la costa con posibilidad de avistar delfines.', 98, 'Incluye embarcación, guía y equipo básico de flotación para una parada de snorkel. Duración de 4 horas, con horario condicionado por el mar. La observación de fauna no se garantiza; confirmar tasas y restricciones ambientales.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Paseo en escuna pirata', 'Navegación costera en escuna desde Florianópolis.', florianopolisTourPrice(190), 'Precio de referencia: R$190. Presentá tu reserva en la boletería. Duración y recorrido sujetos a disponibilidad y condiciones del mar.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Catamarán con almuerzo', 'Excursión en catamarán con almuerzo incluido.', florianopolisTourPrice(250), 'Precio de referencia: R$250. La excursión incluye almuerzo según la opción seleccionada. Confirmá horarios, menú y punto de embarque al reservar.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Excursión en barco a Isla de Campeche', 'Navegación desde Armação hacia el Caribe catarinense.', florianopolisTourPrice(100), 'Precio de referencia: R$100. Incluye navegación y tiempo libre en la isla. Salidas sujetas al clima, oleaje y autorización del parque; confirmá si el traslado hasta el embarque está incluido.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Bautismo de buceo', 'Primera inmersión con barco, equipo e instructor.', florianopolisTourPrice(495), 'Precio de referencia: R$495. La captura indica barco, equipamiento e instructor. La actividad depende de las condiciones del mar y puede requerir una ficha de salud.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Bombinhas y Praia de Quatro Ilhas', 'Excursión de día completo a playas de Bombinhas.', florianopolisTourPrice(120), 'Precio de referencia: R$120. La captura indica traslado de ida y vuelta y visita a las playas. Confirmá itinerario, horarios y servicios incluidos.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Tour de playas de Florianópolis', 'Recorrido por las playas y paisajes más conocidos de la isla.', florianopolisTourPrice(80), 'Precio de referencia: R$80. La captura indica traslado de ida y vuelta. El recorrido y las paradas dependen del operador y las condiciones del día.'),
    tour(['fln'], 'Florianópolis, Brasil', 'City tour de Florianópolis', 'Recorrido guiado por los puntos destacados de la ciudad.', florianopolisTourPrice(110), 'Precio de referencia: R$110. La captura indica traslado de ida y vuelta. Confirmá los lugares visitados, horarios y punto de salida.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Beto Carrero World', 'Excursión al parque temático Beto Carrero World.', florianopolisTourPrice(110), 'Precio de referencia: R$110. La captura muestra traslado y entrada; verificá qué tipo de ingreso incluye la tarifa y la disponibilidad para la fecha elegida.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Balneário Camboriú', 'Excursión a Balneário Camboriú con traslado y entradas.', florianopolisTourPrice(190), 'Precio de referencia: R$190. La captura indica traslado de ida y vuelta y entradas. Confirmá qué atracciones están incluidas.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Guarda do Embaú', 'Excursión a Guarda do Embaú y sus paisajes costeros.', florianopolisTourPrice(100), 'Precio de referencia: R$100. La captura indica traslado de ida y vuelta y guía. Confirmá horarios, recorrido y servicios incluidos.'),
    tour(['camboriu'], 'Camboriú, Brasil', 'Parque Unipraias y teleférico', 'Vistas de la costa, senderos y acceso al parque de atracciones.', 52, 'Incluye traslado local y acceso al circuito principal del Parque Unipraias, según disponibilidad. Medio día de actividad. Las atracciones adicionales se pagan aparte; llevar calzado cómodo y consultar altura mínima.'),
    tour(['camboriu'], 'Camboriú, Brasil', 'Paseo en barco por la costa de Balneário', 'Navegación panorámica desde la Barra Sul con música y paradas.', 40, 'Incluye embarcación compartida y recorrido frente a las playas centrales. Duración aproximada de 3 horas, sujeta al clima. Bebidas y consumos a bordo no están incluidos.'),
    tour(['bombinhas'], 'Bombinhas, Brasil', 'Snorkel en Ilha do Arvoredo', 'Navegación y bautismo de snorkel en aguas transparentes.', 62, 'Incluye embarcación, máscara, chaleco y acompañamiento de instructor durante el snorkel. La salida depende de la visibilidad y del oleaje. Llevar traje de baño, toalla y confirmar requisitos para la reserva.'),
    tour(['bombinhas'], 'Bombinhas, Brasil', 'Trilha de la Costa Esmeralda', 'Caminata guiada por playas, miradores y senderos de Mata Atlántica.', 38, 'Incluye guía local y recorrido por playas y senderos de Bombinhas, con dificultad moderada. Duración aproximada de 4 horas. Usar zapatillas, llevar agua y respetar las áreas protegidas.'),
    tour(['rosa'], 'Praia do Rosa, Brasil', 'Avistaje de ballenas desde los miradores', 'Recorrido costero y observación responsable durante la temporada.', 42, 'Incluye guía local y traslado entre miradores de Praia do Rosa y Garopaba. La actividad es estacional y la observación de ballenas no puede garantizarse. Llevar abrigo, calzado cómodo y consultar la temporada.'),
    tour(['rosa'], 'Praia do Rosa, Brasil', 'Trilha a Praia Vermelha y Ouvidor', 'Senderismo entre playas aisladas y paisajes de la costa sur.', 35, 'Incluye guía y orientación por senderos costeros entre Praia do Rosa, Vermelha y Ouvidor. Duración de 4 a 5 horas según el ritmo. Llevar agua, protector solar y calzado con agarre.'),
    tour(['bcm'], 'Balneário Camboriú, Brasil', 'City tour y Cristo Luz', 'Miradores, playas centrales y el monumento iluminado de la ciudad.', 45, 'Incluye traslado, guía y acceso al complejo Cristo Luz cuando esté operativo. Recorrido de medio día, con salida por la tarde para aprovechar la iluminación. Los horarios pueden variar por eventos o clima.'),
    tour(['bcm'], 'Balneário Camboriú, Brasil', 'Beto Carrero World desde Camboriú', 'Día completo en el principal parque temático de Santa Catarina.', 92, 'Incluye traslado ida y vuelta y entrada estándar al parque. Jornada completa con salida temprano. Las filas, atracciones premium y comidas no están incluidas; confirmar calendario antes de comprar.'),
    tour(['gram'], 'Gramado, Brasil', 'Tour del Vino en Bento Gonçalves y Vale dos Vinhedos', 'Cata de vinos, espumantes, almuerzo colonial y paisaje de la Serra Gaúcha.', 78, 'Incluye transporte desde Gramado, degustaciones seleccionadas y visita a bodegas. Jornada de 10 a 12 horas; algunas versiones suman Tren del Vino y almuerzo. Confirmar el itinerario exacto y avisar restricciones alimentarias.'),
    tour(['gram'], 'Gramado, Brasil', 'City tour de Gramado y parques de Canela', 'Lago Negro, centro de Gramado, Catedral de Piedra y Cascata do Caracol.', 55, 'Incluye transporte y guía por las principales postales de Gramado y Canela. Duración aproximada de 7 horas. Entradas a parques o museos pueden cobrarse aparte según el circuito elegido.'),
    tour(['canela'], 'Canela, Brasil', 'Cascata do Caracol y Skyglass', 'Naturaleza, miradores y una de las atracciones más fotografiadas de la Serra.', 62, 'Incluye traslado desde Canela, visita a Caracol y orientación para Skyglass; la entrada puede variar según el paquete. Medio día o día completo. Consultar condiciones de viento y restricciones de acceso.'),
    tour(['canela'], 'Canela, Brasil', 'Tren del Vino y cultura italiana', 'Bento Gonçalves, degustaciones y experiencia de Maria Fumaça.', 88, 'Incluye transporte desde Canela, visita a bodegas, degustaciones y experiencia del Tren del Vino cuando haya disponibilidad. Excursión de día completo. Reservar con anticipación; el tren puede reemplazarse por otra actividad según el calendario.'),
    tour(['igu'], 'Foz de Iguazú, Brasil', 'Cataratas del lado brasileño y Parque das Aves', 'Pasarelas panorámicas, selva y fauna de la región de Iguazú.', 62, 'Incluye traslado, guía y entradas al circuito brasileño y Parque das Aves si el paquete seleccionado lo contempla. Medio día de actividad. Llevar calzado cómodo, capa de lluvia y documento para los accesos.'),
    tour(['igu'], 'Foz de Iguazú, Brasil', 'Cataratas argentinas con Garganta del Diablo', 'Día completo por los circuitos superior e inferior del parque argentino.', 72, 'Incluye traslado desde Foz, guía y orientación dentro del Parque Nacional Iguazú. Jornada completa; la entrada y el tren interno pueden cobrarse por separado según la tarifa. Llevar documento, agua y protección contra la lluvia.'),
    tour(['rec'], 'Recife, Brasil', 'Olinda histórica y Recife Antigo', 'Iglesias, casonas coloridas, arte y miradores del litoral pernambucano.', 48, 'Incluye transporte y guía por Recife Antigo, Marco Zero y el centro histórico de Olinda. Duración aproximada de 6 horas. Usar calzado cómodo y confirmar qué entradas o consumos están incluidos.'),
    tour(['rec'], 'Recife, Brasil', 'Porto de Galinhas desde Recife', 'Playa, jangada y tiempo libre en las piscinas naturales.', 58, 'Incluye traslado ida y vuelta desde Recife y orientación para la jangada en Porto de Galinhas. Día completo, con horario definido por la marea. La jangada, comidas y actividades opcionales pueden cobrarse aparte.'),
    tour(['poa'], 'Porto Alegre, Brasil', 'Gramado y Canela desde Porto Alegre', 'Excursión por la Serra Gaúcha con parques, arquitectura y gastronomía.', 82, 'Incluye transporte ida y vuelta y paradas panorámicas en Gramado y Canela. Jornada de 12 horas aproximadamente. Las entradas a parques y museos no están incluidas salvo indicación del operador.'),
    tour(['poa'], 'Porto Alegre, Brasil', 'Bento Gonçalves y Vale dos Vinhedos', 'Bodegas, degustaciones y cultura italiana de la Serra Gaúcha.', 88, 'Incluye traslado desde Porto Alegre, visita a bodegas y degustaciones seleccionadas. Excursión de día completo. El Tren del Vino y el almuerzo pueden formar parte de un paquete superior; confirmar al reservar.'),
    tour(['buz'], 'Búzios, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['arraial'], 'Arraial do Cabo, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['cabo'], 'Cabo Frio, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['ilha'], 'Ilha Grande, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['paraty'], 'Paraty, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['ilhabela'], 'Ilhabela, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['ubatuba'], 'Ubatuba, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['rio'], 'Río de Janeiro, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['angra'], 'Angra dos Reis, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['sao'], 'São Paulo, Brasil', 'Free tour a pie por el centro histórico', 'Recorrido guiado por los principales puntos históricos y culturales de la ciudad.', 20, 'Incluye guía local en español o portugués y recorrido a pie por plazas, edificios históricos y miradores del centro. Duración aproximada de 2 a 3 horas. El monto es una propina sugerida al guía; no hay costo fijo obligatorio.'),
    tour(['bho'], 'Belo Horizonte, Brasil', 'Free tour a pie por el centro histórico', 'Recorrido guiado por los principales puntos históricos y culturales de la ciudad.', 20, 'Incluye guía local en español o portugués y recorrido a pie por plazas, edificios históricos y miradores del centro. Duración aproximada de 2 a 3 horas. El monto es una propina sugerida al guía; no hay costo fijo obligatorio.'),
    tour(['curitiba'], 'Curitiba, Brasil', 'Free tour a pie por el centro histórico', 'Recorrido guiado por los principales puntos históricos y culturales de la ciudad.', 20, 'Incluye guía local en español o portugués y recorrido a pie por plazas, edificios históricos y miradores del centro. Duración aproximada de 2 a 3 horas. El monto es una propina sugerida al guía; no hay costo fijo obligatorio.'),
    tour(['porto'], 'Porto de Galinhas, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['mcz'], 'Maceió, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['maragogi'], 'Maragogi, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['nat'], 'Natal, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['pip'], 'Praia do Pipa, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['trancoso'], 'Trancoso / Arraial d’Ajuda, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['ssa'], 'Salvador de Bahía, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['for'], 'Fortaleza / Jericoacoara, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['jericoacoara'], 'Jericoacoara, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['morro'], 'Morro de São Paulo, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['fernando'], 'Fernando de Noronha, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['fln'], 'Florianópolis, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['camboriu'], 'Camboriú, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['bombinhas'], 'Bombinhas, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['rosa'], 'Praia do Rosa, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['bcm'], 'Balneário Camboriú, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['gram'], 'Gramado, Brasil', 'Snowland, el parque de nieve indoor', 'Nieve, trineo y clima frío bajo techo en pleno verano gaúcho.', 55, 'Incluye traslado y entrada general al parque temático de nieve artificial, con zona de trineos y bar de hielo. Actividad de medio día. Llevar ropa de abrigo; el parque provee camperas para la zona de nieve.'),
    tour(['canela'], 'Canela, Brasil', 'Parque do Caracol y su cascada', 'Mirador y torre de observación frente a la cascada más conocida de Canela.', 25, 'Incluye traslado y entrada al parque, con acceso al mirador de la cascada del Caracol y sendero corto por el bosque nativo. Actividad de medio día. Llevar calzado cómodo y cámara de fotos.'),
    tour(['igu'], 'Foz de Iguazú, Brasil', 'Represa de Itaipú', 'Visita guiada a una de las mayores hidroeléctricas del mundo.', 45, 'Incluye traslado y recorrido panorámico por el circuito de visitantes de Itaipú Binacional, con parada en el mirador y proyección institucional. Duración aproximada de 2 horas y media. Llevar documento de identidad, es obligatorio para el ingreso.'),
    tour(['rec'], 'Recife, Brasil', 'Kayak o stand up paddle en la costa', 'Alquiler de equipo con instructor para recorrer la costa a tu ritmo.', 30, 'Incluye equipo, chaleco salvavidas y una breve introducción de manejo antes de salir al agua. Actividad de 1 a 2 horas según el paquete elegido. Se recomienda reservar temprano en temporada alta y llevar protector solar resistente al agua.'),
    tour(['poa'], 'Porto Alegre, Brasil', 'Free tour a pie por el centro histórico', 'Recorrido guiado por los principales puntos históricos y culturales de la ciudad.', 20, 'Incluye guía local en español o portugués y recorrido a pie por plazas, edificios históricos y miradores del centro. Duración aproximada de 2 a 3 horas. El monto es una propina sugerida al guía; no hay costo fijo obligatorio.'),
  ];
  function tourDetailText(tour) {
    return tour.details || 'Incluye la actividad principal y acompañamiento local. Confirmá horarios, punto de encuentro, disponibilidad y valor final antes de reservar.';
  }

  var S = { dest: 'todos', dep: '', ret: '', pax: 2, budget: 3000, style: 'eq', transport: 'flight', proposalId: '', origin: 'MVD', subcategory: '', hotelType: 'intermedio', hotelTypeExplicit: false };
  var HOTEL_TYPE_LABELS = { 'all-inclusive': 'All Inclusive', resort: 'Resort', boutique: 'Boutique', economico: 'Económico', intermedio: 'Intermedio', confort: 'Confort' };
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
  var DESTINATION_GROUPS = [
    { id: 'rio', label: 'Río de Janeiro', image: 'rio', keys: ['rio'], subcategories: [
      { label: 'Réveillon Copacabana (31/12)', key: 'rio' }, { label: 'Zona Sur / Ipanema', key: 'rio' }, { label: 'Centro Histórico', key: 'rio' }
    ] },
    { id: 'buzios', label: 'Búzios / Arraial do Cabo / Cabo Frio', image: 'buz', keys: ['buz', 'arraial', 'cabo'], subcategories: [
      { label: 'Búzios + Arraial do Cabo', key: 'buz' }, { label: 'Sólo Búzios', key: 'buz' }, { label: 'Ruta de Playas (Cabo Frio)', key: 'cabo' }
    ] },
    { id: 'nordeste', label: 'Nordeste', image: 'porto', keys: ['porto', 'mcz', 'ssa'], subcategories: [
      { label: 'Porto de Galinhas (All Inclusive)', key: 'porto', hotelType: 'all-inclusive' }, { label: 'Maceió (Resort)', key: 'mcz', hotelType: 'resort' }, { label: 'Salvador de Bahía', key: 'ssa' }
    ] },
    { id: 'salvador', label: 'Salvador de Bahía', image: 'ssa', keys: ['ssa'], subcategories: [
      { label: 'Salvador de Bahía', key: 'ssa' }
    ] },
    { id: 'buenosaires', label: 'Buenos Aires', image: 'bue', keys: ['bue'], subcategories: [
      { label: 'Centro / Recoleta', key: 'bue' }, { label: 'Palermo / Zona Norte', key: 'bue' }, { label: 'Escapada de Fin de Semana', key: 'bue' }
    ] },
    { id: 'florianopolis', label: 'Florianópolis', image: 'fln', keys: ['fln'], subcategories: [
      { label: 'Canasvieiras / Norte', key: 'fln' }, { label: 'Praia dos Ingleses', key: 'fln' }, { label: 'Centro / Sur', key: 'fln' }
    ] },
    { id: 'ilhabela', label: 'Ilhabela / Ubatuba / Paraty', image: 'ilhabela', keys: ['ilhabela', 'ubatuba', 'paraty'], subcategories: [
      { label: 'Paraty Histórico', key: 'paraty' }, { label: 'Ubatuba Playas', key: 'ubatuba' }, { label: 'Ilhabela', key: 'ilhabela' }
    ] }
  ];
  var MONTH_DESTINATION_ROTATION = {
    0: ['florianopolis', 'ilhabela'], 1: ['florianopolis', 'ilhabela'],
    2: ['rio', 'buzios'], 3: ['rio', 'buenosaires'], 4: ['nordeste', 'buenosaires'],
    5: ['nordeste', 'salvador'], 6: ['buenosaires', 'salvador'], 7: ['rio', 'buenosaires'],
    8: ['rio', 'buzios'], 9: ['rio', 'buzios'], 10: ['nordeste', 'salvador'],
    11: ['rio', 'nordeste']
  };
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
  var DESTINATION_DAILY_COSTS = {
    bue: { transport: { eco: 18, confort: 38 }, food: { casual: 30, moderado: 58, gourmet: 100 } },
    sao: { transport: { eco: 22, confort: 48 }, food: { casual: 35, moderado: 70, gourmet: 125 } }, buz: { transport: { eco: 18, confort: 38 }, food: { casual: 32, moderado: 60, gourmet: 100 } }, arraial: { transport: { eco: 14, confort: 28 }, food: { casual: 25, moderado: 45, gourmet: 75 } }, cabo: { transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } }, ilha: { transport: { eco: 10, confort: 30 }, food: { casual: 28, moderado: 52, gourmet: 90 } }, paraty: { transport: { eco: 12, confort: 26 }, food: { casual: 24, moderado: 44, gourmet: 75 } }, ilhabela: { transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 58, gourmet: 95 } }, ubatuba: { transport: { eco: 15, confort: 32 }, food: { casual: 25, moderado: 48, gourmet: 80 } }, rio: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 95 } }, bho: { transport: { eco: 14, confort: 28 }, food: { casual: 22, moderado: 42, gourmet: 75 } }, porto: { transport: { eco: 15, confort: 32 }, food: { casual: 28, moderado: 52, gourmet: 85 } }, mcz: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 80 } }, maragogi: { transport: { eco: 13, confort: 28 }, food: { casual: 24, moderado: 45, gourmet: 75 } }, nat: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 48, gourmet: 80 } }, pip: { transport: { eco: 16, confort: 35 }, food: { casual: 30, moderado: 55, gourmet: 90 } }, trancoso: { transport: { eco: 20, confort: 45 }, food: { casual: 38, moderado: 70, gourmet: 120 } }, ssa: { transport: { eco: 14, confort: 30 }, food: { casual: 25, moderado: 48, gourmet: 85 } }, for: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } }, jericoacoara: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 60, gourmet: 100 } }, fernando: { transport: { eco: 30, confort: 75 }, food: { casual: 50, moderado: 95, gourmet: 160 } }, fln: { transport: { eco: 16, confort: 35 }, food: { casual: 28, moderado: 55, gourmet: 90 } }, bcm: { transport: { eco: 15, confort: 32 }, food: { casual: 26, moderado: 50, gourmet: 85 } }, gram: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } }, canela: { transport: { eco: 18, confort: 40 }, food: { casual: 32, moderado: 62, gourmet: 110 } }, igu: { transport: { eco: 12, confort: 25 }, food: { casual: 22, moderado: 40, gourmet: 70 } }
  };
  function getDestinationDailyCosts(key) { return DESTINATION_DAILY_COSTS[String(key || '').toLowerCase()] || DESTINATION_DAILY_COSTS.rio; }
  var massSearch = false;
  var detailState = null;
  var ROADTRIP_VEHICLES = { onix: 13, gol: 12, argo: 12.5, hilux: 9, kwid: 15 };
  // Códigos IATA usados por el buscador de vuelos. Se mantienen en el cliente
  // porque /api/cotizar devuelve el nombre del destino para la interfaz.
  var IATA_BY_DEST = { bue: 'EZE', buz: 'GIG', arraial: 'GIG', cabo: 'GIG', ilha: 'GIG', paraty: 'GIG', ilhabela: 'GRU', ubatuba: 'GRU', rio: 'GIG', angra: 'GIG', sao: 'GRU', bho: 'CNF', curitiba: 'CWB', porto: 'REC', mcz: 'MCZ', maragogi: 'MCZ', nat: 'NAT', pip: 'NAT', trancoso: 'SSA', ssa: 'SSA', for: 'FOR', jericoacoara: 'FOR', morro: 'SSA', fernando: 'NVT', fln: 'FLN', camboriu: 'FLN', bombinhas: 'FLN', rosa: 'FLN', bcm: 'FLN', gram: 'POA', canela: 'POA', igu: 'IGU', rec: 'REC', poa: 'POA' };
  var DEST_IATA_ALIASES = { bue: 'EZE AEP BUE', rio: 'RIO GIG', buz: 'GIG', arraial: 'GIG', cabo: 'GIG', porto: 'REC', mcz: 'MCZ', ssa: 'SSA', fln: 'FLN', ilhabela: 'GRU', ubatuba: 'GRU', paraty: 'GIG' };
  var DESTINATION_HUBS = [
    { name: 'Río de Janeiro', codes: 'GIG / SDU', options: [
      { label: 'Río de Janeiro (Centro / Sur)', key: 'rio', codes: 'RIO GIG SDU', subcategory: 'Centro / Sur' },
      { label: 'Búzios', key: 'buz', codes: 'GIG SDU' }, { label: 'Arraial do Cabo', key: 'arraial', codes: 'GIG SDU' },
      { label: 'Ilha Grande', key: 'ilha', codes: 'GIG SDU' }
    ] },
    { name: 'San Pablo', codes: 'GRU / CGH', options: [
      { label: 'Ilhabela', key: 'ilhabela', codes: 'GRU CGH' }, { label: 'Ubatuba', key: 'ubatuba', codes: 'GRU CGH' },
      { label: 'Paraty', key: 'paraty', codes: 'GRU CGH' }
    ] },
    { name: 'Nordeste', codes: 'REC / MCZ / SSA', options: [
      { label: 'Porto de Galinhas', key: 'porto', codes: 'REC' }, { label: 'Maceió', key: 'mcz', codes: 'MCZ' },
      { label: 'Salvador de Bahía', key: 'ssa', codes: 'SSA' }
    ] },
    { name: 'Florianópolis', codes: 'FLN', options: [
      { label: 'Canasvieiras / Norte', key: 'fln', codes: 'FLN', subcategory: 'Canasvieiras / Norte' },
      { label: 'Praia dos Ingleses', key: 'fln', codes: 'FLN', subcategory: 'Praia dos Ingleses' },
      { label: 'Centro / Sur de la isla', key: 'fln', codes: 'FLN', subcategory: 'Centro / Sur de la isla' }
    ] },
    { name: 'Buenos Aires', codes: 'EZE / AEP', options: [
      { label: 'Centro / Recoleta', key: 'bue', codes: 'EZE AEP BUE' },
      { label: 'Palermo / Zona Norte', key: 'bue', codes: 'EZE AEP BUE' },
      { label: 'Escapada de Fin de Semana', key: 'bue', codes: 'EZE AEP BUE', subcategory: 'Escapada de Fin de Semana' }
    ] }
  ];
  var ORIGIN_AIRPORTS = { MVD: 'Montevideo (MVD)', PDP: 'Punta del Este (PDP)' };
  function originLabel(code) { return ORIGIN_AIRPORTS[String(code || 'MVD').toUpperCase()] || ORIGIN_AIRPORTS.MVD; }
  function originCityName(code) { return originLabel(code).split(' · ')[0]; }
  function renderDestinationHighlights(monthIndex) {
    var root = document.getElementById('destination-highlights');
    if (!root) return;
    var names = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var seasonalIds = MONTH_DESTINATION_ROTATION[monthIndex] || MONTH_DESTINATION_ROTATION[new Date().getMonth()];
    var groups = DESTINATION_GROUPS.filter(function (group) { return seasonalIds.indexOf(group.id) >= 0; });
    var monthOptions = names.map(function (name, index) { return '<option value="' + index + '"' + (index === monthIndex ? ' selected' : '') + '>' + name.charAt(0).toUpperCase() + name.slice(1) + '</option>'; }).join('');
    var cards = groups.map(function (group) {
      var subcategories = monthIndex === 10 && group.id === 'nordeste' ? group.subcategories.filter(function (item) { return item.key !== 'ssa'; }) : group.subcategories;
      var options = subcategories.map(function (item, index) { return '<option value="' + index + '">' + esc(item.label) + '</option>'; }).join('');
      var photo = DEST_PHOTOS[group.image];
      var cardLabel = monthIndex === 11 && group.id === 'rio' ? 'Río de Janeiro · Réveillon' : group.label;
      return '<article class="featured-destination" data-featured-destination="' + esc(group.id) + '">' +
        (photo ? '<div class="featured-destination__image"><img src="' + esc(photo) + '" alt="Paisaje de ' + esc(group.label) + '" loading="lazy"></div>' : '') +
        '<div class="featured-destination__body"><span class="featured-destination__eyebrow">BRASIL · DESTINO DESTACADO</span><h3>' + esc(cardLabel) + '</h3>' +
        '<label class="sr-only" for="featured-subcategory-' + esc(group.id) + '">Elegí una zona de ' + esc(group.label) + '</label>' +
        '<select id="featured-subcategory-' + esc(group.id) + '" data-feature-subcategory="' + esc(group.id) + '">' + options + '</select>' +
        '<button type="button" class="featured-destination__search" data-feature-search="' + esc(group.id) + '">Ver propuesta <span aria-hidden="true">→</span></button></div></article>';
    }).join('');
    root.innerHTML = '<div class="destination-highlights__head"><div><span class="destination-highlights__eyebrow">ESCAPADAS PARA CADA TEMPORADA</span><h2 id="destination-highlights-title">Destinos destacados</h2><p>Elegí una zona y te mostramos una propuesta para tu viaje.</p></div><label>Ver destinos para <select data-feature-month aria-label="Simular mes para ver destinos">' + monthOptions + '</select></label></div><div class="destination-highlights__slider"><button type="button" class="destination-highlights__arrow destination-highlights__arrow--prev" data-feature-prev aria-label="Ver destino anterior">‹</button><div class="destination-highlights__carousel" aria-live="polite">' + cards + '</div><button type="button" class="destination-highlights__arrow destination-highlights__arrow--next" data-feature-next aria-label="Ver destino siguiente">›</button></div>';
  }
  var FOOD_TIPS = {
    rio: ['Probá un <b>prato feito</b> al mediodía en los restaurantes por kilo de Copacabana o Botafogo: suele incluir arroz, feijão, proteína y ensalada.', 'Para playa, comprá agua, fruta y snacks en un supermercado antes de bajar a la arena: los kioscos de la orla cuestan bastante más.', 'En Feira de São Cristóvão encontrás porciones abundantes de comida nordestina y opciones para compartir.'],
    fln: ['Buscá <b>prato executivo</b> en el centro de Florianópolis al mediodía: generalmente es la comida con mejor relación precio-cantidad.', 'En los mercados públicos y ferias barriales, armá un picnic con frutas, pan de queso y jugos para llevar a la playa.', 'Alejate una o dos cuadras de la playa para encontrar <b>buffet por kilo</b> y platos del día más accesibles.'],
    sao: ['En los restaurantes por kilo del centro y Vila Madalena, cargá un plato equilibrado y pagá solo por lo que comés.', 'La <b>feira livre</b> es ideal para frutas, pasteles y jugos a precios locales.', 'Compartí una pizza paulista grande: suele rendir para dos personas y es una cena clásica de buen valor.'],
    ssa: ['Probá un <b>prato feito</b> de comida baiana en el centro histórico, lejos de los locales con vista turística.', 'Las bahianas de acarajé son una merienda abundante y típica; consultá el precio antes de pedir extras.', 'Comprá agua y frutas en mercados locales antes de recorrer Pelourinho o las playas.'],
    igu: ['Para un almuerzo económico, buscá buffet por kilo o <b>prato feito</b> fuera de la zona hotelera.', 'En supermercados de Foz podés conseguir fruta, agua y meriendas para llevar a las cataratas.', 'Probá churrasquerías con menú de mediodía: muchas tienen opciones más convenientes que la cena.'],
    rec: ['Buscá menú ejecutivo en Boa Viagem o en el centro, a unas cuadras de la rambla.', 'Las tapiocas y jugos de los mercados son una opción local, rápida y económica para merendar.', 'En el Mercado de São José encontrás ingredientes y comidas populares a precio local.'],
    for: ['En Mercado dos Peixes podés elegir pescado y pedir que lo preparen; compará puestos antes de decidir.', 'Para el almuerzo, el <b>prato comercial</b> suele ser más barato y abundante que cenar en la costa.', 'Comprá agua de coco y fruta en mercados de barrio, no en los puestos de la playa.'],
    mcz: ['Buscá menú ejecutivo en Pajuçara o Jatiúca a una cuadra de la costa para evitar el recargo frente al mar.', 'Las tapiocas y cuscuz nordestinos son desayunos o meriendas baratos y rendidores.', 'Para excursiones, llevá agua y snacks del supermercado: en las paradas turísticas los precios suben.'],
    nat: ['Probá <b>prato feito</b> y buffet por kilo fuera de la primera línea de Ponta Negra.', 'En los mercados locales encontrás castañas, frutas y jugos para una merienda económica.', 'Compartí porciones de camarones o pescado en restaurantes de barrio: suelen ser generosas.'],
    poa: ['En el Mercado Público encontrás almuerzos, empanadas y productos locales a precios variados.', 'Los restaurantes por kilo del centro son una opción práctica para comer bien al mediodía.', 'Probá una cafetería de barrio para merendar: café con salgado suele costar menos que en zonas turísticas.']
  };
  var $ = function (s) { return document.querySelector(s); };
  var today = new Date(); today.setHours(12, 0, 0, 0);
  var timer = null, ctrl = null;
  var lastData = null;
  var pendingDestinationScroll = false;
  var featuredProposalSelection = null;
  var rangeCalendarMonth = null;
  var rangeCalendarStep = 'dep';

  /* ---------- utilidades ---------- */
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function money(n) { return 'US$ ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
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
  function featuredTravelDates(monthIndex, subcategory) {
    var selectedMonth = Math.max(0, Math.min(11, Number(monthIndex) || 0));
    var text = String(subcategory && subcategory.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    var departure;
    if (text.indexOf('reveillon') >= 0) {
      departure = new Date(today.getFullYear(), 11, 28, 12);
      if (departure <= today) departure = new Date(today.getFullYear() + 1, 11, 28, 12);
    } else {
      departure = new Date(today.getFullYear(), selectedMonth, 12, 12);
      if (departure <= today) {
        var nextDay = addDays(today, 1);
        var lastDayOfSelectedMonth = new Date(today.getFullYear(), selectedMonth + 1, 0, 12);
        departure = today.getMonth() === selectedMonth && today.getFullYear() === lastDayOfSelectedMonth.getFullYear() && nextDay <= lastDayOfSelectedMonth
          ? nextDay : new Date(today.getFullYear() + 1, selectedMonth, 12, 12);
      }
    }
    var tripNights = text.indexOf('fin de semana') >= 0 ? 2 : 7;
    return { dep: iso(departure), ret: iso(addDays(departure, tripNights)) };
  }
  function calendarMonthMarkup(monthDate) {
    var year = monthDate.getFullYear();
    var month = monthDate.getMonth();
    var first = new Date(year, month, 1, 12);
    var offset = (first.getDay() + 6) % 7;
    var count = new Date(year, month + 1, 0, 12).getDate();
    var minDeparture = iso(addDays(today, 1));
    var days = '';
    for (var blank = 0; blank < offset; blank++) days += '<span class="date-range-day date-range-day--blank" aria-hidden="true"></span>';
    for (var day = 1; day <= count; day++) {
      var value = iso(new Date(year, month, day, 12));
      var disabled = value < minDeparture || (rangeCalendarStep === 'ret' && S.dep && value <= S.dep);
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
    if (!months || !rangeCalendarMonth) return;
    var second = new Date(rangeCalendarMonth.getFullYear(), rangeCalendarMonth.getMonth() + 1, 1, 12);
    months.innerHTML = calendarMonthMarkup(rangeCalendarMonth) + calendarMonthMarkup(second);
    if (instruction) instruction.textContent = rangeCalendarStep === 'dep' ? 'Elegí la fecha de ida' : 'Ahora elegí la fecha de vuelta';
    var firstAllowedMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    if (previous) previous.disabled = rangeCalendarMonth <= firstAllowedMonth;
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
      intermedio: { tier: 'moderado', title: 'Intermedio', badge: 'MEJOR RELACIÓN PRECIO-CALIDAD', description: 'Hoteles de gama media filtrados por presupuesto por noche.' },
      confort: { tier: 'alto', title: 'Confort', badge: 'COMODIDAD PREMIUM', description: 'Hoteles de categoría superior filtrados por presupuesto.' }
    };
    if (typeProfiles[meta.hotelType]) return typeProfiles[meta.hotelType];
    var styles = {
      ahorro: { tier: 'eco', title: 'Ahorrar al máximo', badge: 'SÚPER ECONÓMICO', description: 'Posadas, hosteles boutique y opciones de bajo costo.' },
      eq: { tier: 'moderado', title: 'Equilibrado', badge: 'MEJOR RELACIÓN PRECIO-CALIDAD', description: 'Hoteles de gama media con buena ubicación y servicios.' },
      comodo: { tier: 'alto', title: 'Con comodidad', badge: 'COMODIDAD PREMIUM', description: 'Hoteles exclusivos, resorts y posadas de alta gama.' }
    };
    return styles[meta.style] || styles.eq;
  }
  function hotelImageFallback(index, fallback) {
    return fallback || '';
  }
  function sanitizeHotelImageUrl(value, fallback) {
    if (typeof value !== 'string') return fallback || '';
    var text = value.trim();
    var markdown = text.match(/^\[.*?\]\((https?:\/\/[^)]+)\)$/i);
    if (markdown && markdown[1]) return markdown[1].trim();
    var direct = text.match(/https?:\/\/[^\s)>"]+/i);
    return direct ? direct[0].trim() : (fallback || '');
  }
  function normalizeHotelCatalog(catalog, defaultHotel) {
    var unique = [];
    var seen = new Set();
    (catalog || []).forEach(function (item, index) {
      if (!item || !item.name) return;
      var name = String(item.name);
      var image = sanitizeHotelImageUrl(item.image, defaultHotel.image);
      if (!image || seen.has(image)) {
        image = '';
      }
      if (image) seen.add(image);
      unique.push(Object.assign({}, item, { name: name, image: image }));
    });
    return unique;
  }

  function hotelTypeSelectMarkup(meta) {
    var selected = meta.hotelType || 'intermedio';
    var options = ['economico', 'intermedio', 'confort', 'boutique', 'resort', 'all-inclusive'];
    return '<label class="hotel-type-filter"><span>Tipo de alojamiento</span><select data-hotel-type-select aria-label="Filtrar alojamientos por tipo">' + options.map(function (type) { return '<option value="' + type + '"' + (type === selected ? ' selected' : '') + '>' + esc(HOTEL_TYPE_LABELS[type]) + '</option>'; }).join('') + '</select></label>';
  }
  function hotelOptions(meta, accommodationTotal) {
    var nights = Math.max(1, Number(meta.nights) || 1);
    var pax = Math.max(1, Number(meta.pax) || 1);
    var average = Math.max(1, Number(accommodationTotal) || 1) / nights / pax;
    var profile = hotelStyle(meta);
    var defaultHotel = { tier: profile.tier, name: '', similar: [], image: '' };
    var hotelCatalog = normalizeHotelCatalog(Array.isArray(meta.hotels) ? meta.hotels : [], defaultHotel).filter(function (hotel) { return !hotel.hotelType || hotel.hotelType === meta.hotelType; });
    var options = hotelCatalog.slice(0, 3).map(function (item, index) {
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
    if (!options.length) {
      var destinationName = meta.dest.name || 'el destino elegido';
      var strictType = ['all-inclusive', 'resort', 'boutique'].indexOf(meta.hotelType) >= 0;
      var emptyCopy = strictType ? 'No encontramos alojamientos verificados de tipo ' + (HOTEL_TYPE_LABELS[meta.hotelType] || meta.hotelType) + ' para estas fechas. No mostramos categorías distintas como reemplazo.' : 'No pudimos cargar opciones automáticamente para estas fechas. Consultá alojamientos y disponibilidad directamente en el destino.';
      var destinationQuery = encodeURIComponent(destinationName);
      var nearbyName = meta.dest.key === 'ilha' || meta.dest.key === 'paraty' ? 'Angra dos Reis' : '';
      var nearbyLink = nearbyName ? '<a class="hotel-nearby-link hotel-nearby-link-secondary" href="https://www.booking.com/searchresults.es.html?ss=' + encodeURIComponent(nearbyName) + '" target="_blank" rel="noopener noreferrer">Ampliar a ' + esc(nearbyName) + ' ↗</a>' : '';
      return '<section class="hotel-options hotel-options-empty" aria-labelledby="hotel-options-title"><div class="hotel-options-head"><div><h2 id="hotel-options-title">Alojamientos en ' + esc(destinationName) + '</h2>' + hotelTypeSelectMarkup(meta) + '<p>' + esc(emptyCopy) + '</p><a class="hotel-nearby-link" href="https://www.booking.com/searchresults.es.html?ss=' + destinationQuery + '" target="_blank" rel="noopener noreferrer">Buscar en ' + esc(destinationName) + ' ↗</a>' + nearbyLink + '</div></div></section>';
    }
    return '<section class="hotel-options" aria-labelledby="hotel-options-title"><div class="hotel-options-head"><div><h2 id="hotel-options-title">Hoteles para viajar ' + esc(profile.title.toLowerCase()) + '</h2>' + hotelTypeSelectMarkup(meta) + '<p>' + esc(profile.description) + ' Seleccioná una alternativa de ' + money(average) + ' por noche en ' + esc(meta.dest.name) + '.</p></div></div><div class="hotel-grid">' +
      (meta.hotelsNearby ? '<p class="hotel-nearby-note">Mostramos opciones en ' + esc(meta.hotelsNearby) + ', una zona cercana a ' + esc(meta.dest.name) + '.</p>' : '') + options.map(function (option, index) {
        var nightlyValue = Number(option.perNight) || Math.max(1, Math.round(average * option.multiplier));
        var totalValue = Number(option.total) || hotelTotalForRate(meta, accommodationTotal, option.multiplier);
        var url = option.bookingUrl || bookingUrl(meta, { hotel: option.name });
        var imageUrl = sanitizeHotelImageUrl(option && option.image && typeof option.image === 'string' ? option.image : '', '');
        var imageMarkup = imageUrl ? '<div class="hotel-image-wrap"><img class="hotel-image" src="' + esc(imageUrl) + '" alt="' + esc(option.name) + '" loading="lazy" onerror="this.onerror=null;this.removeAttribute(\'src\');"></div>' : '<div class="hotel-image-wrap hotel-image-empty"><span>Sin foto disponible</span></div>';
        var similar = option.similar.map(function (name) { return '<li><a href="' + esc(bookingUrl(meta, { hotel: name })) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + ' ↗</a></li>'; }).join('');
        var similarMarkup = similar ? '<details class="hotel-similar"><summary>Ver hoteles similares</summary><ul>' + similar + '</ul></details>' : '';
        var descriptionMarkup = option.description ? '<p class="hotel-description">' + esc(option.description) + '</p>' : '';
        return '<article class="hotel-option' + (option.recommended ? ' recommended' : '') + '" data-hotel-option>' + imageMarkup + '<label class="hotel-choice"><input type="radio" name="hotel-choice" value="' + totalValue + '" data-hotel-total="' + totalValue + '"' + (option.recommended ? ' checked' : '') + '> <span class="hotel-badge">' + esc(option.highlight || profile.badge) + '</span></label><h3>' + esc(option.name) + '</h3>' + descriptionMarkup + '<p class="hotel-detail">' + (option.source === 'booking' ? 'Precio consultado para ' : 'Estimación para ') + nights + (nights === 1 ? ' noche' : ' noches') + ' y ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + '.</p><div class="hotel-price"><small>Desde</small><b>' + money(nightlyValue) + '</b><span>por noche</span></div><strong class="hotel-total">' + money(totalValue) + (option.source === 'booking' ? ' total en Booking' : ' total estimado') + '</strong><a class="hotel-booking" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Ver disponibilidad ↗</a>' + similarMarkup + '</article>';
      }).join('') + '</div></section>';
  }
  function localToursMarkup(meta) {
    var destinationKey = String(meta && meta.dest && meta.dest.key || '').toLowerCase();
    // Mostrar todas las experiencias cargadas para el destino seleccionado.
    var tours = LOCAL_TOURS.filter(function (tour) { return tour.destinations.indexOf(destinationKey) >= 0; });
    if (!tours.length) return '';
    var destPhoto = DEST_PHOTOS[destinationKey];
    return '<section class="local-tours" aria-labelledby="local-tours-title"><div class="local-tours__head"><div><span class="local-tours__eyebrow">EXPERIENCIAS EN DESTINO</span><h2 id="local-tours-title">Tours y actividades sugeridas</h2><p>Elegí las experiencias que querés sumar a tu viaje. Precio referencial, sujeto a disponibilidad.</p></div></div><div class="local-tours__grid" id="local-tours-grid-' + esc(destinationKey) + '">' + tours.map(function (tour, index) {
      var id = 'tour-' + destinationKey + '-' + index;
      var category = classifyTourPhoto(tour.title);
      var photo = (category && TOUR_CATEGORY_PHOTOS[category]) || destPhoto;
      var mediaMarkup = photo
        ? '<div class="local-tour__media"><img src="' + esc(photo) + '" alt="' + esc(tour.title) + '" loading="lazy"></div>'
        : '<div class="local-tour__media local-tour__media-empty"><span aria-hidden="true">✦</span></div>';
      return '<article class="local-tour" data-tour-card role="checkbox" tabindex="0" aria-checked="false" aria-label="Sumar ' + esc(tour.title) + ' al presupuesto">' + mediaMarkup + '<div class="local-tour__body"><input class="local-tour__input" type="checkbox" id="' + id + '" data-tour-choice data-tour-title="' + esc(tour.title) + '" data-tour-destination="' + esc(tour.destination) + '" data-tour-price="' + tour.price + '" tabindex="-1"><span class="local-tour__check" aria-hidden="true">✓</span><span class="local-tour__status">Sumar al presupuesto</span><p class="local-tour__destination">' + esc(tour.destination) + '</p><h3>' + esc(tour.title) + '</h3><p class="local-tour__description">' + esc(tour.description) + '</p><div class="local-tour__price"><small>Precio referencial</small><b>' + money(tour.price) + '</b></div><button type="button" class="local-tour__detail" data-tour-detail-open data-tour-title="' + esc(tour.title) + '" data-tour-description="' + esc(tour.description) + '" data-tour-detail="' + esc(tourDetailText(tour)) + '">Ver detalle</button></div></article>';
    }).join('') + '</div>' + (tours.length > 3 ? '<button type="button" class="local-tours__more" data-toggle-more-tours aria-expanded="false" aria-controls="local-tours-grid-' + esc(destinationKey) + '">Ver más tours (' + (tours.length - 3) + ') <span aria-hidden="true">⌄</span></button>' : '') + '<div class="local-tours__footer"><p class="local-tours__note">El precio es orientativo. Confirmá disponibilidad, fecha y valor final.</p><button type="button" class="local-tours__whatsapp" data-book-selected-tours disabled>Reservar los tours seleccionados <span aria-hidden="true">↗</span></button></div></section>';
  }
  function openTourDetailModal(button) {
    var modal = $('#booking-modal');
    if (!modal || !button) return;
    modal.innerHTML = '<div class="booking-dialog tour-detail-modal" role="dialog" aria-modal="true" aria-labelledby="tour-detail-title"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button><span class="tour-detail-modal__eyebrow">DETALLE DE LA EXPERIENCIA</span><h2 id="tour-detail-title">' + esc(button.getAttribute('data-tour-title')) + '</h2><p class="tour-detail-modal__description">' + esc(button.getAttribute('data-tour-description')) + '</p><div class="tour-detail-modal__copy"><p>' + esc(button.getAttribute('data-tour-detail')) + '</p></div><p class="tour-detail-modal__hint">Los horarios y la disponibilidad pueden variar. Confirmá el punto de encuentro y el valor final antes de reservar.</p></div>';
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
  var hotelRequestId = 0;
  function hotelLoading(meta) {
    return '<section class="hotel-options hotel-options-loading" aria-live="polite"><div class="hotel-options-head"><div><h2>Alojamientos en ' + esc(meta.dest.name) + '</h2>' + hotelTypeSelectMarkup(meta) + '<p>Buscando opciones disponibles…</p></div></div><div class="hotel-skeleton-grid" aria-hidden="true"><div class="hotel-skeleton-card"></div><div class="hotel-skeleton-card"></div><div class="hotel-skeleton-card"></div></div></section>';
  }
  function loadHotelRecommendations(meta, accommodationTotal) {
    var requestId = ++hotelRequestId;
    if (meta.hotelsLoaded) {
      var cached = document.querySelector('.hotel-options-loading');
      if (cached) cached.outerHTML = hotelOptions(meta, accommodationTotal);
      return;
    }
    var params = new URLSearchParams({ dest: meta.dest.key, dep: meta.dep, ret: meta.ret, pax: meta.pax, style: meta.style || 'eq', hotel_type: meta.hotelType || 'intermedio', subcategory: meta.subcategory || '' });
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
      meta.hotelsLoaded = true;
      var current = document.querySelector('.hotel-options-loading');
      if (current) current.outerHTML = hotelOptions(meta, accommodationTotal);
      var recommended = document.querySelector('[data-hotel-total]:checked');
      if (recommended) {
        var card = recommended.closest('[data-hotel-option]');
        detailState.selectedHotelName = card && card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : detailState.selectedHotelName;
        actualizarAlojamiento(Number(recommended.getAttribute('data-hotel-total')), true);
      }
    }).catch(function (error) {
      window.clearTimeout(timeout);
      if (requestId !== hotelRequestId || !detailState || detailState.meta !== meta) return;
      console.warn('[hoteles] No se pudieron cargar alojamientos:', error && error.message || 'error desconocido');
      meta.hotels = [];
      meta.hotelsLoaded = true;
      var current = document.querySelector('.hotel-options-loading');
      if (current) current.outerHTML = hotelOptions(meta, accommodationTotal);
    });
  }
  function getSelectedTransferAmount(state) {
    if (!state || state.transportMode === 'auto') return 0;
    if (state.transferType === 'private') return 150;
    if (state.transferType === 'shared') return 30;
    return Math.max(0, Number(state.transfer) || 0);
  }
  function getBudgetBreakdown(state) {
    if (!state) return { total: 0, entries: [] };
    var roadtrip = state.transportMode === 'auto';
    var categories = roadtrip ? ['auto', 'alojamiento', 'comidas', 'tours'] : state.transportMode === 'bus' ? ['bus', 'alojamiento', 'comidas', 'local', 'tours'] : ['pasajes', 'alojamiento', 'comidas', 'local', 'traslados', 'tours'];
    var transferValue = getSelectedTransferAmount(state);
    var trasladoValue = (Number(state.parts && state.parts.traslados) || 0) + transferValue;
    var total = roadtrip
      ? Math.round((Number(state.auto) || 0) + (Number(state.hotel) || 0) + (Number(state.parts.comidas) || 0) + (Number(state.toursTotal) || 0))
      : Math.round((state.transportMode === 'bus' ? (Number(state.parts && state.parts.bus) || 0) : (Number(state.flight) || 0)) + (Number(state.hotel) || 0) +
        (Number(state.parts.comidas) || 0) + (Number(state.parts.local) || 0) +
        trasladoValue + (Number(state.toursTotal) || 0));
    var entries = categories.map(function (category) {
      if (category === 'auto' && !roadtrip) return null;
      var info = CATS.filter(function (c) { return c[0] === category; })[0] || ['', category, '--c1'];
      var value = category === 'pasajes' ? (Number(state.flight) || 0)
        : category === 'bus' ? (Number(state.parts && state.parts.bus) || 0)
        : category === 'alojamiento' ? (Number(state.hotel) || 0)
        : category === 'traslados' ? trasladoValue
        : category === 'auto' ? (Number(state.auto) || 0)
        : category === 'tours' ? (Number(state.toursTotal) || 0)
        : (Number(state.parts && state.parts[category]) || 0);
      // Tours siempre se lista en "A dónde va tu plata", aunque todavía no se
      // haya sumado ninguna actividad, para que la categoría no desaparezca
      // del desglose apenas el usuario la mira antes de elegir algo.
      if (category !== 'tours' && Number(value) <= 0) return null;
      return { category: category, label: info[1], color: info[2], value: Number(value) || 0, width: total ? ((Number(value) / total) * 100) : 0 };
    }).filter(Boolean);
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
      return '<div class="proposal-breakdown__row" data-breakdown-category="' + entry.category + '"><div class="proposal-breakdown__label"><i style="background:var(' + entry.color + ')"></i><span>' + esc(entry.label) + '</span></div><b data-breakdown-value>' + money(entry.value) + '</b></div>';
    }).join('');
    return '<div class="proposal-breakdown__stack" role="img" aria-label="Distribución del costo">' + segments + '</div>' +
      '<div class="proposal-breakdown__list">' + rows + '</div>';
  }
  function proposalBreakdownMarkup(state) {
    return '<section class="proposal-breakdown" data-proposal-breakdown>' +
      '<h2>A dónde va tu plata</h2>' +
      proposalBreakdownContent(state) +
      '</section>';
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
    var route = ((flightSummary.origin && (flightSummary.origin.name || flightSummary.origin.code)) || 'Origen') + ' → ' + ((flightSummary.destination && (flightSummary.destination.name || flightSummary.destination.code)) || state.meta.dest.name);
    var message = 'Hola, quiero reservar este vuelo para mi viaje a ' + state.meta.dest.name + ':\n' + flightSummary.airline + ' · ' + route + '\n' + flightSummary.summary + '\nPrecio de referencia: ' + money(flightTotal) + '\nFechas: ' + state.meta.dep + ' al ' + state.meta.ret + ' · ' + state.meta.pax + (Number(state.meta.pax) === 1 ? ' pasajero' : ' pasajeros') + '. ¿Podrían confirmar disponibilidad y emitir?';
    return 'https://wa.me/?text=' + encodeURIComponent(message);
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
    var checked = document.querySelector('[data-hotel-total]:checked');
    var card = checked && checked.closest('[data-hotel-option]');
    var detail = card && card.querySelector('.hotel-detail');
    return detail && detail.textContent ? detail.textContent.trim() : 'Alojamiento seleccionado';
  }
  function renderTripSummary() {
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
    var flightLabel = (detailState.selectedOffer && detailState.selectedOffer.airline) || detailState.selectedFlight || 'Vuelo no seleccionado';
    var flightPrice = detailState.selectedOffer && detailState.selectedOffer.price ? Number(detailState.selectedOffer.price) : (Number(detailState.flight) || 0);
    var hotelName = findSelectedHotelLabel();
    var transferAmount = getSelectedTransferAmount(detailState);
    var transferIncluded = transferAmount > 0;
    // El detalle del transfer (modalidad + horario de recogida) se elige
    // dentro de "Transfer desde el aeropuerto" sin abrir ningún modal; una
    // vez elegido, este panel es el único lugar donde se administra y ve.
    var transferWizard = detailState.transferWizard || {};
    var transferModeLabel = detailState.transferType === 'private' ? 'Privado' : (detailState.transferType === 'shared' ? 'Compartido' : '');
    var transferPickupLabel = transferIncluded ? getTransferPickupLabel(transferWizard.pickupMinutes || '60', transferWizard.customTime) : '';
    var transferMeta = transferIncluded ? (transferModeLabel + (transferPickupLabel ? ' · ' + transferPickupLabel : '')) : 'No incluido';
    var toursLabel = detailState.selectedTours && detailState.selectedTours.length ? detailState.selectedTours.length + (detailState.selectedTours.length === 1 ? ' actividad seleccionada' : ' actividades seleccionadas') : 'Sin actividades seleccionadas';
    var foodPerDay = Number(detailState.foodPerDay) || 0;
    var localPerDay = Number(detailState.localPerDay) || 0;
    var summaryItems = [
      detailState.transportMode === 'bus'
        ? { label: 'Bus', meta: 'Semicama / cama desde ' + esc(originCityName(detailState.meta.origin || S.origin)), value: money(Number(detailState.parts && detailState.parts.bus) || 0), color: getCategoryColor('bus') }
        : { label: 'Vuelo', meta: esc(flightLabel), value: money(flightPrice), color: getCategoryColor('pasajes') },
      ...(detailState.transportMode === 'flight' ? [{ label: 'Transfer', meta: esc(transferMeta), value: transferIncluded ? money(transferAmount) : '—', color: getCategoryColor('traslados') }] : []),
      { label: 'Hotel', meta: esc(hotelName), value: money(Number(detailState.hotel) || 0), color: getCategoryColor('alojamiento') },
      { label: 'Comida', meta: foodPerDay ? money(foodPerDay) + '/día' : 'Estimado', value: money(Number(detailState.parts && detailState.parts.comidas) || 0), color: getCategoryColor('comidas') },
      { label: 'Transporte local', meta: localPerDay ? money(localPerDay) + '/día' : 'Estimado', value: money(Number(detailState.parts && detailState.parts.local) || 0), color: getCategoryColor('local') },
      { label: 'Tours', meta: toursLabel, value: money(Number(detailState.toursTotal) || 0), color: getCategoryColor('tours') }
    ];
    var segments = entries.map(function (entry) {
      return '<span style="width:' + entry.width + '%;background:var(' + entry.color + ')"></span>';
    }).join('');
    var itemsHtml = summaryItems.map(function (item) {
      return '<div class="trip-summary__item"><span class="trip-summary__marker" style="background:var(' + item.color + ')"></span><div class="trip-summary__meta"><span>' + item.label + '</span><b>' + item.meta + '</b></div><em>' + item.value + '</em></div>';
    }).join('');
    summary.innerHTML = '<div class="trip-summary__inner">' +
      '<button type="button" class="trip-summary__head" data-trip-summary-toggle aria-expanded="true"><span class="trip-summary__eyebrow">Mi Viaje</span><strong>' + money(total) + '</strong><span class="trip-summary__toggle-icon" aria-hidden="true">⌃</span></button>' +
      '<div class="trip-summary__details"><div class="trip-summary__bar" aria-label="Distribución del presupuesto">' + segments + '</div>' +
      '<div class="trip-summary__items">' + itemsHtml + '</div>' +
      '<div class="trip-summary__actions"><button type="button" class="trip-summary__cta" data-summary-book>Ver mi presupuesto</button><button type="button" class="trip-summary__save" data-save-trip>Guardar viaje</button></div></div>' +
      '</div>';
    summary.hidden = false;
    syncTripSummaryViewport();
  }
  function syncTripSummaryViewport() {
    var summary = $('#trip-summary');
    if (!summary) return;
    var isMobile = window.innerWidth <= 768;
    var wasMobile = summary.getAttribute('data-mobile-viewport') === 'true';
    if (isMobile && !wasMobile) summary.classList.add('minimized');
    if (!isMobile) summary.classList.remove('minimized');
    summary.setAttribute('data-mobile-viewport', String(isMobile));
    var toggle = summary.querySelector('[data-trip-summary-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', String(!isMobile || !summary.classList.contains('minimized')));
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
  function shareStoryCard(button) {
    if (!detailState || !detailState.meta) return;
    var originalLabel = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = '⏳ Generando imagen…'; }
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
      if (button) { button.disabled = false; button.textContent = originalLabel || '📸 Compartir en Instagram'; }
    });
  }
  function openItinerarySummaryModal() {
    if (!detailState || !detailState.meta) return;
    var modal = $('#booking-modal');
    var flightSummary = getSelectedFlightSummary();
    var transferState = detailState.transferWizard || { pickupMinutes: 60, customTime: '', hotelName: findSelectedHotelLabel() };
    var transferLabel = getTransferPickupLabel(transferState.pickupMinutes, transferState.customTime);
    var transferModeLabel = detailState.transferType === 'private' ? 'Transfer privado' : (detailState.transferType === 'shared' ? 'Transfer compartido' : (transferLabel || 'A coordinar'));
    var selectedHotelName = findSelectedHotelLabel();
    var selectedHotelDetail = findSelectedHotelDetail();
    var hotelTotal = Number(detailState.hotel) || 0;
    // Única fuente de verdad para el monto del traslado: la misma función que
    // ya usan el widget "Mi Viaje" y "A dónde va tu plata", para que este
    // voucher nunca muestre un número distinto al resto de la pantalla.
    var transferTotal = getSelectedTransferAmount(detailState);
    var nights = Math.max(1, Number(detailState.meta.nights) || 1);
    var pax = Math.max(1, Number(detailState.meta.pax) || 1);
    var dailyCosts = getDestinationDailyCosts(detailState.meta.dest && detailState.meta.dest.key);
    var foodPerDay = Number(detailState.foodPerDay) || dailyCosts.food.moderado;
    var localPerDay = Number(detailState.localPerDay) || dailyCosts.transport.eco;
    var foodTotal = Math.round(foodPerDay * nights * pax);
    var localTotal = Math.round(localPerDay * nights * pax);
    var flightTotal = Number(detailState.flight) || 0;
    var selectedTours = detailState.selectedTours || [];
    var toursTotal = Number(detailState.toursTotal) || 0;
    var toursLabel = selectedTours.length ? selectedTours.length + (selectedTours.length === 1 ? ' actividad seleccionada' : ' actividades seleccionadas') : 'Sin actividades seleccionadas';
    var toursDetail = selectedTours.length ? selectedTours.map(function (tour) { return tour.title; }).join(', ') : 'Sumá actividades desde la sección de tours.';
    var totalGeneral = Number(getBudgetBreakdown(detailState).total) || (flightTotal + hotelTotal + transferTotal + foodTotal + localTotal + toursTotal);
    var transportLabel = Math.abs(localPerDay - dailyCosts.transport.confort) < Math.abs(localPerDay - dailyCosts.transport.eco) ? 'Confort' : 'Económico';
    var foodLabel = Math.abs(foodPerDay - dailyCosts.food.gourmet) < 3 ? 'Gourmet' : (Math.abs(foodPerDay - dailyCosts.food.casual) < 3 ? 'Casual' : 'Moderado');
    var summaryText = '✈️ ITINERARIO · ' + detailState.meta.dest.name + '\n' + '📅 Fechas: ' + detailState.meta.dep + ' → ' + detailState.meta.ret + ' (' + nights + ' noches)\n' + '👥 Viajeros: ' + pax + '\n\n' + '✈️ Vuelo: ' + flightSummary.airline + ' · ' + flightSummary.summary + ' · ' + money(flightTotal) + '\n' + '🏨 Hotel: ' + selectedHotelName + ' · ' + money(hotelTotal) + '\n' + '🚐 Traslado: ' + (transferLabel || 'A coordinar') + ' · ' + money(transferTotal) + '\n' + '🎟️ Tours: ' + toursLabel + ' · ' + money(toursTotal) + '\n\n' + '📍 PRESUPUESTO OPERATIVO EN DESTINO\n' + '🚕 Transporte local (' + transportLabel + '): ' + money(localPerDay) + '/día · ' + money(localTotal) + ' total\n' + '🍽️ Gastronomía (' + foodLabel + '): ' + money(foodPerDay) + '/día · ' + money(foodTotal) + ' total\n\n' + '💳 TOTAL GENERAL ESTIMADO: ' + money(totalGeneral);
    summaryText = summaryText.replace('Traslado: ' + (transferLabel || 'A coordinar'), 'Traslado: ' + transferModeLabel);
    var bookingHref = bookingUrl(detailState.meta, { hotel: selectedHotelName });
    var flightBookUrl = flightWhatsappUrl(detailState, flightSummary, flightTotal);
    var toursBookUrl = toursWhatsappUrl(detailState);
    modal.innerHTML = '<div class="booking-dialog itinerary-summary voucher-dialog" role="dialog" aria-modal="true" aria-labelledby="itinerary-summary-title"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button>' +
      '<div class="voucher-head"><span class="voucher-kicker">CuantoSale · Voucher digital</span><h2 id="itinerary-summary-title">Resumen final del itinerario</h2><p>' + esc(detailState.meta.dest.name) + ' · ' + nights + (nights === 1 ? ' noche' : ' noches') + '</p></div>' +
      '<div class="voucher-total"><span>Total general estimado</span><strong>' + money(totalGeneral) + '</strong><div class="voucher-total__pp">' + money(Math.round(totalGeneral / pax)) + ' por persona</div><small>Calculado para ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + ' · Vuelo + hotel + traslados + tours + operación en destino</small></div>' +
      '<div class="voucher-grid"><div class="voucher-card"><span class="voucher-icon">✈️</span><div><small>Vuelo seleccionado</small><strong>' + esc(flightSummary.airline) + '</strong><p>' + esc(flightSummary.summary) + '</p><b>' + money(flightTotal) + '</b></div></div>' +
      '<div class="voucher-card"><span class="voucher-icon">🏨</span><div><small>Alojamiento</small><strong>' + esc(selectedHotelName) + '</strong><p>Reserva de referencia en Booking.com</p><b>' + money(hotelTotal) + '</b></div></div>' +
      '<div class="voucher-card"><span class="voucher-icon">🚐</span><div><small>Traslado</small><strong>' + esc(transferLabel || 'A coordinar') + '</strong><p>Destino: ' + esc(transferState.hotelName || selectedHotelName) + '</p><b>' + money(transferTotal) + '</b></div></div>' +
      '<div class="voucher-card"><span class="voucher-icon">🎟️</span><div><small>Tours y actividades</small><strong>' + esc(toursLabel) + '</strong><p>' + esc(toursDetail) + '</p><b>' + money(toursTotal) + '</b></div></div></div>' +
      '<div class="voucher-section"><div class="voucher-section__title"><span>📍</span><div><h3>Presupuesto Operativo en Destino</h3><p>Valores según tus elecciones y la duración del viaje</p></div></div><div class="voucher-breakdown"><div><span>🚕 Transporte local · ' + transportLabel + '</span><b>' + money(localPerDay) + '/día</b><em>' + money(localTotal) + ' total</em></div><div><span>🍽️ Gastronomía · ' + foodLabel + '</span><b>' + money(foodPerDay) + '/día</b><em>' + money(foodTotal) + ' total</em></div></div></div>' +
      '<div class="voucher-actions"><button type="button" class="voucher-instagram" data-share-story>📸 Compartir en Instagram</button><button type="button" class="voucher-whatsapp" data-share-whatsapp>🟢 Enviar itinerario por WhatsApp</button><button type="button" class="voucher-copy" data-copy-summary>📋 Copiar resumen al portapapeles</button><button type="button" class="voucher-copy" data-save-trip>☁️ Guardar este viaje</button><span class="voucher-copy-status" data-copy-status aria-live="polite"></span></div><a class="itinerary-summary__booking" href="' + esc(bookingHref) + '" target="_blank" rel="noopener noreferrer">Reservar alojamiento en Booking.com ↗</a>' +
      '<button type="button" class="itinerary-summary__booking itinerary-summary__booking--tp" data-book-hotel-affiliate data-hotel-name="' + esc(selectedHotelName) + '" data-hotel-total="' + hotelTotal + '">Reservar alojamiento (Travelpayouts) ↗</button></div>';
    modal.dataset.summaryText = summaryText;
    var voucherCards = modal.querySelectorAll('.voucher-card');
    if (voucherCards[0]) {
      var flightContent = voucherCards[0].querySelector('div');
      if (flightContent) {
        var legMarkup = '<div class="voucher-flight-legs"><div class="voucher-flight-leg"><span class="voucher-flight-leg__label">Ida</span><strong>' + esc(flightSummary.outboundAirline || flightSummary.airline) + (flightSummary.flightNumber ? ' · ' + esc(flightSummary.flightNumber) : '') + '</strong><span>' + esc((flightSummary.origin && (flightSummary.origin.name || flightSummary.origin.code)) || 'Origen') + ' (' + esc(airportCode(flightSummary.origin) || '---') + ') &rarr; ' + esc((flightSummary.destination && (flightSummary.destination.name || flightSummary.destination.code)) || 'Destino') + ' (' + esc(airportCode(flightSummary.destination) || '---') + ')</span><small>' + esc(flightSummary.departureText) + ' &rarr; ' + esc(flightSummary.arrivalText) + '</small></div>';
        if (flightSummary.isRoundTrip) legMarkup += '<div class="voucher-flight-leg"><span class="voucher-flight-leg__label">Vuelta</span><strong>' + esc(flightSummary.inboundAirline || flightSummary.airline) + (flightSummary.inboundFlightNumber ? ' · ' + esc(flightSummary.inboundFlightNumber) : '') + '</strong><span>' + esc((flightSummary.returnOrigin && (flightSummary.returnOrigin.name || flightSummary.returnOrigin.code)) || 'Destino') + ' (' + esc(airportCode(flightSummary.returnOrigin) || '---') + ') &rarr; ' + esc((flightSummary.returnDestination && (flightSummary.returnDestination.name || flightSummary.returnDestination.code)) || 'Origen') + ' (' + esc(airportCode(flightSummary.returnDestination) || '---') + ')</span><small>' + esc(flightSummary.returnDepartureText) + ' &rarr; ' + esc(flightSummary.returnArrivalText) + '</small></div>';
        legMarkup += '</div>';
        flightContent.innerHTML = '<small>' + (flightSummary.isRoundTrip ? 'Vuelo seleccionado · Ida y vuelta' : 'Vuelo seleccionado') + '</small><strong>' + esc(flightSummary.airline) + '</strong>' + legMarkup + '<b>' + money(flightTotal) + '</b>';
      }
    }
    if (voucherCards[2]) {
      var transferStrong = voucherCards[2].querySelector('strong');
      if (transferStrong) transferStrong.textContent = transferModeLabel;
      var transferText = voucherCards[2].querySelector('p');
      if (transferText) transferText.textContent = 'Hacia ' + (transferState.hotelName || selectedHotelName);
    }
    if (voucherCards[1]) {
      var hotelContent = voucherCards[1].querySelector('div');
      if (hotelContent) hotelContent.innerHTML = '<small>Alojamiento seleccionado</small><strong>' + esc(selectedHotelName) + '</strong><p>' + esc(selectedHotelDetail) + '</p><b>' + money(hotelTotal) + '</b>';
    }
    if (voucherCards[0]) voucherCards[0].querySelector('div').insertAdjacentHTML('beforeend', flightBookUrl ? '<a class="voucher-card__action" href="' + esc(flightBookUrl) + '" target="_blank" rel="noopener noreferrer">✈️ Reservar Vuelo</a>' : '<button type="button" class="voucher-card__action voucher-card__action--button" disabled>✈️ Reservar Vuelo</button>');
    if (voucherCards[1]) voucherCards[1].querySelector('div').insertAdjacentHTML('beforeend', '<a class="voucher-card__action" href="' + esc(bookingHref) + '" target="_blank" rel="noopener noreferrer">🏨 Reservar en Booking.com ↗</a>');
    if (voucherCards[2]) voucherCards[2].querySelector('div').insertAdjacentHTML('beforeend', '<button type="button" class="voucher-card__action voucher-card__action--button" data-coordinate-transfer>🚐 Coordinar traslado</button>');
    if (voucherCards[3]) voucherCards[3].querySelector('div').insertAdjacentHTML('beforeend', toursBookUrl ? '<a class="voucher-card__action" href="' + esc(toursBookUrl) + '" target="_blank" rel="noopener noreferrer">🎟️ Reservar Tours</a>' : '<button type="button" class="voucher-card__action voucher-card__action--button" disabled>🎟️ Reservar Tours</button>');
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
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
    else if ((!Number.isFinite(Number(detailState.foodPerDay)) || Number(detailState.foodPerDay) <= 0) && !detailState.foodPerDayTouched) detailState.foodPerDay = defaultFood || defaults.foodPerDayUsd;
    if ((!Number.isFinite(Number(detailState.localPerDay)) || Number(detailState.localPerDay) <= 0) && !detailState.localPerDayTouched) detailState.localPerDay = defaultLocal || defaults.localPerDayUsd;
    detailState.foodPerDay = Math.max(0, Number(detailState.foodPerDay) || 0);
    detailState.localPerDay = Math.max(0, Number(detailState.localPerDay) || 0);
    detailState.parts.comidas = Math.round((detailState.foodPerDay || 0) * nights * pax);
    detailState.parts.local = Math.round((detailState.localPerDay || 0) * nights * pax);
  }
  function recalcularTotalViaje() {
    if (!detailState) return;
    syncDailyBudgetState();
    var parts = detailState.parts;
    var roadtrip = detailState.transportMode === 'auto';
    var transferCost = getSelectedTransferAmount(detailState);
    var transport = roadtrip ? detailState.auto : (Number(parts.traslados) || 0) + transferCost;
    var budget = getBudgetBreakdown(detailState);
    var total = budget.total;
    var totalEl = document.querySelector('[data-detail-total]');
    if (totalEl) totalEl.textContent = money(total);
    var perPersonEl = document.querySelector('[data-detail-total-pp]');
    if (perPersonEl) perPersonEl.textContent = money(Math.round(total / Math.max(1, Number(detailState.meta.pax) || 1))) + ' por persona';
    var rows = document.querySelectorAll('[data-cost-category]');
    Array.prototype.forEach.call(rows, function (row) {
      var category = row.getAttribute('data-cost-category');
      var value = category === 'pasajes' ? detailState.flight : category === 'alojamiento' ? detailState.hotel : category === 'traslados' ? transport : category === 'auto' ? (roadtrip ? detailState.auto : 0) : category === 'local' && roadtrip ? 0 : (parts[category] || 0);
      var valueEl = row.querySelector('[data-cost-value]');
      if (valueEl) valueEl.textContent = money(Number(value) || 0);
    });
    var breakdown = document.querySelector('[data-proposal-breakdown]');
    if (breakdown) breakdown.innerHTML = '<h2>A dónde va tu plata</h2>' + proposalBreakdownContent(detailState);
    renderTripSummary();
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
      { key: 'casual', label: 'Casual / Street Food', description: 'Picadas, mercados y locales accesibles.', value: dailyCosts.food.casual },
      { key: 'moderado', label: 'Moderado (Restaurantes estándar)', description: 'Presupuesto equilibrado para almuerzos y cenas.', value: dailyCosts.food.moderado },
      { key: 'gourmet', label: 'Gourmet / Alta cocina', description: 'Experiencias culinarias destacadas.', value: dailyCosts.food.gourmet }
    ];
    var localOptions = [
      { key: 'econ', label: 'Económico', description: 'Ómnibus y Vans locales.', value: dailyCosts.transport.eco },
      { key: 'confort', label: 'Confort', description: 'Uber, taxis y traslados privados urbanos.', value: dailyCosts.transport.confort }
    ];
    function optionMarkup(options, kind) {
      var mode = kind === 'food' ? detailState.foodBudgetMode : detailState.localBudgetMode;
      var presets = options.map(function (option) {
        var selected = mode !== 'custom' && (kind === 'food' ? Math.abs(foodValue - option.value) < 6 : Math.abs(localValue - option.value) < 6);
        return '<button type="button" class="daily-budget__option' + (selected ? ' is-selected' : '') + '" aria-pressed="' + selected + '" data-daily-kind="' + kind + '" data-daily-value="' + option.value + '"><span class="daily-budget__option-title">' + esc(option.label) + '</span><span class="daily-budget__option-copy">' + esc(option.description) + '</span><strong>US$ ' + option.value + '/día</strong></button>';
      }).join('');
      var customSelected = mode === 'custom';
      var customValue = kind === 'food' ? detailState.foodCustomValue : detailState.localCustomValue;
      var input = '<label class="daily-budget__planned"><span>Monto por día</span><div class="daily-budget__input-wrap"><span>US$</span><input type="number" min="0" step="1" inputmode="decimal" value="' + (customValue == null ? '' : esc(customValue)) + '" placeholder="Ej: 30" data-daily-' + (kind === 'food' ? 'food' : 'local') + ' aria-label="Presupuesto personalizado diario para ' + (kind === 'food' ? 'comidas' : 'transporte local') + '"><span>/día</span></div></label>';
      var custom = customSelected
        ? '<div class="daily-budget__option daily-budget__option--custom is-selected" data-daily-kind="' + kind + '-custom"><span class="daily-budget__option-title">Personalizado</span>' + input + '</div>'
        : '<button type="button" class="daily-budget__option daily-budget__option--custom" aria-pressed="false" data-daily-kind="' + kind + '-custom"><span class="daily-budget__option-title">Personalizado</span><span class="daily-budget__option-copy">Escribí el monto que querés gastar.</span><strong>Ingresar monto</strong></button>';
      return presets + custom;
    }
    return '<section class="detail-section daily-budget" aria-label="Presupuesto diario configurado">' +
      '<h2>Personalizá tus costos diarios</h2>' +
      '<div class="daily-budget__group">' +
      '<div class="daily-budget__header"><span>Transporte local</span><small>Presupuesto libre</small></div>' +
      '<div class="daily-budget__options">' + optionMarkup(localOptions, 'local') + '</div>' +
      '</div>' +
      '<div class="daily-budget__group">' +
      '<div class="daily-budget__header"><span>Comidas</span><small>Presupuesto libre</small></div>' +
      '<div class="daily-budget__options">' + optionMarkup(foodOptions, 'food') + '</div>' +
      '</div>' +
      '<p class="daily-budget__hint">Se recalcula automáticamente para toda la duración del viaje.</p>' +
      '</section>';
  }
  function formatFlightDateTime(value) {
    if (!value) return 'sin fecha';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-UY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function getSelectedFlightSummary() {
    if (!detailState) return { airline: 'Vuelo seleccionado', summary: 'Todavía no elegiste un vuelo.' };
    var offer = getSelectedFlightOffer();
    var airline = (offer && offer.airline) || detailState.selectedFlight || 'Vuelo seleccionado';
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
      route: route
    };
  }
  function sincronizarTrasladoOficial() {
    if (!detailState) return;
    // La modalidad elegida se suma al presupuesto inmediatamente. Vuelo y hotel
    // solo son requisitos para coordinar el traslado, no para cotizar su costo.
    // getSelectedTransferAmount() es la única fuente de verdad del monto, para
    // que este total nunca se desincronice del que muestran Mi Viaje y el
    // desglose "A dónde va tu plata".
    detailState.transfer = detailState.transportMode === 'flight' && detailState.transferType
      ? getSelectedTransferAmount(detailState)
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
  function actualizarAlojamiento(price, selectedByUser) {
    if (!detailState || !Number.isFinite(price) || price <= 0) return;
    if (detailState.multiStay && selectedByUser) {
      detailState.multiStay.selectedPrimaryHotelTotal = Math.round(price);
      updateMultiStayPricing();
    } else { detailState.hotel = Math.round(price); }
    if (selectedByUser) {
      detailState.selectedHotel = true;
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
  function actualizarTransporte(autoEnabled) {
    if (!detailState) return;
    detailState.transportMode = autoEnabled ? 'auto' : 'flight';
    detailState.auto = autoEnabled ? Number(detailState.roadtrip.totalUsd) : 0;
    detailState.flight = autoEnabled ? 0 : detailState.baseFlight;
    detailState.parts.traslados = autoEnabled ? 0 : detailState.baseTraslados + (detailState.multiStay ? Number(detailState.multiStay.transferBetweenUsd) || 0 : 0);
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
    if (detailState.transportMode === 'auto') detailState.auto = r.totalUsd;
    recalcularTotalViaje();
  }
  function actualizarModeloRoadtrip(model) {
    var manual = document.querySelector('[data-roadtrip-consumption]');
    if (!manual) return;
    var custom = model === 'custom';
    manual.hidden = !custom;
    manual.disabled = !custom;
    if (!custom) {
      manual.value = ROADTRIP_VEHICLES[model];
      actualizarRoadtrip(ROADTRIP_VEHICLES[model]);
    } else {
      manual.focus();
    }
  }
  function roadtripCard(meta, autoSelected) {
    return '';
  }
  function roadtripCalculator(meta) {
    var r = meta.roadtrip;
    if (!r) return '';
    return '<section class="transport-options"><div class="transport-card transport-detail" data-roadtrip-calculator><label for="roadtrip-model">Modelo o consumo del auto<select id="roadtrip-model" data-roadtrip-model><option value="onix">Chevrolet Onix · 13 km/l</option><option value="gol" selected>VW Gol · 12 km/l</option><option value="argo">Fiat Argo · 12,5 km/l</option><option value="hilux">Toyota Hilux · 9 km/l</option><option value="kwid">Renault Kwid · 15 km/l</option><option value="custom">Personalizado (Ingresar manual)</option></select></label><label for="roadtrip-consumption">Consumo personalizado (km por litro)<input id="roadtrip-consumption" type="number" inputmode="decimal" min="3" max="40" step="0.1" value="' + esc(r.kmPerLiter || 12) + '" data-roadtrip-consumption hidden disabled></label><p>⛽ Combustible: <span data-roadtrip-liters>' + r.liters + ' litros</span> × ' + money(r.fuelPriceUsd) + '/l = <b data-roadtrip-fuel>' + money(r.fuelUsd) + '</b></p><p>🚧 Peajes estimados: <b>' + money(r.tollsUsd) + '</b></p><p>🚗 Total Auto / Roadtrip: <b data-roadtrip-total>' + money(r.totalUsd) + '</b></p><p>⏱️ Manejo estimado: <b>' + r.hours + ' horas</b></p><p class="cost-note">* Ruta ida y vuelta de ' + r.roundTripKm + ' km. Combustible estimado para ruta/Brasil y peajes incluidos.</p></div></section>';
  }
  function transferPickupTimeLabel(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';
  }
  function transferCard(meta) {
    var selected = detailState && detailState.transferType || '';
    var wizard = (detailState && detailState.transferWizard) || {};
    var pickupMinutes = wizard.pickupMinutes ? String(wizard.pickupMinutes) : '60';
    var offer = getSelectedFlightOffer();
    var hasLiveFlight = !!(offer && ((offer.outbound && offer.outbound.arrival) || offer.arrival));
    var pickupWindow = getTransferPickupWindow();
    var suggestionMarkup = hasLiveFlight
      ? '<p class="transfer-suggestion">✈️ Tu vuelo llega ' + esc(transferPickupTimeLabel(pickupWindow.baseDate)) + ' hs. Te sugerimos coordinar la recogida para ' + esc(transferPickupTimeLabel(pickupWindow.plusOneHour)) + ' hs (1 hora después).</p>'
      : '';
    var cards = [
      { key: 'shared', amount: 30, icon: '🚐', title: 'Transfer compartido', desc: 'Compartís el vehículo con otros pasajeros.' },
      { key: 'private', amount: 150, icon: '🚗', title: 'Transfer privado', desc: 'Vehículo exclusivo y traslado directo.' }
    ].map(function (card) {
      var isSelected = selected === card.key;
      return '<button type="button" class="transfer-choice' + (isSelected ? ' is-selected' : '') + '" data-transfer-choice="' + card.key + '" data-transfer-amount="' + card.amount + '"><span class="transfer-choice__icon" aria-hidden="true">' + card.icon + '</span><span class="transfer-choice__body"><strong>' + card.title + '</strong><small>' + card.desc + '</small></span><b class="transfer-choice__price">US$ ' + card.amount + '</b></button>';
    }).join('');
    var pickupMarkup = selected ? '<div class="transfer-pickup" data-transfer-pickup>' +
      '<span class="transfer-pickup__label">Horario de recogida</span><div class="transfer-pickup__chips">' +
      ['60', '120', 'custom'].map(function (value) {
        var label = value === '60' ? '1 h después · ' + transferPickupTimeLabel(pickupWindow.plusOneHour)
          : value === '120' ? '2 h después · ' + transferPickupTimeLabel(pickupWindow.plusTwoHours)
          : 'Personalizado';
        return '<button type="button" class="transfer-pickup__chip' + (pickupMinutes === value ? ' is-selected' : '') + '" data-transfer-pickup-choice="' + value + '">' + esc(label) + '</button>';
      }).join('') + '</div>' +
      (pickupMinutes === 'custom' ? '<input type="time" class="transfer-pickup__time" data-transfer-custom-time value="' + esc(wizard.customTime || '') + '" aria-label="Horario personalizado de recogida">' : '') +
      '</div>' : '';
    // Elegir una tarjeta ya suma el transfer al presupuesto (igual que tours y
    // hoteles); este botón es solo el indicador de estado, nunca abre un modal
    // ni un flujo de pasos adicional. El detalle queda centralizado en "Mi Viaje".
    var addedLabel = selected ? '✓ Agregado al presupuesto' : 'Elegí un tipo de transfer';
    return '<section class="transport-options official-transfer" data-official-transfer><h2>Transfer desde el aeropuerto</h2><p>Elegí cómo querés llegar a tu alojamiento en ' + esc(meta.dest.name) + '.</p>' + suggestionMarkup + '<div class="transfer-choice-grid">' + cards + '</div>' + pickupMarkup + '<button type="button" class="btn-transfer' + (selected ? ' is-added' : '') + '" disabled>' + addedLabel + '</button></section>';
  }

  function transportFlow(meta, budget, mode) {
    var selectedMode = typeof mode === 'string' ? mode : mode ? 'auto' : 'flight';
    if (selectedMode === 'auto') return roadtripCalculator(meta);
    if (selectedMode === 'bus') return '<section class="transport-options bus-itinerary"><h2>Bus semicama / cama</h2><p>Estimación de pasaje ida y vuelta desde ' + esc(originCityName(meta.origin || S.origin)) + ' hasta ' + esc(meta.dest.name) + '.</p><p>El presupuesto incluye el pasaje terrestre; no requiere transfer de aeropuerto.</p><p class="cost-note">La tarifa de bus es estimada y debe confirmarse con el operador para las fechas elegidas.</p></section>';
    return '<section class="detail-section"><h2>Reserva tus Vuelos en Vivo</h2>' + flightSearch(meta, budget) + '</section>' + transferCard(meta);
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
    var categories = roadtrip ? ['auto', 'alojamiento', 'comidas'] : detailState.transportMode === 'bus' ? ['bus', 'alojamiento', 'comidas', 'local'] : ['pasajes', 'alojamiento', 'comidas', 'local', 'traslados'];
    return categories.map(function (category) {
      if (category === 'auto' && !roadtrip) return '';
      var label = CATS.filter(function (c) { return c[0] === category; })[0][1];
      var value = category === 'pasajes' ? detailState.flight : category === 'alojamiento' ? detailState.hotel : category === 'traslados' ? (Number(detailState.parts.traslados) || 0) + getSelectedTransferAmount(detailState) : category === 'auto' ? detailState.auto : detailState.parts[category];
      return '<div data-cost-category="' + category + '"><span>' + label + '</span><b data-cost-value>' + money(Number(value) || 0) + '</b></div>';
    }).join('');
  }
  function getTransferPickupWindow() {
    var offer = getSelectedFlightOffer();
    var arrivalValue = null;
    if (offer) {
      if (offer.outbound && offer.outbound.arrival) arrivalValue = offer.outbound.arrival;
      else if (offer.inbound && offer.inbound.arrival) arrivalValue = offer.inbound.arrival;
      else if (offer.arrival) arrivalValue = offer.arrival;
      else if (offer.departure) arrivalValue = offer.departure;
    }
    var baseDate = arrivalValue ? new Date(arrivalValue) : new Date();
    if (Number.isNaN(baseDate.getTime())) return { baseDate: new Date(), customMinutes: 60 };
    return {
      baseDate: baseDate,
      customMinutes: 60,
      plusOneHour: new Date(baseDate.getTime() + 60 * 60 * 1000),
      plusTwoHours: new Date(baseDate.getTime() + 120 * 60 * 1000)
    };
  }
  function getTransferPickupLabel(minutes, customValue) {
    if (minutes === 'custom') return customValue ? 'Horario personalizado: ' + customValue : 'Horario personalizado';
    if (Number(minutes) === 60) return '1 hora después de la llegada';
    if (Number(minutes) === 120) return '2 horas después de la llegada';
    return 'Horario a coordinar';
  }
  function transferFlightLegCard(label, origin, destination, departureText, arrivalText, flightNumber) {
    return '<div class="transfer-flight-leg"><span class="flight-badge">' + esc(label) + '</span>' +
      '<div class="flight-route"><div><small>' + esc(airportCode(origin)) + ' → ' + esc(airportCode(destination)) + '</small><small>Salida · ' + esc(airportLabel(origin)) + '</small><b>' + esc(departureText) + '</b></div><span aria-hidden="true">→</span><div><small>Llegada · ' + esc(airportLabel(destination)) + '</small><b>' + esc(arrivalText) + '</b></div></div>' +
      (flightNumber ? '<small class="transfer-flight-leg__number">Vuelo ' + esc(flightNumber) + '</small>' : '') + '</div>';
  }
  function transferFlightInfoMarkup(flightData) {
    var hasFlight = !!(flightData && flightData.origin && (flightData.origin.code || flightData.origin.name));
    if (!hasFlight) {
      return '<div class="transfer-flight-sync transfer-flight-sync--empty"><p>✈️ Todavía no elegiste un vuelo. En cuanto lo hagas, usamos su horario real para sugerir la recogida.</p></div>';
    }
    return '<div class="transfer-flight-sync"><div class="flight-airline"><b>' + esc(flightData.airline) + '</b></div>' +
      transferFlightLegCard('Ida', flightData.origin, flightData.destination, flightData.departureText, flightData.arrivalText, flightData.flightNumber) +
      (flightData.isRoundTrip ? transferFlightLegCard('Vuelta', flightData.returnOrigin, flightData.returnDestination, flightData.returnDepartureText, flightData.returnArrivalText, flightData.inboundFlightNumber) : '') +
      '</div>';
  }
  function openTransferModal(meta) {
    if (!detailState) return;
    meta = meta || detailState.meta;
    detailState.transferWizard = detailState.transferWizard || { step: 1, pickupMinutes: 60, customTime: '', hotelName: '' };
    var state = detailState.transferWizard;
    if (!state.pickupMinutes) state.pickupMinutes = 60;
    if (!state.hotelName && detailState.selectedHotelName) state.hotelName = detailState.selectedHotelName;
    state.step = 1;
    renderTransferWizard(meta, 1);
  }
  function syncTransferWizardStateFromDom(modal) {
    if (!detailState || !detailState.transferWizard || !modal) return;
    var state = detailState.transferWizard;
    var radio = modal.querySelector('[name="transfer-pickup"]:checked');
    if (radio) {
      state.pickupMinutes = radio.value;
      if (String(radio.value) === 'custom') {
        var customInput = modal.querySelector('[data-transfer-custom-time]');
        state.customTime = customInput ? customInput.value : '';
      } else {
        state.customTime = '';
      }
    }
    var hotelInput = modal.querySelector('[name="transfer-hotel"]');
    if (hotelInput) state.hotelName = (hotelInput.value || '').trim();
  }
  function advanceTransferWizard(targetStep) {
    var modal = $('#booking-modal');
    if (!detailState || !detailState.transferWizard || !modal) return;
    syncTransferWizardStateFromDom(modal);
    var state = detailState.transferWizard;
    if (state.step === 1 && String(state.pickupMinutes) === 'custom' && !state.customTime) {
      alert('Seleccioná un horario personalizado para continuar.');
      var customInput = modal.querySelector('[data-transfer-custom-time]');
      if (customInput) customInput.focus();
      return;
    }
    if (state.step === 2 && !state.hotelName) {
      alert('Ingresá el hotel o pousada de destino para continuar.');
      var hotelInput = modal.querySelector('[name="transfer-hotel"]');
      if (hotelInput) hotelInput.focus();
      return;
    }
    state.step = targetStep;
    renderTransferWizard(detailState.meta, state.step);
  }
  function addTransferToBudget() {
    if (!detailState) return;
    detailState.transfer = getSelectedTransferAmount(detailState);
    detailState.selectedHotel = true;
    detailState.transferWizard = detailState.transferWizard || {};
    detailState.transferWizard.hotelName = detailState.transferWizard.hotelName || findSelectedHotelLabel();
    closeBookingForm();
    recalcularTotalViaje();
    renderTripSummary();
  }
  function renderTransferWizard(meta, step) {
    var modal = $('#booking-modal');
    var t = meta.officialTransfer;
    if (!detailState) return;
    detailState.transferWizard = detailState.transferWizard || { step: 1, pickupMinutes: 60, customTime: '', hotelName: '' };
    var state = detailState.transferWizard;
    if (step) state.step = step;
    var flightData = getSelectedFlightSummary();
    var flightInfo = transferFlightInfoMarkup(flightData);
    var arrivalWindow = getTransferPickupWindow();
    var pickupOptions = [
      { value: '60', label: '1 hora después de la llegada', time: arrivalWindow.plusOneHour ? arrivalWindow.plusOneHour.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false }) : '01:00' },
      { value: '120', label: '2 horas después de la llegada', time: arrivalWindow.plusTwoHours ? arrivalWindow.plusTwoHours.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false }) : '02:00' },
      { value: 'custom', label: 'Otro horario personalizado', time: 'Ingresá el horario' }
    ];
    var selectedIndex = pickupOptions.findIndex(function (option) { return String(option.value) === String(state.pickupMinutes); });
    var stepMarkup = '';
    if (state.step === 1) {
      stepMarkup = '<div class="transfer-step"><div class="transfer-step__header"><span class="transfer-step__badge">Paso 1</span><h3>¿Cuándo querés que te recojan?</h3></div>' +
        '<div class="transfer-pickup-options">' + pickupOptions.map(function (option) {
          var index = pickupOptions.indexOf(option);
          var checked = selectedIndex === index ? 'checked' : '';
          var customInput = option.value === 'custom' ? '<input class="transfer-custom-time" type="time" data-transfer-custom-time value="' + esc(state.customTime || '') + '" ' + (selectedIndex === index ? '' : 'disabled') + '>' : '<span class="transfer-pickup__time">' + esc(option.time) + '</span>';
          return '<label class="transfer-pickup-option' + (checked ? ' selected' : '') + '"><input type="radio" name="transfer-pickup" value="' + esc(option.value) + '" ' + checked + ' data-transfer-pickup-radio><span class="transfer-pickup__content"><strong>' + esc(option.label) + '</strong>' + customInput + '</span></label>';
        }).join('') + '</div>' +
        '<button type="button" class="confirm-booking" data-transfer-step="2">Continuar</button></div>';
    } else {
      var pickupText = getTransferPickupLabel(state.pickupMinutes, state.customTime);
      var hotelText = state.hotelName ? state.hotelName : findSelectedHotelLabel();
      state.hotelName = hotelText;
      stepMarkup = '<div class="transfer-step"><div class="transfer-step__header"><span class="transfer-step__badge">Paso 2</span><h3>¿Dónde te alojás?</h3></div>' +
        '<label class="transfer-field"><span>Hotel o pousada de destino</span><input type="text" name="transfer-hotel" value="' + esc(hotelText) + '" placeholder="Ej: Pousada del Sol" autocomplete="off"></label>' +
        '<div class="transfer-summary-box"><p><b>Recogida:</b> ' + esc(pickupText) + '</p><p><b>Hotel:</b> ' + esc(hotelText) + '</p><p><b>Vuelo:</b> ' + esc(flightData.airline) + '</p><p><b>Costo transfer:</b> ' + money(t.amount || 70) + '</p></div>' +
        '<button type="button" class="confirm-booking" data-transfer-add-budget>Agregar al presupuesto</button></div>';
    }
    modal.innerHTML = '<div class="booking-dialog transfer-wizard" role="dialog" aria-modal="true"><button type="button" class="booking-close" data-close-booking aria-label="Cerrar">×</button><h2>Transfer desde el aeropuerto</h2>' + flightInfo + stepMarkup + '</div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
  }
  async function submitTransfer(form) {
    var button = form.querySelector('button[type="submit"]'), file = form.querySelector('[name="receipt"]').files[0];
    if (!file) return;
    button.disabled = true; button.textContent = 'Agregando al presupuesto…';
    try {
      var dataUrl = await new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = reject; reader.readAsDataURL(file); });
      var amount = Number(form.querySelector('[name="amount"]').value || 0);
      if (detailState) {
        detailState.transfer = amount;
        detailState.selectedHotel = true;
        detailState.transferWizard = detailState.transferWizard || {};
        detailState.transferWizard.hotelName = form.querySelector('[name="hotel_name"]').value || detailState.selectedHotelName || 'Hotel de destino';
      }
      var response = await fetch('/api/traslados/transferencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amount, destination: S.dest, pickup_minutes: form.querySelector('[name="pickup_minutes"]').value || '', pickup_label: form.querySelector('[name="pickup_label"]').value || '', hotel_name: form.querySelector('[name="hotel_name"]').value || '', flight_airline: (detailState && detailState.selectedFlight) || 'Vuelo activo', receipt: { name: file.name, type: file.type, data: dataUrl } }) });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(result.error || 'No pudimos registrar la transferencia.');
      sincronizarTrasladoOficial();
      $('#booking-modal').innerHTML = '<div class="booking-dialog booking-success"><div class="success-icon">✅</div><h2>Transfer agregado al presupuesto</h2><p class="booking-note">' + esc(result.message || 'El transfer quedó incluido en el cálculo de tu viaje.') + '</p><button type="button" class="confirm-booking" data-close-booking>Entendido</button></div>';
    } catch (e) { button.disabled = false; button.textContent = 'Agregar al presupuesto'; alert(e.message || 'No pudimos registrar la transferencia.'); }
  }
  function guideUnlocked() {
    try { return localStorage.getItem('cuantosale_guia_desbloqueada') === 'true'; } catch (e) { return false; }
  }
  function unlockGuide() {
    try { localStorage.setItem('cuantosale_guia_desbloqueada', 'true'); } catch (e) { /* la guía se desbloquea igualmente en esta vista */ }
    Array.prototype.forEach.call(document.querySelectorAll('.food-guide'), function (guide) {
      guide.querySelector('.food-tips').classList.remove('bloqueado');
      var lock = guide.querySelector('.guide-lock');
      if (lock) lock.hidden = true;
    });
  }
  function foodGuide(meta) {
    var tips = FOOD_TIPS[meta.dest.key] || FOOD_TIPS.fln;
    var locked = !guideUnlocked();
    var items = tips.map(function (tip) { return '<li>📍 🔒 ' + tip + '</li>'; }).join('');
    return '<section class="food-guide" aria-labelledby="food-guide-title">' +
      '<div class="food-guide-head"><span aria-hidden="true">🍽️</span><div><h2 id="food-guide-title">Guía Secreta: Dónde comer bien y barato en ' + esc(meta.dest.name) + '</h2>' +
      '<p>Ideas locales para cuidar tu presupuesto sin resignar sabor.</p></div></div>' +
      '<ul class="food-tips' + (locked ? ' bloqueado' : '') + '">' + items + '</ul>' +
      '<div class="guide-lock"' + (locked ? '' : ' hidden') + '>' +
      '<div class="guide-lock-icon" aria-hidden="true">🔒</div>' +
      '<p>🔒 <b>Contenido exclusivo desbloqueable:</b> Ayúdanos a mantener CuántoSale gratuito abriendo las opciones de alojamiento en Booking.com (no requiere compra, solo abrir el enlace).</p>' +
      '<a class="guide-unlock" data-unlock-guide href="' + esc(bookingUrl(meta)) + '" target="_blank" rel="noopener noreferrer">🏨 Ver Hoteles en Booking y Desbloquear Guía 🔓</a>' +
      '</div></section>';
  }
  function flightSearch(meta, budget) {
    return '<section class="flight-search" aria-labelledby="flight-title"><div><h2 id="flight-title">Vuelos</h2><p>Tarifas aéreas en tiempo real para tu viaje.</p></div>' +
      '<div class="flight-filters" aria-label="Filtros de vuelos"><div><b>Escalas</b><button type="button" data-flight-stop="all" aria-pressed="true">Todos</button><button type="button" data-flight-stop="0">Directos</button><button type="button" data-flight-stop="1">1 escala</button><button type="button" data-flight-stop="2">2+ escalas</button></div><div><b>Horario de salida</b><button type="button" data-flight-time="all" aria-pressed="true">Todo el día</button><button type="button" data-flight-time="morning">Mañana</button><button type="button" data-flight-time="afternoon">Tarde</button><button type="button" data-flight-time="night">Noche</button></div></div>' +
      '<div class="flight-results" aria-live="polite"><div class="flight-search-prompt"><p>Buscá tarifas actuales y compará agencias para tu ruta.</p><button type="button" class="btn btn-primary" data-start-flight-search>Buscar vuelos disponibles</button></div></div></section>';
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
    function legRow(leg, label) {
      if (!leg) return '';
      return '<div class="flight-summary-leg"><span class="flight-badge">' + esc(label) + '</span>' +
        '<div class="flight-summary-route"><b>' + esc(airportCode(leg.origin)) + '</b><span aria-hidden="true">→</span><b>' + esc(airportCode(leg.destination)) + '</b></div>' +
        '<div class="flight-summary-times"><span>Sale ' + esc(flightTime(leg.departure)) + '</span><span>Llega ' + esc(flightTime(leg.arrival)) + '</span></div></div>';
    }
    var price = offer.price_usd === null ? esc(offer.original_price + ' ' + (offer.original_currency || '')) : money(offer.price_usd);
    var logo = offer.logo ? '<img src="' + esc(offer.logo) + '" alt="" class="flight-logo">' : '<span class="flight-logo-fallback" aria-hidden="true">✈️</span>';
    return '<div class="flight-summary-card">' +
      '<div class="flight-airline">' + logo + '<b>' + esc(offer.airline) + '</b><span class="flight-badge cabin-badge">' + esc(offer.cabin_label || cabinClassLabel(offer.cabin_class)) + '</span></div>' +
      legRow(offer.outbound, 'Ida') + legRow(offer.inbound, 'Vuelta') +
      '<div class="flight-summary-footer"><small>Precio final · Ida y vuelta</small><b>' + price + '</b></div>' +
      '<button type="button" class="btn btn-secondary flight-summary-change" data-change-flight>Elegir otro vuelo</button></div>';
  }
  function getFlightSelectionState() {
    if (!detailState) return null;
    if (!detailState.flightSelection) {
      detailState.flightSelection = { stage: 'outbound', outboundId: null, inboundId: null };
    }
    return detailState.flightSelection;
  }
  function renderFlightOffers(el, data, budget) {
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
    var stepLabel = flightStep === 'inbound' ? 'Vuelta' : 'Ida';
    var titleEl = section.querySelector('h2');
    var subtitleEl = section.querySelector('p');
    if (titleEl) titleEl.textContent = flightStep === 'inbound' ? 'Vuelos de vuelta' : (flightStep === 'done' ? 'Itinerario seleccionado' : 'Vuelos de ida');
    if (subtitleEl) subtitleEl.textContent = flightStep === 'inbound'
      ? 'Revisá el vuelo de vuelta incluido en la tarifa seleccionada.'
      : (flightStep === 'done' ? 'Este es el itinerario que se sumó a tu presupuesto.' : 'Te mostramos la opción más conveniente y, si aporta algo distinto, una alternativa.');
    var visible = filteredFlightOffers(section, offers);
    if (flightStep === 'done' && state && state.outboundId) {
      var doneOffer = visible.find(function (offer) { return String(offer.id) === String(state.outboundId); }) || offers.find(function (offer) { return String(offer.id) === String(state.outboundId); });
      if (doneOffer) {
        el.innerHTML = flightSummaryCard(doneOffer);
        if (doneOffer.price_usd !== null) actualizarPasajes(section, Number(doneOffer.price_usd), doneOffer.airline);
        return;
      }
    }
    if (flightStep === 'inbound' && state && state.outboundId) {
      visible = visible.filter(function (offer) { return String(offer.id) === String(state.outboundId); });
    } else if (flightStep === 'outbound') {
      visible = pickTopFlightOffers(visible);
      // Mientras el usuario no confirmó un itinerario, el presupuesto ya refleja
      // la tarifa real más barata que Duffel encontró, no una estimación estática.
      if (state && !state.outboundId && visible.length && visible[0].price_usd !== null) {
        actualizarPasajes(section, Number(visible[0].price_usd), visible[0].airline);
      }
    }
    if (!visible.length) { el.innerHTML = '<p class="flight-empty">No hay vuelos que coincidan con estos filtros.</p>'; return; }
    el.innerHTML = '<div class="flight-cards">' + visible.map(function (offer) {
      var logo = offer.logo ? '<img src="' + esc(offer.logo) + '" alt="" class="flight-logo">' : '<span class="flight-logo-fallback" aria-hidden="true">✈️</span>';
      var price = offer.price_usd === null ? esc(offer.original_price + ' ' + (offer.original_currency || '')) : money(offer.price_usd);
      var isRoundTrip = offer.trip_type === 'round_trip';
      var displayedLeg = isRoundTrip && (flightStep === 'inbound' || flightStep === 'done')
        ? offer.inbound
        : (isRoundTrip ? offer.outbound : offer);
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
        ? (flightStep === 'inbound' ? 'Confirmar ida y vuelta' : (flightStep === 'done' ? 'Itinerario seleccionado' : 'Seleccionar ida'))
        : (flightStep === 'done' ? 'Vuelo seleccionado' : 'Agregar a presupuesto');
      var stageBadge = offer.trip_type === 'round_trip' ? '<span class="flight-badge">' + esc(flightStep === 'done' ? 'Ida y vuelta' : stepLabel) + '</span>' : '<span class="flight-badge">' + esc(offer.recommendation || 'Opción estratégica') + '</span>';
      var cabinBadge = '<span class="flight-badge cabin-badge">' + esc(offer.cabin_label || cabinClassLabel(offer.cabin_class)) + '</span>';
      var agencyLabel = offer.agency ? '<small class="flight-agency">Venta por ' + esc(offer.agency) + '</small>' : '';
      var isSelected = !!(detailState && detailState.selectedFlightId && String(detailState.selectedFlightId) === String(offer.id));
      var priceKnown = offer.price_usd !== null && Number.isFinite(Number(offer.price_usd));
      var affiliateHref = offer.provider === 'travelpayouts' ? '/api/vuelos/comprar?search_id=' + encodeURIComponent(offer.search_id || '') + '&term=' + encodeURIComponent(offer.affiliate_term || '') : '';
      var affiliateLink = affiliateHref ? '<a class="btn btn-secondary flight-buy-link" href="' + esc(affiliateHref) + '" target="_blank" rel="noopener noreferrer">Ver precio y reservar</a>' : '';
      return '<article class="flight-card within-budget' + (isSelected ? ' is-selected' : '') + '"><div class="flight-airline">' + logo + '<b>' + esc(offer.airline) + '</b>' + agencyLabel + cabinBadge + stageBadge + '</div>' +
        '<div class="flight-route"><div><small>' + routeLabel + '</small><small>Salida · ' + esc(airportLabel(originAirport)) + '</small><b>' + esc(departText) + '</b></div><span aria-hidden="true">→</span><div><small>Llegada · ' + esc(airportLabel(destinationAirport)) + '</small><b>' + esc(arrivalText) + '</b></div></div>' +
        '<div class="flight-footer"><span class="flight-badge' + (offer.stops === 0 ? ' direct' : '') + '">' + (offer.stops === 0 ? 'Directo' : offer.stops + (offer.stops === 1 ? ' escala' : ' escalas')) + '</span><span class="flight-duration">' + esc(offer.duration || '') + '</span>' +
        '<div class="flight-price"><small>' + (offer.trip_type === 'round_trip' ? 'Precio final · Ida y vuelta' : 'Precio final · Solo ida') + '</small><b>' + price + '</b></div></div>' +
        '<div class="flight-card__actions"><button type="button" class="select-flight btn btn-primary"' + (priceKnown ? '' : ' disabled title="Esta tarifa no está disponible en USD para sumarla al presupuesto."') + ' aria-pressed="' + (isSelected ? 'true' : 'false') + '" data-select-flight="' + esc(offer.id) + '" data-passenger-ids="' + esc(JSON.stringify(offer.passenger_ids || [])) + '" data-offer-price="' + esc(priceKnown ? offer.price_usd : '') + '" data-offer-currency="' + esc(offer.original_currency || 'USD') + '" data-offer-airline="' + esc(offer.airline) + '">' + (isSelected ? 'Vuelo seleccionado' : (priceKnown ? primaryButtonText : 'No convertible a US$')) + '</button>' + affiliateLink + '</div></article>';
    }).join('') + '</div>';
  }
  function searchFlights(meta, section) {
    var box = section.querySelector('.flight-results');
    var budget = 0;
    if (!box || section.getAttribute('data-flight-requested') === '1') return;
    section.setAttribute('data-flight-requested', '1');
    box.innerHTML = '<div class="flight-skeleton" aria-label="Buscando vuelos" role="status"><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div><div class="skeleton-box tall"></div><span class="sr-only">Buscando tarifas actuales…</span></div>';
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
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
        renderFlightOffers(box, data, budget);
      })
      .catch(function (e) { window.clearTimeout(timeout); section.removeAttribute('data-flight-requested'); box.innerHTML = '<div class="flight-empty"><p>' + esc(e && e.name === 'AbortError' ? 'La búsqueda está tardando más de lo esperado. Podés volver a intentarlo.' : e && e.message || 'No pudimos buscar vuelos ahora.') + '</p><button type="button" class="btn btn-secondary" data-retry-flight-search>Intentar de nuevo</button></div>'; });
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
  function closeBookingForm() {
    var modal = $('#booking-modal'); modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); modal.innerHTML = '';
  }
  function renderDestinationResults(data) {
    var el = $('#destination-results');
    var fits = DESTINATION_GROUPS.map(function (group) {
      var options = data.options.filter(function (option) { return group.keys.indexOf(option.dest.key) >= 0 && option.fits; });
      if (!options.length) return null;
      var best = options.slice().sort(function (a, b) { return a.total - b.total; })[0];
      return Object.assign({}, best, { dest: Object.assign({}, best.dest, { name: group.label }), featuredGroup: group.id });
    }).filter(Boolean).sort(function (a, b) { return a.total - b.total; });
    var cards = fits.map(function (option) {
      var rows = CATS.map(function (c) {
        return '<div><span>' + c[1] + '</span><b>' + money(option.parts[c[0]]) + '</b></div>';
      }).join('');
      var photo = DEST_PHOTOS[option.dest.key];
      var location = [option.dest.region, option.dest.country || 'Brasil'].filter(Boolean).join(' - ');
      return '<article class="destination-card' + (option.fits ? ' fits' : '') + '">' +
        (photo
          ? '<div class="destination-banner destination-banner-photo"><img src="' + esc(photo) + '" alt="' + esc(option.dest.name) + '" loading="lazy"></div>'
          : '<div class="destination-banner destination-banner-' + esc(option.dest.key) + '" aria-hidden="true"><span>' + (option.dest.key === 'rio' ? '🌴' : option.dest.key === 'sao' ? '🏙️' : option.dest.key === 'igu' ? '🌊' : '☀️') + '</span></div>') +
        '<div class="destination-card-body">' +
        '<div class="destination-card-top"><div><h3>' + esc(option.dest.name) + '</h3>' + (location ? '<p class="destination-location">' + esc(location) + '</p>' : '') + '<p>' + esc(option.title.replace(/Vuelo desde Montevideo/g, 'Vuelo desde ' + originCityName(data.meta.origin))) + '. ' + esc(option.tierDesc) + '.</p></div>' +
        '<div class="destination-total"><small>Gran total</small><b>' + money(option.total) + '</b><span>' + money(option.pp) + ' por persona</span></div></div>' +
        '<span class="mini g">¡Entra en tu presupuesto!</span>' +
        '<details><summary>Ver desglose</summary><div class="destination-breakdown">' + rows + '</div></details>' +
        '<button type="button" class="btn-ver-propuesta-destino" data-propuesta-dest="' + esc(option.dest.key) + '">Ver propuesta ➔</button>' +
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
    renderTransportSelector();
    if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    var mine = ctrl;
    el.classList.add('loading');
    el.innerHTML = renderLoadingState('Buscando ofertas para tu viaje…');
    var transportParam = S.transport === 'roadtrip' ? 'auto' : S.transport;
    var qs = new URLSearchParams({ dest: S.dest, dep: S.dep, ret: S.ret, pax: S.pax, budget: S.budget, style: S.style, transport: transportParam, origin: S.origin, subcategory: S.subcategory, hotel_type: S.hotelType });
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
  function titleOf(p) {
    var origin = originCityName(detailState && detailState.meta && detailState.meta.origin || S.origin);
    var originAirport = originLabel(detailState && detailState.meta && detailState.meta.origin || S.origin);
    var mode = p.mode === 'auto' ? 'Viaje en auto desde ' + originAirport : p.mode === 'bus' ? 'Bus semicama/cama desde ' + originAirport : 'Vuelo desde ' + originAirport;
    var type = detailState && detailState.meta && detailState.meta.hotelType || S.hotelType || 'intermedio';
    var hotel = HOTEL_TYPE_LABELS[type] || (p.tierLabel ? p.tierLabel.charAt(0).toUpperCase() + p.tierLabel.slice(1) : 'Intermedio');
    return mode + ' + Hotel ' + hotel;
  }
  function srcTag(p, cat, live) {
    if (!live) return '';
    return p.sources[cat] === 'real' ? '<span class="src real">real</span>' : '<span class="src">estimado</span>';
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
      comidas: 'Basado en precios reales de mercado y gastronomía local.',
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
    var busDestinations = ['bue', 'fln', 'bcm', 'camboriu', 'bombinhas', 'rosa', 'gram', 'canela', 'igu', 'poa'];
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
  function render(data) {
    lastData = data;
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
    var dep = parse(data.meta.dep), ret = parse(data.meta.ret), pax = data.meta.pax, budget = data.meta.budget;
    var cheapest = byId(list, data.cheapestId), cozy = byId(list, data.cozyId);

    var chip = $('#chip');
    if (chip) chip.textContent = '';
    $('#foot').innerHTML = live
      ? '<p><b>Vuelos:</b> tarifa aérea real al momento de la búsqueda, por persona. Puede cambiar hasta que reserves. <b>Alojamiento, comidas, traslados y buses:</b> valores de referencia.</p>'
      : '<p><b>Estimaciones iniciales.</b> Consultá la sección de vuelos en el detalle para buscar tarifas en tiempo real. Alojamiento, comidas, traslados y buses son valores de referencia.</p>';

    var pct = Math.min(100, Math.round(rec.total / Math.max(budget, 1) * 100));
    var status = data.fits
      ? 'Entra en tu presupuesto. Te sobran ' + money(budget - rec.total) + '.'
      : 'Ninguna opción entra en ' + money(budget) + '. La más barata te deja ' + money(rec.total - budget) + ' por encima.';
    var sourceBadge = live ? 'Precios reales' : 'Precios estimados';
    var sourcePill = '<span class="tag ghost source-pill">' + esc(sourceBadge) + '</span>';

    var h = '';
    h += '<section class="sec"><div class="hero">' +
      '<div class="tags"><span class="tag">' + (data.fits ? 'La más conveniente para vos' : 'La más barata que encontramos') + '</span>' +
      '<span class="tag ghost">' + esc(data.meta.dest.name) + '</span>' +
      '<span class="tag ghost">' + data.meta.nights + ' noches</span>' + sourcePill + '</div>' +
      '<h3>' + esc(titleOf(rec)) + '</h3>' +
      '<p class="meta">' + dLong(dep) + ' a ' + dLong(ret) + ', ' + pax + (pax === 1 ? ' viajero' : ' viajeros') + '. Trayecto ' + esc(rec.dur) + '.</p>' +
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

    h += '<section class="sec"><h2>Dónde podés ahorrar</h2><p class="sub">Comparamos fechas, rutas y alojamiento con la propuesta principal.</p><div class="panel">';
    if (data.tips.length) {
      h += data.tips.map(function (t) {
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
      h += '<p style="margin:0">Con estas fechas y esta ruta ya estás en una muy buena combinación. Probá con otro destino o cambiá el presupuesto.</p>';
    }
    h += '</div></section>';

    var mn = Infinity, mx = -Infinity, bestS = null;
    data.series.forEach(function (x) { if (x.total < mn) { mn = x.total; bestS = x; } if (x.total > mx) mx = x.total; });
    var bars = data.series.map(function (x) {
      var ht = 34 + 96 * ((x.total - mn) / ((mx - mn) || 1));
      var d = parse(x.dep);
      var cls = 'bar' + (x.shift === 0 ? ' cur' : '') + (x === bestS ? ' best' : '');
      return '<button type="button" class="' + cls + '" data-shift="' + x.shift + '" aria-label="Salir el ' + dLong(d) + ': ' + money(x.total) + '">' +
        '<span class="v">' + money(x.total).replace('US$ ', '') + '</span><span class="b" style="height:' + ht + 'px"></span>' +
        '<span class="d"><b>' + d.getDate() + '</b>' + d.toLocaleDateString('es-UY', { month: 'short' }) + '</span></button>';
    }).join('');
    h += '<section class="sec"><h2>Mismo viaje, otra fecha</h2><p class="sub">Costo total en US$ si salís antes o después, con las mismas noches. Es una estimación a partir del precio de tu fecha. Tocá una barra para usarla.</p>' +
      '<div class="panel"><div class="chart">' + bars + '</div>' +
      '<div class="legend"><span class="l1">Tu fecha</span><span class="l2">La más barata</span><span>Otras fechas</span></div></div></section>';

    var proposalMarkup = function (p) {
      var tags = '';
      if (p.id === rec.id) tags += '<span class="mini y">Recomendada</span>';
      if (cheapest && p.id === cheapest.id) tags += '<span class="mini">Más barata</span>';
      if (cozy && p.id === cozy.id) tags += '<span class="mini">Más cómoda</span>';
      if (live && p.sources.pasajes === 'real') tags += '<span class="mini g">Pasaje real</span>';
      tags += p.total <= budget ? '<span class="mini g">Entra en tu presupuesto</span>' : '<span class="mini r">Se pasa por ' + money(p.total - budget) + '</span>';
      var rows = CATS.filter(function (c) { return Number(p.parts[c[0]]) > 0; }).map(function (c) { return '<div><span>' + c[1] + '</span><b>' + money(p.parts[c[0]]) + '</b></div>'; }).join('');
      return '<details class="opt' + (p.id === rec.id ? ' propuesta-seleccionada' : '') + '"><summary><div><div class="t">' + esc(titleOf(p)) + '</div><div class="s">' + esc(p.tierDesc) + '. Trayecto ' + esc(p.dur) + '.</div><div class="tg">' + tags + '</div></div>' +
        '<div class="r"><b>' + money(p.total) + '</b><span>' + money(p.pp) + ' por persona</span></div></summary><div class="body">' + rows + '<div class="proposal-actions"><button type="button" class="btn-ver-propuesta" data-propuesta-id="' + esc(p.id) + '">Ver propuesta ➔</button></div></div></details>';
    };
    // Solo se comparan propuestas de la misma gama de alojamiento que la recomendada
    // (la que ya refleja el estilo de viaje elegido arriba), para no mezclar tiers.
    var allProposals = list.concat(Array.isArray(data.alternatives) ? data.alternatives : []).filter(function (proposal, index, proposals) {
      return proposal.mode !== 'avion_ba' && proposals.findIndex(function (candidate) { return candidate.id === proposal.id; }) === index;
    });
    var sameTier = allProposals.filter(function (p) { return p.ti === rec.ti; }).sort(function (a, b) { return a.total - b.total; });
    var opts = sameTier.map(proposalMarkup).join('');
    h += '<section class="sec"><h2>Todas las propuestas</h2><p class="sub">Mismo nivel de alojamiento que elegiste, ordenadas de la más barata a la más cara. Tocá una para ver el desglose.</p><div class="opts">' + opts + '</div></section>';

    var el = $('#results');
    el.innerHTML = h;
    var ch = el.querySelector('.chart'), cu = el.querySelector('.bar.cur');
    if (ch && cu) ch.scrollLeft = cu.offsetLeft - ch.clientWidth / 2 + cu.offsetWidth / 2;
    if (pendingDestinationScroll) window.setTimeout(scrollToDestinationResults, 50);
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
    var logistics = 'Vuelo ida y vuelta por ' + trip.hub.name + ' (' + trip.hub.iata + '): aeropuerto → Búzios → Arraial do Cabo → aeropuerto. Incluye transfers de aeropuerto y ' + trip.transferBetweenLabel.toLowerCase() + ' (' + money(trip.transferBetweenUsd) + ' en total).';
    return '<section class="multistay-panel" aria-labelledby="multistay-title" data-multistay-panel>' +
      '<div class="multistay-panel__head"><div><span class="multistay-panel__eyebrow">ITINERARIO MULTIDESTINO</span><h2 id="multistay-title">Distribuí tus noches</h2></div><span class="multistay-panel__total">' + nights + (nights === 1 ? ' noche' : ' noches') + ' en total</span></div>' +
      (nights > 1 ? '<div class="multistay-panel__stays"><div class="multistay-panel__stay"><strong>' + esc(first.name) + '</strong><span><b data-multistay-first-nights>' + firstNights + '</b> ' + (firstNights === 1 ? 'noche' : 'noches') + '</span><small data-multistay-first-cost>' + money(0) + ' alojamiento estimado</small></div>' +
      '<label class="multistay-panel__slider"><span class="sr-only">Noches en ' + esc(first.name) + '</span><input type="range" min="1" max="' + (nights - 1) + '" step="1" value="' + firstNights + '" data-multistay-split aria-valuetext="' + firstNights + ' noches en ' + esc(first.name) + ', ' + secondNights + ' en ' + esc(second.name) + '"></label>' +
      '<div class="multistay-panel__stay"><strong>' + esc(second.name) + '</strong><span><b data-multistay-second-nights>' + secondNights + '</b> ' + (secondNights === 1 ? 'noche' : 'noches') + '</span><small data-multistay-second-cost>' + money(0) + ' alojamiento estimado</small></div></div>' : '<p class="multistay-panel__hint">Para dividir la estadía entre localidades necesitás al menos 2 noches.</p>') +
      '<p class="multistay-panel__logistics">✈️ ' + esc(logistics) + '</p><p class="multistay-panel__hint">Alojamiento y traslado interlocalidad son estimaciones; el precio se ajusta al cambiar el reparto.</p></section>';
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
    if (Number.isFinite(Number(trip.selectedPrimaryHotelTotal)) && Number(trip.selectedPrimaryHotelTotal) > 0) {
      firstStayCost = Math.round(Number(trip.selectedPrimaryHotelTotal) * firstNights / totalNights);
    } else {
      firstStayCost = Math.round((trip.stays[0].nightlyRates || []).slice(0, firstNights).reduce(function (sum, rate) { return sum + Number(rate || 0); }, 0) * rooms * typeFactor);
    }
    var secondStayCost = Math.round((trip.stays[1].nightlyRates || []).slice(firstNights, totalNights).reduce(function (sum, rate) { return sum + Number(rate || 0); }, 0) * rooms * typeFactor);
    trip.firstNights = firstNights;
    trip.firstStayCost = firstStayCost;
    trip.secondStayCost = secondStayCost;
    detailState.hotel = firstStayCost + secondStayCost;
    var firstCount = document.querySelector('[data-multistay-first-nights]');
    var secondCount = document.querySelector('[data-multistay-second-nights]');
    var firstCost = document.querySelector('[data-multistay-first-cost]');
    var secondCost = document.querySelector('[data-multistay-second-cost]');
    var slider = document.querySelector('[data-multistay-split]');
    if (firstCount) firstCount.textContent = String(firstNights);
    if (secondCount) secondCount.textContent = String(secondNights);
    if (firstCost) firstCost.textContent = money(firstStayCost) + ' alojamiento estimado';
    if (secondCost) secondCost.textContent = money(secondStayCost) + ' alojamiento estimado';
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
    if (detailState.multiStay) {
      detailState.multiStay.selectedPrimaryHotelTotal = null;
      updateMultiStayPricing();
    } else {
      detailState.hotel = Math.round(detailState.originalHotelEstimate * hotelTypeFactor(type));
    }
    detailState.parts.comidas = type === 'all-inclusive' ? 0 : detailState.originalMealEstimate;
    detailState.foodPerDayTouched = type === 'all-inclusive';
    detailState.foodPerDay = type === 'all-inclusive' ? 0 : (detailState.originalMealEstimate / Math.max(1, Number(detailState.meta.nights) * Number(detailState.meta.pax)));
    S.hotelType = type;
    if (detailState.proposal) {
      var title = document.querySelector('.detail-summary h2');
      if (title) title.textContent = titleOf(detailState.proposal);
    }
    var hotelSection = document.querySelector('.hotel-options');
    if (hotelSection) hotelSection.outerHTML = hotelLoading(detailState.meta);
    recalcularTotalViaje();
    loadHotelRecommendations(detailState.meta, detailState.hotel);
  }
  function showProposalView(proposal, data) {
    var view = $('#vista-detalle'), content = $('#detalle-contenido');
    var isRoadtrip = proposal.mode === 'auto';
    var selectedTransportMode = proposal.mode === 'auto' ? 'auto' : proposal.mode === 'bus' ? 'bus' : 'flight';
    proposal = normalizeLocalTransportInProposal(data, proposal);
    var selectedHotelTotal = hotelTotalForRate(data.meta, proposal.parts.alojamiento, 1);
    detailState = { parts: Object.assign({}, proposal.parts), flight: proposal.parts.pasajes, baseFlight: proposal.parts.pasajes, baseTraslados: proposal.parts.traslados, hotel: selectedHotelTotal, toursTotal: 0, selectedTours: [], auto: isRoadtrip ? Number(proposal.parts.auto) : 0, transfer: 0, transportMode: selectedTransportMode, hotelType: data.meta.hotelType || S.hotelType, originalHotelEstimate: Number(proposal.baseHotelCost) || Number(proposal.parts.alojamiento) || 0, originalMealEstimate: Number(proposal.baseMealCost) || Number(proposal.parts.comidas) || 0, proposal: proposal, roadtrip: proposal.roadtrip || data.meta.roadtrip, meta: data.meta, selectedFlightId: '', selectedFlight: '', selectedOffer: null, selectedHotel: true, selectedHotelName: 'Hotel recomendado', localBudgetMode: 'preset', foodBudgetMode: 'preset', localCustomValue: null, foodCustomValue: null };
    var nights = Math.max(1, Number(data.meta.nights) || 1);
    var pax = Math.max(1, Number(data.meta.pax) || 1);
    if (data.meta.multiStay && data.meta.multiStay.stays && data.meta.multiStay.stays.length === 2) {
      detailState.multiStay = Object.assign({}, data.meta.multiStay, { totalNights: nights, firstNights: Math.max(1, Math.floor(nights / 2)) });
      detailState.baseTraslados = Number(proposal.parts.traslados) || 0;
      detailState.parts.traslados = detailState.baseTraslados + (Number(detailState.multiStay.transferBetweenUsd) || 0);
      updateMultiStayPricing();
    }
    detailState.foodPerDay = Number((Number(detailState.parts.comidas) / Math.max(1, nights * pax)).toFixed(2)) || 0;
    detailState.localPerDay = Number((Number(detailState.parts.local) / Math.max(1, nights * pax)).toFixed(2)) || 0;
    data.meta.officialTransfer = data.meta.officialTransfer || { pricePerPassenger: 0, amount: 0 };
    var renderSafe = function (fn, fallback) { try { return fn(); } catch (error) { console.error('Error al renderizar detalle', error); return fallback; } };
    var breakdownMarkup = renderSafe(function () { return proposalBreakdownMarkup(detailState); }, '<section class="proposal-breakdown"><h2>Desglose del viaje</h2></section>');
    var dailyBudgetMarkup = renderSafe(function () { return dailyBudgetControls(); }, '');
    var transportMarkup = renderSafe(function () { return transportFlow(detailState.meta, detailState.flight, selectedTransportMode); }, '');
    var hotelsMarkup = renderSafe(function () { return data.meta.hotelsLoaded ? hotelOptions(data.meta, proposal.parts.alojamiento) : hotelLoading(data.meta); }, '<section class="hotel-options">Cargando alojamientos…</section>');
    var toursMarkup = renderSafe(function () { return localToursMarkup(data.meta); }, '');
    var foodMarkup = renderSafe(function () { return foodGuide(data.meta); }, '<section class="detail-section"><h2>Recomendaciones</h2></section>');
    content.innerHTML = '<div class="detail-layout"><div class="detail-main">' +
      '<section class="detail-summary"><span class="tag">Propuesta seleccionada</span><h2>' + esc(titleOf(proposal)) + '</h2><p>' + esc(data.meta.dest.name) + (data.meta.subcategory ? ' · ' + esc(data.meta.subcategory) : '') + ' · Salís desde ' + esc(originLabel(data.meta.origin)) + ' · ' + data.meta.nights + (data.meta.nights === 1 ? ' noche' : ' noches') + '</p><strong data-detail-total>' + money(proposal.total) + '</strong><span class="detail-summary__per-person" data-detail-total-pp>' + money(Math.round(proposal.total / pax)) + ' por persona</span></section>' +
      renderSafe(function () { return multiStayMarkup(detailState); }, '') + breakdownMarkup + dailyBudgetMarkup +
      '<div data-transport-flow>' + transportMarkup + '</div>' +
      hotelsMarkup + toursMarkup + foodMarkup +
      '</div></div>';
    updateMultiStayPricing();
    $('#btn-volver').textContent = massSearch ? '⬅ Volver a todos los destinos' : '⬅ Volver a las propuestas';
    if (detailState.transportMode === 'auto' || detailState.transportMode === 'flight') actualizarTransporte(isRoadtrip);
    else { var groundFlow = document.querySelector('[data-transport-flow]'); if (groundFlow) groundFlow.innerHTML = transportFlow(detailState.meta, detailState.flight, detailState.transportMode); }
    renderTripSummary();
    $('#vista-principal').classList.add('oculto');
    view.classList.remove('oculto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!data.meta.hotelsLoaded) {
      var loadHotels = function () { loadHotelRecommendations(data.meta, proposal.parts.alojamiento); };
      if ('requestIdleCallback' in window) window.requestIdleCallback(loadHotels, { timeout: 1200 });
      else window.setTimeout(loadHotels, 120);
    }
    var liveFlightSection = content.querySelector('.flight-search');
    if (detailState.transportMode === 'flight' && liveFlightSection) {
      window.setTimeout(function () {
        if (detailState && detailState.meta === data.meta) searchFlights(data.meta, liveFlightSection);
      }, 80);
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
  function getSelectedFlightSummary() {
    if (!detailState) return { airline: 'Vuelo seleccionado', summary: 'No hay un vuelo seleccionado.' };
    var offer = getSelectedFlightOffer() || detailState.selectedOffer || {};
    var airline = offer.airline || detailState.selectedFlight || 'Vuelo seleccionado';
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
    return { airline: airline, outboundAirline: outbound.airline || airline, inboundAirline: inboundAirline, summary: isRoundTrip ? 'Ida: ' + outboundText + ' | Vuelta: ' + inboundText + ' · tarifa ida y vuelta incluida' : outboundText, departureText: formatFlightDateTime(departure), arrivalText: formatFlightDateTime(arrival), returnDepartureText: formatFlightDateTime(returnDeparture), returnArrivalText: formatFlightDateTime(returnArrival), route: ' · ' + airportCode(origin) + ' -> ' + airportCode(destination), flightNumber: flightNumber, inboundFlightNumber: inboundFlightNumber, origin: origin, destination: destination, returnOrigin: returnOrigin, returnDestination: returnDestination, isRoundTrip: isRoundTrip, outboundText: outboundText, inboundText: inboundText };
  }

  function openDestinationProposal(key, savedTrip) {
    var qs = new URLSearchParams({ dest: key, dep: S.dep, ret: S.ret, pax: S.pax, budget: S.budget, style: S.style, origin: S.origin, subcategory: S.subcategory, hotel_type: S.hotelType });
    return fetch('/api/cotizar?' + qs.toString()).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
      if (!res.ok) throw new Error(res.j.error || 'No pudimos cargar la propuesta.');
      showProposalView(byId(res.j.list, res.j.recId), res.j);
      if (savedTrip) { applySavedTripToDetail(savedTrip); window.setTimeout(openItinerarySummaryModal, 0); }
      return true;
    }).catch(function (e) { notice(e.message); return null; });
  }

  // Captura los botones dinámicos antes de que <details> u otro listener los procese.
  function handleProposalNavigation(e) {
    var button = e.target.closest && e.target.closest('.btn-ver-propuesta,[data-propuesta-id],[data-propuesta-dest]');
    if (!button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var destination = button.getAttribute('data-propuesta-dest');
    if (destination) {
      S.dest = destination;
      $('#dest').value = destination;
      openDestinationProposal(destination);
      return;
    }
    var proposalId = button.getAttribute('data-propuesta-id');
      var proposal = lastData && (byId(lastData.list, proposalId) || byId(lastData.alternatives, proposalId) || byId(lastData.roadtripList, proposalId));
    if (proposal) {
      try { showProposalView(proposal, lastData); } catch (error) { console.error('No pudimos abrir la propuesta', error); notice('No pudimos abrir esta propuesta. Probá nuevamente.'); }
    } else {
      notice('La propuesta ya no está disponible. Volvé a buscar para actualizarla.');
    }
  }

  /* ---------- cuentas y viajes guardados ---------- */
  var supabaseClient = null;
  var authUser = null;
  var pendingTripSave = false;
  var tripSaveInProgress = false;
  var travelpayoutsMarker = '';
  var lastSavedTripId = null;
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

  // sub_id único por clic para atribuir cada reserva de hotel a un viaje y un
  // usuario puntuales en los reportes de Travelpayouts (viaje_id + user_id +
  // timestamp en base36, compactado porque el parámetro tiene largo limitado).
  function generateHotelSubId(tripId, userId) {
    var t = String(tripId || 'na').replace(/-/g, '').slice(0, 10);
    var u = String(userId || 'anon').replace(/-/g, '').slice(0, 10);
    return 't' + t + '-u' + u + '-' + Date.now().toString(36);
  }
  // Registra el clic en estado "pendiente" antes de salir del sitio, para
  // poder conciliar después contra el reporte de conversiones de Travelpayouts.
  async function registerHotelClick(subId, meta, hotelName, hotelTotal, tripId) {
    if (!supabaseClient || !authUser) return;
    try {
      await supabaseClient.from('reservas_hoteles').insert({
        user_id: authUser.id,
        trip_id: tripId || null,
        destination_key: meta.dest.key,
        hotel_name: hotelName || null,
        sub_id: subId,
        click_total: Number(hotelTotal) || null,
        currency: 'USD',
        status: 'pending',
        provider: 'travelpayouts'
      });
    } catch (error) { /* no bloquear la salida del usuario por un error de tracking */ }
  }
  // Hotellook/Travelpayouts no nos da el ID interno del hotel (nuestros
  // datos de hoteles vienen de Booking.com, no de Hotellook), así que no
  // podemos armar un link directo a la ficha de esa propiedad puntual. Lo
  // más cerca que llegamos sin esa integración es que el término de
  // búsqueda incluya el nombre del hotel, para que sus resultados lo
  // prioricen en vez de mostrar el destino genérico.
  function travelpayoutsHotelUrl(meta, subId, hotelName) {
    var destination = hotelName ? hotelName + ', ' + meta.dest.name + ', Brasil' : meta.dest.name + ', Brasil';
    var params = new URLSearchParams({
      marker: travelpayoutsMarker || '',
      sub_id: subId,
      destination: destination,
      checkIn: meta.dep,
      checkOut: meta.ret,
      adults: String(meta.pax || 1)
    });
    return 'https://search.hotellook.com/?' + params.toString();
  }

  function authDisplayName(user) {
    var metadata = user && user.user_metadata || {};
    return metadata.full_name || metadata.name || (user && user.email) || 'Mi cuenta';
  }
  function closeAccountModal(id) {
    var modal = document.getElementById(id);
    if (modal) { modal.hidden = true; modal.setAttribute('aria-hidden', 'true'); modal.innerHTML = ''; }
  }
  function openAuthModal(message) {
    var modal = $('#auth-modal');
    if (!modal) return;
    if (authUser) { openTripsModal(); return; }
    modal.innerHTML = '<div class="booking-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button type="button" class="booking-close" data-close-auth aria-label="Cerrar">×</button><span class="account-kicker">CuántoSale</span><h2 id="auth-title">Guardá tus viajes</h2><p class="booking-note">Creá una cuenta para conservar presupuestos e itinerarios en la nube.</p>' + (message ? '<p class="booking-error">' + esc(message) + '</p>' : '') + '<button type="button" class="oauth-button" data-google-auth>Continuar con Google</button><div class="account-divider"><span>o con tu email</span></div><form id="auth-form"><label>Correo electrónico<input required type="email" name="email" autocomplete="email"></label><label>Contraseña<input required minlength="6" type="password" name="password" autocomplete="current-password"></label><div class="account-form-actions"><button type="submit" class="confirm-booking" data-auth-action="signin">Iniciar sesión</button><button type="button" class="account-button account-button--secondary" data-auth-action="signup">Crear cuenta</button></div><p class="account-status" data-auth-status aria-live="polite"></p></form></div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    var first = modal.querySelector('input'); if (first) first.focus();
  }
  async function openTripsModal() {
    var modal = $('#trips-modal');
    if (!modal) return;
    await authReadyPromise;
    if (!authUser) { pendingTripSave = false; openAuthModal('Iniciá sesión para ver tus viajes.'); return; }
    modal.innerHTML = '<div class="booking-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="trips-title"><button type="button" class="booking-close" data-close-trips aria-label="Cerrar">×</button><span class="account-kicker">Tu cuenta</span><h2 id="trips-title">Mis viajes</h2><p class="booking-note">Itinerarios guardados por ' + esc(authDisplayName(authUser)) + '.</p><div class="saved-trips" data-saved-trips><p class="account-status">Cargando tus viajes...</p></div><button type="button" class="account-button account-button--secondary" data-signout>Cerrar sesión</button></div>';
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    loadSavedTrips(modal);
  }
  function renderAuthState(user) {
    authUser = user || null;
    var button = $('#auth-button'), trips = $('#trips-button');
    if (button) { var avatar = authUser && authUser.user_metadata && (authUser.user_metadata.avatar_url || authUser.user_metadata.picture); button.innerHTML = authUser ? (avatar ? '<img class="account-avatar" src="' + esc(avatar) + '" alt="">' : '👤 ') + esc(authDisplayName(authUser)) : 'Iniciar sesión'; button.setAttribute('aria-label', authUser ? 'Abrir cuenta de ' + authDisplayName(authUser) : 'Iniciar sesión'); }
    if (trips) trips.hidden = !authUser;
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
      details: { destination_key: detailState.meta.dest && detailState.meta.dest.key || S.dest, origin: detailState.meta.origin || S.origin, subcategory: detailState.meta.subcategory || S.subcategory || '', parts: detailState.parts || {}, flight: detailState.selectedOffer || { id: detailState.selectedFlightId || '', airline: detailState.selectedFlight || '', price: detailState.flight || 0 }, hotel: { name: findSelectedHotelLabel(), total: detailState.hotel || 0 }, transfer: detailState.transfer || 0, transferType: detailState.transferType || '', tours: detailState.selectedTours || [], budget: budget, queryBudget: S.budget, style: detailState.meta.style || S.style, hotelType: detailState.meta.hotelType || S.hotelType, roadtrip: detailState.roadtrip || null }
    };
  }
  async function saveCurrentTrip() {
    if (!supabaseClient) { authReadyPromise = initAuth(); await authReadyPromise; }
    if (!supabaseClient) { openAuthModal('Falta configurar SUPABASE_ANON_KEY en las variables de entorno del despliegue.'); return; }
    if (!authUser) { pendingTripSave = true; try { var draft = tripPayload(); if (draft) sessionStorage.setItem('cuantosale_pending_trip_data', JSON.stringify(draft)); sessionStorage.setItem('cuantosale_pending_trip', '1'); } catch (error) {} openAuthModal(); return; }
    if (tripSaveInProgress) return;
    var payload = tripPayload();
    if (!payload) { try { payload = JSON.parse(sessionStorage.getItem('cuantosale_pending_trip_data') || 'null'); } catch (error) { payload = null; } }
    if (!payload) { alert('Abrí una propuesta antes de guardar el viaje.'); return; }
    payload.user_id = authUser.id;
    tripSaveInProgress = true;
    var result;
    try {
      result = await guardarViaje({ origin: originLabel(payload.details.origin || S.origin), destination: payload.destination_name, destination_key: payload.destination_key, departure_date: payload.departure_date, return_date: payload.return_date, total_price: payload.total_amount, flight_details: Object.assign({}, payload.details, { transport_mode: payload.transport_mode, food_per_day: payload.food_per_day, local_per_day: payload.local_per_day, travelers: payload.travelers, total_amount: payload.total_amount }) });
    } catch (error) {
      tripSaveInProgress = false;
      openAuthModal(error.message);
      return;
    }
    tripSaveInProgress = false;
    pendingTripSave = false;
    lastSavedTripId = result && result.id || lastSavedTripId;
    try { sessionStorage.removeItem('cuantosale_pending_trip'); sessionStorage.removeItem('cuantosale_pending_trip_data'); } catch (error) {}
    await openTripsModal();
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
    detailState.selectedTours = Array.isArray(details.tours) ? details.tours : [];
    detailState.toursTotal = detailState.selectedTours.reduce(function (sum, tour) { return sum + (Number(tour.price) || 0); }, 0);
    detailState.selectedTours.forEach(function (tour) {
      var input = Array.prototype.slice.call(document.querySelectorAll('[data-tour-choice]')).find(function (item) { return item.getAttribute('data-tour-title') === tour.title; });
      if (input) input.checked = true;
    });
    var toursButton = document.querySelector('[data-book-selected-tours]');
    if (toursButton) toursButton.disabled = !detailState.selectedTours.length;
    if (details.hotel) {
      detailState.hotel = Number(details.hotel.total) || detailState.hotel;
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
    if (typeof openDestinationProposal === 'function' && S.dest !== 'todos') { closeAccountModal('trips-modal'); var loaded = await openDestinationProposal(S.dest, trip); if (loaded === null) throw new Error('No pudimos cargar la propuesta guardada.'); }
    else alert('No pudimos identificar el destino guardado. Volvé a buscar la propuesta y guardala nuevamente.');
  }
  function initAuth() {
    if (supabaseClient) return Promise.resolve();
    if (authInitPromise) return authInitPromise;
    authInitPromise = (async function () {
      try {
        await loadSupabaseSdk();
        var configResponse = await fetch('/api/config');
        var config = await configResponse.json();
        travelpayoutsMarker = config.travelpayoutsMarker || '';
        if (!config.supabaseUrl || !config.supabaseAnonKey) { console.warn('Falta SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY en las variables de entorno del despliegue.'); return; }
        supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
        try { pendingTripSave = sessionStorage.getItem('cuantosale_pending_trip') === '1'; } catch (error) {}
        var sessionResult = await supabaseClient.auth.getSession();
        renderAuthState(sessionResult.data && sessionResult.data.session && sessionResult.data.session.user);
        if (pendingTripSave && authUser) window.setTimeout(saveCurrentTrip, 0);
        supabaseClient.auth.onAuthStateChange(function (_event, session) { renderAuthState(session && session.user); if (pendingTripSave && session && session.user) window.setTimeout(saveCurrentTrip, 0); });
      } catch (error) { authInitPromise = null; console.error('Supabase Auth no disponible', error); }
    })();
    return authInitPromise;
  }

  /* ---------- formulario ---------- */
  function init() {
    var authButton = $('#auth-button'), tripsButton = $('#trips-button');
    if (authButton) authButton.addEventListener('click', function () { authReadyPromise = initAuth(); authReadyPromise.then(function () { if (authUser) openTripsModal(); else openAuthModal(); }); });
    if (tripsButton) tripsButton.addEventListener('click', function () { authReadyPromise = initAuth(); authReadyPromise.then(openTripsModal); });
    if (window.location.search.indexOf('code=') >= 0 || window.location.hash.indexOf('access_token=') >= 0) { authReadyPromise = initAuth(); }
    $('#trip-summary').addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-trip-summary-toggle]');
      if (toggle) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          var summary = $('#trip-summary');
          summary.classList.toggle('minimized');
          toggle.setAttribute('aria-expanded', String(!summary.classList.contains('minimized')));
        }
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
      if (S.subcategory && (!item || item.subcategory !== S.subcategory)) text += ' · ' + S.subcategory;
      if (trigger) trigger.value = text;
      if (menu) {
        Array.prototype.forEach.call(menu.querySelectorAll('.custom-select__option'), function (option) {
          var selected = option.getAttribute('data-dest-value') === value && (!S.subcategory || option.getAttribute('data-subcategory') === S.subcategory);
          option.classList.toggle('is-selected', selected);
          option.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
      }
      clearActiveDestOption();
    }

    function normalizeDestQuery(value) {
      return String(value || '').trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
      sel.classList.remove('is-open');
      setDestDisplay(S.dest);
    }

    function openDestMenu() {
      if (!menu || !trigger || !sel) return;
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      sel.classList.add('is-open');
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
      if (all) { $('#results').innerHTML = ''; $('#destination-results').innerHTML = ''; }
    }
    function syncTransportSelection() {
      if (S.dest === 'todos') { S.transport = 'flight'; }
      if (S.transport === 'roadtrip') S.transport = 'auto';
      if (S.transport === 'auto' && !isRoadtripDestinationAllowed(S.dest)) S.transport = 'flight';
      if (['flight', 'bus', 'auto'].indexOf(S.transport) < 0) S.transport = 'flight';
      renderTransportSelector();
    }
    function selectDestination(nextValue, subcategory, fromFeatured, requestedHotelType) {
      var destinationKey = String(nextValue || 'todos');
      if (!destinationKey) return;
      if (!fromFeatured) featuredProposalSelection = null;
      S.dest = destinationKey; S.proposalId = ''; S.subcategory = String(subcategory || '');
      var inferredHotelType = requestedHotelType || inferHotelType(S.subcategory);
      S.hotelTypeExplicit = !!inferredHotelType;
      S.hotelType = inferredHotelType || hotelTypeForStyle(S.style);
      if (S.dest === 'todos') { S.transport = 'flight'; }
      else if (!isRoadtripDestinationAllowed(S.dest) && S.transport === 'auto') { S.transport = 'flight'; }
      setDestDisplay(S.dest);
      closeDestMenu();
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
      renderDestinationHighlights(new Date().getMonth());
      highlights.addEventListener('change', function (event) {
        var month = event.target.closest('[data-feature-month]');
        if (!month) return;
        var monthIndex = Number(month.value);
        renderDestinationHighlights(monthIndex);
        var featuredSelection = featuredProposalSelection;
        var selectedSubcategory = featuredSelection && featuredSelection.subcategory;
        var dates = featuredTravelDates(monthIndex, selectedSubcategory);
        S.dep = dates.dep; S.ret = dates.ret;
        syncDateRangeFields();
        if (featuredSelection) {
          pendingDestinationScroll = true;
          selectDestination(selectedSubcategory.key, selectedSubcategory.label, true);
        } else if (S.dest !== 'todos') {
          pendingDestinationScroll = true;
          schedule();
        } else if (massSearch) {
          findDestinations();
        }
      });
      highlights.addEventListener('click', function (event) {
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
        var card = choose.closest('[data-featured-destination]');
        var choice = card && card.querySelector('[data-feature-subcategory]');
        var availableSubcategories = group && Number($('#destination-highlights [data-feature-month]').value) === 10 && group.id === 'nordeste'
          ? group.subcategories.filter(function (item) { return item.key !== 'ssa'; }) : group && group.subcategories;
        var subcategory = availableSubcategories && choice && availableSubcategories[Number(choice.value)];
        if (subcategory) {
          var selectedMonth = Number($('#destination-highlights [data-feature-month]').value);
          featuredProposalSelection = { monthIndex: selectedMonth, subcategory: subcategory };
          var dates = featuredTravelDates(selectedMonth, subcategory);
          S.dep = dates.dep; S.ret = dates.ret;
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
    document.addEventListener('click', function (e) {
      if (originPicker && !originPicker.contains(e.target)) closeOriginMenu(true);
      if (sel && !sel.contains(e.target)) closeDestMenu();
    });
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
    $('#dep').addEventListener('change', function (e) {
      var old = S.dep && S.ret ? Math.round((parse(S.ret) - parse(S.dep)) / 864e5) : 7;
      S.dep = e.target.value;
      if (S.dep && (!S.ret || parse(S.ret) <= parse(S.dep))) { S.ret = iso(addDays(parse(S.dep), Math.max(old, 1))); $('#ret').value = S.ret; }
      syncDateRangeFields();
      schedule();
    });
    $('#ret').addEventListener('change', function (e) { S.ret = e.target.value; syncDateRangeFields(); schedule(); });
    $('#bud').addEventListener('input', function (e) { S.budget = Math.max(0, Number(e.target.value) || 0); schedule(); });
    $('#pm').addEventListener('click', function () { S.pax = Math.max(1, S.pax - 1); $('#pax').textContent = S.pax; schedule(); });
    $('#pp').addEventListener('click', function () { S.pax = Math.min(10, S.pax + 1); $('#pax').textContent = S.pax; schedule(); });
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
      var destinationProposal = e.target.closest('[data-propuesta-dest]');
      if (destinationProposal) { e.preventDefault(); e.stopPropagation(); S.dest = destinationProposal.getAttribute('data-propuesta-dest'); sel.value = S.dest; $('#destination-results').innerHTML = ''; openDestinationProposal(S.dest); return; }
      var proposal = e.target.closest('[data-propuesta-id]');
      if (proposal) { e.preventDefault(); e.stopPropagation(); var proposalId = proposal.getAttribute('data-propuesta-id'); var selected = lastData && (byId(lastData.list, proposalId) || byId(lastData.alternatives, proposalId) || byId(lastData.roadtripList, proposalId)); if (selected) showProposalView(selected, lastData); return; }
      var selectedFlight = e.target.closest('[data-select-flight]');
      if (selectedFlight) {
        e.preventDefault(); e.stopPropagation();
        persistSelectedOffer(selectedFlight);
        actualizarPasajes(selectedFlight.closest('.flight-search'), Number(selectedFlight.getAttribute('data-offer-price')), selectedFlight.getAttribute('data-offer-airline'));
        return;
      }
      var unlock = e.target.closest('[data-unlock-guide]');
      if (unlock) { unlockGuide(); return; }
      var b = e.target.closest('[data-shift]'); if (!b) return;
      var s = Number(b.getAttribute('data-shift'));
      S.dep = iso(addDays(parse(S.dep), s)); S.ret = iso(addDays(parse(S.ret), s));
      syncDateRangeFields();
      schedule();
    });
    $('#destination-results').addEventListener('click', function (e) {
      var destinationProposal = e.target.closest('[data-propuesta-dest]');
      if (!destinationProposal) return;
      e.preventDefault(); e.stopPropagation(); S.dest = destinationProposal.getAttribute('data-propuesta-dest'); sel.value = S.dest; openDestinationProposal(S.dest);
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
      var dailyBudgetCard = e.target.closest('[data-daily-kind]');
      if (dailyBudgetCard && detailState) {
        if (e.target.closest('input')) return;
        e.preventDefault(); e.stopPropagation();
        var kind = dailyBudgetCard.getAttribute('data-daily-kind');
        if (kind === 'local-custom' || kind === 'food-custom') {
          if ((kind === 'local-custom' && detailState.localBudgetMode === 'custom') || (kind === 'food-custom' && detailState.foodBudgetMode === 'custom')) {
            var existingInput = dailyBudgetCard.querySelector('input');
            if (existingInput) existingInput.focus();
            return;
          }
          var customKind = kind.split('-')[0];
          detailState[customKind + 'BudgetMode'] = 'custom';
          var customSection = dailyBudgetCard.closest('.daily-budget');
          if (customSection) {
            customSection.innerHTML = dailyBudgetControls();
            var customInput = customSection.querySelector('[data-daily-' + customKind + ']');
            if (customInput) customInput.focus();
          }
          return;
        }
        var value = Number(dailyBudgetCard.getAttribute('data-daily-value')) || 0;
        if (kind === 'local') {
          detailState.localBudgetMode = 'preset';
          detailState.localPerDayTouched = true;
          detailState.localPerDay = value;
          detailState.parts.local = Math.round(detailState.localPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        } else if (kind === 'food') {
          detailState.foodBudgetMode = 'preset';
          detailState.foodPerDayTouched = true;
          detailState.foodPerDay = value;
          detailState.parts.comidas = Math.round(detailState.foodPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        }
        recalcularTotalViaje();
        var section = e.target.closest('.daily-budget');
        if (section) section.innerHTML = dailyBudgetControls();
        return;
      }
      var bookTours = e.target.closest('[data-book-selected-tours]');
      if (bookTours && detailState) {
        e.preventDefault(); e.stopPropagation();
        var toursUrl = toursWhatsappUrl(detailState);
        if (!toursUrl) return;
        window.open(toursUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      var tourDetail = e.target.closest('[data-tour-detail-open]');
      if (tourDetail) {
        e.preventDefault(); e.stopPropagation();
        openTourDetailModal(tourDetail);
        return;
      }
      var tourCard = e.target.closest('[data-tour-card]');
      if (tourCard && detailState && !e.target.closest('a,button')) {
        var tourInput = tourCard.querySelector('[data-tour-choice]');
        if (tourInput) {
          tourInput.checked = !tourInput.checked;
          tourInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      if (e.target.closest('#btn-volver')) {
        e.preventDefault(); e.stopPropagation();
        $('#vista-detalle').classList.add('oculto'); $('#vista-principal').classList.remove('oculto');
        if (massSearch) { S.dest = 'todos'; sel.value = 'todos'; $('#btn-buscar-todos').hidden = false; }
        window.scrollTo({ top: 0, behavior: 'smooth' }); return;
      }
      var hotelChoice = e.target.closest('[data-hotel-total]');
      if (hotelChoice && hotelChoice.checked) { var hotelCard = hotelChoice.closest('[data-hotel-option]'); var hotelName = hotelCard ? hotelCard.querySelector('h3') : null; if (hotelName) detailState.selectedHotelName = hotelName.textContent.trim(); actualizarAlojamiento(Number(hotelChoice.getAttribute('data-hotel-total')), true); return; }
      var hotelCard = e.target.closest('[data-hotel-option]');
      if (hotelCard && !e.target.closest('.hotel-booking,.hotel-similar')) {
        var hotelInput = hotelCard.querySelector('[data-hotel-total]');
        if (hotelInput) { hotelInput.checked = true; var hotelName = hotelCard.querySelector('h3'); if (hotelName) detailState.selectedHotelName = hotelName.textContent.trim(); actualizarAlojamiento(Number(hotelInput.getAttribute('data-hotel-total')), true); }
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
        detailState.transferType = mode;
        detailState.transfer = amount;
        detailState.transferWizard = detailState.transferWizard || {};
        detailState.transferWizard.pickupMinutes = detailState.transferWizard.pickupMinutes || '60';
        detailState.transferWizard.hotelName = detailState.transferWizard.hotelName || findSelectedHotelLabel();
        var transferSectionEl = transferChoice.closest('[data-official-transfer]');
        if (transferSectionEl) transferSectionEl.outerHTML = transferCard(detailState.meta);
        sincronizarTrasladoOficial();
        return;
      }
      var pickupChoice = e.target.closest('[data-transfer-pickup-choice]');
      if (pickupChoice) {
        e.preventDefault(); e.stopPropagation();
        detailState.transferWizard = detailState.transferWizard || {};
        detailState.transferWizard.pickupMinutes = pickupChoice.getAttribute('data-transfer-pickup-choice');
        if (detailState.transferWizard.pickupMinutes !== 'custom') detailState.transferWizard.customTime = '';
        var pickupSectionEl = pickupChoice.closest('[data-official-transfer]');
        if (pickupSectionEl) pickupSectionEl.outerHTML = transferCard(detailState.meta);
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
        if (state && detailState && detailState.flightOffers) {
          var offer = detailState.flightOffers.find(function (item) { return String(item.id) === String(offerId); });
          var roundTrip = offer && offer.trip_type === 'round_trip';
          if (roundTrip) {
            if (state.stage !== 'inbound' && state.stage !== 'done') {
              state.stage = 'inbound';
              state.outboundId = offerId;
              state.inboundId = null;
              section.setAttribute('data-flight-step', 'inbound');
              renderFlightOffers(section.querySelector('.flight-results'), { offers: detailState.flightOffers });
              section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              return;
            }
            if (state.stage === 'inbound' && String(state.outboundId) === String(offerId)) {
              state.inboundId = offerId;
              state.stage = 'done';
              section.setAttribute('data-flight-step', 'done');
            } else {
              return;
            }
            persistSelectedOffer(selectedFlight);
            actualizarPasajes(section, Number(selectedFlight.getAttribute('data-offer-price')), selectedFlight.getAttribute('data-offer-airline'));
            renderFlightOffers(section.querySelector('.flight-results'), { offers: detailState.flightOffers });
            return;
          }
          state.stage = 'done';
          state.outboundId = offerId;
          state.inboundId = null;
          section.setAttribute('data-flight-step', 'done');
        }
        persistSelectedOffer(selectedFlight);
        actualizarPasajes(section, Number(selectedFlight.getAttribute('data-offer-price')), selectedFlight.getAttribute('data-offer-airline'));
        if (section && detailState && detailState.flightOffers) renderFlightOffers(section.querySelector('.flight-results'), { offers: detailState.flightOffers });
        return;
      }
      var unlock = e.target.closest('[data-unlock-guide]');
      if (unlock) { unlockGuide(); return; }
    });
    $('#vista-detalle').addEventListener('change', function (e) {
      var tourChoice = e.target.closest && e.target.closest('[data-tour-choice]');
      if (tourChoice && detailState) {
        var tour = { title: tourChoice.getAttribute('data-tour-title'), destination: tourChoice.getAttribute('data-tour-destination'), price: Number(tourChoice.getAttribute('data-tour-price')) || 0 };
        detailState.selectedTours = (detailState.selectedTours || []).filter(function (item) { return item.title !== tour.title; });
        if (tourChoice.checked) detailState.selectedTours.push(tour);
        detailState.toursTotal = detailState.selectedTours.reduce(function (sum, item) { return sum + item.price; }, 0);
        var tourCard = tourChoice.closest('[data-tour-card]');
        if (tourCard) {
          tourCard.setAttribute('aria-checked', tourChoice.checked ? 'true' : 'false');
          var tourStatus = tourCard.querySelector('.local-tour__status');
          if (tourStatus) tourStatus.textContent = tourChoice.checked ? 'Añadido al presupuesto' : 'Sumar al presupuesto';
        }
        var bookTours = document.querySelector('[data-book-selected-tours]');
        if (bookTours) bookTours.disabled = !detailState.selectedTours.length;
        recalcularTotalViaje();
        return;
      }
      var hotelChoice = e.target.closest && e.target.closest('[data-hotel-total]');
      if (hotelChoice && hotelChoice.checked) actualizarAlojamiento(Number(hotelChoice.getAttribute('data-hotel-total')), true);
      var transferCustomTime = e.target.closest && e.target.closest('[data-transfer-custom-time]');
      if (transferCustomTime && detailState) {
        detailState.transferWizard = detailState.transferWizard || {};
        detailState.transferWizard.pickupMinutes = 'custom';
        detailState.transferWizard.customTime = transferCustomTime.value;
        renderTripSummary();
      }
      var consumption = e.target.closest && e.target.closest('[data-roadtrip-consumption]');
      if (consumption) actualizarRoadtrip(consumption.value);
      var roadtripModel = e.target.closest && e.target.closest('[data-roadtrip-model]');
      if (roadtripModel) actualizarModeloRoadtrip(roadtripModel.value);
      var dailyFoodInput = e.target.closest && e.target.closest('[data-daily-food]');
      if (dailyFoodInput && detailState) {
        detailState.foodBudgetMode = 'custom';
        detailState.foodCustomValue = dailyFoodInput.value;
        detailState.foodPerDayTouched = true;
        detailState.foodPerDay = Math.max(0, Number(dailyFoodInput.value) || 0);
        detailState.parts.comidas = Math.round(detailState.foodPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
      var dailyLocalInput = e.target.closest && e.target.closest('[data-daily-local]');
      if (dailyLocalInput && detailState) {
        detailState.localBudgetMode = 'custom';
        detailState.localCustomValue = dailyLocalInput.value;
        detailState.localPerDayTouched = true;
        detailState.localPerDay = Math.max(0, Number(dailyLocalInput.value) || 0);
        detailState.parts.local = Math.round(detailState.localPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
    });
    $('#vista-detalle').addEventListener('keydown', function (e) {
      var tourCard = e.target.closest && e.target.closest('[data-tour-card]');
      if (!tourCard || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      var tourInput = tourCard.querySelector('[data-tour-choice]');
      if (tourInput) {
        tourInput.checked = !tourInput.checked;
        tourInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    $('#vista-detalle').addEventListener('change', function (e) {
      var hotelTypeSelect = e.target.closest && e.target.closest('[data-hotel-type-select]');
      if (hotelTypeSelect) changeHotelType(hotelTypeSelect.value);
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
      var dailyFoodInput = e.target.closest && e.target.closest('[data-daily-food]');
      if (dailyFoodInput && detailState) {
        detailState.foodBudgetMode = 'custom';
        detailState.foodCustomValue = dailyFoodInput.value;
        detailState.foodPerDayTouched = true;
        detailState.foodPerDay = Math.max(0, Number(dailyFoodInput.value) || 0);
        detailState.parts.comidas = Math.round(detailState.foodPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
      var dailyLocalInput = e.target.closest && e.target.closest('[data-daily-local]');
      if (dailyLocalInput && detailState) {
        detailState.localBudgetMode = 'custom';
        detailState.localCustomValue = dailyLocalInput.value;
        detailState.localPerDayTouched = true;
        detailState.localPerDay = Math.max(0, Number(dailyLocalInput.value) || 0);
        detailState.parts.local = Math.round(detailState.localPerDay * Math.max(1, Number(detailState.meta.nights) || 1) * Math.max(1, Number(detailState.meta.pax) || 1));
        recalcularTotalViaje();
      }
    });
    $('#booking-modal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-booking]') || e.target === $('#booking-modal')) closeBookingForm();
      var saveTripButton = e.target.closest('[data-save-trip]');
      if (saveTripButton) { e.preventDefault(); saveCurrentTrip(); return; }
      var hotelAffiliateButton = e.target.closest('[data-book-hotel-affiliate]');
      if (hotelAffiliateButton) {
        e.preventDefault();
        (async function () {
          if (!supabaseClient) { await initAuth(); }
          if (!authUser) { openAuthModal('Iniciá sesión para reservar el hotel y hacer seguimiento de tu clic.'); return; }
          if (!detailState || !detailState.meta) return;
          var subId = generateHotelSubId(lastSavedTripId, authUser.id);
          var hotelName = hotelAffiliateButton.getAttribute('data-hotel-name');
          var win = window.open(travelpayoutsHotelUrl(detailState.meta, subId, hotelName), '_blank', 'noopener,noreferrer');
          if (!win) notice('Permití las ventanas emergentes para abrir la reserva.');
          registerHotelClick(subId, detailState.meta, hotelName, hotelAffiliateButton.getAttribute('data-hotel-total'), lastSavedTripId);
        }());
        return;
      }
      var whatsappButton = e.target.closest('[data-share-whatsapp]');
      if (whatsappButton) {
        e.preventDefault();
        var whatsappUrl = 'https://wa.me/?text=' + encodeURIComponent($('#booking-modal').dataset.summaryText || '');
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }
      var copyButton = e.target.closest('[data-copy-summary]');
      if (copyButton) {
        e.preventDefault();
        var copyText = $('#booking-modal').dataset.summaryText || '';
        var copyPromise = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(copyText) : Promise.reject(new Error('clipboard unavailable'));
        copyPromise.then(function () {
          var status = $('#booking-modal').querySelector('[data-copy-status]');
          if (status) status.textContent = 'Resumen copiado';
        }).catch(function () {
          var status = $('#booking-modal').querySelector('[data-copy-status]');
          if (status) status.textContent = 'No se pudo copiar';
        });
      }
      var storyButton = e.target.closest('[data-share-story]');
      if (storyButton) { e.preventDefault(); shareStoryCard(storyButton); }
      var coordinateTransfer = e.target.closest('[data-coordinate-transfer]');
      if (coordinateTransfer) {
        e.preventDefault();
        closeBookingForm();
        openTransferModal(detailState && detailState.meta);
      }
      var stepButton = e.target.closest('[data-transfer-step]');
      if (stepButton) {
        e.preventDefault(); e.stopPropagation();
        advanceTransferWizard(Number(stepButton.getAttribute('data-transfer-step')) || 1);
      }
      var addBudgetButton = e.target.closest('[data-transfer-add-budget]');
      if (addBudgetButton) {
        e.preventDefault(); e.stopPropagation();
        syncTransferWizardStateFromDom($('#booking-modal'));
        if (!detailState || !detailState.transferWizard || !detailState.transferWizard.hotelName) {
          var hotelInput = $('#booking-modal').querySelector('[name="transfer-hotel"]');
          if (hotelInput) {
            detailState.transferWizard.hotelName = hotelInput.value.trim();
          }
        }
        if (!detailState || !detailState.transferWizard || !detailState.transferWizard.hotelName) {
          alert('Ingresá el hotel o pousada de destino para continuar.');
          var fallbackInput = $('#booking-modal').querySelector('[name="transfer-hotel"]');
          if (fallbackInput) fallbackInput.focus();
          return;
        }
        addTransferToBudget();
      }
    });
    $('#booking-modal').addEventListener('change', function (e) {
      var radio = e.target.closest('[name="transfer-pickup"]');
      if (radio) {
        if (!detailState || !detailState.transferWizard) return;
        detailState.transferWizard.pickupMinutes = radio.value;
        if (String(radio.value) === 'custom') {
          var customInput = $('#booking-modal').querySelector('[data-transfer-custom-time]');
          detailState.transferWizard.customTime = customInput ? customInput.value : '';
        } else {
          detailState.transferWizard.customTime = '';
        }
        return;
      }
      var customTime = e.target.closest('[data-transfer-custom-time]');
      if (customTime && detailState && detailState.transferWizard) {
        detailState.transferWizard.customTime = customTime.value;
      }
      var hotelInput = e.target.closest('[name="transfer-hotel"]');
      if (hotelInput && detailState && detailState.transferWizard) {
        detailState.transferWizard.hotelName = hotelInput.value.trim();
      }
    });
    $('#booking-modal').addEventListener('input', function (e) {
      var cardNumber = e.target.closest('[data-card-number]');
      if (cardNumber) cardNumber.value = cardNumber.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
      var cardExpiry = e.target.closest('[data-card-expiry]');
      if (cardExpiry) { var expiryValue = cardExpiry.value.replace(/\D/g, '').slice(0, 4); cardExpiry.value = expiryValue.length > 2 ? expiryValue.slice(0, 2) + '/' + expiryValue.slice(2) : expiryValue; }
      var customTime = e.target.closest('[data-transfer-custom-time]');
      if (customTime && detailState && detailState.transferWizard) {
        detailState.transferWizard.customTime = customTime.value;
      }
      var hotelInput = e.target.closest('[name="transfer-hotel"]');
      if (hotelInput && detailState && detailState.transferWizard) {
        detailState.transferWizard.hotelName = hotelInput.value.trim();
      }
    });
    $('#booking-modal').addEventListener('submit', function (e) { e.preventDefault(); if (e.target.id !== 'transfer-form') return; if (!e.target.checkValidity()) { e.target.reportValidity(); return; } submitTransfer(e.target); });

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
          hub.options.forEach(function (item, optionIndex) {
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

  init();
})();
