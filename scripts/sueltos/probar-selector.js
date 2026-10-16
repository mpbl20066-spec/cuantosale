const fs = require("fs");
const src = fs.readFileSync("public/app.js", "utf8");
function extraer(nombre) {
  const i = src.indexOf("function " + nombre + "(");
  if (i < 0) throw new Error("no existe " + nombre);
  let p = src.indexOf("{", i), nivel = 0;
  for (let k = p; k < src.length; k++) {
    if (src[k] === "{") nivel++;
    else if (src[k] === "}") { nivel--; if (!nivel) return src.slice(i, k + 1); }
  }
}
const CFG = {
  monedas: [{code:"USD",etiqueta:"Dolares",simbolo:"US$"},{code:"BRL",etiqueta:"Reales",simbolo:"R$"},{code:"UYU",etiqueta:"Pesos uruguayos",simbolo:"$"}],
  fx: { rates: { USD: 1, BRL: 5.1843, UYU: 40.1196 }, base: "USD", until: 0, cargando: false },
  s: { currency: "USD" }
};
const cuerpo = "const MONEDAS_APP = CFG.monedas, FX = CFG.fx, S = CFG.s;\n"
  + "const esc = s => String(s);\n"
  + extraer("tasaDe") + "\n" + extraer("monedaActiva") + "\n" + extraer("selectorMoneda")
  + "\nreturn selectorMoneda();";
try {
  const html = new Function("CFG", cuerpo)(CFG);
  console.log("  OK, largo:", html.length);
  console.log("  ", html.replace(/\s+/g, " ").slice(0, 420));
} catch (e) {
  console.log("  FALLA:", e.message);
}
