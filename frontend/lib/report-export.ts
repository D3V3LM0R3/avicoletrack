import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function exportPdfFile(title: string, headers: string[], rows: unknown[][]) {
  const tableRows = rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('');
  const html = `<html><body><h1>${escapeHtml(title)}</h1><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table><style>body{font-family:Arial;color:#222}table{border-collapse:collapse;width:100%;font-size:9px}th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}th{background:#e8f3e8}</style></body></html>`;
  const result = await Print.printToFileAsync({ html });
  if (!result?.uri) throw new Error('Le fichier PDF n’a pas été créé.');
  await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: `Exporter ${title}` });
}

export async function exportExcelFile(sheetName: string, filename: string, headers: string[], rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName);
  const workbookBase64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const uri = `${FileSystem.cacheDirectory}${filename}-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, workbookBase64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: `Exporter ${sheetName}` });
}
