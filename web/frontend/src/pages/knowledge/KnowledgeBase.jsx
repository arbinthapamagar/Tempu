import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Upload, FileText, Trash2, Search, Sparkles, Send } from '@/components/ui/icons'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/shared/EmptyState'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { ChatPanel } from '../../components/ai/ChatPanel'
import { knowledgeApi } from '../../api/knowledge.api'
import { useAuthStore } from '../../store/authStore'
import ragLogo from '@/assets/rag-logo.png'
import toast from 'react-hot-toast'

const ACCEPT = '.pdf,.docx,.txt,.md,.csv,.json'

const RAG_SUGGESTIONS = [
  'What are the fare and pricing rules?',
  'How does a driver get verified?',
  'What is the cancellation policy?',
]

export default function KnowledgeBase() {
  const qc = useQueryClient()
  const admin = useAuthStore((s) => s.admin)
  const fileRef = useRef(null)
  const [files, setFiles] = useState([])
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [toDelete, setToDelete] = useState(null)

  // Test panel
  const [mode, setMode] = useState('retrieve') // 'retrieve' | 'ask'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [answer, setAnswer] = useState(null)

  const { data: srcRes, isLoading } = useQuery({
    queryKey: ['knowledge-sources'],
    queryFn: () => knowledgeApi.sources(),
  })
  const sources = srcRes?.data?.sources || []
  const embedModel = srcRes?.data?.embedModel

  const refresh = () => qc.invalidateQueries({ queryKey: ['knowledge-sources'] })

  const ingestFiles = useMutation({
    mutationFn: () => knowledgeApi.ingest(files),
    onSuccess: (res) => {
      toast.success(res?.message || 'Documents ingested')
      setFiles([])
      if (fileRef.current) fileRef.current.value = ''
      refresh()
    },
    onError: (e) => toast.error(e?.message || 'Ingestion failed'),
  })

  const ingestText = useMutation({
    mutationFn: () => knowledgeApi.ingestText(text, label),
    onSuccess: (res) => {
      toast.success(res?.message || 'Text ingested')
      setText('')
      setLabel('')
      refresh()
    },
    onError: (e) => toast.error(e?.message || 'Ingestion failed'),
  })

  const removeSource = useMutation({
    mutationFn: (source) => knowledgeApi.removeSource(source),
    onSuccess: (res) => {
      toast.success(res?.message || 'Source deleted')
      setToDelete(null)
      refresh()
    },
    onError: (e) => toast.error(e?.message || 'Delete failed'),
  })

  const runQuery = useMutation({
    mutationFn: () => (mode === 'ask' ? knowledgeApi.ask(query) : knowledgeApi.search(query)),
    onSuccess: (res) => {
      if (mode === 'ask') {
        setAnswer(res?.data || null)
        setResults(null)
      } else {
        setResults(res?.data?.results || [])
        setAnswer(null)
      }
    },
    onError: (e) => toast.error(e?.message || 'Query failed. Is Ollama running?'),
  })

  const submitQuery = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    runQuery.mutate()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={
          <span className="flex flex-col items-center gap-2">
            <img src={ragLogo} alt="Tempu Rag" className="h-64 w-64 rounded-xl object-contain" />
            Tempu Rag
          </span>
        }
        description="Documents the AI assistant can answer from (retrieval-augmented). Powered by Ollama embeddings."
      />

      {/* ── Chat with the knowledge base (multi-turn, saved to this browser) ── */}
      <div className="mb-5">
        <ChatPanel
          icon={Sparkles}
          title="Chat with Tempu Rag"
          subtitle="Answers from your Tempu knowledge base"
          emptyTitle="Ask Tempu Rag"
          emptyHint="Ask about policies, fares, documents, or help articles."
          suggestions={RAG_SUGGESTIONS}
          placeholder="Ask about policies, fares, documents… or attach an image"
          footerNote="Tempu Rag answers from your knowledge base and can understand attached images. This chat is saved on this device."
          sendFn={(text, history, image) => knowledgeApi.chat(text, history, image)}
          showSources
          allowImage
          storageKey={`tempu-rag-chat:${admin?._id || 'anon'}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Upload documents ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <Upload className="h-4 w-4 text-orange-500" /> Upload documents
          </h2>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-700 file:text-sm file:font-medium hover:file:bg-orange-100 cursor-pointer"
          />
          <p className="mt-2 text-xs text-gray-400">PDF, DOCX, TXT, MD, CSV, JSON — up to 10 files.</p>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-2 truncate">
                  <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </li>
              ))}
            </ul>
          )}
          <Button
            className="mt-4 w-full"
            icon={Upload}
            loading={ingestFiles.isPending}
            disabled={!files.length}
            onClick={() => ingestFiles.mutate()}
          >
            Ingest {files.length ? `${files.length} file(s)` : 'documents'}
          </Button>
        </section>

        {/* ── Paste text ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
            <FileText className="h-4 w-4 text-orange-500" /> Paste text
          </h2>
          <Input
            label="Label (optional)"
            placeholder="e.g. Refund Policy"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Textarea
            label="Content"
            rows={5}
            placeholder="Paste policies, FAQs, or any reference text…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-3"
          />
          <Button
            className="mt-4 w-full"
            icon={FileText}
            loading={ingestText.isPending}
            disabled={!text.trim()}
            onClick={() => ingestText.mutate()}
          >
            Ingest text
          </Button>
        </section>
      </div>

      {/* ── Test / Ask panel ── */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-orange-500" /> Test the knowledge base
          </h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            {['retrieve', 'ask'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResults(null); setAnswer(null) }}
                className={
                  'px-3 py-1.5 font-medium capitalize ' +
                  (mode === m ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')
                }
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={submitQuery} className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              placeholder={mode === 'ask' ? 'Ask a question…' : 'Search the knowledge base…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            icon={mode === 'ask' ? Send : Search}
            loading={runQuery.isPending}
            disabled={!query.trim()}
          >
            {mode === 'ask' ? 'Ask' : 'Search'}
          </Button>
        </form>

        {answer && (
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{answer.answer}</p>
            {answer.sources?.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">Sources: {answer.sources.join(', ')}</p>
            )}
          </div>
        )}

        {results && (
          results.length ? (
            <ul className="mt-4 space-y-2">
              {results.map((r, i) => (
                <li key={`${r.source}-${r.chunkIndex}`} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span className="font-medium text-gray-600">[{i + 1}] {r.source}</span>
                    <span>score {r.score.toFixed(3)}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-4">{r.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-400">No relevant chunks found.</p>
          )
        )}
      </section>

      {/* ── Sources ── */}
      <section className="bg-white rounded-xl border border-gray-200 mt-5">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <BookOpen className="h-4 w-4 text-orange-500" />
          <h2 className="text-sm font-semibold text-gray-900">Ingested sources</h2>
          {embedModel && <span className="ml-auto text-xs text-gray-400">embed: {embedModel}</span>}
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : sources.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No documents yet"
            description="Upload files or paste text above to build the assistant's knowledge base."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Source</th>
                <th className="px-5 py-2 font-medium">Chunks</th>
                <th className="px-5 py-2 font-medium">Updated</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.source} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-800 font-medium flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate max-w-xs">{s.source}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{s.chunks}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setToDelete(s.source)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete source"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => removeSource.mutate(toDelete)}
        title="Delete source"
        message={`Remove "${toDelete}" and all its chunks from the knowledge base? This can't be undone.`}
        confirmLabel="Delete"
        loading={removeSource.isPending}
      />
    </div>
  )
}
