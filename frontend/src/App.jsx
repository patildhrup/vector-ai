import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:8000';

async function processChatStream(reader, decoder, onUpdate) {
  let buffer = '';
  let accumulatedText = '';
  let citedSources = [];
  let sourcesParsed = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    if (!sourcesParsed && buffer.includes('__SOURCES__:')) {
      const nl = buffer.indexOf('\n');
      if (nl !== -1) {
        const header = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const jsonStr = header.replace('__SOURCES__:', '');
        try {
          citedSources = JSON.parse(jsonStr);
        } catch (e) {
          console.error('Failed to parse sources', e);
        }
        sourcesParsed = true;
      }
    }

    if (sourcesParsed) {
      accumulatedText += buffer;
      buffer = '';
      onUpdate(accumulatedText, citedSources, false);
    }
  }

  if (buffer && sourcesParsed) {
    accumulatedText += buffer;
  }
  onUpdate(accumulatedText, citedSources, true);
}

const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.4 20.4l17.45-7.56c.84-.36.84-1.52 0-1.88L3.4 3.4c-.66-.29-1.39.2-1.39.91v15.18c0 .71.73 1.2 1.39.91z" />
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
  </svg>
);

function getYoutubeEmbedUrl(url) {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/)([^#&?]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : '';
}

const VideoCard = memo(function VideoCard({ video, variant }) {
  const isA = variant === 'a';
  const embed = isA ? getYoutubeEmbedUrl(video?.url) : null;

  return (
    <div className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/80 overflow-hidden h-full">
      <div className="aspect-video bg-black relative shrink-0">
        {embed ? (
          <iframe
            src={embed}
            title={video?.title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-xs text-neutral-500 uppercase tracking-wide">
              {isA ? 'YouTube' : 'Instagram Reel'}
            </span>
            {video?.url && (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-300 hover:text-white underline"
              >
                Open source
              </a>
            )}
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 min-h-0 flex-1 text-sm">
        <p className="font-medium text-neutral-100 line-clamp-2 leading-snug">
          {video?.title || 'Untitled'}
        </p>
        <p className="text-neutral-500 text-xs truncate">{video?.creator}</p>
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs mt-auto">
          <div className="rounded bg-neutral-950 py-1.5 border border-neutral-800">
            <div className="text-neutral-500">Views</div>
            <div className="text-neutral-200 font-medium tabular-nums">
              {(video?.views ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded bg-neutral-950 py-1.5 border border-neutral-800">
            <div className="text-neutral-500">Likes</div>
            <div className="text-neutral-200 font-medium tabular-nums">
              {(video?.likes ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded bg-neutral-950 py-1.5 border border-neutral-800">
            <div className="text-neutral-500">Eng.</div>
            <div className="text-neutral-200 font-medium tabular-nums">
              {video?.engagement_rate ?? 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function SourceCitations({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {sources.map((src, i) => (
        <a
          key={src.key || `${src.source}-${src.chunk}-${i}`}
          href={src.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors"
          title={src.title}
        >
          <span className="text-neutral-500">↗</span>
          {src.source}
          {src.chunk != null && (
            <span className="text-neutral-500">· chunk {src.chunk}</span>
          )}
        </a>
      ))}
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[85%] rounded-2xl bg-neutral-800 px-4 py-2.5 text-[15px] text-neutral-100 leading-relaxed">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 group">
      <div className="text-[15px] text-neutral-200 leading-relaxed whitespace-pre-wrap break-words">
        {msg.content}
        {msg.streaming && (
          <span className="inline-block w-2 h-4 ml-0.5 bg-neutral-400 animate-pulse align-middle" />
        )}
      </div>
      {!msg.streaming && <SourceCitations sources={msg.sources} />}
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [videoA, setVideoA] = useState(null);
  const [videoB, setVideoB] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [urlMenuOpen, setUrlMenuOpen] = useState(false);
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [showVideos, setShowVideos] = useState(true);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/status`)
      .then((res) => {
        if (res.data.loaded) {
          setVideoA(res.data.video_a);
          setVideoB(res.data.video_b);
          setChatHistory([
            {
              role: 'assistant',
              content:
                'Videos are loaded. Ask anything about engagement, hooks, transcripts, or how the two compare.',
              sources: [],
            },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [userInput, adjustTextareaHeight]);

  const handleProcessVideos = async () => {
    if (!urlA.trim() || !urlB.trim()) return;
    setLoading(true);
    setUrlMenuOpen(false);
    setLoadingStatus('Processing videos and indexing transcripts…');

    try {
      const res = await axios.post(`${BACKEND_URL}/api/process`, {
        url_a: urlA.trim(),
        url_b: urlB.trim(),
      });
      if (res.data.success) {
        setVideoA(res.data.video_a);
        setVideoB(res.data.video_b);
        setChatHistory([
          {
            role: 'assistant',
            content: `Ready. **${res.data.video_a.title}** (YouTube) and **${res.data.video_b.title}** (Reel) are indexed. What would you like to compare?`,
            sources: [],
          },
        ]);
      }
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err.response?.data?.detail || 'Failed to process videos.',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleSendChat = async (textToSend = null) => {
    const query = (textToSend ?? userInput).trim();
    if (!query) return;

    if (!videoA || !videoB) {
      setUrlMenuOpen(true);
      return;
    }

    const historyForApi = chatHistory
      .filter((m) => !m.streaming && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    const newUserMessage = { role: 'user', content: query };
    const placeholder = { role: 'assistant', content: '', sources: [], streaming: true };

    setChatHistory((prev) => [...prev, newUserMessage, placeholder]);
    if (!textToSend) setUserInput('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, chat_history: historyForApi }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Chat request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      await processChatStream(reader, decoder, (text, sources, done) => {
        setChatHistory((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              ...last,
              content: text,
              sources,
              streaming: !done,
            };
          }
          return next;
        });
      });
    } catch (err) {
      setChatHistory((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = {
            role: 'assistant',
            content: err.message || 'Connection error. Check backend and API keys.',
            sources: [],
            streaming: false,
          };
        }
        return next;
      });
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear loaded videos and reset the index?')) return;
    try {
      await axios.post(`${BACKEND_URL}/api/clear`);
      setVideoA(null);
      setVideoB(null);
      setChatHistory([]);
      setUrlA('');
      setUrlB('');
    } catch (e) {
      console.error(e);
    }
  };

  const hasVideos = Boolean(videoA && videoB);
  const isEmpty = chatHistory.length === 0;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-neutral-100 overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-neutral-800/80 bg-[#0a0a0a]">
        <span className="text-sm font-medium text-neutral-300">Vector</span>
        <div className="flex items-center gap-2">
          {hasVideos && (
            <>
              <button
                type="button"
                onClick={() => setShowVideos((v) => !v)}
                className="text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1 rounded-md hover:bg-neutral-800 transition-colors"
              >
                {showVideos ? 'Hide videos' : 'Show videos'}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1 rounded-md hover:bg-neutral-800 transition-colors"
              >
                Reset
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Video sidebar — side by side */}
        {hasVideos && showVideos && (
          <aside className="hidden lg:flex w-[min(42%,520px)] shrink-0 flex-col border-r border-neutral-800/80 p-4 gap-3 overflow-y-auto bg-[#0a0a0a]">
            <p className="text-xs text-neutral-500 uppercase tracking-wider px-0.5">Compared videos</p>
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
              <VideoCard video={videoA} variant="a" />
              <VideoCard video={videoB} variant="b" />
            </div>
          </aside>
        )}

        {/* Chat column — ChatGPT layout */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          {loading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a0a0a]/90 gap-3">
              <div className="w-8 h-8 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin" />
              <p className="text-sm text-neutral-400 max-w-xs text-center px-6">{loadingStatus}</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-8 w-full">
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                  <h1 className="text-2xl font-semibold text-neutral-100 mb-2">Video comparison chat</h1>
                  <p className="text-neutral-500 text-sm max-w-md mb-8">
                    Add two URLs with the + button, then ask questions. Answers stream in with citations to video and transcript chunk.
                  </p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => <ChatMessage key={idx} msg={msg} />)
              )}
              <div ref={chatEndRef} className="h-4" />
            </div>
          </div>

          {/* Mobile video strip */}
          {hasVideos && showVideos && (
            <div className="lg:hidden shrink-0 border-t border-neutral-800 px-3 py-2 overflow-x-auto flex gap-2">
              <div className="w-40 shrink-0">
                <VideoCard video={videoA} variant="a" />
              </div>
              <div className="w-40 shrink-0">
                <VideoCard video={videoB} variant="b" />
              </div>
            </div>
          )}

          {/* ChatGPT-style input bar */}
          <div className="shrink-0 border-t border-neutral-800/80 bg-[#0a0a0a] p-3 pb-4">
            <div className="max-w-3xl mx-auto relative">
              {urlMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl p-4 z-20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-neutral-200">Add video URLs</span>
                    <button
                      type="button"
                      onClick={() => setUrlMenuOpen(false)}
                      className="p-1 text-neutral-500 hover:text-neutral-300 rounded"
                      aria-label="Close"
                    >
                      <IconClose />
                    </button>
                  </div>
                  <label className="block text-xs text-neutral-500 mb-1">YouTube (Video A)</label>
                  <input
                    type="url"
                    value={urlA}
                    onChange={(e) => setUrlA(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full mb-3 rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
                  />
                  <label className="block text-xs text-neutral-500 mb-1">Instagram Reel (Video B)</label>
                  <input
                    type="url"
                    value={urlB}
                    onChange={(e) => setUrlB(e.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    className="w-full mb-4 rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
                  />
                  <button
                    type="button"
                    onClick={handleProcessVideos}
                    disabled={!urlA.trim() || !urlB.trim() || loading}
                    className="w-full rounded-lg bg-neutral-100 text-neutral-900 text-sm font-medium py-2 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Process & index
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border border-neutral-700 bg-neutral-900/80 px-2 py-2 shadow-sm focus-within:border-neutral-500 transition-colors">
                <button
                  type="button"
                  onClick={() => setUrlMenuOpen((o) => !o)}
                  className="shrink-0 p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                  aria-label="Add video URLs"
                  title="Add video URLs"
                >
                  <IconPlus />
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder={hasVideos ? 'Ask about the videos…' : 'Add URLs with +, then ask a question'}
                  className="flex-1 resize-none bg-transparent text-[15px] text-neutral-100 placeholder:text-neutral-500 py-2 px-1 max-h-[200px] focus:outline-none leading-relaxed"
                />

                <button
                  type="button"
                  onClick={() => handleSendChat()}
                  disabled={!userInput.trim() && !loading}
                  className="shrink-0 p-2 rounded-lg bg-neutral-100 text-neutral-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors mb-0.5"
                  aria-label="Send message"
                >
                  <IconSend />
                </button>
              </div>
              <p className="text-center text-[11px] text-neutral-600 mt-2">
                Streaming answers · sources cite video + chunk · conversation memory enabled
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
