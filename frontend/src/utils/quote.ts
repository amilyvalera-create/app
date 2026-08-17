import { formatPrice } from "@/src/utils/format";
import { VENEGE_LOGO_DATA_URI } from "@/src/utils/logo";

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
  const now = new Date();
  const date = now.toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

  const totals: Record<string, number> = {};
  const rows = data.items
    .map((it, idx) => {
      const line = it.value * it.qty;
      totals[it.currency] = (totals[it.currency] || 0) + line;
      return `<tr class="${idx % 2 ? "alt" : ""}">
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
    @page {
      margin: 30px 30px 46px;
      @bottom-center { content: "Página " counter(page) " de " counter(pages); font-size: 8.5px; color: #B0B0B0; }
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background:#FFFFFF; }
    body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1A1A1F; padding: 28px; }

    .page-header {
      display:flex; align-items:center; justify-content:space-between;
      border-bottom: 2.5px solid #C0392B; padding-bottom: 16px; margin-bottom: 22px;
    }
    .logo { height: 46px; }
    .hmeta { text-align:right; }
    .kicker { font-size: 9px; letter-spacing: 3px; color:#C0392B; font-weight:700; text-transform: uppercase; }
    .htitle { font-size: 18px; font-weight: 800; color:#1A1A1F; margin-top:2px; letter-spacing:.3px; }
    .date { font-size: 9.5px; color:#888; margin-top:5px; }

    .info { display:flex; gap:36px; margin: 4px 0 16px; font-size: 12px; }
    .info b { display:block; color:#C0392B; font-size: 9px; letter-spacing:1px; text-transform:uppercase; margin-bottom:3px; }
    .lead { color:#666; font-size: 11px; margin-bottom: 16px; }

    table { width:100%; border-collapse: collapse; font-size: 12px; }
    thead { display: table-header-group; }
    th { text-align:left; background:#C0392B; color:#FFFFFF; padding:9px 10px; font-size:9px; letter-spacing:.6px; text-transform:uppercase; font-weight:700; }
    td { padding:11px 10px; border-bottom:1px solid #EFEFEF; vertical-align: top; }
    tr.alt td { background:#FBF9F9; }
    tr { page-break-inside: avoid; }
    .c { text-align:center; } .r { text-align:right; white-space:nowrap; } .b { font-weight:800; color:#1A1A1F; }
    .mk { font-weight:800; } .ds { color:#4A4A50; } .sk { color:#A0A0A6; font-size:9.5px; }

    .totals { margin-top: 22px; margin-left:auto; width: 280px; }
    .trow { display:flex; justify-content:space-between; padding:9px 4px; border-top:1px solid #EEE; font-size:13px; }
    .tv { font-weight:800; color:#C0392B; }
    .foot { margin-top: 30px; padding-top: 12px; border-top:1px solid #EEE; font-size: 9px; color:#AAAAAA; }
  </style></head><body>
    <div class="page-header">
      <img class="logo" src="${VENEGE_LOGO_DATA_URI}" alt="VENEGE"/>
      <div class="hmeta">
        <div class="kicker">Cotización</div>
        <div class="htitle">Cotización de productos</div>
        <div class="date">${esc(date)} · ${esc(time)}</div>
      </div>
    </div>

    <div class="info">
      <div><b>Cliente</b>${esc(data.recipient || "—")}</div>
      <div><b>Vendedor</b>${esc(data.sellerName || "—")}</div>
      <div><b>Contacto</b>${esc(data.sellerPhone || "—")}</div>
    </div>
    <div class="lead">Documento generado para el cliente.</div>
    <table>
      <thead><tr><th>Producto</th><th class="c">Precio</th><th class="c">Cant.</th><th class="r">Unitario</th><th class="r">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">${totalsHTML}</div>
    <div class="foot">VENEGE · Neumáticos y suspensiones · Los montos en distintas monedas se totalizan por separado. Precios sujetos a cambio sin previo aviso.</div>
  </body></html>`;
}
