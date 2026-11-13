// Chat view: two-pane conversation list + thread. Seeded in-memory demo data;
// replace ensureStore()/pushMessage() with API calls when the backend is ready.
import { $ as byId, cloneTpl, fill, fmtTime, googleMapsUrl, openDialog, setIcon } from '../ui.js';
import { state } from '../state.js';

const THEME_KEY = 'tk-chat-theme';

const EMOJIS = [
  '😀', '😂', '😊', '😍', '👍', '👏', '🙏', '🔥',
  '🎉', '❤️', '💯', '✅', '👀', '😮', '😅', '🤝',
  '📍', '🚗', '📞', '📎', '⏰', '💡', '📊', '🙌',
];
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🔥'];
const AVATAR_COLORS = ['#1E8E4E', '#6D3FC0', '#B26A00', '#B23A6B', '#2F6DB5', '#0E7490'];

let store = null;
let loaded = false;
let replyTo = null;
let quickTarget = null;
let recording = null;

// ---------------------------------------------------------------- helpers
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};

const svgIcon = (href) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', href);
  svg.appendChild(use);
  return svg;
};

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorForName(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function convAvatar(conv, extra = '') {
  const node = el('span', `chat-avatar ${extra}`.trim());
  if (conv.kind === 'ai') {
    node.classList.add('chat-avatar--ai');
    node.appendChild(svgIcon('#i-sparkle'));
    node.appendChild(el('span', 'chat-avatar__dot'));
  } else if (conv.kind === 'broadcast') {
    node.classList.add('chat-avatar--broadcast');
    node.appendChild(svgIcon('#i-megaphone'));
  } else {
    node.style.setProperty('--avatar-color', conv.color || colorForName(conv.name));
    node.appendChild(el('span', 'chat-avatar__text', initials(conv.name)));
    if (conv.online) node.appendChild(el('span', 'chat-avatar__dot'));
  }
  return node;
}

function personAvatar(name, extra = '') {
  const node = el('span', `chat-avatar ${extra}`.trim());
  node.style.setProperty('--avatar-color', colorForName(name));
  node.appendChild(el('span', 'chat-avatar__text', initials(name)));
  return node;
}

function listTime(at) {
  const d = new Date(at);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(d);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
}

function dayLabel(at) {
  const d = new Date(at);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diff = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (diff < 7) return new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(d);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function fmtSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return 'Unknown size';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function previewOf(message) {
  switch (message.kind) {
    case 'image': return 'Photo';
    case 'file': return message.fileName || 'Document';
    case 'location': return 'Shared a live location';
    case 'voice': return `Voice note - ${message.voiceSeconds || 0}s`;
    default: return message.text || '';
  }
}

function convPreview(conv) {
  if (conv.typing) return 'typing...';
  const m = conv.messages[conv.messages.length - 1];
  if (!m) return 'No messages yet';
  return m.mine ? `You: ${previewOf(m)}` : previewOf(m);
}

const lastAt = (conv) => conv.messages.length ? conv.messages[conv.messages.length - 1].at : Date.now();
const unreadTotal = () => store.conversations.reduce((sum, c) => sum + (c.id === store.activeId ? 0 : (c.unread || 0)), 0);
const byConversation = (id) => store.conversations.find((c) => c.id === id) || null;
const activeConv = () => byConversation(store.activeId) || store.conversations[0];

function nextId() {
  store.seq += 1;
  return `m${store.seq}`;
}

// ---------------------------------------------------------------- demo data
function ensureStore() {
  if (store) return store;
  const me = state.user || {};
  const managerName = me.role === 'admin' ? 'Neha Deshmukh' : 'Vikram Rao';
  const managerRole = me.role === 'admin' ? 'Branch manager' : 'Admin';
  const firstName = String(me.name || '').trim().split(/\s+/)[0] || 'there';
  const now = Date.now();
  const hours = (h) => now - h * 3600 * 1000;
  const mins = (m) => now - m * 60 * 1000;
  const days = (d) => now - d * 86400 * 1000;

  const msg = (o) => ({
    id: o.id,
    author: o.author,
    mine: !!o.mine,
    kind: o.kind || 'text',
    text: o.text || '',
    at: o.at,
    status: o.status || 'read',
    reactions: o.reactions || [],
    reply: o.reply || null,
    fileName: o.fileName || '',
    fileSize: o.fileSize || 0,
    voiceSeconds: o.voiceSeconds || 0,
    lat: o.lat,
    lng: o.lng,
    imageUrl: o.imageUrl || '',
  });

  const ai = {
    id: 'ai', name: 'AI Assistant', kind: 'ai', color: '#2F6DB5',
    subtitle: 'Always available - preview mode', pinned: true, unread: 0, typing: false,
    members: [], messages: [
      msg({ id: 'ai-1', author: 'AI Assistant', at: hours(3), text: `Hi ${firstName}, I am your Track_karo assistant. Ask me about attendance, routes, tasks or customer visits.` }),
      msg({ id: 'ai-2', author: 'AI Assistant', at: hours(2.9), text: 'You can also send a location or a photo, and I will pull up the related visit.' }),
      msg({ id: 'ai-3', author: 'You', mine: true, at: mins(26), text: 'How is the Pune Central team doing today?' }),
      msg({ id: 'ai-4', author: 'AI Assistant', at: mins(25), text: '4 of 5 officers are on duty. Ramesh has covered 12.4 km and 6 customers; Imran has been at one stop for 42 minutes. Want the full breakdown?', reactions: [{ emoji: '👍', count: 1, mine: true }] }),
    ],
  };

  const group = {
    id: 'group-branch', name: 'Pune Central team', kind: 'group', color: '#2F6DB5',
    subtitle: '5 members', unread: 2, typing: false, pinned: false,
    members: ['Ramesh Patil', 'Sneha Kulkarni', 'Aarti Jadhav', 'Imran Shaikh'],
    messages: [
      msg({ id: 'g-1', author: 'Ramesh Patil', at: hours(1.2), text: 'Reached the Wagholi customer. Will share the visit in 10 minutes.' }),
      msg({ id: 'g-2', author: 'Sneha Kulkarni', at: mins(42), text: 'Traffic near Kharadi bypass - adding about 15 minutes to my route.' }),
      msg({ id: 'g-3', author: 'You', mine: true, at: mins(36), text: 'Noted. Update the task status when you reach.' }),
      msg({ id: 'g-4', author: 'Aarti Jadhav', at: mins(12), text: 'Morning collection sheet is in the branch folder. Two signatures are pending.' }),
      msg({ id: 'g-5', author: 'Imran Shaikh', at: mins(8), text: 'Lunch break, back in 20.' }),
    ],
  };

  const broadcast = {
    id: 'broadcast', name: 'Announcements', kind: 'broadcast', color: '#E08A2B',
    subtitle: 'Admin announcements - read only', unread: 0, typing: false, pinned: false, readOnly: true,
    members: [], messages: [
      msg({ id: 'b-1', author: 'Vikram Rao', at: days(1.1), text: 'Office closed on Friday for maintenance. Field visits move to Saturday.' }),
      msg({ id: 'b-2', author: 'Vikram Rao', at: days(1.04), text: 'Submit expense bills before 5 PM today.' }),
    ],
  };

  const ramesh = {
    id: 'dm-ramesh', name: 'Ramesh Patil', kind: 'direct', color: '#1E8E4E',
    subtitle: 'Field officer', online: true, unread: 1, typing: false, members: [],
    messages: [
      msg({ id: 'r-1', author: 'Ramesh Patil', at: hours(2.3), text: 'Sir, the customer is not available at Undri. Should I mark it as missed?' }),
      msg({ id: 'r-2', author: 'You', mine: true, at: hours(2.2), text: 'Try once more after lunch, then mark it missed.' }),
      msg({ id: 'r-3', author: 'Ramesh Patil', at: mins(15), text: 'Done. Marked as missed and moved to Hadapsar.' }),
    ],
  };

  const sneha = {
    id: 'dm-sneha', name: 'Sneha Kulkarni', kind: 'direct', color: '#6D3FC0',
    subtitle: 'Field officer', online: true, unread: 0, typing: false, members: [],
    messages: [
      msg({ id: 's-1', author: 'Sneha Kulkarni', at: days(1.16), text: 'Tomorrow I will start from the Kharadi side, the Mundhwa route is blocked.' }),
      msg({ id: 's-2', author: 'You', mine: true, at: days(1.12), text: 'Fine, I will adjust the first two tasks.' }),
    ],
  };

  const imran = {
    id: 'dm-imran', name: 'Imran Shaikh', kind: 'direct', color: '#B26A00',
    subtitle: 'Field officer - last seen 20 min ago', unread: 0, typing: false, members: [],
    messages: [
      msg({ id: 'i-1', author: 'Imran Shaikh', at: hours(5), text: 'Sharing my current location for the visit log.' }),
      msg({ id: 'i-2', author: 'Imran Shaikh', kind: 'location', at: hours(5), lat: 18.5513, lng: 73.9380, reactions: [{ emoji: '📍', count: 1, mine: false }] }),
      msg({ id: 'i-3', author: 'You', mine: true, at: hours(4.8), text: 'Got it, the geofence matched. Mark the visit complete.' }),
    ],
  };

  const manager = {
    id: 'dm-manager', name: managerName, kind: 'direct', color: '#14285A',
    subtitle: managerRole, unread: 0, typing: false, members: [],
    messages: [
      msg({ id: 'mg-1', author: managerName, at: hours(7), text: 'Please review the visit reports before 6 PM.' }),
      msg({ id: 'mg-2', author: 'You', mine: true, at: hours(6.6), text: 'On it. I will send the summary once the last officer ends the day.' }),
    ],
  };

  const aarti = {
    id: 'dm-aarti', name: 'Aarti Jadhav', kind: 'direct', color: '#B23A6B',
    subtitle: 'Field officer', online: false, unread: 0, typing: false, members: [],
    messages: [
      msg({ id: 'a-1', author: 'Aarti Jadhav', at: days(2.08), text: 'Sent the collection sheet to the branch email.' }),
      msg({ id: 'a-2', author: 'Aarti Jadhav', kind: 'file', fileName: 'collection-12-nov.xlsx', fileSize: 184000, at: days(2.07) }),
    ],
  };

  let theme = 'light';
  try { theme = localStorage.getItem(THEME_KEY) || 'light'; } catch { /* storage blocked */ }

  store = {
    conversations: [ai, group, broadcast, ramesh, sneha, imran, manager, aarti],
    activeId: 'ai',
    seq: 1000,
    theme,
  };
  return store;
}

// ---------------------------------------------------------------- theme
function applyTheme() {
  const chat = byId('chat');
  chat.dataset.theme = store.theme;
  const btn = byId('btn-chat-theme');
  setIcon(btn.querySelector('svg'), store.theme === 'dark' ? '#i-sun' : '#i-moon');
  btn.setAttribute('aria-label', store.theme === 'dark' ? 'Switch to light chat' : 'Switch to dark chat');
  btn.title = store.theme === 'dark' ? 'Switch to light chat' : 'Switch to dark chat';
  try { localStorage.setItem(THEME_KEY, store.theme); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- rendering
function refreshBadge() {
  const n = unreadTotal();
  const badge = byId('nav-chat-badge');
  if (badge) {
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
  }
  const total = byId('chat-unread-total');
  if (total) total.textContent = n === 0 ? 'All caught up' : `${n} unread`;
}

function renderList() {
  const list = byId('chat-list');
  const query = (byId('chat-search')?.value || '').trim().toLowerCase();
  const matches = (c) => !query || c.name.toLowerCase().includes(query) || convPreview(c).toLowerCase().includes(query);

  const filtered = store.conversations.filter(matches);
  const pinned = filtered.filter((c) => c.pinned);
  const rest = filtered.filter((c) => !c.pinned).sort((a, b) => lastAt(b) - lastAt(a));

  list.textContent = '';
  const section = (label) => {
    const li = el('li', 'chat-section', label.toUpperCase());
    li.setAttribute('role', 'presentation');
    list.appendChild(li);
  };

  const addRow = (conv) => {
    const li = cloneTpl('tpl-chat-row');
    li.dataset.conversationId = conv.id;
    li.classList.toggle('is-active', conv.id === store.activeId);
    li.classList.toggle('is-pinned', !!conv.pinned);
    li.classList.toggle('has-unread', conv.unread > 0);
    li.classList.toggle('is-typing', !!conv.typing);
    li.setAttribute('aria-current', conv.id === store.activeId ? 'true' : 'false');
    fill(li, { name: conv.name, time: listTime(lastAt(conv)), preview: convPreview(conv) });

    li.querySelector('.chat-row__ai').hidden = conv.kind !== 'ai';
    li.querySelector('.chat-row__spark').hidden = !(conv.kind === 'ai' && conv.unread === 0);
    const count = li.querySelector('[data-count]');
    count.hidden = conv.unread === 0;
    if (conv.unread > 0) count.textContent = conv.unread > 99 ? '99+' : String(conv.unread);

    const avatar = li.querySelector('[data-avatar]');
    avatar.replaceWith(convAvatar(conv));

    list.appendChild(li);
  };

  if (pinned.length) {
    section('Pinned');
    pinned.forEach(addRow);
  }
  if (rest.length) {
    section('All conversations');
    rest.forEach(addRow);
  }
  byId('chat-list-empty').hidden = filtered.length > 0;
  list.hidden = filtered.length === 0;
  refreshBadge();
}

function renderHead() {
  const conv = activeConv();
  byId('chat-head-avatar').replaceChildren(convAvatar(conv));
  byId('chat-title').textContent = conv.name;

  const sub = byId('chat-subtitle');
  sub.textContent = conv.typing ? 'typing...' : conv.subtitle;
  sub.classList.toggle('is-typing', !!conv.typing);

  const form = byId('chat-form');
  const readonly = byId('chat-readonly');
  form.hidden = !!conv.readOnly;
  readonly.hidden = !conv.readOnly;
  byId('chat-input').placeholder = conv.readOnly ? 'Read only channel' : `Message ${conv.name}`;
}

function appendBody(body, message) {
  if (message.kind === 'image') {
    if (message.imageUrl) {
      const img = el('img', 'chat-image');
      img.src = message.imageUrl;
      img.alt = message.fileName || 'Shared photo';
      body.appendChild(img);
    } else {
      const ph = el('div', 'chat-image chat-image--placeholder');
      body.appendChild(ph);
    }
  } else if (message.kind === 'file') {
    const wrap = el('div', 'chat-file');
    const icon = el('span', 'chat-file__icon');
    icon.appendChild(svgIcon('#i-file'));
    const info = el('div', '');
    info.appendChild(el('p', 'chat-file__name', message.fileName || 'Document'));
    info.appendChild(el('p', 'chat-file__size', fmtSize(message.fileSize)));
    wrap.append(icon, info);
    body.appendChild(wrap);
  } else if (message.kind === 'location') {
    const wrap = el('div', 'chat-location');
    const map = el('div', 'chat-location__map');
    map.appendChild(el('span', 'chat-location__pin'));
    const link = el('a', 'chat-location__link', 'Open in Google Maps');
    link.href = googleMapsUrl(message.lat ?? 0, message.lng ?? 0);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    wrap.append(
      map,
      el('p', 'chat-location__coords', `${Number(message.lat ?? 0).toFixed(4)}, ${Number(message.lng ?? 0).toFixed(4)}`),
      link,
    );
    body.appendChild(wrap);
  } else if (message.kind === 'voice') {
    const wrap = el('div', 'chat-voice');
    const play = el('button', 'chat-voice__play');
    play.type = 'button';
    play.setAttribute('aria-label', 'Play voice note');
    play.appendChild(svgIcon('#i-play'));
    const bars = el('span', 'chat-voice__bars');
    for (let i = 0; i < 12; i += 1) bars.appendChild(el('span'));
    wrap.append(play, bars, el('span', 'chat-voice__time', `0:${String(message.voiceSeconds || 0).padStart(2, '0')}`));
    body.appendChild(wrap);
  }

  if (message.text) body.appendChild(el('p', 'chat-msg__text', message.text));
}

function renderMessages({ preserveScroll = false, forceBottom = false } = {}) {
  const conv = activeConv();
  const list = byId('chat-messages');
  const prevTop = list.scrollTop;
  const wasBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;

  list.textContent = '';
  let lastDay = '';
  let prevAuthor = null;

  conv.messages.forEach((message) => {
    const day = new Date(message.at).toDateString();
    if (day !== lastDay) {
      const li = el('li', 'chat-day');
      li.appendChild(el('span', '', dayLabel(message.at)));
      list.appendChild(li);
      lastDay = day;
      prevAuthor = null;
    }

    const li = cloneTpl('tpl-chat-msg');
    li.dataset.messageId = message.id;
    li.classList.toggle('is-mine', message.mine);

    const newRun = prevAuthor !== message.author;
    const isGroup = conv.kind === 'group' || conv.kind === 'broadcast';
    const author = li.querySelector('.chat-msg__author');
    if (!message.mine && isGroup && newRun) {
      author.hidden = false;
      author.textContent = message.author;
    }

    const slot = li.querySelector('[data-avatar-slot]');
    if (!message.mine && conv.kind !== 'ai' && newRun) {
      slot.appendChild(personAvatar(message.author, 'chat-avatar--sm'));
    }

    if (message.reply) {
      const quote = li.querySelector('.chat-msg__quote');
      quote.hidden = false;
      quote.querySelector('strong').textContent = message.reply.author || 'Reply';
      quote.querySelector('span').textContent = message.reply.text || '';
    }

    appendBody(li.querySelector('.chat-msg__body'), message);

    const reactions = li.querySelector('.chat-msg__reactions');
    message.reactions.forEach((r) => {
      const pill = el('button', 'chat-reaction', `${r.emoji} ${r.count}`);
      pill.type = 'button';
      pill.dataset.reaction = r.emoji;
      pill.classList.toggle('is-mine', !!r.mine);
      pill.setAttribute('aria-label', `React ${r.emoji}, ${r.count}`);
      reactions.appendChild(pill);
    });

    const time = li.querySelector('.chat-msg__time');
    time.textContent = fmtTime(message.at);
    time.dateTime = new Date(message.at).toISOString();

    const ticks = li.querySelector('.chat-msg__ticks');
    if (message.mine) {
      ticks.hidden = false;
      ticks.textContent = message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓';
      ticks.classList.toggle('is-read', message.status === 'read');
    }

    list.appendChild(li);
    prevAuthor = message.author;
  });

  byId('chat-typing').hidden = !conv.typing;

  if (forceBottom || (wasBottom && !preserveScroll)) list.scrollTop = list.scrollHeight;
  else if (preserveScroll) list.scrollTop = prevTop;
}

function renderAll(forceBottom = false) {
  renderList();
  renderHead();
  renderMessages({ forceBottom });
  refreshBadge();
}

// ---------------------------------------------------------------- actions
function openConversation(id, { push = true } = {}) {
  const conv = byConversation(id);
  if (!conv) return;
  if (recording) stopRecording(false);
  store.activeId = id;
  conv.unread = 0;
  replyTo = null;
  byId('chat-reply').hidden = true;
  closeMenus();
  renderAll(true);
  if (push) {
    byId('chat').classList.add('is-thread-open');
    if (window.matchMedia('(min-width: 901px)').matches) byId('chat-input')?.focus();
  }
}

function pushMessage(conv, message) {
  conv.messages.push(message);
  conv.typing = false;
  if (conv.id !== store.activeId) conv.unread = (conv.unread || 0) + 1;
  renderList();
  if (conv.id === store.activeId) {
    renderHead();
    renderMessages({ forceBottom: true });
  }
  refreshBadge();

  setTimeout(() => updateStatus(conv, message.id, 'delivered'), 700);
  setTimeout(() => updateStatus(conv, message.id, 'read'), 1800);
  scheduleReply(conv);
}

function updateStatus(conv, id, status) {
  const message = conv.messages.find((m) => m.id === id);
  if (!message || message.status === 'read') return;
  message.status = status;
  if (conv.id !== store.activeId) return;
  const ticks = byId('chat-messages').querySelector(`[data-message-id="${CSS.escape(String(id))}"] .chat-msg__ticks`);
  if (!ticks) return;
  ticks.textContent = status === 'read' ? '✓✓' : '✓✓';
  ticks.classList.toggle('is-read', status === 'read');
}

function scheduleReply(conv) {
  if (conv.readOnly) return;
  if (conv.timers) conv.timers.forEach((t) => clearTimeout(t));
  conv.timers = [];

  conv.timers.push(setTimeout(() => {
    const current = byConversation(conv.id);
    if (!current) return;
    current.typing = true;
    renderList();
    if (current.id === store.activeId) {
      renderHead();
      renderMessages({ preserveScroll: true });
    }
  }, 900));

  conv.timers.push(setTimeout(() => {
    const current = byConversation(conv.id);
    if (!current) return;
    current.typing = false;

    let author = current.name;
    let text = 'Got it, thanks. I will check and get back to you.';
    if (current.kind === 'ai') {
      author = 'AI Assistant';
      const replies = [
        'Preview data only for now - once the API is connected I will answer from live tracking, attendance and visit data.',
        'I can see 4 officers on duty in Pune Central. Two have a location gap longer than 20 minutes; want the names?',
        'Today: 6 customer visits completed, 1 marked missed. Tomorrow assignments are still unapproved.',
      ];
      text = replies[store.seq % replies.length];
    } else if (current.kind === 'group') {
      author = current.members[0] || 'Team member';
      text = ['Noted, I will update after the next visit.', 'Sure, sharing the details in a bit.', 'Reached the customer, marking the task now.'][store.seq % 3];
    }

    current.messages.push({
      id: nextId(), author, mine: false, kind: 'text', text, at: Date.now(),
      status: 'read', reactions: [], reply: null, fileName: '', fileSize: 0, voiceSeconds: 0,
    });
    if (current.id !== store.activeId) current.unread = (current.unread || 0) + 1;

    renderList();
    refreshBadge();
    if (current.id === store.activeId) {
      renderHead();
      renderMessages({ forceBottom: true });
    }
  }, 2900));
}

function sendText() {
  const conv = activeConv();
  const input = byId('chat-input');
  const text = input.value.trim();
  if (!text || conv.readOnly) return;

  const message = {
    id: nextId(), author: 'You', mine: true, kind: 'text', text, at: Date.now(),
    status: 'sent', reactions: [],
    reply: replyTo ? { author: replyTo.author, text: previewOf(replyTo) } : null,
    fileName: '', fileSize: 0, voiceSeconds: 0,
  };
  pushMessage(conv, message);
  replyTo = null;
  byId('chat-reply').hidden = true;
  input.value = '';
  autoGrow();
  updateComposerState();
  input.focus();
}

function toggleReaction(conv, message, emoji) {
  const existing = message.reactions.find((r) => r.emoji === emoji);
  if (!existing) {
    message.reactions.push({ emoji, count: 1, mine: true });
  } else if (existing.mine) {
    existing.count -= 1;
    existing.mine = false;
    if (existing.count <= 0) message.reactions = message.reactions.filter((r) => r !== existing);
  } else {
    existing.count += 1;
    existing.mine = true;
  }
  renderMessages({ preserveScroll: true });
}

// ---------------------------------------------------------------- composer
function autoGrow() {
  const input = byId('chat-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(120, input.scrollHeight)}px`;
}

function updateComposerState() {
  const input = byId('chat-input');
  const hasText = input.value.trim().length > 0;
  byId('btn-chat-send').hidden = !hasText;
  byId('btn-chat-mic').hidden = hasText;
}

function insertEmoji(emoji) {
  const input = byId('chat-input');
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
  input.setSelectionRange(start + emoji.length, start + emoji.length);
  input.focus();
  autoGrow();
  updateComposerState();
}

function startRecording() {
  if (activeConv().readOnly) return;
  recording = { seconds: 0, timer: null };
  byId('chat-form').hidden = true;
  byId('chat-record').hidden = false;
  byId('chat-record-time').textContent = '0:00';
  recording.timer = setInterval(() => {
    if (!recording) return;
    recording.seconds += 1;
    byId('chat-record-time').textContent = `0:${String(recording.seconds).padStart(2, '0')}`;
    if (recording.seconds >= 120) stopRecording(true);
  }, 1000);
}

function stopRecording(send) {
  if (!recording) return;
  clearInterval(recording.timer);
  const seconds = Math.max(1, recording.seconds);
  recording = null;
  byId('chat-record').hidden = true;
  byId('chat-form').hidden = !!activeConv().readOnly;
  if (send) {
    pushMessage(activeConv(), {
      id: nextId(), author: 'You', mine: true, kind: 'voice', text: '', at: Date.now(),
      status: 'sent', reactions: [], reply: null, fileName: '', fileSize: 0, voiceSeconds: seconds,
    });
  }
}

function setReply(message) {
  replyTo = message;
  byId('chat-reply-author').textContent = `Replying to ${message.author}`;
  byId('chat-reply-text').textContent = previewOf(message);
  byId('chat-reply').hidden = false;
  byId('chat-input').focus();
}

function closeMenus() {
  for (const [panelId, buttonId] of [['chat-emoji', 'btn-chat-emoji'], ['chat-attach', 'btn-chat-attach'], ['chat-people', 'btn-chat-new']]) {
    const panel = byId(panelId);
    const button = byId(buttonId);
    if (panel) panel.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
  }
  byId('chat-quick-react').hidden = true;
  quickTarget = null;
}

function togglePanel(panelId, buttonId) {
  const panel = byId(panelId);
  const button = byId(buttonId);
  const show = panel.hidden;
  closeMenus();
  panel.hidden = !show;
  button.setAttribute('aria-expanded', String(show));
  return show;
}

function showQuickReact(anchor, conv, message) {
  const pop = byId('chat-quick-react');
  closeMenus();
  quickTarget = { convId: conv.id, messageId: message.id };
  pop.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const width = 214;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left - width / 2))}px`;
  pop.style.top = `${Math.max(8, rect.top - 46)}px`;
}

function buildPeopleList() {
  const ul = byId('chat-people');
  ul.textContent = '';
  const people = store.conversations.filter((c) => c.kind === 'direct');
  people.forEach((conv) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.append(convAvatar(conv, ''), el('span', '', conv.name));
    button.addEventListener('click', () => {
      ul.hidden = true;
      byId('btn-chat-new').setAttribute('aria-expanded', 'false');
      openConversation(conv.id);
    });
    li.appendChild(button);
    ul.appendChild(li);
  });
}

function openInfo() {
  const conv = activeConv();
  const body = byId('chat-info-body');
  body.textContent = '';

  const head = el('div', 'chat-info__head');
  const who = el('div', '');
  who.append(el('h3', '', conv.name), el('p', '', conv.subtitle));
  head.append(convAvatar(conv), who);
  body.appendChild(head);

  if (conv.members.length) {
    body.appendChild(el('p', 'chat-info__label', 'Members'));
    const ul = el('ul', 'chat-info__members');
    conv.members.forEach((name) => {
      const li = document.createElement('li');
      li.append(personAvatar(name), el('span', '', name));
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  body.appendChild(el('p', 'chat-info__note', 'Preview build: messages are stored in memory until the chat API is connected.'));
  openDialog(byId('modal-chat-info'));
}

// ---------------------------------------------------------------- init
function init() {
  ensureStore();
  applyTheme();

  const emojiPanel = byId('chat-emoji');
  EMOJIS.forEach((emoji) => {
    const button = el('button', '', emoji);
    button.type = 'button';
    button.addEventListener('click', () => insertEmoji(emoji));
    emojiPanel.appendChild(button);
  });

  const quick = byId('chat-quick-react');
  QUICK_REACTIONS.forEach((emoji) => {
    const button = el('button', '', emoji);
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.addEventListener('click', () => {
      const target = quickTarget;
      const conv = target ? byConversation(target.convId) : null;
      const message = conv?.messages.find((m) => m.id === target.messageId);
      if (conv && message) toggleReaction(conv, message, emoji);
      closeMenus();
    });
    quick.appendChild(button);
  });

  buildPeopleList();

  // list interactions
  byId('chat-list').addEventListener('click', (e) => {
    const row = e.target.closest('.chat-row');
    if (row) openConversation(row.dataset.conversationId);
  });
  byId('chat-list').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.chat-row');
    if (!row) return;
    e.preventDefault();
    openConversation(row.dataset.conversationId);
  });

  // search
  byId('chat-search').addEventListener('input', renderList);

  // theme + new chat + info
  byId('btn-chat-theme').addEventListener('click', () => {
    store.theme = store.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });
  byId('btn-chat-new').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel('chat-people', 'btn-chat-new');
  });
  byId('btn-chat-info').addEventListener('click', openInfo);
  byId('btn-chat-back').addEventListener('click', () => {
    byId('chat').classList.remove('is-thread-open');
    closeMenus();
  });
  byId('btn-chat-reply-close').addEventListener('click', () => {
    replyTo = null;
    byId('chat-reply').hidden = true;
  });

  // message actions
  byId('chat-messages').addEventListener('click', (e) => {
    const conv = activeConv();
    const row = e.target.closest('[data-message-id]');
    if (!row) return;
    const message = conv.messages.find((m) => m.id === row.dataset.messageId);
    if (!message) return;

    const action = e.target.closest('[data-msg-action]');
    if (action) {
      if (action.dataset.msgAction === 'reply') setReply(message);
      else showQuickReact(action, conv, message);
      return;
    }

    const reaction = e.target.closest('[data-reaction]');
    if (reaction) toggleReaction(conv, message, reaction.dataset.reaction);
  });

  // composer
  const input = byId('chat-input');
  byId('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendText();
  });
  input.addEventListener('input', () => {
    autoGrow();
    updateComposerState();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  });

  byId('btn-chat-emoji').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel('chat-emoji', 'btn-chat-emoji');
  });
  byId('btn-chat-attach').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel('chat-attach', 'btn-chat-attach');
  });

  byId('chat-attach').addEventListener('click', (e) => {
    const button = e.target.closest('[data-attach]');
    if (!button) return;
    const kind = button.dataset.attach;
    closeMenus();
    if (kind === 'location') {
      pushMessage(activeConv(), {
        id: nextId(), author: 'You', mine: true, kind: 'location', text: '', at: Date.now(),
        status: 'sent', reactions: [], reply: null, fileName: '', fileSize: 0, voiceSeconds: 0,
        lat: 18.5204, lng: 73.8567,
      });
      return;
    }
    const file = byId('chat-file');
    file.dataset.mode = kind;
    file.accept = kind === 'photo' ? 'image/*' : '';
    file.click();
  });

  byId('chat-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    const mode = e.target.dataset.mode || 'file';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    pushMessage(activeConv(), {
      id: nextId(), author: 'You', mine: true,
      kind: isImage && mode === 'photo' ? 'image' : 'file',
      text: '', at: Date.now(), status: 'sent', reactions: [], reply: null,
      fileName: file.name,
      fileSize: file.size,
      imageUrl: isImage && mode === 'photo' ? URL.createObjectURL(file) : '',
      voiceSeconds: 0,
    });
    e.target.value = '';
    e.target.dataset.mode = '';
  });

  byId('btn-chat-mic').addEventListener('click', startRecording);
  byId('btn-chat-record-cancel').addEventListener('click', () => stopRecording(false));
  byId('btn-chat-record-send').addEventListener('click', () => stopRecording(true));

  // close floating panels
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#chat-emoji') && !e.target.closest('#btn-chat-emoji')
      && !e.target.closest('#chat-attach') && !e.target.closest('#btn-chat-attach')
      && !e.target.closest('#chat-people') && !e.target.closest('#btn-chat-new')
      && !e.target.closest('#chat-quick-react')) {
      closeMenus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenus();
      if (window.matchMedia('(max-width: 900px)').matches) byId('chat').classList.remove('is-thread-open');
    }
  });

  updateComposerState();
  renderList();
}

export default {
  init,
  show() {
    ensureStore();
    if (!loaded) {
      loaded = true;
      openConversation(store.activeId, { push: false });
    } else {
      renderAll();
    }
  },
  hide() {
    closeMenus();
  },
};
