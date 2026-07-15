import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
}

export function Markdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children || ''}
    </ReactMarkdown>
  )
}
