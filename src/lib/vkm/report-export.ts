// Generic Excel / PDF export for admin Reports — one builder shared by every
// report type (individual / batch / coach / mentor) so styling stays
// consistent and each report only has to describe its own data shape.
export type ReportExportSpec = {
  title: string;
  subtitle: string;
  meta: { label: string; value: string }[];
  kpis: { label: string; value: string | number }[];
  tables: { title: string; columns: string[]; rows: (string | number)[][] }[];
};

const NAVY_ARGB = "FF0B2545";
const GOLD_ARGB = "FFC9A227";

export async function exportReportExcel(spec: ReportExportSpec, filename: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  // Summary sheet: title, meta, KPIs.
  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ width: 26 }, { width: 30 }];
  sum.mergeCells("A1:B1");
  const titleCell = sum.getCell("A1");
  titleCell.value = spec.title;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_ARGB } };
  titleCell.alignment = { vertical: "middle" };
  sum.getRow(1).height = 30;
  sum.mergeCells("A2:B2");
  sum.getCell("A2").value = spec.subtitle;
  sum.getCell("A2").font = { italic: true, color: { argb: "FF667085" } };

  let r = 4;
  for (const m of spec.meta) {
    sum.getCell(`A${r}`).value = m.label;
    sum.getCell(`A${r}`).font = { bold: true };
    sum.getCell(`B${r}`).value = m.value;
    r++;
  }
  r += 1;
  sum.getCell(`A${r}`).value = "KPI";
  sum.getCell(`B${r}`).value = "Value";
  sum.getRow(r).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sum.getRow(r).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_ARGB } };
  r++;
  for (const k of spec.kpis) {
    sum.getCell(`A${r}`).value = k.label;
    sum.getCell(`B${r}`).value = k.value;
    r++;
  }

  // One sheet per data table.
  for (const t of spec.tables) {
    const ws = wb.addWorksheet(t.title.slice(0, 31));
    ws.columns = t.columns.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 4) }));
    const head = ws.getRow(1);
    head.height = 24;
    head.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_ARGB } };
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = { bottom: { style: "thin", color: { argb: GOLD_ARGB } } };
    });
    t.rows.forEach((row) => ws.addRow(row));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}

export async function exportReportPdf(spec: ReportExportSpec, filename: string) {
  const { default: jsPDF } = await import("jspdf");
  const mod = await import("jspdf-autotable");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTableFn = (mod as any).default ?? (mod as any).autoTable;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
  const pageW = doc.internal.pageSize.getWidth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runTable = (opts: any) =>
    typeof autoTableFn === "function"
      ? autoTableFn(doc, opts)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).autoTable(opts);

  // Title bar
  doc.setFillColor(11, 37, 69);
  doc.rect(0, 0, pageW, 58, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(spec.title, 40, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(210, 214, 222);
  doc.text(spec.subtitle, 40, 44);
  doc.setTextColor(201, 162, 39);
  doc.setFont("helvetica", "bold");
  doc.text("VK MENTORSHIP", pageW - 40, 28, { align: "right" });

  let y = 76;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 80, 96);
  doc.text(spec.meta.map((m) => `${m.label}: ${m.value}`).join("   ·   "), 40, y);
  y += 18;

  // KPI row
  const kpiCols = Math.min(spec.kpis.length, 6);
  const kpiW = (pageW - 80) / Math.max(1, kpiCols);
  spec.kpis.forEach((k, i) => {
    const col = i % kpiCols;
    const row = Math.floor(i / kpiCols);
    const x = 40 + col * kpiW;
    const ky = y + row * 46;
    doc.setFillColor(248, 246, 240);
    doc.roundedRect(x, ky, kpiW - 8, 38, 6, 6, "F");
    doc.setTextColor(11, 37, 69);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(k.value), x + 10, ky + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 128, 140);
    doc.text(k.label.toUpperCase(), x + 10, ky + 30);
  });
  y += Math.ceil(spec.kpis.length / kpiCols) * 46 + 10;

  for (const t of spec.tables) {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = 40;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(11, 37, 69);
    doc.text(t.title, 40, y);
    runTable({
      startY: y + 8,
      head: [t.columns],
      body: t.rows,
      styles: { fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [11, 37, 69], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 246, 240] },
      margin: { left: 40, right: 40 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 24;
  }

  doc.save(`${filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
