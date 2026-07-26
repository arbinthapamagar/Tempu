import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../../api/client'

// Screenshots pulled out of ingested documents (see rag-service/images.py).
// They're behind admin auth and the app authenticates with a Bearer token from
// localStorage, which a plain <img src> can't send — so fetch the bytes through
// the authed client and render an object URL instead.
const KB_IMAGE_PREFIX = '/admin/knowledge/images/'

function KbImage({ src, alt }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl
    let cancelled = false
    api
      .get(src, { responseType: 'blob' })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  // A model that invented a path shouldn't leave a broken-image icon mid-answer.
  if (failed) return null
  if (!url) return <span className="block h-32 mb-3 rounded-lg bg-gray-100 animate-pulse" />
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt || 'Screenshot'} className="max-w-full h-auto rounded-lg border border-gray-200 mb-3" />
    </a>
  )
}

// Minimal, Claude-style markdown rendering for AI responses — no bubble
// chrome, just well-spaced readable prose. No Tailwind Typography plugin
// dependency; every element is styled directly via `components`.
const components = {
  p: ({ children }) => <p className="leading-relaxed mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-orange-600 underline hover:text-orange-700">
      {children}
    </a>
  ),
  h1: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-600 mb-3">{children}</blockquote>
  ),
  code: ({ inline, className, children }) =>
    inline ? (
      <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[0.85em] font-mono text-gray-800">{children}</code>
    ) : (
      <code className={className}>{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mb-3 rounded-lg bg-gray-900 text-gray-100 text-[0.85em] p-3 overflow-x-auto font-mono">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="text-sm border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left bg-gray-50 font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
  img: ({ src, alt }) =>
    src?.startsWith(KB_IMAGE_PREFIX) ? (
      <KbImage src={src} alt={alt} />
    ) : (
      <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg border border-gray-200 mb-3" />
    ),
}

export function Markdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children || ''}
    </ReactMarkdown>
  )
}
