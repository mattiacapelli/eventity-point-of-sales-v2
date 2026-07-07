export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const headerLine = headers.map((h) => `"${h}"`).join(",");
  const bodyLines = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, "'")}"`).join(","));
  const blob = new Blob([[headerLine, ...bodyLines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
