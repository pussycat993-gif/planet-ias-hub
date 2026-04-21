import React, { useState, useMemo } from 'react';

const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── Help content ──────────────────────────────────────────
const SECTIONS = [
  {
    id: 'getting-started',
    title: '🚀 Getting Started',
    articles: [
      {
        id: 'login',
        title: 'Logging in',
        content: `IAS Hub uses your PLANet Systems Group credentials. Navigate to http://localhost:5174 and enter your email (firstname.lastname@planetsg.com) and your password. Your session is saved — you won't need to log in again unless you explicitly log out.`,
      },
      {
        id: 'profile',
        title: 'Your profile and status',
        content: `Click your name in the top-right corner to open the profile menu. From here you can:\n• Update your status (Online / Away / Offline)\n• Set a custom status message (e.g. "In a meeting", "Focusing")\n• Access your profile settings\n• Log out of PLANet Systems Group\n\nYour status dot (green / orange / grey) is visible to all team members next to your name.`,
      },
    ],
  },
  {
    id: 'navigation',
    title: '🗺️ Navigation',
    articles: [
      {
        id: 'tabs',
        title: 'Tab bar — All, Direct Messages, Calls, Files',
        content: `The tab bar below the toolbar lets you switch between views:\n\n• All — shows all channels and groups you're a member of. Channels are organised in sections: Groups, Public, Private. Favourited channels always appear at the top.\n• Direct Messages — shows all your 1-on-1 conversations with team members. Online/Away/Offline status is shown next to each person.\n• Calls — shows your recent call history (audio and video). Red arrow indicates a missed call. Click the call icon to call back.\n• Files — (coming soon) shows all files shared across your channels.\n\nUnread message counts appear as red badges on the All and Direct Messages tabs.`,
      },
      {
        id: 'sidebar',
        title: 'Sidebar',
        content: `The sidebar on the left shows the list of channels, DMs, or call history depending on the active tab.\n\n• Search — type in the search box at the top of the sidebar to filter channels or DMs by name in real time.\n• Favourites — click the ★ star on hover to pin any channel or DM to the top of the list. Favourites persist across sessions.\n• Unread badge — red bubble on a channel row shows the number of unread messages.\n• + button — creates a new channel, group, or message depending on the active section.\n• Notifications bell — in the sidebar footer, click 🔔 to see recent notifications. Red badge shows unread count. Click any notification to jump to the relevant channel.`,
      },
      {
        id: 'search',
        title: 'Global search',
        content: `The search bar in the top header searches messages within the currently active channel in real time as you type. Matching messages are highlighted and a result count is shown.\n\nTo clear the search, click the ✕ button or delete the text. The search is case-insensitive and matches both message content and sender names.`,
      },
    ],
  },
  {
    id: 'messaging',
    title: '💬 Messaging',
    articles: [
      {
        id: 'sending',
        title: 'Sending messages',
        content: `Type your message in the input field at the bottom of the chat and press Enter or click Send.\n\n• Shift + Enter — adds a new line without sending\n• @ — type @ to mention a team member\n• 😊 — click the emoji icon for emoji picker\n• 🔗 Log — toggle to mark the conversation for logging to PLANet IAS`,
      },
      {
        id: 'attachments',
        title: 'Attaching files and images',
        content: `You can attach multiple files or images in a single message:\n\n1. Click the 📎 paperclip icon — opens a file picker where you can select multiple files at once\n2. Drag & drop — drag files directly onto the message input area\n\nAttachments show a preview area above the input:\n• Images show a thumbnail (72×72)\n• Documents show a file icon, name, and size\n• Click ✕ on any attachment to remove it before sending\n• Click "+ Add more" to add additional files\n\nThe 📎 icon shows a blue badge with the count of pending attachments.\nSupported types: images (PNG, JPG, GIF, WEBP), PDF, DOC/DOCX, XLS/XLSX, TXT, MD, SQL, ZIP, MP4`,
      },
      {
        id: 'reactions',
        title: 'Emoji reactions',
        content: `Hover over any message to reveal the action toolbar. Click 😊 to open the emoji picker with 6 quick reactions: 👍 ❤️ 😂 🙏 🎉 🔥\n\nClick an emoji to react. Reactions appear below the message. Click a reaction again to remove it.\n\nMultiple people can react with the same emoji — the count is shown on the reaction bubble.`,
      },
      {
        id: 'reply',
        title: 'Replying to a message',
        content: `Hover over a message and click ↩ to reply. A blue reply context bar appears above the input showing the quoted sender and message preview.\n\nPress Esc or click ✕ on the reply bar to cancel. Your reply is sent as a regular message with the context shown above it.`,
      },
      {
        id: 'pin',
        title: 'Pinning messages',
        content: `Hover over a message and click 📌 to pin it. Pinned messages get a gold left border and a "PINNED" badge.\n\nClick the 📌 Pinned button in the channel title bar (or the 📌 N badge) to open the Pinned Messages panel which slides in from the right. Click "Jump to message →" to scroll to that message.\n\nClick 📌 again on a pinned message to unpin it.`,
      },
      {
        id: 'typing',
        title: 'Typing indicators',
        content: `When a team member starts typing, you'll see an animated "... is typing" indicator at the bottom of the message list. This disappears automatically after 2 seconds of inactivity or when they send the message.`,
      },
      {
        id: 'user-profile',
        title: 'Viewing a user profile',
        content: `Click on any user's avatar or name in the message list to open their profile card. The card shows:\n• Name, role, and current status\n• Email (click to send email)\n• 💬 Message and 📞 Call buttons\n\nClick anywhere outside the card to close it.`,
      },
    ],
  },
  {
    id: 'channels-groups',
    title: '📢 Channels & Groups',
    articles: [
      {
        id: 'channels-overview',
        title: 'Channels vs Groups vs DMs',
        content: `IAS Hub has three types of conversations:\n\n• Public Channels (#) — open to all team members, used for project-wide communication\n• Private Channels — invite-only, for sensitive topics\n• Groups (⬡) — team groups with a logo (colour + abbreviation), used for workgroups\n• Direct Messages (💬) — private 1-on-1 conversations\n\nAll types support messaging, file sharing, reactions, replies, pinning, and calls.`,
      },
      {
        id: 'create-channel',
        title: 'Creating a channel or group',
        content: `Click the + button in the sidebar header or use the toolbar buttons:\n• "+ New Channel" — creates a public or private channel\n• "⬡ New Group" — creates a group with a custom logo (colour, abbreviation, or image)\n• "✎ New Message" — starts a direct message with a team member\n\nWhen creating a group you can: set a name and description, choose a logo colour from 8 options, set a 2-4 character abbreviation, upload a custom image, and add members.`,
      },
      {
        id: 'channel-header',
        title: 'Channel title bar actions',
        content: `The title bar above the message list shows the channel or person name and provides quick actions:\n\n• 📅 Schedule Meet — (DMs and Groups only) schedule a meeting with all participants\n• 📌 Pinned — opens the Pinned Messages panel\n• 👥 Members — opens the Members panel showing online/away/offline status\n• 🔗 Log to PCI — log this conversation to PLANet Contact IAS\n• 📞 Audio / 📹 Video — start an audio or video call`,
      },
      {
        id: 'members-panel',
        title: 'Members panel',
        content: `Click 👥 Members in the title bar or the "👥 N members" badge to open the Members panel. It slides in from the right and shows:\n\n• Total member count and how many are online\n• Members grouped by status: Online (green) / Away (orange) / Offline (grey)\n• Each member: avatar with status dot, name, role\n• 💬 button to start a direct message with that person\n• Search field to filter members by name or role`,
      },
    ],
  },
  {
    id: 'calls',
    title: '📹 Audio & Video Calls',
    articles: [
      {
        id: 'starting-call',
        title: 'Starting a call',
        content: `Start a call from the channel title bar:\n• 📞 Audio — starts an audio-only call\n• 📹 Video — starts a video call\n\nA pre-call dialog appears before joining. Here you can:\n• See who you're calling\n• Enable or disable Whisper AI Transcription\n• Click "Join Call" to connect or "Cancel" to dismiss`,
      },
      {
        id: 'transcription',
        title: 'Whisper AI transcription',
        content: `Enable transcription in the pre-call dialog by toggling "Enable Transcription" ON. When enabled during a video call:\n\n• The screen splits into 3 panels: your camera | the other person's camera | live transcript\n• The transcript auto-scrolls and shows each speaker's name with a timestamp\n• For audio calls, the transcript appears in a panel during the call\n\nAfter the call ends, the Post-call modal appears automatically.`,
      },
      {
        id: 'call-controls',
        title: 'Call controls',
        content: `During a call, the control bar at the bottom provides:\n\n• 🎤 Mute / Unmute — toggle your microphone\n• 📹 Camera — toggle your camera on/off (video calls only)\n• 🖥 Share — start/stop screen sharing\n• ✋ Raise Hand — signal to the other participant\n• 📵 End — end the call for yourself`,
      },
      {
        id: 'post-call',
        title: 'Post-call modal and logging to PCI',
        content: `After ending a call (when transcription was enabled), a Post-call modal appears with:\n\n• Call summary: duration, participants, date\n• Transcript viewer: formatted speaker | time | text layout\n• Editable raw text area for corrections\n\nThree actions:\n• Discard — close without saving\n• 💾 Save File — downloads the transcript as a .txt file\n• ↗ Log into PLANet IAS — opens the New Activity form\n\nThe New Activity form is pre-filled with:\n• Subject from the call participants\n• Full transcript in the Note field\n• People detected from the transcript (mentions of team members)\n• Entities detected from keywords (IAS Hub, DWM, Adriatic Holdings, etc.)\n\nYou can edit all fields before clicking Save.`,
      },
    ],
  },
  {
    id: 'schedule-meet',
    title: '📅 Schedule Meeting',
    articles: [
      {
        id: 'schedule-overview',
        title: 'Scheduling a meeting',
        content: `Click "📅 Schedule Meet" in the channel title bar (available in DMs and Groups) to open the Schedule Meeting modal.\n\nFill in:\n• Meeting title — required. As you type, entity suggestions appear automatically based on keywords (e.g. "DWM" suggests DWM Module Development, "sprint" suggests IAS Sprint Board)\n• Date & Time — default is tomorrow at 10:00\n• Duration — 15, 30, 45, 60, 90, or 120 minutes\n• Suggested Entities — toggle on/off the auto-detected PCI entities\n• Participants — all channel members are selected by default. Click to deselect individuals.\n\nA meeting summary card is shown live at the bottom.\n\nOn confirm:\n• A meeting card is posted in the channel chat\n• All selected participants receive a notification\n• The meeting is logged to PLANet Contact IAS with all people and entities`,
      },
    ],
  },
  {
    id: 'pci-integration',
    title: '🔗 PLANet Contact IAS Integration',
    articles: [
      {
        id: 'pci-panel',
        title: 'PCI Context Panel',
        content: `The right panel (click "◧ Context" in the toolbar) shows PCI context for the current conversation.\n\nThe PCI tab shows:\n• Person header: name, role, status badge, email\n• Company, entity tags, activity count, upcoming schedule\n• Clickable entity tags (📁 Projects, 🏢 Companies)\n• ↗ Open in PCI — opens the person's full record in PLANet Contact IAS\n• + Log Activity — inline form to log a new activity to PCI (type + subject)\n\nOther tabs:\n• Info — channel type, creation date, members list\n• Files — recently shared files in this channel\n• Log — recent PCI activities linked to this conversation`,
      },
      {
        id: 'log-activity',
        title: 'Logging activities to PCI',
        content: `There are three ways to log an activity to PLANet Contact IAS:\n\n1. PCI panel → "+ Log Activity" — quick inline form with type (Meeting, Call, Email, Task, Note) and subject\n2. Post-call modal → "↗ Log into PLANet IAS" — full New Activity form with auto-populated transcript, people, and entities\n3. Channel title bar → "🔗 Log to PCI" — logs the current conversation context\n\nAll logged activities appear in the PCI panel Log tab.`,
      },
    ],
  },
  {
    id: 'automations',
    title: '⚡ Automations',
    articles: [
      {
        id: 'automations-overview',
        title: 'Available automation modules',
        content: `Open the Automations panel via "⚡ Automations" in the toolbar. The panel has two tabs: Settings and Events.\n\nAvailable modules:\n\n• 📝 Smart Activity Logger — after each call, suggests a PCI activity log with detected people, entities, and action items from the transcript\n\n• 📅 Meeting Prep Briefing — posts a briefing card in the relevant channel a few minutes before an upcoming meeting, with PCI context and Jira sprint status. Configure timing (5–30 min before) in Briefing Timing section.\n\n• 🔄 DWM Workflow Trigger — when a document workflow in PLANet Contact IAS requires approval, an approve/reject card is posted directly in the chat. No need to switch to PCI.\n\n• ⬡ Auto-Channel from PCI — automatically creates a group channel when a new Client project or entity is added in PCI. OFF by default.\n\n• 🔔 Smart Notifications — filters notification noise: suppresses muted channels, elevates @mentions and Jira ticket references to the top.\n\nThe Events tab shows a log of all automation triggers with status (success / failed).`,
      },
    ],
  },
  {
    id: 'ai-assistant',
    title: '🤖 AI Assistant',
    articles: [
      {
        id: 'ai-overview',
        title: 'Using the AI Assistant',
        content: `Click 🤖 in the top header to open the AI Assistant panel on the right side of the screen.\n\nThe AI panel has:\n• A chat interface — ask any question in natural language\n• 5 quick chip buttons for common queries\n\nThe AI can answer questions about:\n• Jira tickets and sprint status ("What's the status of IAS-533?")\n• PLANet Contact IAS data via the n8n integration ("Who is Dean Bedford's main contact?")\n• General questions about the IAS Hub features\n\nThe AI uses the claude-sonnet model and has access to your Jira project and PCI data through the MCP server.`,
      },
    ],
  },
  {
    id: 'keyboard-shortcuts',
    title: '⌨️ Keyboard Shortcuts',
    articles: [
      {
        id: 'shortcuts',
        title: 'Shortcuts reference',
        content: `Messaging:\n• Enter — send message\n• Shift + Enter — new line\n• Escape — cancel reply or close modal\n\nSearch:\n• Type in the header search bar — filters messages in real time\n• Click ✕ or clear text — exits search\n\nCall controls (during a call):\n• All controls available via the bottom control bar\n\nGeneral:\n• ★ on hover — add/remove channel from favourites\n• Click avatar or name — open user profile\n• Click 📌 on hover — pin/unpin message\n• Click 😊 on hover — open emoji reaction picker`,
      },
    ],
  },
];

// ── Main Help Panel ───────────────────────────────────────
export default function HelpPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<string | null>(null);

  // Search filtering
  const results = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const hits: { section: string; article: typeof SECTIONS[0]['articles'][0] }[] = [];
    SECTIONS.forEach(s => {
      s.articles.forEach(a => {
        if (a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)) {
          hits.push({ section: s.title, article: a });
        }
      });
    });
    return hits;
  }, [search]);

  const currentSection = SECTIONS.find(s => s.id === activeSection);
  const currentArticle = currentSection?.articles.find(a => a.id === activeArticle);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 780, maxWidth: '96vw', height: '85vh', boxShadow: '0 12px 50px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: BLUE_DARK, color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>IAS Hub — Help & Documentation</div>
            <div style={{ fontSize: 11, opacity: .7, marginTop: 2 }}>Everything you need to know about IAS Hub</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', opacity: .8 }}>✕</button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f6f8', borderRadius: 10, padding: '8px 14px', border: '1px solid #eee' }}>
            <span style={{ color: '#aaa', fontSize: 16 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documentation..."
              autoFocus
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: '#1a1a2e' }}
            />
            {search && <span onClick={() => setSearch('')} style={{ color: '#bbb', cursor: 'pointer', fontSize: 16 }}>✕</span>}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Search results */}
          {results !== null ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
              {results.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#aaa' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                  <div style={{ fontSize: 14 }}>No results for "{search}"</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Try different keywords</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#888', padding: '6px 0 12px', fontWeight: 600 }}>{results.length} result{results.length !== 1 ? 's' : ''} for "{search}"</div>
                  {results.map(({ section, article }) => (
                    <div key={article.id}
                      onClick={() => { setActiveSection(SECTIONS.find(s => s.articles.find(a => a.id === article.id))?.id || null); setActiveArticle(article.id); setSearch(''); }}
                      style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid #eee', marginBottom: 8, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                      <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, marginBottom: 3 }}>{section}</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', marginBottom: 4 }}>{article.title}</div>
                      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {article.content.slice(0, 160)}...
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <>
              {/* Left nav */}
              <div style={{ width: 220, borderRight: '1px solid #eee', overflowY: 'auto', flexShrink: 0, padding: '8px 0' }}>
                {!activeSection && !activeArticle ? (
                  // Section list
                  SECTIONS.map(s => (
                    <div key={s.id}
                      onClick={() => { setActiveSection(s.id); setActiveArticle(s.articles[0]?.id || null); }}
                      style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {s.title}
                    </div>
                  ))
                ) : (
                  <>
                    <div onClick={() => { setActiveSection(null); setActiveArticle(null); }} style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 12, color: BLUE, display: 'flex', alignItems: 'center', gap: 5, borderBottom: '1px solid #f0f0f0', marginBottom: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      ← All topics
                    </div>
                    {currentSection?.articles.map(a => (
                      <div key={a.id}
                        onClick={() => setActiveArticle(a.id)}
                        style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: activeArticle === a.id ? BLUE_DARK : '#333', fontWeight: activeArticle === a.id ? 700 : 400, background: activeArticle === a.id ? '#e3f2fd' : 'transparent', borderLeft: activeArticle === a.id ? `3px solid ${BLUE}` : '3px solid transparent' }}
                        onMouseEnter={e => { if (activeArticle !== a.id) e.currentTarget.style.background = '#f0f7ff'; }}
                        onMouseLeave={e => { if (activeArticle !== a.id) e.currentTarget.style.background = 'transparent'; }}>
                        {a.title}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Right content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                {!activeSection && !activeArticle ? (
                  // Home — section cards
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: BLUE_DARK, marginBottom: 4 }}>Welcome to IAS Hub Help</div>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Select a topic below or use the search bar to find answers quickly.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {SECTIONS.map(s => (
                        <div key={s.id}
                          onClick={() => { setActiveSection(s.id); setActiveArticle(s.articles[0]?.id || null); }}
                          style={{ padding: '14px 16px', border: '1px solid #eee', borderRadius: 10, cursor: 'pointer', transition: 'all .15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f0f7ff'; e.currentTarget.style.borderColor = '#90caf9'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#eee'; }}>
                          <div style={{ fontSize: 15, marginBottom: 4 }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{s.articles.length} article{s.articles.length !== 1 ? 's' : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : currentArticle ? (
                  // Article view
                  <div>
                    <div style={{ fontSize: 11, color: BLUE, fontWeight: 600, marginBottom: 6 }}>{currentSection?.title}</div>
                    <div style={{ fontWeight: 700, fontSize: 20, color: BLUE_DARK, marginBottom: 16 }}>{currentArticle.title}</div>
                    <div style={{ fontSize: 14, color: '#1a1a2e', lineHeight: 1.8 }}>
                      {currentArticle.content.split('\n').map((line, i) => {
                        if (line.startsWith('• ')) {
                          return (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, paddingLeft: 8 }}>
                              <span style={{ color: BLUE, flexShrink: 0, marginTop: 2 }}>•</span>
                              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                            </div>
                          );
                        }
                        if (line === '') return <div key={i} style={{ height: 10 }} />;
                        return <div key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />;
                      })}
                    </div>

                    {/* Next article */}
                    {currentSection && (() => {
                      const idx = currentSection.articles.findIndex(a => a.id === activeArticle);
                      const next = currentSection.articles[idx + 1];
                      return next ? (
                        <div onClick={() => setActiveArticle(next.id)} style={{ marginTop: 28, padding: '12px 16px', border: `1px solid ${BLUE}`, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                          <div>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Next article</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: BLUE }}>{next.title}</div>
                          </div>
                          <span style={{ color: BLUE, fontSize: 18 }}>→</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
