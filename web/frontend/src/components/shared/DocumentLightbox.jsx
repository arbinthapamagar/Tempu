import { Download } from '@/components/ui/icons'
import { isPdf, docTypeLabel, downloadUrl } from '../../utils/documents'

// Full-screen preview for a document. Renders PDFs in an <iframe> and images
// inline. `actions` is an optional node shown below the preview (e.g. verify /
// reject buttons).
export function DocumentLightbox({ doc, onClose, actions }) {
  if (!doc) return null
  const url = doc.fileUrl
  const title = docTypeLabel(doc.type)

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">{title}</h3>
          <div className="flex items-center gap-3">
            {url && (
              <a
                href={downloadUrl(url)}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white border border-white/30 hover:border-white/60 rounded-lg px-3 py-1.5 transition-colors"
                title="Download document"
              >
                <Download className="h-4 w-4" /> Download
              </a>
            )}
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>
        {url && isPdf(url) ? (
          <iframe src={url} title={title} className="w-full rounded-xl bg-white h-[75vh]" />
        ) : url ? (
          <img src={url} alt={title} className="w-full rounded-xl max-h-[80vh] object-contain" />
        ) : (
          <div className="bg-white/10 text-white/70 rounded-xl py-20 text-center">No file uploaded</div>
        )}
        {actions && <div className="mt-4">{actions}</div>}
      </div>
    </div>
  )
}
