import { api } from './client'

// Knowledge Base (RAG) admin endpoints. Ported from the BOT project's rag/.
export const knowledgeApi = {
  sources: () => api.get('/admin/knowledge/sources'),
  // files: a FileList / array of File. Sent as multipart under `files`.
  ingest: (files) => {
    const fd = new FormData()
    Array.from(files).forEach((f) => fd.append('files', f))
    return api.post('/admin/knowledge/ingest', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  ingestText: (text, label) => api.post('/admin/knowledge/text', { text, label }),
  search: (query, k) => api.post('/admin/knowledge/search', { query, k }),
  ask: (question, k) => api.post('/admin/knowledge/ask', { question, k }),
  chat: (message, history) => api.post('/admin/knowledge/chat', { message, history }),
  removeSource: (source) => api.delete(`/admin/knowledge/sources/${encodeURIComponent(source)}`),
  // Agentic AI — tool-calling agent over LIVE app data (users, drivers, trips,
  // payments, etc.), gated by the separate useAgenticAI permission.
  agenticChat: (message, history) => api.post('/admin/agentic/chat', { message, history }),
}
