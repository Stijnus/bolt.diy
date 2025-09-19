export function rowsToCSV<T extends Record<string, any>>(rows: T[], headers?: string[]): string {
  if (!rows.length) {
    return '';
  }

  const cols = headers && headers.length ? headers : Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) {
      return '';
    }

    const s = String(v).replace(/"/g, '""');

    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s + '"';
    }

    return s;
  };
  const head = cols.join(',');
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(',')).join('\n');

  return head + '\n' + body;
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
