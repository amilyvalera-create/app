import { formatPrice, isAvailable } from "@/src/utils/format";
import { ProductDetail, PriceTile } from "@/src/api/client";

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

export function buildListHTML(channelLabel: string, products: ProductDetail[], keys: string[]): string {
  const date = new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });
  // Columns = the channel's price keys (in schema order as returned per product).
  const sample = products.find((p) => p.prices.length);
  const cols: PriceTile[] = (sample?.prices ?? []).filter((p) => keys.includes(p.key));
  const colHead = cols.map((c) => `<th class="r">${esc(c.label)}</th>`).join("");

  const rows = products
    .map((p) => {
      const byKey: Record<string, PriceTile> = {};
      p.prices.forEach((pt) => (byKey[pt.key] = pt));
      const cells = cols
        .map((c) => {
          const pt = byKey[c.key];
          const txt = pt && isAvailable(pt.value) ? formatPrice(pt.value, pt.currency) : "No disponible";
          return `<td class="r">${esc(txt)}</td>`;
        })
        .join("");
      return `<tr><td class="mk">${esc(p.marca)}</td><td class="ds">${esc(p.descripcion)}</td>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page { margin: 28px; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color:#17181F; margin:0; }
    .head { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #A32A32; padding-bottom:14px; }
    .brand { display:flex; align-items:center; gap:12px; }
    .mark { width:38px; height:38px; }
    .wm { font-size:26px; font-weight:800; letter-spacing:2px; color:#A32A32; }
    .kicker { font-size:9px; letter-spacing:3px; color:#E0552F; font-weight:700; text-transform:uppercase; }
    .meta { text-align:right; font-size:11px; color:#555; }
    .chip { display:inline-block; margin-top:4px; background:#F4F1F1; color:#A32A32; font-weight:700; font-size:11px; padding:3px 10px; border-radius:20px; }
    table { width:100%; border-collapse:collapse; font-size:11px; margin-top:16px; }
    thead { display: table-header-group; }
    th { text-align:left; background:#A32A32; color:#fff; padding:8px 6px; font-size:9px; letter-spacing:.5px; text-transform:uppercase; }
    th.r, td.r { text-align:right; }
    td { padding:7px 6px; border-bottom:1px solid #ECECEC; }
    tr:nth-child(even) td { background:#FAF8F8; }
    .mk { font-weight:700; white-space:nowrap; }
    .ds { color:#444; }
    .foot { margin-top:18px; font-size:9.5px; color:#999; }
  </style></head><body>
    <div class="head">
      <div class="brand">
        <svg class="mark" viewBox="0 0 100 100"><path d="M20 20 C20 55 40 80 50 85 C48 60 34 40 32 22 Z" fill="#A32A32"/><path d="M52 84 C60 55 72 35 88 20 L80 16 L92 12 L90 26 L84 22 C70 40 58 60 60 84 Z" fill="#E0552F"/></svg>
        <div><div class="kicker">Lista de Precios</div><div class="wm">VENEGE</div></div>
      </div>
      <div class="meta">${esc(date)}<div class="chip">${esc(channelLabel)}</div></div>
    </div>
    <table>
      <thead><tr><th>Marca</th><th>Descripción</th>${colHead}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">VENEGE · Lista de precios (${esc(channelLabel)}) · ${esc(date)}. Precios sujetos a cambio sin previo aviso.</div>
  </body></html>`;
}
