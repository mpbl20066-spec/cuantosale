const airportByDestination = { "Florianópolis": "FLN", "Buenos Aires": "BUE", "Río de Janeiro": "RIO" };
export default async function handler(request, response) {
  if (request.method !== "POST") { response.setHeader("Allow", "POST"); return response.status(405).json({ message: "Method not allowed" }); }
  if (!process.env.DUFFEL_ACCESS_TOKEN) return response.status(500).json({ message: "Falta configurar DUFFEL_ACCESS_TOKEN en las variables de entorno." });
  const { destination, departureDate, returnDate, travelers } = request.body || {};
  const destinationCode = airportByDestination[destination], travelerCount = Number(travelers);
  if (!destinationCode || !departureDate || !returnDate || !Number.isInteger(travelerCount) || travelerCount < 1) return response.status(400).json({ message: "Los datos de búsqueda no son válidos." });
  try {
    const duffelResponse = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true", { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/json", "Duffel-Version": "v2", "Authorization": `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}` }, body: JSON.stringify({ data: { cabin_class: "economy", slices: [{ origin: "MVD", destination: destinationCode, departure_date: departureDate }, { origin: destinationCode, destination: "MVD", departure_date: returnDate }], passengers: Array.from({ length: travelerCount }, () => ({ type: "adult" })) } }) });
    const payload = await duffelResponse.json();
    if (!duffelResponse.ok) { console.error("Duffel error", payload); return response.status(duffelResponse.status).json({ message: "Duffel no pudo completar la búsqueda." }); }
    const offers = (payload.data.offers || []).slice(0, 12).map((offer) => {
      const outbound = offer.slices[0], firstSegment = outbound.segments[0];
      const duration = outbound.duration?.replace("PT", "").replace("H", " h ").replace("M", " min") || "Ver detalle";
      return { id: offer.id, totalAmount: offer.total_amount, totalCurrency: offer.total_currency, airline: firstSegment.operating_carrier?.name || firstSegment.marketing_carrier?.name || "Aerolínea", duration: duration.trim(), connections: Math.max(0, outbound.segments.length - 1), expiresAt: offer.expires_at };
    });
    return response.status(200).json({ offers });
  } catch (error) { console.error("Flight search error", error); return response.status(500).json({ message: "No fue posible conectar con Duffel." }); }
}
