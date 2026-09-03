import { jsPDF } from 'jspdf/dist/jspdf.es.min.js';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export async function exportPdfFile(title: string, headers: string[], rows: unknown[][]) {
  const document = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  document.setFontSize(16);
  document.text(title, 32, 34);
  document.setFontSize(9);
  document.text(`${rows.length} rapport(s) sélectionné(s)`, 32, 50);
  autoTable(document, {
    startY: 64,
    head: [headers],
    body: rows.map((row) => row.map((value) => String(value ?? '—'))),
    styles: { fontSize: 6, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [13, 99, 27] },
    margin: { left: 32, right: 32 },
  });
  downloadBlob(document.output('blob'), `${title.toLowerCase()}-${Date.now()}.pdf`);
}

export async function exportExcelFile(sheetName: string, filename: string, headers: string[], rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = headers.map((header) => ({ wch: Math.min(Math.max(String(header).length + 2, 12), 24) }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}-${Date.now()}.xlsx`);
}
