import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/use-auth'
import { useCouple } from '../couple/use-couple'

type ChatConnection = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
type ChatMessage = { id: string; senderId: string; text: string; sentAt: number; failed?: boolean }
type ChatPayload = { id: string; senderId: string; text: string; sentAt: number }

const MAX_MESSAGE_LENGTH = 600
const MAX_MESSAGES = 80

function messageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `message-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function validPayload(value: unknown): value is ChatPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return typeof payload.id === 'string'
    && typeof payload.senderId === 'string'
    && typeof payload.text === 'string'
    && payload.text.trim().length > 0
    && payload.text.length <= MAX_MESSAGE_LENGTH
    && typeof payload.sentAt === 'number'
    && Number.isFinite(payload.sentAt)
}

function clockTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp))
}

export function WatchChatPanel({ onClose }: { onClose: () => void }) {
  const { user, session } = useAuth()
  const { couple, partner, state: pairingState } = useCouple()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [connection, setConnection] = useState<ChatConnection>('connecting')
  const [sendError, setSendError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const partnerName = partner?.display_name ?? 'your person'

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message].slice(-MAX_MESSAGES))
  }, [])

  useEffect(() => {
    if (!user || !session?.access_token || !couple || pairingState !== 'paired') {
      setConnection('disconnected')
      return
    }

    let disposed = false
    const topic = `couple:${couple.id}:watch-chat`
    setConnection('connecting')
    setSendError(null)
    supabase.realtime.setAuth(session.access_token)
    const channel = supabase
      .channel(topic, { config: { private: true, broadcast: { self: false, ack: true } } })
      .on<ChatPayload>('broadcast', { event: 'watch-chat' }, ({ payload }) => {
        if (!validPayload(payload)) return
        appendMessage(payload)
      })

    channelRef.current = channel
    channel.subscribe((status) => {
      if (disposed) return
      if (status === 'SUBSCRIBED') { setConnection('connected'); return }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setConnection('reconnecting'); return }
      if (status === 'CLOSED') setConnection('disconnected')
    })

    return () => {
      disposed = true
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [appendMessage, couple?.id, pairingState, session?.access_token, user])

  useEffect(() => {
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!user || !text || !channelRef.current || connection !== 'connected') return
    const message: ChatMessage = { id: messageId(), senderId: user.id, text: text.slice(0, MAX_MESSAGE_LENGTH), sentAt: Date.now() }
    setDraft('')
    setSendError(null)
    appendMessage(message)
    const result = await channelRef.current.send({ type: 'broadcast', event: 'watch-chat', payload: message })
    if (result === 'ok') return
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, failed: true } : item))
    setSendError('That message did not send. Try again when chat reconnects.')
  }, [appendMessage, connection, draft, user])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send()
  }

  return <aside className="watch-chat-panel" aria-label="Watch together chat">
    <header className="watch-chat-header"><span><MessageCircle size={15} /><b>Chat</b><small>{connection === 'connected' ? 'just for this watch room' : connection === 'reconnecting' ? 'reconnecting...' : 'connecting...'}</small></span><button type="button" onClick={onClose} aria-label="Close chat"><X size={16} /></button></header>
    <div className="watch-chat-messages" ref={messageListRef} role="log" aria-live="polite" aria-label="Chat messages">
      {messages.length === 0 && <p className="watch-chat-empty">Messages stay here only while you are both in Watch Together.</p>}
      {messages.map((message) => <div key={message.id} className={`watch-chat-message${message.senderId === user?.id ? ' is-own' : ''}${message.failed ? ' is-failed' : ''}`}><span>{message.senderId === user?.id ? 'You' : partnerName}</span><p>{message.text}</p><small>{message.failed ? 'not sent' : clockTime(message.sentAt)}</small></div>)}
    </div>
    {sendError && <p className="watch-chat-error" role="alert">{sendError}</p>}
    <form className="watch-chat-form" onSubmit={submit}><label className="sr-only" htmlFor="watch-chat-message">Message {partnerName}</label><input id="watch-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} placeholder={connection === 'connected' ? `Message ${partnerName}` : 'Chat is connecting...'} disabled={connection !== 'connected'} /><button type="submit" disabled={connection !== 'connected' || !draft.trim()} aria-label="Send message"><Send size={16} /></button></form>
  </aside>
}
