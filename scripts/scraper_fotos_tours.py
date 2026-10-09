import json
import os
import time
import requests
from bs4 import BeautifulSoup

# Lista de destinos y sus respectivos tours sin foto
tours_data = {
    "Arraial d'Ajuda": [
        "Buggy a Pitinga y Taípe",
        "Paseo a Coroa Vermelha"
    ],
    "Balneário Camboriú": [
        "Ingreso al Parque Unipraias",
        "Ingreso Beto Carrero World",
        "Pasaporte de la Diversión (5 Atracciones)"
    ],
    "Cabo Frio": [
        "Buggy por las dunas de Peró",
        "Gruta Azul / Ilha do Farol em barco",
        "Paseo en escuna por cái Canal / Ilha do Japonês"
    ],
    "Canela": [
        "Alpen Park",
        "Parque do Caracol (entrada)"
    ],
    "Fernando de Noronha": [
        "Ilha tour en buggy 4x4",
        "Paseo en barco Baía dos Golfinhos",
        "Trilha Atalaia (Cupo limitado)"
    ],
    "Ferrugem": [
        "Paseo en buggy / cuatriciclo"
    ],
    "Florianópolis": [
        "City tour Ilha de Santa Catarina",
        "Isla Campeche en barco",
        "Paseo de delfines (Ribeirão / Sambaqui)",
        "Sandboard en dunas de Joaquina"
    ],
    "Fortaleza": [
        "City tour histórico y playas de Fortaleza",
        "Excursión a Beach Park (entrada)"
    ],
    "Praia do Forte": [
        "Piscinas naturales de Papagaio",
        "Proyecto Tamar (entrada)",
        "Reserva Sapiranga: trilha y tirolesa"
    ],
    "Garopaba": [
        "Avistaje de ballenas franca",
        "Clase de surf"
    ],
    "Gramado": [
        "Mini Mundo (entrada)",
        "Snowland (entrada)"
    ],
    "Itapema": [
        "Buceo en Arvoredo",
        "Paseo en escuna por la costa",
        "Unipraias Balneário Camboriú"
    ],
    "Jericoacoara": [
        "Excursión en buggy a la Laguna del Paraíso y Árbol de la Sloth",
        "Paseo en catamarán o lancha al atardecer en la Duna del Pôr do Sol"
    ],
    "Maragogi": [
        "Excursión a las Piscinas Naturales de Maragogi (Galés)"
    ],
    "Maceió": [
        "Excursión a Praia do Gunga y los acantilados",
        "Paseo a las piscinas naturales de Pajuçara"
    ],
    "Morro de São Paulo": [
        "Excursión de día completo a Morro (desde Salvador)",
        "Snorkel en Garapuá",
        "Tirolesa sobre la Praia",
        "Volta à ilha en lancha"
    ],
    "Natal": [
        "Dunas de Genipabu (Buggy con emoção)",
        "Maracajaú (Paseo a las Maquas / Buceo)"
    ],
    "Paraty": [
        "Centro histórico + destilerías de cachaça",
        "Jeep tour cascadas y alambiques",
        "Paseo en escuna por la bahía"
    ],
    "Piçarras": [
        "Beto Carrero World (entrada)"
    ],
    "Pipa": [
        "Buggy Pipa / Tibau do Sul",
        "Excursión en 4x4 Paseo Ecológico por las playas de Pipa",
        "Paseo en barco al atardecer y avistaje de delfines"
    ],
    "Porto Alegre": [
        "City tour histórico",
        "Paseo en catamarán por el Guaíba",
        "Vale dos Vinhedos (excursión)"
    ],
    "Porto de Galinhas": [
        "Paseo en jangada a las piscinas naturales",
        "Ponta a Ponta (Buggy por todas las playas)"
    ],
    "Porto Seguro": [
        "Catamarán a Recife de Fora",
        "Paseo a Arraial d'Ajuda y Trancoso",
        "Passeio Praia do Espelho"
    ],
    "Recife": [
        "City Tour Histórico Recife y Olinda"
    ],
    "Río de Janeiro": [
        "City tour completo: Cristo Redentor + Pan de Azúcar",
        "Cristo Redentor en Trem do Corcovado",
        "Pan de Azúcar y City Tour Histórico",
        "Santa Teresa y Escalera Selarón"
    ],
    "Praia do Rosa": [
        "Avistaje de ballenas franca",
        "Paddle en Lagoa de Ibiraquera"
    ],
    "São Paulo": [
        "City Tour Histórico, Paulista y Liberdade",
        "Tour gastronómico guiado por el Mercadão y Centro"
    ],
    "Salvador de Bahía": [
        "City Tour Histórico y Pelourinho",
        "City tour Pelourinho + Elevador Lacerda",
        "Espectáculo Balé Folclórico da Bahia",
        "Paseo en barco por la Bahía de Todos os Santos",
        "Paseo en goleta por la Bahía de Todos os Santos"
    ],
    "Trancoso": [
        "Buggy por las playas",
        "Praia do Espelho (excursión)"
    ]
}

# Imagen de respaldo cuando la búsqueda no encuentra nada.
FOTO_RESPALDO = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"


def search_image_url(query_str):
    """
    Busca una imagen representativa en los resultados de DuckDuckGo (HTML).
    Devuelve (url, encontrada): encontrada es False cuando se usó el respaldo.
    """
    search_url = "https://html.duckduckgo.com/html/?q=" + requests.utils.quote(query_str + " tourism travel photo")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    try:
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, "html.parser")
            # Busca enlaces de imágenes en los resultados
            for a in soup.find_all("a", class_="result__url"):
                link = a.get("href", "")
                if any(ext in link.lower() for ext in [".jpg", ".png", ".jpeg"]):
                    return link, True
    except Exception as e:
        print("Error buscando imagen para " + query_str + ": " + str(e))

    return FOTO_RESPALDO, False


def generar_catalogo_fotos(salida):
    resultado_final = {}
    total = sum(len(v) for v in tours_data.values())
    encontradas = 0
    hechos = 0

    print("Iniciando la búsqueda de imágenes para " + str(total) + " tours...")

    for destino, tours in tours_data.items():
        resultado_final[destino] = {}
        for tour in tours:
            hechos += 1
            query_busqueda = tour + " " + destino + " Brasil"
            print("[" + str(hechos) + "/" + str(total) + "] " + query_busqueda)

            url_encontrada, ok = search_image_url(query_busqueda)
            if ok:
                encontradas += 1
            resultado_final[destino][tour] = {
                "url_imagen": url_encontrada,
                "fuente": "auto-scraped" if ok else "respaldo"
            }
            # Pausa breve para evitar bloqueos por rate-limiting
            time.sleep(1.5)

    with open(salida, "w", encoding="utf-8") as f:
        json.dump(resultado_final, f, ensure_ascii=False, indent=4)

    print("")
    print("Listo: " + str(encontradas) + " de " + str(total) + " con imagen encontrada; " +
          str(total - encontradas) + " con la imagen de respaldo.")
    print("Archivo generado: " + salida)


if __name__ == "__main__":
    # Va a data/_trabajo y NO a data/tour-photos.json: ese archivo ya existe con
    # otro formato (clave "destino#titulo" con autor y licencia) y esta salida lo pisaria.
    carpeta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "_trabajo")
    os.makedirs(carpeta, exist_ok=True)
    generar_catalogo_fotos(os.path.join(carpeta, "tour-photos-scraped.json"))
