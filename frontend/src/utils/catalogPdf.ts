import { VENEGE_LOGO_DATA_URI, LOGO_ASPECT } from "@/src/utils/logo";

export type CatalogData = {
  channelLabel: string;
  dateStr: string;
  count: number;
  headers: string[]; // ["MARCA","DESCRIPCIÓN", price labels...]
  rows: string[][]; // each row aligned to headers
  fileName: string; // e.g. "Lista_de_precios_VENEGE.pdf"
};

/**
 * Returns a self-contained HTML page that loads jsPDF + jspdf-autotable (UMD, CDN)
 * and builds a TRUE vector, paginated A4-landscape catalog PDF (fixed margins,
 * repeating branded header/footer, repeating table header, controlled row breaks,
 * "Página X de Y"). The page also renders the generated PDF for on-screen preview.
 *
 * It exposes on `window`:
 *   __ready           -> boolean once the doc is built
 *   __download()      -> triggers a direct file download (web)
 *   __blob()          -> returns the PDF Blob (web share)
 *   __base64()        -> returns raw base64 (native save via FileSystem)
 */
export function buildCatalogGeneratorHTML(data: CatalogData): string {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
<style>
  html,body{margin:0;padding:0;height:100%;background:#525659;}
  #pv{width:100%;height:100%;border:none;background:#fff;}
  #msg{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#fff;padding:24px;text-align:center;}
</style></head>
<body>
  <div id="msg">Generando PDF…</div>
  <iframe id="pv" style="display:none"></iframe>
<script>
  var DATA = ${payload};
  var LOGO = ${JSON.stringify(VENEGE_LOGO_DATA_URI)};
  var LOGO_ASPECT = ${LOGO_ASPECT};
  window.__ready = false;

  function drawHeader(doc, PW, ML, MR){
    var logoW = 34, logoH = logoW / LOGO_ASPECT, topY = 8;
    try { doc.addImage(LOGO, "PNG", ML, topY, logoW, logoH); } catch(e){}
    var rx = PW - MR;
    doc.setTextColor(192,57,43); doc.setFont("helvetica","bold"); doc.setFontSize(7);
    doc.text("LISTA DE PRECIOS", rx, 10.5, {align:"right"});
    doc.setTextColor(26,26,31); doc.setFontSize(12);
    doc.text("Catálogo autorizado", rx, 16, {align:"right"});
    doc.setTextColor(120,120,120); doc.setFont("helvetica","normal"); doc.setFontSize(8);
    doc.text(DATA.channelLabel + "   ·   " + DATA.dateStr + "   ·   " + DATA.count + " productos", rx, 21, {align:"right"});
    doc.setDrawColor(192,57,43); doc.setLineWidth(0.6);
    doc.line(ML, 25, PW - MR, 25);
  }

  function drawFooter(doc, PW, PH, ML, MR, p, total){
    var y = PH - 8;
    doc.setDrawColor(230,230,230); doc.setLineWidth(0.2);
    doc.line(ML, y - 4, PW - MR, y - 4);
    doc.setTextColor(150,150,150); doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
    doc.text("VENEGE  |  Neumáticos y Suspensiones  |  Precios sujetos a cambio sin previo aviso", ML, y, {align:"left"});
    doc.text("Página " + p + " de " + total, PW - MR, y, {align:"right"});
  }

  function build(){
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
    var PW = doc.internal.pageSize.getWidth();   // 297
    var PH = doc.internal.pageSize.getHeight();  // 210
    var ML = 14, MR = 14, MB = 16;
    var usable = PW - ML - MR;                   // 269
    var nPrice = Math.max(1, DATA.headers.length - 2);
    var wMarca = usable * 0.16, wDesc = usable * 0.44, wPrice = (usable * 0.40) / nPrice;

    var colStyles = {
      0: { cellWidth: wMarca, halign:"left", fontStyle:"bold" },
      1: { cellWidth: wDesc, halign:"left" }
    };
    for (var i=0; i<nPrice; i++){ colStyles[2+i] = { cellWidth: wPrice, halign:"right" }; }

    var bodyTop = 27; // below the branded header + red rule (y=25)

    doc.autoTable({
      head: [DATA.headers],
      body: DATA.rows,
      startY: bodyTop,
      tableWidth: usable,
      margin: { left: ML, right: MR, top: bodyTop, bottom: MB },
      styles: { font:"helvetica", fontSize:8.5, cellPadding:{top:2,right:2.2,bottom:2,left:2.2},
                overflow:"linebreak", valign:"top", lineColor:[231,231,231], lineWidth:0.1, textColor:[26,26,31] },
      headStyles: { fillColor:[192,57,43], textColor:[255,255,255], fontSize:9, fontStyle:"bold", halign:"left", lineWidth:0 },
      columnStyles: colStyles,
      alternateRowStyles: { fillColor:[251,250,250] },
      rowPageBreak: "avoid",
      showHead: "everyPage"
    });

    var total = doc.getNumberOfPages();
    for (var p=1; p<=total; p++){
      doc.setPage(p);
      drawHeader(doc, PW, ML, MR);
      drawFooter(doc, PW, PH, ML, MR, p, total);
    }
    return doc;
  }

  function boot(){
    if (!(window.jspdf && window.jspdf.jsPDF)) { setTimeout(boot, 60); return; }
    try {
      var doc = build();
      window.__doc = doc;
      window.__download = function(){ doc.save(DATA.fileName); };
      window.__blob = function(){ return doc.output("blob"); };
      window.__base64 = function(){ var s = doc.output("datauristring"); return s.substring(s.indexOf(",") + 1); };
      var url = doc.output("bloburl");
      var pv = document.getElementById("pv");
      pv.src = url; pv.style.display = "block";
      document.getElementById("msg").style.display = "none";
      window.__ready = true;
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage("READY"); }
    } catch (e) {
      document.getElementById("msg").textContent = "No pudimos generar el PDF.";
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage("ERR:" + (e && e.message)); }
    }
  }
  boot();
</script>
</body></html>`;
}
