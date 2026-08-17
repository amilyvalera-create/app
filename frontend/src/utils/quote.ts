import { formatPrice } from "@/src/utils/format";

export type QuoteItem = {
  sku: string;
  marca: string;
  descripcion: string;
  rin: number | string;
  priceLabel: string;
  value: number;
  currency: string;
  qty: number;
};

export type QuoteData = {
  recipient: string;
  sellerName: string;
  sellerPhone: string;
  items: QuoteItem[];
};

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

export function buildQuoteHTML(data: QuoteData): string {
  const date = new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });
  const totals: Record<string, number> = {};
  const rows = data.items
    .map((it) => {
      const line = it.value * it.qty;
      totals[it.currency] = (totals[it.currency] || 0) + line;
      return `<tr>
        <td class="l"><span class="mk">${esc(it.marca)}</span><br/><span class="ds">${esc(it.descripcion)}</span><br/><span class="sk">SKU ${esc(it.sku)} · RIN ${esc(String(it.rin))}"</span></td>
        <td class="c">${esc(it.priceLabel)}</td>
        <td class="c">${it.qty}</td>
        <td class="r">${formatPrice(it.value, it.currency)}</td>
        <td class="r b">${formatPrice(line, it.currency)}</td>
      </tr>`;
    })
    .join("");
  const totalsHTML = Object.entries(totals)
    .map(([cur, val]) => `<div class="trow"><span>Total ${cur === "Bs" ? "Bolívares" : "Dólares"}</span><span class="tv">${formatPrice(val, cur)}</span></div>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #17181F; margin: 0; padding: 40px; }
    .head { display:flex; align-items:center; justify-content:space-between; border-bottom: 3px solid #A32A32; padding-bottom: 18px; }
    .brand { display:flex; align-items:center; gap:14px; }
    .mark { width:44px; height:44px; }
    .wm { font-size: 30px; font-weight: 800; letter-spacing: 2px; color:#A32A32; }
    .kicker { font-size: 10px; letter-spacing: 3px; color:#E0552F; font-weight:700; text-transform: uppercase; }
    .meta { text-align:right; font-size: 12px; color:#555; }
    .title { font-size: 22px; font-weight: 800; margin: 26px 0 4px; letter-spacing: .5px; }
    .sub { color:#666; font-size: 12px; margin-bottom: 20px; }
    .info { display:flex; gap:40px; margin-bottom: 22px; font-size: 13px; }
    .info b { display:block; color:#A32A32; font-size: 10px; letter-spacing:1px; text-transform:uppercase; margin-bottom:3px; }
    table { width:100%; border-collapse: collapse; font-size: 12.5px; }
    th { text-align:left; background:#F4F1F1; color:#A32A32; padding:10px; font-size:10px; letter-spacing:1px; text-transform:uppercase; }
    td { padding:12px 10px; border-bottom:1px solid #ECECEC; vertical-align: top; }
    .c { text-align:center; } .r { text-align:right; } .b { font-weight:700; }
    .mk { font-weight:800; } .ds { color:#444; } .sk { color:#999; font-size:10px; }
    .totals { margin-top: 20px; margin-left:auto; width: 260px; }
    .trow { display:flex; justify-content:space-between; padding:8px 4px; border-top:1px solid #eee; font-size:13px; }
    .tv { font-weight:800; color:#A32A32; }
    .foot { margin-top: 40px; font-size: 10.5px; color:#999; border-top:1px solid #eee; padding-top:12px; }
  </style></head><body>
    <div class="head">
      <div class="brand">
        <svg class="mark" viewBox="0 0 100 100"><path d="M20 20 C20 55 40 80 50 85 C48 60 34 40 32 22 Z" fill="#A32A32"/><path d="M52 84 C60 55 72 35 88 20 L80 16 L92 12 L90 26 L84 22 C70 40 58 60 60 84 Z" fill="#E0552F"/></svg>
        <div><div class="kicker">Lista de Precios</div><div class="wm">VENEGE</div></div>
      </div>
      <div class="meta">Cotización<br/>${esc(date)}</div>
    </div>
    <div class="title">Cotización de productos</div>
    <div class="sub">Documento generado para el cliente. Precios sujetos a cambio sin previo aviso.</div>
    <div class="info">
      <div><b>Cliente</b>${esc(data.recipient || "—")}</div>
      <div><b>Vendedor</b>${esc(data.sellerName || "—")}</div>
      <div><b>Contacto</b>${esc(data.sellerPhone || "—")}</div>
    </div>
    <table>
      <thead><tr><th>Producto</th><th class="c">Precio</th><th class="c">Cant.</th><th class="r">Unitario</th><th class="r">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">${totalsHTML}</div>
    <div class="foot">VENEGE · Neumáticos y suspensiones · Cotización generada el ${esc(date)}. Los montos en distintas monedas se totalizan por separado.</div>
  </body></html>`;
}
