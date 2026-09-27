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
      setMessages(data);
    } catch (_) {}
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
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
      <h3 className="chat-title">Case Thread</h3>
      <div className="chat-messages">
        {messages.length === 0 && <p className="muted">No messages yet.</p>}
        {messages.map(m => (
          <div key={m.id} className="chat-bubble">
            <span className="chat-sender">{m.sender_name || m.sender_user_id}</span>
            <span className="chat-text">{m.body}</span>
            <span className="chat-time">{new Date(m.created_at).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button className="btn-primary" type="submit" disabled={sending || !text.trim()}>
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
