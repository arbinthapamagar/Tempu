import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, X, Zap } from '@/components/ui/icons'
import { cn } from '../utils/cn'
import { knowledgeApi } from '../api/knowledge.api'
import { useAuthStore, hasPermission } from '../store/authStore'

// Floating, RAG-powered AI assistant for the admin. Answers strictly from the
// Knowledge Base (see pages/knowledge/KnowledgeBase.jsx) via Ollama. Only shown
// to admins who can manage the knowledge base.
const GREETING = "Hi! 👋 I'm the Tempu Assistant. Ask me anything covered in your knowledge base."

const SUGGESTIONS = [
  'What is our refund policy?',
  'How do driver payouts work?',
  'What are the support hours?',
]

export default function AssistantWidget() {
  const { admin } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'model', text: GREETING }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Gate: only admins with knowledge-base access get the assistant.
  if (!hasPermission(admin, 'manageKnowledge')) return null

  const send = async (text) => {
    const message = (text ?? input).trim()
    if (!message || loading) return
    setInput('')
    const history = messages.filter((m) => m.text !== GREETING)
    setMessages((m) => [...m, { role: 'user', text: message }])
    setLoading(true)
    try {
      const res = await knowledgeApi.chat(message, history)
      const { reply, sources } = res?.data || {}
      setMessages((m) => [...m, { role: 'model', text: reply || 'No response.', sources }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'model', text: e?.message || 'Something went wrong. Is the AI service running?' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const onlyGreeting = messages.length === 1

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-orange-600 text-white shadow-lg hover:bg-orange-700 grid place-items-center transition-colors"
          title="Tempu Assistant"
          aria-label="Open assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(92vw,380px)] h-[min(80vh,560px)] flex flex-col rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-orange-600 text-white">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Tempu Assistant</p>
              <p className="text-[11px] text-white/80 leading-tight">Answers from your knowledge base</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto p-1 rounded hover:bg-white/20" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-orange-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                  )}
                >
                  {m.text}
                  {m.sources?.length > 0 && (
                    <p className="mt-1.5 text-[10px] text-gray-400">Sources: {m.sources.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}

            {onlyGreeting && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-gray-100 flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a question…"
              className="flex-1 resize-none max-h-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="shrink-0 h-9 w-9 grid place-items-center rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
