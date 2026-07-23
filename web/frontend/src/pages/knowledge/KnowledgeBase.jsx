import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Upload, FileText, Trash2, MessageSquare, Settings, Search, Edit, Save } from '@/components/ui/icons'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/shared/EmptyState'
import { ConfirmDialog } from '../../components/shared/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { ChatPanel } from '../../components/ai/ChatPanel'
import { knowledgeApi } from '../../api/knowledge.api'
import { useAuthStore } from '../../store/authStore'
import ragLogo from '@/assets/rag-logo.png'
import toast from 'react-hot-toast'

const ACCEPT = '.pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.gif'

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

  // Editing a pasted source: { source } while loading its text, then we fill
  // editText. editText === null means the editor is closed.
  const [editing, setEditing] = useState(null)
  const [editText, setEditText] = useState('')
  const [loadingEdit, setLoadingEdit] = useState(false)

  // Everything below the chat (upload / paste / retrieve / sources) lives in the
  // gear settings modal, so the page itself is just the chat.
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Retrieve (raw search) test — inside the settings modal.
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)

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

  // Open the editor for a pasted source: fetch its current text first.
  const openEditor = async (source) => {
    setEditing({ source })
    setLoadingEdit(true)
    try {
      const res = await knowledgeApi.sourceContent(source)
      setEditText(res?.data?.text || '')
    } catch (e) {
      toast.error(e?.message || 'Could not load source')
      setEditing(null)
    } finally {
      setLoadingEdit(false)
    }
  }

  const updateSource = useMutation({
    mutationFn: () => knowledgeApi.updateSource(editing.source, editText),
    onSuccess: (res) => {
      toast.success(res?.message || 'Source updated')
      setEditing(null)
      setEditText('')
      refresh()
    },
    onError: (e) => toast.error(e?.message || 'Update failed'),
  })

  const runSearch = useMutation({
    mutationFn: () => knowledgeApi.search(query),
    onSuccess: (res) => setResults(res?.data?.results || []),
    onError: (e) => toast.error(e?.message || 'Search failed. Is the RAG service running?'),
  })
  const submitSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    runSearch.mutate()
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        sticky
        title={
          <span className="inline-flex items-center gap-3">
            <img
              src={ragLogo}
              alt="Tempu Rag"
              className="h-16 w-16 rounded-full object-cover bg-white ring-2 ring-orange-200 p-0.5"
            />
            <span className="text-2xl sm:text-3xl w-40 text-left">RAG</span>
          </span>
        }
        actions={
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            title="Knowledge base settings"
            aria-label="Knowledge base settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        }
      />

      {/* ── Chat with the knowledge base (multi-turn, saved to this browser) ── */}
      <ChatPanel
        icon={MessageSquare}
        title="Chat"
        emptyTitle="Ask Tempu Rag"
        emptyHint="Ask about policies, fares, documents, or help articles."
        suggestions={RAG_SUGGESTIONS}
        placeholder="Ask about policies, fares, documents… or attach an image"
        sendFn={(msg, history, image) => knowledgeApi.chat(msg, history, image)}
        showSources
        allowImage
        storageKey={`tempu-rag-chat:${admin?._id || 'anon'}`}
      />

      {/* ── Settings: manage the knowledge base (gear button, top-right) ── */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Knowledge base" size="xl" align="right">
        <div className="space-y-8">
          {/* Upload documents & images */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
              <Upload className="h-4 w-4 text-orange-500" /> Upload documents &amp; images
            </h3>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-700 file:text-sm file:font-medium hover:file:bg-orange-100 cursor-pointer"
            />
            <p className="mt-2 text-xs text-gray-400">
              PDF, DOCX, TXT, MD, CSV, JSON, or images (PNG/JPG/WEBP…) — add as many as you like (up to 50 at once).
            </p>
            {files.length > 0 && (
              <ul className="mt-3 grid gap-1 text-sm text-gray-600 sm:grid-cols-2">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-2 truncate">
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button
              className="mt-4"
              icon={Upload}
              loading={ingestFiles.isPending}
              disabled={!files.length}
              onClick={() => ingestFiles.mutate()}
            >
              Ingest {files.length ? `${files.length} file(s)` : 'documents'}
            </Button>
          </section>

          {/* Paste text */}
          <section className="border-t border-gray-100 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
              <FileText className="h-4 w-4 text-orange-500" /> Paste text
            </h3>
            <Input
              label="Label (optional)"
              placeholder="e.g. Refund Policy"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Textarea
              label="Content"
              rows={16}
              placeholder="Paste policies, FAQs, or any reference text… (no length limit)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-3"
            />
            <Button
              className="mt-4"
              icon={FileText}
              loading={ingestText.isPending}
              disabled={!text.trim()}
              onClick={() => ingestText.mutate()}
            >
              Ingest text
            </Button>
          </section>

          {/* Retrieve (raw search) test */}
          <section className="border-t border-gray-100 pt-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
              <Search className="h-4 w-4 text-orange-500" /> Retrieve
            </h3>
            <form onSubmit={submitSearch} className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  placeholder="Search the knowledge base for matching chunks…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button type="submit" icon={Search} loading={runSearch.isPending} disabled={!query.trim()}>
                Search
              </Button>
            </form>
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

          {/* Ingested sources */}
          <section className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900">Ingested sources</h3>
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
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-1 font-medium">Source</th>
                      <th className="px-4 py-1 font-medium">Chunks</th>
                      <th className="px-4 py-1 font-medium">Updated</th>
                      <th className="px-4 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s) => (
                      <tr key={s.source} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-1 text-gray-800 font-medium flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate max-w-xs">{s.source}</span>
                        </td>
                        <td className="px-4 py-1 text-gray-500">{s.chunks}</td>
                        <td className="px-4 py-1 text-gray-500">
                          {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-1 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {s.kind === 'pasted' && (
                              <button
                                onClick={() => openEditor(s.source)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                title="Edit text"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setToDelete(s.source)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete source"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </Modal>

      {/* Edit a pasted source */}
      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setEditText('') }}
        title={editing ? `Edit “${editing.source}”` : 'Edit source'}
        size="xl"
        align="right"
      >
        {loadingEdit ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Saving replaces this source’s content in the knowledge base (its old chunks are removed and the edited text is re-embedded under the same name).
            </p>
            <Textarea
              label="Content"
              rows={18}
              placeholder="Edit the text…"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setEditing(null); setEditText('') }}>
                Cancel
              </Button>
              <Button
                icon={Save}
                loading={updateSource.isPending}
                disabled={!editText.trim()}
                onClick={() => updateSource.mutate()}
              >
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
