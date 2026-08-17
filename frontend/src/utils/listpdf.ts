import { formatPrice, isAvailable } from "@/src/utils/format";
import { ProductDetail, PriceTile } from "@/src/api/client";
import { VENEGE_LOGO_DATA_URI } from "@/src/utils/logo";

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

export function buildListHTML(channelLabel: string, products: ProductDetail[], keys: string[]): string {
  const now = new Date();
  const date = now.toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

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
          const ok = pt && isAvailable(pt.value);
          const txt = ok ? formatPrice(pt.value, pt.currency) : "No disp.";
          return `<td class="r${ok ? "" : " na"}">${esc(txt)}</td>`;
        })
        .join("");
      return `<tr><td class="mk">${esc(p.marca)}</td><td class="ds">${esc(p.descripcion)}</td>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page {
      margin: 30px 26px 46px;
      @bottom-center { content: "Página " counter(page) " de " counter(pages); font-size: 8.5px; color: #B0B0B0; }
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #FFFFFF; }
    body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1A1A1F; padding: 22px; }

    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2.5px solid #C0392B; padding-bottom: 14px; margin-bottom: 18px;
    }
    .logo { height: 42px; }
    .hmeta { text-align: right; }
    .kicker { font-size: 8.5px; letter-spacing: 3px; color: #C0392B; font-weight: 700; text-transform: uppercase; }
    .title { font-size: 15px; font-weight: 800; color: #1A1A1F; margin-top: 2px; letter-spacing: .3px; }
    .chip { display:inline-block; margin-top:6px; background:#FBEDEB; color:#C0392B; font-weight:700; font-size:10px; padding:3px 12px; border-radius:20px; }
    .date { font-size: 9.5px; color:#888; margin-top:6px; }

    table { width:100%; border-collapse: collapse; font-size: 10px; }
    thead { display: table-header-group; }
    th { text-align:left; background:#C0392B; color:#FFFFFF; padding:7px 6px; font-size:8.5px; letter-spacing:.4px; text-transform:uppercase; font-weight:700; }
    th.r, td.r { text-align:right; white-space:nowrap; }
    td { padding:6px; border-bottom:1px solid #EFEFEF; }
    tr:nth-child(even) td { background:#FBF9F9; }
    tr { page-break-inside: avoid; }
    .mk { font-weight:700; white-space:nowrap; color:#1A1A1F; }
    .ds { color:#4A4A50; }
    td.na { color:#C0C0C6; font-style: italic; }
    .foot { margin-top: 20px; padding-top: 10px; border-top: 1px solid #EEE; font-size: 8.5px; color:#AAAAAA; display:flex; justify-content:space-between; }
  </style></head><body>
    <div class="page-header">
      <img class="logo" src="${VENEGE_LOGO_DATA_URI}" alt="VENEGE"/>
      <div class="hmeta">
        <div class="kicker">Lista de Precios</div>
        <div class="title">Catálogo autorizado</div>
        <div class="chip">${esc(channelLabel)}</div>
        <div class="date">${esc(date)} · ${esc(time)} · ${products.length} productos</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Marca</th><th>Descripción</th>${colHead}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">
      <span>VENEGE · Neumáticos y suspensiones</span>
      <span>Precios sujetos a cambio sin previo aviso</span>
    </div>
  </body></html>`;
}
