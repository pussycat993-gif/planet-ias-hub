import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Header from './Header';
import Toolbar from './Toolbar';
import TabBar from './TabBar';
import Sidebar from './Sidebar';
import MessageList, { ReplyContext } from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import ThreadPanel from '../chat/ThreadPanel';
import CallBar from '../calls/CallBar';
import AIPanel from '../ai/AIPanel';
import AutoPanel from '../automation/AutoPanel';
import PCIContextPanel from '../pci/PCIContextPanel';
import ScheduleMeetModal from '../chat/ScheduleMeetModal';
import MembersPanel from '../channel/MembersPanel';
import PinnedPanel from '../channel/PinnedPanel';
import HelpPanel from '../help/HelpPanel';
import LogActivityModal from '../modals/LogActivityModal';
import UpcomingMeetingBanner from '../meetings/UpcomingMeetingBanner';
import AskIASModal from '../ai/AskIASModal';
import { useChatStore } from '../../store/chatStore';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { useSocket } from '../../hooks/useSocket';
import { useFavorites } from '../../hooks/useFavorites';
import { useMutedChannels } from '../../hooks/useMutedChannels';
import { detectMeeting } from '../../utils/meetingDetector';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

export function stringToColor(str: string): string {
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c', '#283593', '#4a148c'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name, avatarUrl, size = 32, logoColor, logoAbbr, logoUrl, isGroup }: {
  name: string; avatarUrl?: string; size?: number;
  logoColor?: string; logoAbbr?: string; logoUrl?: string; isGroup?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const imgUrl = logoUrl || avatarUrl;
  if (imgUrl && !imgError) return (
    <div style={{ width: size, height: size, borderRadius: isGroup ? size * 0.28 : '50%', overflow: 'hidden', flexShrink: 0 }}>
      <img src={imgUrl} alt={name} onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
    </div>
  );
  if (isGroup) return <div style={{ width: size, height: size, borderRadius: size * 0.28, background: logoColor || BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{logoAbbr || initials}</div>;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: stringToColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>;
}

export default function Layout() {
  const { fetchChannels, receiveMessage, setTyping, channels, activeChannelId, activeChannel } = useChatStore();
  const { rightPanelOpen, aiPanelOpen, autoPanelOpen, activeThreadId, activeModal, closeModal } = useUIStore();
  const { user } = useAuthStore();
  const socket = useSocket();
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Auto-detected meeting suggestion from incoming messages
  const [autoDetected, setAutoDetected] = useState<{
    channelId: number;
    channelName: string;
    title: string;
    datetime: Date;
    messageId: number;
    excerpt: string;
  } | null>(null);

  useEffect(() => { fetchChannels(); }, []);

  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: any) => {
      receiveMessage(msg);

      // ── Auto-detect meeting intent ────────────────────
      // Rules: plain text only, not already dismissed.
      // Works for both incoming messages AND the user's own messages
      // (so Ivana can write "vidimo se u 10h" and get the modal too).
      if (!msg?.sender || !msg?.body) return;
      if (msg.message_type && msg.message_type !== 'text') return;

      const dismissKey = `ias_meet_dismissed_${msg.id}`;
      if (sessionStorage.getItem(dismissKey)) return;

      const res = detectMeeting(msg.body);
      if (!res.match || !res.datetime) return;

      const isMine = msg.sender.id === user?.id;

      // Don't interrupt if a suggestion is already open
      setAutoDetected(prev => {
        if (prev) return prev;
        const allChannels = [...channels.public, ...channels.private, ...channels.groups, ...channels.dms];
        const ch = allChannels.find(c => c.id === msg.channel_id);
        const chName = ch
          ? (ch.type === 'dm' ? (isMine ? ch.other_user?.name || ch.name : ch.other_user?.name || ch.name) : ch.name)
          : 'channel';
        const title = isMine
          ? (ch?.type === 'dm' ? `Meeting with ${ch.other_user?.name || chName}` : `Meeting in ${chName}`)
          : `Meeting with ${msg.sender.name}`;
        return {
          channelId: msg.channel_id,
          channelName: chName,
          title,
          datetime: res.datetime!,
          messageId: msg.id,
          excerpt: msg.body.length > 80 ? msg.body.slice(0, 77) + '…' : msg.body,
        };
      });
    };

    socket.on('message:receive', handleReceive);
    socket.on('typing:update', ({ userId, typing }: { userId: number; typing: boolean }) => setTyping(userId, typing));
    socket.on('call:incoming', (data: any) => console.log('Incoming call:', data));

    // Thread update: parent's reply counter bumps when a reply arrives.
    // ThreadPanel has its own listener for appending the reply to its list.
    const handleThreadUpdate = (payload: { parent_id: number; reply: any }) => {
      useChatStore.getState().incrementThreadCount(payload.parent_id, payload.reply?.created_at);
    };
    socket.on('thread:update', handleThreadUpdate);

    return () => {
      socket.off('message:receive', handleReceive);
      socket.off('typing:update');
      socket.off('call:incoming');
      socket.off('thread:update', handleThreadUpdate);
    };
  }, [socket, user?.id, channels, receiveMessage, setTyping]);

  const dismissAutoDetected = () => {
    if (autoDetected) {
      sessionStorage.setItem(`ias_meet_dismissed_${autoDetected.messageId}`, '1');
    }
    setAutoDetected(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: 13 }}>
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {autoDetected && (
        <ScheduleMeetModal
          channelId={autoDetected.channelId}
          channelName={autoDetected.channelName}
          initialTitle={autoDetected.title}
          initialDate={autoDetected.datetime}
          detectedFrom={autoDetected.excerpt}
          onClose={dismissAutoDetected}
        />
      )}
      <Header onSearch={setSearchQuery} searchQuery={searchQuery} />
      <Toolbar />
      <TabBar />
      <UpcomingMeetingBanner />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#fff' }}>
          <ChatTitleBar />
          <CallBar />
          <MessageList onReply={setReplyContext} searchQuery={searchQuery} />
          <MessageInput replyContext={replyContext} onClearReply={() => setReplyContext(null)} />
        </div>
        {activeThreadId && <ThreadPanel />}
        {rightPanelOpen && (
          <div style={{ width: 280, borderLeft: '1px solid #dde1e7', background: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <RightPanelTabs />
          </div>
        )}
        {aiPanelOpen && (
          <div style={{ width: 300, borderLeft: '1px solid #dde1e7', background: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <AIPanel />
          </div>
        )}
        {autoPanelOpen && (
          <div style={{ width: 260, borderLeft: '1px solid #dde1e7', background: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <AutoPanel />
          </div>
        )}
      </div>

      <div style={{ background: BLUE_DARK, color: '#fff', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24, flexShrink: 0 }}>
        <span onClick={() => setShowHelp(true)} style={{ fontSize: 10, color: 'rgba(255,255,255,.8)', cursor: 'pointer', textDecoration: 'underline' }}>Help</span>
        <span style={{ fontSize: 10, opacity: .7 }}>Design by PLANet Systems Group | © IAS Hub 2026. All rights reserved.</span>
      </div>

      {/* Schedule Meeting modal — triggered from Toolbar's "+ New" dropdown */}
      {activeModal === 'scheduleMeeting' && activeChannelId && activeChannel && (
        <ScheduleMeetModal
          channelId={activeChannelId}
          channelName={
            activeChannel.type === 'dm'
              ? activeChannel.other_user?.name || activeChannel.name
              : activeChannel.name
          }
          onClose={closeModal}
        />
      )}
      {/* Ask IAS modal — global, toggled by Cmd+K or the header button */}
      <AskIASModal />
    </div>
  );
}

function ChatTitleBar() {
  const { activeChannel, activeChannelId, messages, fetchChannels } = useChatStore();
  const { startCall } = useCallStore();
  const { isFav, toggle: toggleFav } = useFavorites();
  const { isMuted, toggle: toggleMute } = useMutedChannels();
  const { inlineSearchOpen, toggleInlineSearch, channelSearchQuery, setChannelSearchQuery } = useUIStore();
  const [showMeetModal, setShowMeetModal] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [memberStats, setMemberStats] = useState<{ total: number; online: number }>({ total: 0, online: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    if (showMenu) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  // Fetch member stats for groups/publics to show "3/7 online"
  useEffect(() => {
    if (!activeChannelId || !activeChannel || activeChannel.type === 'dm') {
      setMemberStats({ total: 0, online: 0 });
      return;
    }
    axios.get(`${API}/channels/${activeChannelId}/members`)
      .then(r => {
        const list: any[] = r.data.data || [];
        setMemberStats({
          total: list.length,
          online: list.filter(m => m.status === 'online').length,
        });
      })
      .catch(() => setMemberStats({ total: 0, online: 0 }));
  }, [activeChannelId, activeChannel]);

  if (!activeChannel) return null;

  const isDM = activeChannel.type === 'dm';
  const isGroup = activeChannel.type === 'group';
  const isPublic = !isDM && !isGroup;
  const canSchedule = isDM || isGroup;
  const displayName = isDM ? activeChannel.other_user?.name : activeChannel.name;

  const subtitle = isDM
    ? (activeChannel.other_user?.status === 'online' ? '● Online' : activeChannel.other_user?.status === 'away' ? '● Away' : '● Offline')
    : isGroup ? `Group · Private` : `#${activeChannel.name}`;
  const subtitleColor = isDM && activeChannel.other_user?.status === 'online' ? '#4caf50'
    : isDM && activeChannel.other_user?.status === 'away' ? '#ff9800' : '#888';

  const pinnedMessages = messages.filter(m => m.pinned && !m.deleted_at);
  const fav = isFav(activeChannel.id);
  const muted = isMuted(activeChannel.id);

  const handleLeave = async () => {
    try {
      await axios.delete(`${API}/channels/${activeChannelId}`);
      await fetchChannels();
      setShowLeaveConfirm(false);
      setShowMenu(false);
    } catch {
      setShowLeaveConfirm(false);
    }
  };

  const openChannelSettings = () => {
    useUIStore.getState().setRightPanelTab('info');
    if (!useUIStore.getState().rightPanelOpen) useUIStore.getState().toggleRightPanel();
    setShowMenu(false);
  };

  return (
    <>
      {showMeetModal && activeChannelId && (
        <ScheduleMeetModal channelId={activeChannelId} channelName={displayName || ''} onClose={() => setShowMeetModal(false)} />
      )}
      {showMembers && activeChannelId && <MembersPanel channelId={activeChannelId} onClose={() => setShowMembers(false)} />}
      {showPinned && <PinnedPanel messages={pinnedMessages} onClose={() => setShowPinned(false)}
        onJump={(msgId) => {
          useUIStore.getState().jumpToMessage(msgId);
          setShowPinned(false);
        }} />}

      {/* Leave-channel confirmation */}
      {showLeaveConfirm && (
        <div onClick={() => setShowLeaveConfirm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 10, width: 360, padding: '18px 20px', boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 6 }}>Leave {isGroup ? 'group' : 'channel'}?</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>You'll stop receiving messages from <strong>{displayName}</strong>. You can be re-added later.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowLeaveConfirm(false)} style={{ padding: '7px 14px', border: '1px solid #dde1e7', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleLeave} style={{ padding: '7px 14px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {isDM && activeChannel.other_user && (
          <div style={{ position: 'relative' }}>
            <Avatar name={activeChannel.other_user.name} avatarUrl={activeChannel.other_user.avatar_url} size={36} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', border: '2px solid #fff', background: activeChannel.other_user.status === 'online' ? '#4caf50' : activeChannel.other_user.status === 'away' ? '#ff9800' : '#bbb' }} />
          </div>
        )}
        {isGroup && <Avatar name={activeChannel.name} logoColor={activeChannel.logo_color} logoAbbr={activeChannel.logo_abbr} logoUrl={activeChannel.logo_url} isGroup size={36} />}
        {isPublic && <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: BLUE, flexShrink: 0 }}>#</div>}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: BLUE_DARK, fontSize: 15 }}>{displayName}</span>

            {/* Star/Favorite toggle */}
            <span onClick={() => toggleFav(activeChannel.id)}
              title={fav ? 'Remove from favorites' : 'Add to favorites'}
              style={{ cursor: 'pointer', fontSize: 14, color: fav ? '#f9a825' : '#ccc', padding: '0 2px', transition: 'color .15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f9a825')}
              onMouseLeave={e => (e.currentTarget.style.color = fav ? '#f9a825' : '#ccc')}>
              ★
            </span>

            {/* Mute channel toggle */}
            <span onClick={() => toggleMute(activeChannel.id)}
              title={muted ? 'Unmute channel notifications' : 'Mute channel notifications'}
              style={{ cursor: 'pointer', fontSize: 13, color: muted ? '#ff9800' : '#ccc', padding: '0 2px', transition: 'color .15s' }}
              onMouseEnter={e => { if (!muted) e.currentTarget.style.color = '#999'; }}
              onMouseLeave={e => (e.currentTarget.style.color = muted ? '#ff9800' : '#ccc')}>
              {muted ? '🔕' : '🔔'}
            </span>

            {isGroup && <span style={{ fontSize: 10, color: '#888', background: '#f0f0f0', borderRadius: 8, padding: '1px 6px' }}>🔒 Private</span>}

            {!isDM && (
              <span onClick={() => setShowMembers(true)}
                style={{ fontSize: 11, color: '#888', cursor: 'pointer', background: '#f0f0f0', borderRadius: 10, padding: '1px 7px', fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.color = BLUE; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.color = '#888'; }}>
                👥 {memberStats.total > 0
                    ? (isGroup ? `${memberStats.online}/${memberStats.total} online` : `${memberStats.total} members`)
                    : 'members'}
              </span>
            )}

            {pinnedMessages.length > 0 && (
              <span onClick={() => setShowPinned(true)}
                style={{ fontSize: 11, color: '#888', cursor: 'pointer', background: '#fffde7', borderRadius: 10, padding: '1px 7px', fontWeight: 500, border: '1px solid #ffe082' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fff9c4')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fffde7')}>
                📌 {pinnedMessages.length}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: subtitleColor, marginTop: 1 }}>{subtitle}</div>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
          <TitleBtn onClick={toggleInlineSearch}>🔍 Search</TitleBtn>
          {canSchedule && <TitleBtn onClick={() => setShowMeetModal(true)} blue>📅 Schedule</TitleBtn>}
          {!isDM && <TitleBtn onClick={() => setShowPinned(true)}>📌 Pinned{pinnedMessages.length > 0 ? ` (${pinnedMessages.length})` : ''}</TitleBtn>}
          <TitleBtn green onClick={() => activeChannelId && startCall(activeChannelId, 'audio')}>📞 Audio</TitleBtn>
          <TitleBtn green onClick={() => activeChannelId && startCall(activeChannelId, 'video')}>📹 Video</TitleBtn>

          {/* Overflow menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(o => !o)}
              title="More"
              style={{ padding: '4px 10px', border: '1px solid #dde1e7', background: showMenu ? '#f5f5f5' : '#fff', color: '#555', cursor: 'pointer', fontSize: 14, borderRadius: 6, fontFamily: 'inherit', fontWeight: 700, lineHeight: 1, letterSpacing: 1 }}>
              ⋯
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)', minWidth: 200, zIndex: 1500, overflow: 'hidden' }}>
                <MenuItem icon="⚙️" label="Channel settings" onClick={openChannelSettings} />
                <MenuItem icon="🔗" label="Log activity to PCI" onClick={() => setShowMenu(false)} />
                <div style={{ height: 1, background: '#f0f0f0' }} />
                <MenuItem icon="🚪" label={`Leave ${isGroup ? 'group' : 'channel'}`} danger onClick={() => { setShowMenu(false); setShowLeaveConfirm(true); }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline search bar — appears below title bar when active */}
      {inlineSearchOpen && (
        <div style={{ background: '#fff3e0', borderBottom: '1px solid #ffe0b2', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <input
            autoFocus
            value={channelSearchQuery}
            onChange={e => setChannelSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') toggleInlineSearch(); }}
            placeholder={`Search in ${displayName}…`}
            style={{ flex: 1, border: '1px solid #ffcc80', borderRadius: 6, padding: '5px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={toggleInlineSearch}
            style={{ padding: '4px 10px', background: '#fff', border: '1px solid #ffcc80', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#e65100', fontFamily: 'inherit' }}>
            ✕ Close
          </button>
        </div>
      )}
    </>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: danger ? '#c62828' : '#1a1a2e' }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? '#fff5f5' : '#f5f5f5')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function TitleBtn({ children, onClick, blue, green }: { children: React.ReactNode; onClick: () => void; blue?: boolean; green?: boolean }) {
  return (
    <button onClick={onClick} style={{ padding: '4px 10px', border: `1px solid ${blue ? '#90caf9' : green ? '#a5d6a7' : '#dde1e7'}`, background: blue ? '#f0f7ff' : '#fff', color: blue ? BLUE_DARK : green ? '#2e7d32' : '#555', cursor: 'pointer', fontSize: 11, borderRadius: 6, fontFamily: 'inherit', fontWeight: blue ? 600 : 400, whiteSpace: 'nowrap' }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(.95)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}>
      {children}
    </button>
  );
}

const TABS = [
  { key: 'pci',   label: 'PCI'   },
  { key: 'info',  label: 'Info'  },
  { key: 'files', label: 'Files' },
  { key: 'log',   label: 'Log'   },
] as const;

const DUMMY_FILES = [
  { name: 'Dashboard_Mockup_v3_final.png', size: '2.1 MB', type: 'PNG', from: 'Dušan Mandić',    ago: '2h ago' },
  { name: 'DWM_Backend_Architecture.pdf',  size: '1.2 MB', type: 'PDF', from: 'Staša Bugarski',  ago: '1d ago' },
  { name: 'QA_Test_Report_April.xlsx',     size: '198 KB', type: 'XLSX',from: 'Fedor Drmanović', ago: '2d ago' },
  { name: 'IAS_Hub_Demo_Script.docx',      size: '45 KB',  type: 'DOCX',from: 'Dean Bedford',    ago: '5d ago' },
  { name: 'Architecture_Proposal_Q3.pdf',  size: '1.6 MB', type: 'PDF', from: 'Veselko Pešut',   ago: '7d ago' },
];
const FILE_ICONS: Record<string, string> = { PNG: '🖼️', PDF: '📄', XLSX: '📊', DOCX: '📝' };

const DUMMY_LOG = [
  { date: '14 Apr', type: 'Meeting', subject: 'Q2 Strategy Review',         person: 'Marko Petrović', status: 'Complete' },
  { date: '10 Apr', type: 'Call',    subject: 'Contract renewal discussion', person: 'Ana Kovač',      status: 'Complete' },
  { date: '08 Apr', type: 'Email',   subject: 'Proposal follow-up',          person: 'Marko Petrović', status: 'Active'   },
  { date: '28 Mar', type: 'Meeting', subject: 'Onboarding kickoff',          person: 'Team',           status: 'Complete' },
];
const DUMMY_MEMBERS = ['Ivana Vrtunic', 'Staša Bugarski', 'Dean Bedford', 'Veselko Pešut', 'Peđa Jovanović', 'Dušan Mandić', 'Fedor Drmanović'];

type DateRange = 'today' | '2days' | 'week' | 'month';

const ALL_PCI_ITEMS = [
  { type: 'Meeting', subject: 'IAS Hub Sprint Review',     status: 'Active', daysFromNow: 0  },
  { type: 'Task',    subject: 'Review IAS-533 QA report',  status: 'Active', daysFromNow: 0  },
  { type: 'Call',    subject: 'Client demo preparation',    status: 'Active', daysFromNow: 1  },
  { type: 'Meeting', subject: 'Q3 Architecture planning',   status: 'Active', daysFromNow: 3  },
  { type: 'Task',    subject: 'Dashboard implementation',   status: 'Active', daysFromNow: 5  },
  { type: 'Meeting', subject: 'DWM workflow review',        status: 'Active', daysFromNow: 6  },
  { type: 'Task',    subject: 'Update Confluence docs',     status: 'Active', daysFromNow: 8  },
  { type: 'Meeting', subject: 'Client demo — Adriatic',     status: 'Active', daysFromNow: 14 },
  { type: 'Task',    subject: 'Q3 planning proposal',       status: 'Active', daysFromNow: 20 },
  { type: 'Meeting', subject: 'Monthly team retrospective', status: 'Active', daysFromNow: 28 },
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

const PCI_ITEMS = ALL_PCI_ITEMS.map(item => ({ ...item, date: addDays(new Date(), item.daysFromNow) }));

function filterByRange(range: DateRange) {
  const limit = range === 'today' ? 0 : range === '2days' ? 2 : range === 'week' ? 7 : 30;
  return PCI_ITEMS.filter(item => item.daysFromNow <= limit);
}

function GroupInfoPanel({ channel }: { channel: any }) {
  const { fetchChannels } = useChatStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(channel.name || '');
  const [about, setAbout] = useState('IAS Hub development and project coordination team');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('week');

  const pciItems = filterByRange(dateRange);
  const typeIcon: Record<string, string> = { Meeting: '📅', Call: '📞', Task: '✅', Email: '📧' };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/channels/${channel.id}`, { name, description: about });
      await fetchChannels();
    } catch { } finally { setSaving(false); setEditing(false); setConfirmDelete(false); }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/channels/${channel.id}`);
      await fetchChannels();
    } catch { setConfirmDelete(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '6px 8px', border: '1px solid #dde1e7',
    borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ fontSize: 12, overflowY: 'auto', flex: 1 }}>
      <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: channel.logo_color || BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {channel.logo_abbr || channel.name?.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)} style={{ ...inp, fontWeight: 700, fontSize: 13 }} autoFocus />
          ) : (
            <div style={{ fontWeight: 700, fontSize: 13, color: BLUE_DARK }}>{channel.name}</div>
          )}
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>🔒 Private Group · 7 members</div>
        </div>
        <button onClick={() => { setEditing(e => !e); setConfirmDelete(false); }} title={editing ? 'Cancel' : 'Edit group'}
          style={{ background: editing ? '#e3f2fd' : 'transparent', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', fontSize: 15, color: editing ? BLUE : '#ccc', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = BLUE; e.currentTarget.style.background = '#f0f7ff'; }}
          onMouseLeave={e => { e.currentTarget.style.color = editing ? BLUE : '#ccc'; e.currentTarget.style.background = editing ? '#e3f2fd' : 'transparent'; }}>
          ✏️
        </button>
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>About</div>
        {editing ? (
          <textarea value={about} onChange={e => setAbout(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="What is this group for?" />
        ) : (
          <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>{about}</div>
        )}
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '7px', background: BLUE, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
              {saving ? 'Saving...' : '✓ Save Changes'}
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: '7px', border: '1px solid #ffcdd2', color: '#c62828', background: '#fff', cursor: 'pointer', fontSize: 11, borderRadius: 6, fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#ffebee')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                🗑️ Delete Group
              </button>
            ) : (
              <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#c62828', fontWeight: 600, marginBottom: 6 }}>Delete "{channel.name}"?</div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>This will permanently delete the group and all its messages.</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleDelete} style={{ flex: 1, padding: '6px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #dde1e7', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Members</div>
        {DUMMY_MEMBERS.map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: stringToColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {n.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <span style={{ fontSize: 12 }}>{n}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>PLANet IAS Schedule</div>
          <select value={dateRange} onChange={e => setDateRange(e.target.value as DateRange)}
            style={{ fontSize: 10, border: '1px solid #dde1e7', borderRadius: 5, padding: '2px 5px', fontFamily: 'inherit', cursor: 'pointer', color: '#555' }}>
            <option value="today">Today only</option>
            <option value="2days">Next 2 days</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
        {pciItems.length === 0 ? (
          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '8px 0' }}>No items for this period</div>
        ) : pciItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderBottom: '1px solid #f8f8f8', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{typeIcon[item.type] || '•'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: BLUE_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subject}</div>
              <div style={{ fontSize: 10, color: '#888' }}>
                {item.daysFromNow === 0 ? 'Today' : item.daysFromNow === 1 ? 'Tomorrow' : item.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                {' · '}{item.type}
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 7, background: '#e3f2fd', color: BLUE, flexShrink: 0 }}>{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DMInfoPanel({ channel }: { channel: any }) {
  return (
    <div style={{ padding: '10px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: BLUE_DARK, marginBottom: 10 }}>{channel.other_user?.name}</div>
      {[
        { label: 'Type',  value: 'Direct Message' },
        { label: 'Email', value: channel.other_user?.email || '—' },
        { label: 'Role',  value: channel.other_user?.role || '—' },
      ].map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', borderBottom: '1px solid #f5f5f5', padding: '5px 0' }}>
          <span style={{ color: '#aaa', width: 70, flexShrink: 0, fontSize: 11 }}>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#1a1a2e', flex: 1 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function InfoPanel({ channel }: { channel: any }) {
  if (!channel) return <div style={{ padding: 16, color: '#aaa', fontSize: 12 }}>Select a channel</div>;
  if (channel.type === 'group') return <GroupInfoPanel channel={channel} />;
  if (channel.type === 'dm') return <DMInfoPanel channel={channel} />;
  return (
    <div style={{ padding: '10px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: BLUE_DARK, marginBottom: 10 }}>{channel.name}</div>
      {[
        { label: 'Type', value: 'Public Channel' }, { label: 'Created', value: 'April 2026' }, { label: 'Members', value: '7' },
      ].map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', borderBottom: '1px solid #f5f5f5', padding: '5px 0' }}>
          <span style={{ color: '#aaa', width: 70, flexShrink: 0, fontSize: 11 }}>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#1a1a2e', flex: 1 }}>{value}</span>
        </div>
      ))}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Members</div>
        {DUMMY_MEMBERS.map(name => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: stringToColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <span style={{ fontSize: 12 }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesPanel() {
  const { activeChannelId } = useChatStore();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pciModalFor, setPciModalFor] = useState<any | null>(null);

  useEffect(() => {
    if (!activeChannelId) { setFiles([]); setLoading(false); return; }
    setLoading(true);
    axios.get(`${API}/channels/${activeChannelId}/files?limit=50`)
      .then(r => setFiles(r.data.data || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [activeChannelId]);

  const API_ROOT = API.replace(/\/api$/, '');

  const fmtBytes = (b: number) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };
  const fmtAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };
  const getIcon = (name: string, mime: string) => {
    if (mime?.startsWith('image/')) return '🖼️';
    if (mime?.startsWith('video/')) return '🎬';
    if (mime?.startsWith('audio/')) return '🎙️';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const m: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', sql: '🗄️', md: '📋', txt: '📋', zip: '🗜️' };
    return m[ext] || '📎';
  };

  return (
    <div>
      {pciModalFor && (
        <LogActivityModal
          initialSubject={`File — ${pciModalFor.file_name}`}
          initialActivityType="Note"
          initialNote={`Attached file: ${pciModalFor.file_name}`}
          onClose={() => setPciModalFor(null)}
        />
      )}
      <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Shared Files {files.length > 0 && `(${files.length})`}
      </div>
      {loading ? (
        <div style={{ padding: '20px 12px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>Loading…</div>
      ) : files.length === 0 ? (
        <div style={{ padding: '20px 12px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
          No files shared yet
        </div>
      ) : files.map(f => {
        const basename = (f.storage_path || '').split('/').pop() || '';
        const streamUrl = basename ? `${API_ROOT}/uploads/${basename}` : null;
        const downloadUrl = `${API_ROOT}/api/files/${f.id}/download`;
        const isImage = f.mime_type?.startsWith('image/');
        return (
          <div key={f.id} style={{ padding: '7px 12px', borderBottom: '1px solid #f5f5f5', fontSize: 11 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isImage && streamUrl ? (
                <div style={{ width: 30, height: 30, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: '#f5f5f5' }}>
                  <img src={streamUrl} alt={f.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <span style={{ fontSize: 20, flexShrink: 0, width: 30, textAlign: 'center' }}>{getIcon(f.file_name, f.mime_type)}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: BLUE_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                <div style={{ fontSize: 9, color: '#888' }}>{fmtBytes(f.file_size)} · {f.uploaded_by_name} · {fmtAgo(f.created_at)}</div>
              </div>
              <a href={downloadUrl} download={f.file_name} title="Download"
                style={{ fontSize: 12, color: '#bbb', textDecoration: 'none', padding: '2px 3px', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
                onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>⬇</a>
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
              <button onClick={() => setPciModalFor(f)}
                style={{ padding: '2px 7px', fontSize: 9, fontFamily: 'inherit', border: '1px solid #dde1e7', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#555' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.borderColor = '#90caf9'; e.currentTarget.style.color = BLUE; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#dde1e7'; e.currentTarget.style.color = '#555'; }}>
                🔗 Log to PCI
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogPanel() {
  const { activeChannel } = useChatStore();
  const [showModal, setShowModal] = useState(false);

  // Channel-scoped initial values for the modal
  const isDM = activeChannel?.type === 'dm';
  const otherName = isDM ? (activeChannel?.other_user?.name || '') : '';
  const participants = isDM && otherName ? [otherName] : [];
  const entities: string[] = [];

  return (
    <div>
      {showModal && activeChannel && (
        <LogActivityModal
          initialSubject={isDM ? `Conversation with ${otherName}` : `Discussion in ${activeChannel.name}`}
          initialActivityType={isDM ? 'Call' : 'Meeting'}
          initialParticipants={participants}
          initialEntities={entities}
          onClose={() => setShowModal(false)}
        />
      )}

      <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        PCI Activity Log
      </div>
      {DUMMY_LOG.map((item, i) => (
        <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5', fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.subject}</span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: item.status === 'Active' ? '#e3f2fd' : '#e8f5e9', color: item.status === 'Active' ? BLUE : '#2e7d32', flexShrink: 0, marginLeft: 4 }}>{item.status}</span>
          </div>
          <div style={{ color: '#888' }}>{item.type} · {item.person} · {item.date}</div>
        </div>
      ))}
      <div style={{ padding: '10px 12px' }}>
        <button onClick={() => setShowModal(true)}
          disabled={!activeChannel}
          style={{
            width: '100%', padding: 7,
            border: `1px solid ${activeChannel ? BLUE : '#ddd'}`,
            color: activeChannel ? BLUE : '#aaa',
            background: '#fff',
            cursor: activeChannel ? 'pointer' : 'not-allowed',
            fontSize: 11, borderRadius: 6, fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (activeChannel) { e.currentTarget.style.background = BLUE; e.currentTarget.style.color = '#fff'; } }}
          onMouseLeave={e => { if (activeChannel) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = BLUE; } }}>
          + Log Activity to PCI
        </button>
      </div>
    </div>
  );
}

function RightPanelTabs() {
  const { rightPanelTab, setRightPanelTab } = useUIStore();
  const { activeChannel } = useChatStore();
  return (
    <>
      <div style={{ display: 'flex', borderBottom: '2px solid #1976d2', background: '#f8f9fa', flexShrink: 0 }}>
        {TABS.map(t => (
          <div key={t.key} onClick={() => setRightPanelTab(t.key)} style={{
            flex: 1, textAlign: 'center', padding: '6px 2px', fontSize: 10,
            cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap', transition: 'all .15s',
            background: rightPanelTab === t.key ? '#1976d2' : 'transparent',
            color: rightPanelTab === t.key ? '#fff' : '#555',
          }}>{t.label}</div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {rightPanelTab === 'pci'   && <PCIContextPanel />}
        {rightPanelTab === 'info'  && <InfoPanel channel={activeChannel} />}
        {rightPanelTab === 'files' && <FilesPanel />}
        {rightPanelTab === 'log'   && <LogPanel />}
      </div>
    </>
  );
}
