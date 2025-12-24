import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Settings2, Loader2 } from 'lucide-react'
import { AIMessage } from '../../types'

export default function ChatInterface() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content: `👋 Hello! I'm your AI trading assistant. I can help you with:

• **Finding coins** - "Find coins with >$100M volume and >5% change"
• **Technical analysis** - "Analyze BTC on 1h timeframe"
• **Creating alerts** - "Alert me when ETH drops below $2000"
• **Managing watchlist** - "Add top 5 gainers to my watchlist"
• **Pattern detection** - "Show me coins forming bullish patterns"

Configure your AI provider in Settings to enable full functionality.`,
      createdAt: new Date().toISOString()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: AIMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const assistantMessage: AIMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `I received your message: "${userMessage.content}"

To use the AI assistant, please configure an AI provider in Settings:
1. Go to Settings → AI Providers
2. Add your API key (OpenAI, Anthropic, etc.)
3. Set it as default

Once configured, I'll be able to:
• Search and filter coins for you
• Provide technical analysis
• Create alerts automatically
• Add coins to your watchlist`,
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-sm">AI Assistant</div>
            <div className="text-xs text-dark-400">Configure in Settings</div>
          </div>
        </div>
        <button className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
          <Settings2 className="w-4 h-4 text-dark-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        <div className="text-xs text-dark-500 mt-2 text-center">
          Configure AI provider in Settings for full functionality
        </div>
      </form>
    </div>
  )
}
