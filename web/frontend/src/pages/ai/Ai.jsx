import { MessageSquare } from '@/components/ui/icons'
import { PageHeader } from '../../components/shared/PageHeader'
import { EmptyState } from '../../components/shared/EmptyState'
import { ChatPanel } from '../../components/ai/ChatPanel'
import { knowledgeApi } from '../../api/knowledge.api'
import { useAuthStore, hasPermission } from '../../store/authStore'
import agentLogo from '@/assets/agent-logo.png'

// Tempu Ai — a tool-calling chat over LIVE app data. The knowledge base (Tempu
// Rag) lives on its own page (/knowledge); this page is purely the agent.
export default function Ai() {
  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        sticky
        title={
          <span className="inline-flex items-center gap-3">
            <img
              src={agentLogo}
              alt="Tempu Ai"
              className="h-16 w-16 rounded-full object-cover bg-white ring-2 ring-orange-200 p-0.5"
            />
            <span className="text-2xl sm:text-3xl w-40 text-left">AGENT</span>
          </span>
        }
      />
      <AgenticSection />
    </div>
  )
}

const AGENTIC_SUGGESTIONS = [
  'What can you do?',
  'How many unanswered support tickets, and what are they about?',
  'Who is our least-rated driver?',
  'Give me the platform stats',
]

// ── Agentic: a tool-calling chat over LIVE app data. Gated by the useAgenticAI
// permission since it can surface personal data. ─────────────────────────────
function AgenticSection() {
  const admin = useAuthStore((s) => s.admin)
  const canUse = hasPermission(admin, 'useAgenticAI')

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

  return (
    <ChatPanel
      icon={MessageSquare}
      title="Chat"
      emptyTitle="How can Tempu Ai help?"
      emptyHint="Ask about any user, driver, trip, or platform stat."
      suggestions={AGENTIC_SUGGESTIONS}
      placeholder="Message Tempu Ai… or attach an image"
      sendFn={(text, history, image) => knowledgeApi.agenticChat(text, history, image)}
      allowImage
      storageKey={`tempu-agentic-chat:${admin?._id || 'anon'}`}
    />
  )
}
