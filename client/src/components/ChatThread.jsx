import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendMessage, fetchMessages } from '../api/reports';

export default function ChatThread({ reportId }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  async function load() {
    try {
      const data = await fetchMessages(token, reportId);
      setMessages(Array.isArray(data) ? data : []);
    } catch (_) {}
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [reportId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await sendMessage(token, reportId, text.trim());
      setText('');
      await load();
    } catch (_) {}
    setSending(false);
  }

  return (
    <div className="chat-container">
      <div className="chat-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Anonymous Case Thread</span>
        <button type="button" className="btn-outline" style={{ fontSize: '0.75rem', padding: '2px 8px' }} onClick={load}>
          Refresh
        </button>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="muted" style={{ textAlign: 'center', margin: 'auto', fontSize: '0.85rem' }}>
            No messages exchanged yet. Use the field below to send a confidential update.
          </p>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`chat-bubble ${m.is_me ? 'chat-me' : 'chat-other'}`}
            style={{
              alignSelf: m.is_me ? 'flex-end' : 'flex-start',
              background: m.is_me ? 'var(--accent)' : 'var(--surface2)',
              color: '#fff',
              border: m.is_me ? 'none' : '1px solid var(--border)',
              maxWidth: '75%',
            }}
          >
            <span
              className="chat-sender"
              style={{
                color: m.is_me ? '#e2e6f0' : 'var(--warning)',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            >
              {m.sender_name || (m.is_me ? 'You' : 'User')}
            </span>
            <span className="chat-text" style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
              {m.body}
            </span>
            <span className="chat-time" style={{ opacity: 0.75, fontSize: '0.7rem' }}>
              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type an anonymous follow-up message..."
          disabled={sending}
        />
        <button className="btn-primary" type="submit" disabled={sending || !text.trim()}>
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
