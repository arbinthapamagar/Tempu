import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Send, Upload, FileText, BookOpen, Trash2, MessageSquare } from '@/components/ui/icons'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/shared/EmptyState'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { knowledgeApi } from '../../api/knowledge.api'
import { useAuthStore, hasPermission } from '../../store/authStore'
import { Markdown } from '../../components/ai/Markdown'
import toast from 'react-hot-toast'

const ACCEPT = '.pdf,.docx,.txt,.md,.csv,.json'

export default function Ai() {
  const [tab, setTab] = useState('rag') // 'rag' | 'agentic'

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Tempu Ai"
        description="Ask the knowledge base or chat with the agent. Powered by your Tempu knowledge base."
      />

      {/* Section switcher */}
      <div className="flex gap-1.5 mb-5">
        {[
          { key: 'rag', label: 'Tempu Rag', icon: Sparkles },
          { key: 'agentic', label: 'Tempu Ai', icon: MessageSquare },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
              (tab === t.key ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')
            }
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'rag' ? <RagSection /> : <AgenticSection />}
    </div>
  )
}

// ── RAG: ask the knowledge base (all admins) + manage documents (superadmin /
// manageKnowledge only) ──────────────────────────────────────────────────────
function RagSection() {
  const admin = useAuthStore((s) => s.admin)
  const canManage = hasPermission(admin, 'manageKnowledge') // superadmin auto-passes
  const qc = useQueryClient()

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)

  const runAsk = useMutation({
    mutationFn: () => knowledgeApi.ask(question.trim()),
    onSuccess: (res) => setAnswer(res?.data || null),
    onError: (e) => toast.error(e?.message || 'Could not get an answer. Is the AI service running?'),
  })

  const submitAsk = (e) => {
    e.preventDefault()
    if (!question.trim()) return
    runAsk.mutate()
  }

  return (
    <div className="space-y-5">
      {/* Ask — available to every admin */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
          <Sparkles className="h-4 w-4 text-orange-500" /> Tempu Rag — ask the knowledge base
        </h2>
        <form onSubmit={submitAsk} className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              placeholder="Ask a question about policies, fares, documents…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <Button type="submit" icon={Send} loading={runAsk.isPending} disabled={!question.trim()}>
            Ask
          </Button>
        </form>

        {answer && (
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <div className="text-sm text-gray-800">
              <Markdown>{answer.answer}</Markdown>
            </div>
            {answer.sources?.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">Sources: {answer.sources.join(', ')}</p>
            )}
          </div>
        )}
      </section>

      {/* Document management — superadmin / manageKnowledge only */}
      {canManage && <RagDocuments qc={qc} />}
    </div>
  )
}

function RagDocuments({ qc }) {
  const fileRef = useRef(null)
  const [files, setFiles] = useState([])
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [toDelete, setToDelete] = useState(null)

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

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Upload documents */}
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

        {/* Paste text */}
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

      {/* Sources */}
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
    </>
  )
}

const AGENTIC_SUGGESTIONS = [
  'What can you do?',
  'How many unanswered support tickets, and what are they about?',
  'Who is our least-rated driver?',
  'Give me the platform stats',
]

// ── Agentic: a tool-calling chat over LIVE app data (users, drivers, trips,
// payments, etc.) — separate from the RAG knowledge base. Gated by the
// useAgenticAI permission since it can surface personal data. Styled as a
// plain, document-like conversation (Claude-style) rather than chat bubbles:
// assistant turns are markdown prose with no box; user turns are a subtle
// right-aligned pill. ────────────────────────────────────────────────────────
function AgenticSection() {
  const admin = useAuthStore((s) => s.admin)
  const canUse = hasPermission(admin, 'useAgenticAI')

  const [messages, setMessages] = useState([]) // { role: 'user' | 'model', text }
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = useMutation({
    // History is everything already exchanged; the new message is sent separately.
    mutationFn: ({ text, history }) => knowledgeApi.agenticChat(text, history),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: 'model', text: res?.data?.reply || '…' }])
    },
    onError: (e) => {
      toast.error(e?.message || 'Chat failed. Is the AI service running?')
      // Drop the optimistic user turn so they can retry.
      setMessages((prev) => prev.slice(0, -1))
    },
  })

  if (!canUse) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 p-10">
        <EmptyState
          icon={MessageSquare}
          title="No access to Tempu Ai"
          description="Ask a superadmin to grant you the “Use Agentic AI” permission to query live app data through chat."
        />
      </section>
    )
  }

  const sendMessage = (text) => {
    const trimmed = text.trim()
    if (!trimmed || send.isPending) return
    const history = messages.map((m) => ({ role: m.role, text: m.text }))
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    send.mutate({ text: trimmed, history })
  }

  const submit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const autoGrow = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: '75vh' }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 shrink-0">
        <MessageSquare className="h-4 w-4 text-orange-500" />
        <h2 className="text-sm font-semibold text-gray-900">Tempu Ai</h2>
        <span className="ml-auto text-[11px] text-gray-400">Queries live app data — users, drivers, trips, payments</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <Sparkles className="h-7 w-7 text-orange-300 mb-3" />
              <p className="text-base font-semibold text-gray-900">How can Tempu Ai help?</p>
              <p className="text-sm text-gray-400 mt-1 mb-5">Ask about any user, driver, trip, or platform stat.</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {AGENTIC_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-900 whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="text-sm text-gray-800">
                    <Markdown>{m.text}</Markdown>
                  </div>
                )
              )}
              {send.isPending && (
                <div className="flex items-center gap-1.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 p-4 shrink-0">
        <form onSubmit={submit} className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl border border-gray-300 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400 bg-white shadow-sm transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={autoGrow}
              onKeyDown={onInputKeyDown}
              placeholder="Message Tempu Ai…"
              className="w-full resize-none bg-transparent rounded-2xl pl-4 pr-12 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
              style={{ maxHeight: 200 }}
            />
            <button
              type="submit"
              disabled={!input.trim() || send.isPending}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white grid place-items-center transition-colors"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-2">
            Tempu Ai can make mistakes. Verify important details before acting on them.
          </p>
        </form>
      </div>
    </section>
  )
}
