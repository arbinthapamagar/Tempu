// Build a CSV from a list of columns + rows and trigger a browser download.
// CSV opens directly in Excel; we prepend a UTF-8 BOM so accented names and the
// ₹/Rs symbols render correctly. Each column is { label, value(row) }.
export function exportToCsv(filename, columns, rows) {
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const lines = [columns.map((c) => escape(c.label)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escape(c.value(row))).join(','))
  }

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// `users-2026-06-22` style suffix for export filenames.
export function dateStamp() {
  return new Date().toISOString().slice(0, 10)
}
