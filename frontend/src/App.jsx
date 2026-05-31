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

const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconYouTube = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="2" y="5" width="20" height="14" rx="3" />
    <path d="M10 9.5v5l5-2.5-5-2.5z" fill="currentColor" stroke="none" />
  </svg>
);

const IconInstagram = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);


const IconRemove = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
  </svg>
);

function parseYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([^#&?/]{11})/);
  return match?.[1] ?? null;
}

function newAttachmentId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isValidPlatformUrl(url, platform) {
  const u = url.trim().toLowerCase();
  if (platform === 'youtube') return u.includes('youtube.com') || u.includes('youtu.be');
  if (platform === 'instagram') return u.includes('instagram.com');
  return false;
}

function platformLabel(platform) {
  return platform === 'youtube' ? 'YouTube' : 'Instagram';
}

function toggleSelection(selectedIds, id) {
  if (selectedIds.includes(id)) {
    return selectedIds.filter((x) => x !== id);
  }
  if (selectedIds.length >= 2) {
    return [selectedIds[1], id];
  }
  return [...selectedIds, id];
}

function displayLabel(url, meta, fallback) {
  if (meta?.title) return meta.title;
  if (!url) return fallback;
  try {
    const u = new URL(url);
    const path = u.pathname.length > 28 ? `${u.pathname.slice(0, 28)}…` : u.pathname;
    return `${u.hostname}${path || ''}`;
  } catch {
    return url.length > 36 ? `${url.slice(0, 36)}…` : url;
  }
}

function RemoveButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-600 border border-neutral-500 flex items-center justify-center text-neutral-200 hover:bg-neutral-500 hover:text-white transition-colors shadow-md z-10"
    >
      <IconRemove />
    </button>
  );
}

function VideoAttachmentCard({ attachment, selected, selectedIndex, loading, onRemove, onToggleSelect }) {
  const { id, platform, url, meta } = attachment;
  const isYoutube = platform === 'youtube';
  const ytId = isYoutube ? parseYoutubeId(url || meta?.url) : null;
  const thumb = meta?.thumbnail || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null);
  const label = displayLabel(url, meta, isYoutube ? 'YouTube video' : 'Instagram Reel');
  const slotLabel = selectedIndex === 0 ? 'A' : selectedIndex === 1 ? 'B' : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggleSelect(id)}
      onKeyDown={(e) => e.key === 'Enter' && onToggleSelect(id)}
      className={`relative cursor-pointer rounded-xl border bg-[#1a1a1a] transition-colors ${
        selected
          ? 'border-neutral-300 ring-1 ring-neutral-300'
          : 'border-neutral-700 hover:border-neutral-500'
      } ${isYoutube ? 'flex items-center gap-3 min-w-[200px] max-w-[280px] px-3 py-2.5 pr-8' : 'flex items-center gap-3 min-w-[88px] max-w-[260px] px-2.5 py-2 pr-8'}`}
    >
      <RemoveButton
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        label={`Remove ${platformLabel(platform)} link`}
      />

      {isYoutube ? (
        <>
          <div className="shrink-0 w-10 h-10 rounded-lg bg-[#ff0000] flex items-center justify-center text-white">
            <IconYouTube />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{label}</p>
            <p className="text-xs text-neutral-500">YouTube</p>
          </div>
          {thumb && (
            <img
              src={thumb}
              alt=""
              className="hidden sm:block w-12 h-9 rounded object-cover shrink-0 opacity-90"
              loading="lazy"
            />
          )}
        </>
      ) : (
        <>
          <div className="relative shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden border border-neutral-800">
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-900/80 via-pink-900/60 to-neutral-900 flex items-center justify-center">
                <span className="text-pink-300/90">
                  <IconInstagram />
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate max-w-[120px] sm:max-w-none">{label}</p>
            <p className="text-xs text-neutral-500">Instagram</p>
          </div>
        </>
      )}

      {slotLabel && (
        <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium text-neutral-900 bg-white px-1.5 py-0.5 rounded">
          Video {slotLabel}
        </span>
      )}

      {loading && selected && (
        <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-neutral-400 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

function VideoAttachmentStrip({
  attachments,
  selectedIds,
  loading,
  hasVideos,
  onRemove,
  onToggleSelect,
  onCompare,
}) {
  if (!attachments.length) return null;

  const canCompare = selectedIds.length === 2 && !hasVideos && !loading;

  return (
    <div className="px-3 pt-3 pb-2 border-b border-neutral-800/80">
      <p className="text-[11px] text-neutral-500 mb-2">
        Select 2 videos to compare (YT+YT, Insta+Insta, or mixed)
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {attachments.map((attachment) => {
          const selectedIndex = selectedIds.indexOf(attachment.id);
          return (
            <VideoAttachmentCard
              key={attachment.id}
              attachment={attachment}
              selected={selectedIndex !== -1}
              selectedIndex={selectedIndex}
              loading={loading}
              onRemove={onRemove}
              onToggleSelect={onToggleSelect}
            />
          );
        })}
        {canCompare && (
          <button
            type="button"
            onClick={onCompare}
            className="mb-1 rounded-xl bg-white text-neutral-900 text-xs font-semibold px-4 py-2 hover:bg-neutral-100 transition-colors"
          >
            Compare
          </button>
        )}
      </div>
    </div>
  );
}

function AttachMenu({
  open,
  step,
  selectedCount,
  pendingUrl,
  loading,
  onPickPlatform,
  onBack,
  onPendingChange,
  onSaveUrl,
  onCompare,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && step !== 'picker') {
      inputRef.current?.focus();
    }
  }, [open, step]);

  if (!open) return null;

  const menuBtn =
    'w-full flex items-center gap-3 px-3 py-2.5 text-left text-[14px] text-white rounded-lg hover:bg-white/10 transition-colors';

  if (step === 'youtube' || step === 'instagram') {
    const isYt = step === 'youtube';
    return (
      <div className="absolute bottom-full left-0 mb-2 w-[min(100%,320px)] rounded-2xl bg-[#2f2f2f] shadow-2xl border border-neutral-700/50 overflow-hidden z-20">
        <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-neutral-300 hover:bg-white/10 hover:text-white"
            aria-label="Back"
          >
            <IconBack />
          </button>
          <span className="text-sm font-medium text-white">
            {isYt ? 'YouTube video' : 'Instagram Reel'}
          </span>
        </div>
        <div className="p-3">
          <input
            ref={inputRef}
            type="url"
            value={pendingUrl}
            onChange={(e) => onPendingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pendingUrl.trim()) onSaveUrl();
            }}
            placeholder={
              isYt
                ? 'https://www.youtube.com/watch?v=...'
                : 'https://www.instagram.com/reel/...'
            }
            className="w-full rounded-xl bg-[#212121] border border-neutral-600 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-400"
          />
          <button
            type="button"
            onClick={onSaveUrl}
            disabled={!pendingUrl.trim()}
            className="mt-3 w-full rounded-xl bg-white text-neutral-900 text-sm font-medium py-2 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add {isYt ? 'YouTube' : 'Instagram'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[min(100%,280px)] rounded-2xl bg-[#2f2f2f] shadow-2xl border border-neutral-700/50 overflow-hidden z-20 py-1.5">
      <button type="button" className={menuBtn} onClick={() => onPickPlatform('youtube')}>
        <span className="shrink-0 text-white/90">
          <IconYouTube />
        </span>
        <span className="flex-1">YouTube</span>
      </button>

      <div className="mx-3 my-1 border-t border-white/10" />

      <button type="button" className={menuBtn} onClick={() => onPickPlatform('instagram')}>
        <span className="shrink-0 text-white/90">
          <IconInstagram />
        </span>
        <span className="flex-1">Instagram</span>
      </button>

      {selectedCount === 2 && (
        <>
          <div className="mx-3 my-1 border-t border-white/10" />
          <div className="px-2 pb-1.5 pt-0.5">
            <button
              type="button"
              onClick={onCompare}
              disabled={loading}
              className="w-full rounded-xl bg-white text-neutral-900 text-sm font-medium py-2.5 hover:bg-neutral-100 disabled:opacity-50"
            >
              Compare selected
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function getYoutubeEmbedUrl(url) {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/)([^#&?]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : '';
}

const VideoCard = memo(function VideoCard({ video }) {
  const isYoutube = video?.is_youtube;
  const embed = isYoutube ? getYoutubeEmbedUrl(video?.url) : null;
  const platformName = isYoutube ? 'YouTube' : 'Instagram Reel';

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
        ) : video?.thumbnail ? (
          <img src={video.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-xs text-neutral-500 uppercase tracking-wide">{platformName}</span>
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachStep, setAttachStep] = useState('picker');
  const [pendingUrl, setPendingUrl] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showVideos, setShowVideos] = useState(true);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const attachMenuRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/status`)
      .then((res) => {
        if (res.data.loaded) {
          const a = {
            id: newAttachmentId(),
            platform: res.data.video_a?.is_youtube ? 'youtube' : 'instagram',
            url: res.data.video_a?.url || '',
            meta: res.data.video_a,
          };
          const b = {
            id: newAttachmentId(),
            platform: res.data.video_b?.is_youtube ? 'youtube' : 'instagram',
            url: res.data.video_b?.url || '',
            meta: res.data.video_b,
          };
          setVideoA(res.data.video_a);
          setVideoB(res.data.video_b);
          setAttachments([a, b]);
          setSelectedIds([a.id, b.id]);
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

  useEffect(() => {
    if (!attachMenuOpen) return;
    const onDocClick = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setAttachMenuOpen(false);
        setAttachStep('picker');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [attachMenuOpen]);

  const openAttachMenu = () => {
    setAttachMenuOpen((o) => {
      if (!o) setAttachStep('picker');
      return !o;
    });
  };

  const handlePickPlatform = (platform) => {
    setAttachStep(platform);
    setPendingUrl('');
  };

  const invalidateProcessed = () => {
    setVideoA(null);
    setVideoB(null);
  };

  const handleSavePlatformUrl = () => {
    const trimmed = pendingUrl.trim();
    if (!trimmed || (attachStep !== 'youtube' && attachStep !== 'instagram')) return;
    if (!isValidPlatformUrl(trimmed, attachStep)) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `That doesn't look like a valid ${platformLabel(attachStep)} URL.`,
          sources: [],
        },
      ]);
      return;
    }

    const item = { id: newAttachmentId(), platform: attachStep, url: trimmed, meta: null };
    setAttachments((prev) => [...prev, item]);
    setSelectedIds((prev) => {
      if (prev.includes(item.id)) return prev;
      if (prev.length >= 2) return [prev[1], item.id];
      return [...prev, item.id];
    });
    invalidateProcessed();
    setAttachStep('picker');
    setPendingUrl('');
    setAttachMenuOpen(false);
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    invalidateProcessed();
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => toggleSelection(prev, id));
    invalidateProcessed();
  };

  const platformName = (video) => (video?.is_youtube ? 'YouTube' : 'Instagram');

  const handleProcessVideos = async () => {
    if (selectedIds.length !== 2) return;
    const picked = selectedIds
      .map((id) => attachments.find((a) => a.id === id))
      .filter(Boolean);
    if (picked.length !== 2) return;

    setLoading(true);
    setAttachMenuOpen(false);
    setAttachStep('picker');
    setLoadingStatus('Processing videos and indexing transcripts…');

    try {
      const res = await axios.post(`${BACKEND_URL}/api/process`, {
        url_a: picked[0].url.trim(),
        url_b: picked[1].url.trim(),
      });
      if (res.data.success) {
        setVideoA(res.data.video_a);
        setVideoB(res.data.video_b);
        setAttachments((prev) =>
          prev.map((a) => {
            if (a.id === picked[0].id) return { ...a, url: res.data.video_a?.url || a.url, meta: res.data.video_a };
            if (a.id === picked[1].id) return { ...a, url: res.data.video_b?.url || a.url, meta: res.data.video_b };
            return a;
          })
        );
        setChatHistory([
          {
            role: 'assistant',
            content: `Ready. **${res.data.video_a.title}** (${platformName(res.data.video_a)}) and **${res.data.video_b.title}** (${platformName(res.data.video_b)}) are indexed. What would you like to compare?`,
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
      setAttachMenuOpen(true);
      setAttachStep('picker');
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
      setAttachments([]);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    }
  };

  const hasVideos = Boolean(videoA && videoB);
  const isEmpty = chatHistory.length === 0;
  const hasAttachments = attachments.length > 0;

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
              <VideoCard video={videoA} />
              <VideoCard video={videoB} />
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
                    Add video links with + (YouTube, Instagram, or both). Select any 2 to compare — YT+YT, Insta+Insta, or mixed.
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
                <VideoCard video={videoA} />
              </div>
              <div className="w-40 shrink-0">
                <VideoCard video={videoB} />
              </div>
            </div>
          )}

          {/* ChatGPT-style input bar */}
          <div className="shrink-0 border-t border-neutral-800/80 bg-[#0a0a0a] p-3 pb-4">
            <div className="max-w-3xl mx-auto relative" ref={attachMenuRef}>
              <AttachMenu
                open={attachMenuOpen}
                step={attachStep}
                selectedCount={selectedIds.length}
                pendingUrl={pendingUrl}
                loading={loading}
                onPickPlatform={handlePickPlatform}
                onBack={() => setAttachStep('picker')}
                onPendingChange={setPendingUrl}
                onSaveUrl={handleSavePlatformUrl}
                onCompare={handleProcessVideos}
              />

              <div className="rounded-2xl border border-neutral-700 bg-neutral-900/80 shadow-sm focus-within:border-neutral-500 transition-colors overflow-hidden">
                <VideoAttachmentStrip
                  attachments={attachments}
                  selectedIds={selectedIds}
                  loading={loading}
                  hasVideos={hasVideos}
                  onRemove={handleRemoveAttachment}
                  onToggleSelect={handleToggleSelect}
                  onCompare={handleProcessVideos}
                />

                <div className="flex items-end gap-2 px-2 py-2">
                  <button
                    type="button"
                    onClick={openAttachMenu}
                    className={`shrink-0 p-2 rounded-lg transition-colors ${
                      attachMenuOpen
                        ? 'text-white bg-neutral-700'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                    aria-label="Add YouTube or Instagram"
                    title="Add YouTube or Instagram"
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
                    placeholder={
                      hasVideos || hasAttachments ? 'Ask anything' : 'Use + to add video links'
                    }
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
