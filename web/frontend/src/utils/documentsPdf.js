import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { docTypeLabel, isPdfDoc, sortDocs } from './documents'

// Bundle one driver's documents into a single PDF: a cover page with the
// driver/vehicle details and a checklist, then every document — images placed
// on an A4 page under a heading, PDF uploads appended page by page.

const A4 = [595.28, 841.89]
const MARGIN = 40

// Any browser-decodable image (incl. webp) → JPEG bytes pdf-lib can embed.
async function toJpeg(blob) {
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0)
  const out = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
  return new Uint8Array(await out.arrayBuffer())
}

// The standard PDF fonts only cover Latin-1 (WinAnsi); anything else (e.g. a
// name typed in Devanagari) would make pdf-lib throw, so replace it.
const safe = (t) => String(t ?? '-').replace(/[^\x20-\x7E\u00A0-\u00FF•–—]/g, '?')

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')

export async function buildDriverDocumentsPdf(group) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const driver = group.driver || {}
  const user = driver.userId || {}
  const docs = sortDocs(group.documents)
  const ink = rgb(0.1, 0.1, 0.1)
  const muted = rgb(0.45, 0.45, 0.45)

  // ── Cover ────────────────────────────────────────────────────────────────
  const cover = pdf.addPage(A4)
  let y = A4[1] - MARGIN - 10
  const line = (text, { f = font, size = 11, color = ink, gap = 18 } = {}) => {
    cover.drawText(safe(text), { x: MARGIN, y, size, font: f, color })
    y -= gap
  }
  line('Tempu — Driver documents', { f: bold, size: 20, gap: 30 })
  line(user.name || 'Driver', { f: bold, size: 15, gap: 20 })
  line(`Phone: ${user.phone || '-'}    Email: ${user.email || '-'}`, { color: muted })
  line(`Vehicle: ${driver.vehicleType || '-'}  ·  Plate: ${driver.vehiclePlate || '-'}  ·  ${[driver.vehicleModel, driver.vehicleColor].filter(Boolean).join(', ') || ''}`, { color: muted })
  line(`Licence no: ${driver.licenseNumber || '-'}    Expires: ${fmt(driver.licenseExpiry)}`, { color: muted })
  line(`Application status: ${driver.status || '-'}    Generated: ${fmt(new Date())}`, { color: muted, gap: 30 })
  line('Documents', { f: bold, size: 13, gap: 20 })
  for (const d of docs) {
    line(`•  ${docTypeLabel(d.type)}  —  ${d.status}${isPdfDoc(d) ? '  (PDF)' : ''}  ·  uploaded ${fmt(d.updatedAt || d.createdAt)}`, { gap: 16 })
  }

  // ── One section per document ─────────────────────────────────────────────
  for (const d of docs) {
    const title = `${docTypeLabel(d.type)}  ·  ${d.status}`
    try {
      const blob = await (await fetch(d.fileUrl)).blob()
      if (isPdfDoc(d) || blob.type === 'application/pdf') {
        const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
        const pages = await pdf.copyPages(src, src.getPageIndices())
        pages.forEach((pg, i) => {
          pdf.addPage(pg)
          if (i === 0) pg.drawText(safe(title), { x: 20, y: pg.getHeight() - 20, size: 10, font: bold, color: rgb(0.8, 0.3, 0) })
        })
        continue
      }
      const img = await pdf.embedJpg(await toJpeg(blob))
      const page = pdf.addPage(A4)
      page.drawText(safe(title), { x: MARGIN, y: A4[1] - MARGIN, size: 14, font: bold, color: ink })
      const maxW = A4[0] - MARGIN * 2
      const maxH = A4[1] - MARGIN * 2 - 30
      const scale = Math.min(maxW / img.width, maxH / img.height, 1)
      const w = img.width * scale
      const h = img.height * scale
      page.drawImage(img, { x: (A4[0] - w) / 2, y: A4[1] - MARGIN - 30 - h, width: w, height: h })
    } catch {
      const page = pdf.addPage(A4)
      page.drawText(safe(title), { x: MARGIN, y: A4[1] - MARGIN, size: 14, font: bold, color: ink })
      page.drawText('This file could not be included. Open it from the admin panel:', { x: MARGIN, y: A4[1] - MARGIN - 30, size: 11, font, color: muted })
      page.drawText(safe(d.fileUrl), { x: MARGIN, y: A4[1] - MARGIN - 48, size: 8, font, color: muted })
    }
  }

  return pdf.save()
}

export async function downloadDriverDocumentsPdf(group) {
  const bytes = await buildDriverDocumentsPdf(group)
  const name = (group.driver?.userId?.name || 'driver').replace(/[^\w-]+/g, '_')
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-documents.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
