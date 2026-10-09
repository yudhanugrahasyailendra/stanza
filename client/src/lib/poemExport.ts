export type ExportPoem = { title: string; content: string; authorName: string; username: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function printPoemAsPdf(poem: ExportPoem) {
  const printWindow = window.open("", "_blank", "width=900,height=720");
  if (!printWindow) {
    window.alert("Izinkan jendela cetak untuk menyimpan puisi sebagai PDF.");
    return;
  }
  const body = escapeHtml(poem.content);
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(poem.title)} — Stanza</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"><style>@page{size:A4;margin:24mm}*{box-sizing:border-box}body{color:#302f2a;font-family:'Cormorant Garamond',Georgia,serif;padding:36px 20px}main{max-width:620px;margin:12vh auto 0}h1{font-size:34px;font-weight:500;margin:0 0 24px}.poem{white-space:pre-wrap;font-size:21px;line-height:1.7}.by{font:13px 'DM Sans',sans-serif;color:#77756c;margin:0 0 36px}.watermark{position:fixed;bottom:0;border-top:1px solid #e2dfd4;padding-top:14px;width:100%;font:11px 'DM Sans',sans-serif;color:#77756c;letter-spacing:.04em}@media print{body{padding:0}}</style></head><body><main><h1>${escapeHtml(poem.title)}</h1><p class="by">${escapeHtml(poem.authorName)} · @${escapeHtml(poem.username)}</p><div class="poem">${body}</div></main><div class="watermark">Dibuat di Stanza oleh @${escapeHtml(poem.username)}</div><script>setTimeout(()=>{window.focus();window.print()},500)</script></body></html>`);
  printWindow.document.close();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; }
      else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

export async function buildQuoteCard(poem: ExportPoem): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Peramban tidak dapat membuat kartu gambar.");
  ctx.fillStyle = "#f4f1e8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#617257";
  ctx.fillRect(82, 90, 48, 4);
  ctx.fillStyle = "#474b40";
  ctx.font = "500 30px 'DM Sans', sans-serif";
  ctx.fillText("stanza", 82, 160);
  ctx.fillStyle = "#77766b";
  ctx.font = "400 19px 'DM Sans', sans-serif";
  ctx.fillText("PUISI UNTUK DIBACA PELAN-PELAN", 82, 222);
  ctx.fillStyle = "#35342e";
  ctx.font = "500 68px 'Cormorant Garamond', Georgia, serif";
  const titleLines = wrapText(ctx, poem.title, 850).slice(0, 2);
  let y = 350;
  for (const line of titleLines) { ctx.fillText(line, 82, y); y += 78; }
  ctx.fillStyle = "#617257";
  ctx.fillRect(82, y + 20, 36, 2);
  ctx.fillStyle = "#3d3c35";
  ctx.font = "400 43px 'Cormorant Garamond', Georgia, serif";
  const fullLines = wrapText(ctx, poem.content, 850);
  const lines = fullLines.slice(0, 7);
  if (fullLines.length > lines.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]} …`;
  y += 106;
  for (const line of lines) { if (line) ctx.fillText(line, 82, y); y += 56; }
  ctx.fillStyle = "#737166";
  ctx.font = "400 22px 'DM Sans', sans-serif";
  ctx.fillText(`${poem.authorName}  ·  @${poem.username}`, 82, 1110);
  ctx.strokeStyle = "#ddd9cd";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(82, 1170); ctx.lineTo(998, 1170); ctx.stroke();
  ctx.fillStyle = "#77766b";
  ctx.font = "400 19px 'DM Sans', sans-serif";
  ctx.fillText(`Dibuat di Stanza oleh @${poem.username}`, 82, 1220);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Kartu gagal dibuat.")), "image/png"));
}

export async function downloadQuoteCard(poem: ExportPoem) {
  const blob = await buildQuoteCard(poem);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stanza-${poem.username}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
