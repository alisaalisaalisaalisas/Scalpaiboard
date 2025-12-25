import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ChevronDown, Loader2, Plus, Send, Settings2, Trash2, User } from 'lucide-react'

import { getAIProviders } from '../../services/api'
import { AIMessage } from '../../types'

const SESSIONS_STORAGE_KEY = 'scalpaiboard-ai-chat-sessions-v1'
const ACTIVE_SESSION_STORAGE_KEY = 'scalpaiboard-ai-chat-active-session-v1'
const MAX_MESSAGES_PER_SESSION = 200

type ProviderSummary = { id: number; providerName: string; modelName: string }

type ChatSession = {
  id: string
  title: string
  messages: AIMessage[]
  createdAt: string
  updatedAt: string
}

const buildWelcomeContent = (provider: ProviderSummary | null) => {
  if (provider) {
    return `👋 Hello! I'm your AI trading assistant powered by **${provider.providerName}** (${provider.modelName}).

I can help you with:

• **Finding coins** - "Find coins with >$100M volume and >5% change"
• **Technical analysis** - "Analyze BTC on 1h timeframe"
• **Creating alerts** - "Alert me when ETH drops below $2000"
• **Managing watchlist** - "Add top 5 gainers to my watchlist"

Open Settings (top-right) to change provider/model.`
  }

  return `👋 Hello! I'm your AI trading assistant. I can help you with:

• **Finding coins** - "Find coins with >$100M volume and >5% change"
• **Technical analysis** - "Analyze BTC on 1h timeframe"
• **Creating alerts** - "Alert me when ETH drops below $2000"
• **Managing watchlist** - "Add top 5 gainers to my watchlist"
• **Pattern detection** - "Show me coins forming bullish patterns"

Configure your AI provider in Settings to enable full functionality.`
}

const createWelcomeMessage = (provider: ProviderSummary | null): AIMessage => {
  return {
    id: Date.now(),
    role: 'assistant',
    content: buildWelcomeContent(provider),
    createdAt: new Date().toISOString(),
  }
}

const createNewSession = (provider: ProviderSummary | null): ChatSession => {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  const now = new Date().toISOString()
  return {
    id,
    title: 'New chat',
    messages: [createWelcomeMessage(provider)],
    createdAt: now,
    updatedAt: now,
  }
}

const clampSessions = (sessions: ChatSession[]) => {
  return sessions.map((s) => ({
    ...s,
    messages: s.messages.slice(-MAX_MESSAGES_PER_SESSION),
  }))
}

type ChatInterfaceProps = {
  onClose?: () => void
}


export default function ChatInterface({ onClose }: ChatInterfaceProps) {
  const navigate = useNavigate()


  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [hasProvider, setHasProvider] = useState(false)
  const [activeProvider, setActiveProvider] = useState<ProviderSummary | null>(null)

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatSession[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          return clampSessions(parsed)
        }
      } catch {
        // ignore
      }
    }
    return [createNewSession(null)]
  })

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || ''
  })

  useEffect(() => {
    if (sessions.length === 0) {
      const session = createNewSession(activeProvider)
      setSessions([session])
      setActiveSessionId(session.id)
      return
    }

    if (!activeSessionId) {
      setActiveSessionId(sessions[0].id)
      return
    }

    if (!sessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id)
    }
  }, [activeProvider, activeSessionId, sessions])

  useEffect(() => {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId)
    }
  }, [activeSessionId, sessions])

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0]
  const messages = activeSession?.messages || []

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const updateActiveSession = (updater: (session: ChatSession) => ChatSession) => {
    if (!activeSession) return

    setSessions((prev) => {
      const next = prev.map((s) => (s.id === activeSession.id ? updater(s) : s))
      return clampSessions(next)
    })
  }

  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false)
  const sessionMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSessionMenuOpen) return

    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null
      if (!target) return
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(target)) {
        setIsSessionMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [isSessionMenuOpen])


  useEffect(() => {
    checkProvider()

    const handler = () => {
      checkProvider()
    }

    window.addEventListener('scalpaiboard-ai-provider-updated', handler)
    return () => {
      window.removeEventListener('scalpaiboard-ai-provider-updated', handler)
    }
  }, [])


  const checkProvider = async () => {
    try {
      const data = await getAIProviders()
      const configured = data.configured || []

      if (configured.length === 0) {
        setHasProvider(false)
        setActiveProvider(null)

        updateActiveSession((session) => {
          if (session.messages.length === 1 && session.messages[0].role === 'assistant') {
            return {
              ...session,
              messages: [createWelcomeMessage(null)],
              updatedAt: new Date().toISOString(),
            }
          }
          return session
        })

        return
      }

      const active: any = configured.find((p: any) => p.isDefault || p.isActive) || configured[0]
      if (!active) return

      const providerSummary: ProviderSummary = {
        id: active.id,
        providerName: active.providerName,
        modelName: active.modelName,
      }

      setHasProvider(true)
      setActiveProvider(providerSummary)

      updateActiveSession((session) => {
        if (session.messages.length === 1 && session.messages[0].role === 'assistant') {
          return {
            ...session,
            messages: [createWelcomeMessage(providerSummary)],
            updatedAt: new Date().toISOString(),
          }
        }
        return session
      })
    } catch (error) {
      console.error('Failed to check provider:', error)
    }
  }


  const selectSession = (id: string) => {
    setActiveSessionId(id)
    setIsSessionMenuOpen(false)
  }

  const startNewSession = () => {
    const session = createNewSession(activeProvider)
    setSessions((prev) => [session, ...prev])
    setActiveSessionId(session.id)
    setIsSessionMenuOpen(false)
  }

  const clearActiveSession = () => {
    if (!activeSession) return

    updateActiveSession((session) => ({
      ...session,
      title: 'New chat',
      messages: [createWelcomeMessage(activeProvider)],
      updatedAt: new Date().toISOString(),
    }))
    setIsSessionMenuOpen(false)
  }

  const deleteSession = (id: string) => {
    if (sessions.length <= 1) {
      clearActiveSession()
      return
    }

    const next = sessions.filter((s) => s.id !== id)
    setSessions(next)

    if (activeSessionId === id) {
      setActiveSessionId(next[0]?.id || '')
    }

    setIsSessionMenuOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: AIMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    }

    updateActiveSession((session) => {
      const trimmed = userMessage.content.trim()
      const nextTitle = session.title === 'New chat' && trimmed ? trimmed.slice(0, 40) : session.title

      return {
        ...session,
        title: nextTitle,
        messages: [...session.messages, userMessage],
        updatedAt: new Date().toISOString(),
      }
    })
    setInput('')
    setIsLoading(true)


    try {
      // Call real AI API
      const token = localStorage.getItem('scalpaiboard-auth')
      let authToken = ''
      if (token) {
        try {
          const parsed = JSON.parse(token)
          authToken = parsed.state?.token || ''
        } catch {
          authToken = ''
        }
      }

      const response = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ message: userMessage.content })
      })

      const data = await response.json()
      
      const assistantMessage: AIMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response || data.error || 'No response from AI',
        createdAt: new Date().toISOString()
      }
      updateActiveSession((session) => ({
        ...session,
        messages: [...session.messages, assistantMessage],
        updatedAt: new Date().toISOString(),
      }))
    } catch (error: any) {
      const errorMessage: AIMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to connect to AI service'}`,
        createdAt: new Date().toISOString()
      }
      updateActiveSession((session) => ({
        ...session,
        messages: [...session.messages, errorMessage],
        updatedAt: new Date().toISOString(),
      }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-dark-900">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-sm">AI Assistant</div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-dark-400">{hasProvider ? 'Online' : 'Configure in Settings'}</div>
              <div ref={sessionMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsSessionMenuOpen((v) => !v)}
                  className="text-xs px-2 py-1 rounded-md bg-dark-800 border border-dark-700 text-dark-200 hover:bg-dark-700 flex items-center gap-1 max-w-[180px]"
                  title="Sessions"
                >
                  <span className="truncate">{activeSession?.title || 'Chat'}</span>
                  <ChevronDown className="w-3 h-3 text-dark-400" />
                </button>

                {isSessionMenuOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-dark-700 flex items-center justify-between">
                      <div className="text-xs text-dark-400">Sessions</div>
                      <button
                        type="button"
                        onClick={startNewSession}
                        className="text-xs px-2 py-1 rounded-md bg-primary-600 text-white hover:bg-primary-700 flex items-center gap-1"
                        title="New session"
                      >
                        <Plus className="w-3 h-3" />
                        New
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                      {sessions.map((s) => (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between gap-2 px-3 py-2 hover:bg-dark-700/60 ${s.id === activeSession?.id ? 'bg-dark-700/40' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => selectSession(s.id)}
                            className="flex-1 text-left text-sm text-dark-100 truncate"
                            title={s.title}
                          >
                            {s.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSession(s.id)}
                            className="p-1 rounded-md text-dark-400 hover:text-red-400 hover:bg-dark-700"
                            title="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="px-3 py-2 border-t border-dark-700">
                      <button
                        type="button"
                        onClick={clearActiveSession}
                        className="w-full text-xs px-2 py-1 rounded-md bg-dark-700 text-dark-200 hover:bg-dark-600"
                      >
                        Clear current chat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              title="Close"
              onClick={onClose}
            >
              ✕
            </button>
          )}
          <button
            type="button"
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            title="AI Settings"
            onClick={() => {
              if (activeProvider) {
                navigate('/settings', { state: { editProviderId: activeProvider.id } })
                return
              }
              navigate('/settings')
            }}
          >
            <Settings2 className="w-4 h-4 text-dark-400" />
          </button>
        </div>

      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-primary-600' : 'bg-dark-700'
            }`}>
              {msg.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            {/* Message */}
            <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 border border-dark-700'
            }`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              <div className="text-xs text-dark-400 mt-2">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-dark-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about crypto..."
            className="input text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {!hasProvider && (
          <div className="text-xs text-dark-500 mt-2 text-center">
            Configure AI provider in Settings for full functionality
          </div>
        )}
      </form>
    </div>
  )
}
