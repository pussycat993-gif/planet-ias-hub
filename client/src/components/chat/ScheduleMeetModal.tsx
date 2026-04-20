import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { toLocalDateTimeString } from '../../utils/meetingDetector';
import EntityPickerModal, { PickerKind } from '../modals/EntityPickerModal';
import { MOCK_ENTITIES, MOCK_PEOPLE, MOCK_TAGS } from '../../utils/pickerData';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

interface Member { id: number; name: string; email: string; role?: string; avatar_url?: string; }

const ENTITY_KEYWORDS: { keywords: string[]; name: string; type: string }[] = [
  { keywords: ['adriatic', 'holdings'], name: 'Adriatic Holdings d.o.o.', type: 'Company' },
  { keywords: ['ias', 'hub', 'platform', 'product', 'software'], name: 'IAS Hub Project', type: 'Project' },
  { keywords: ['dwm', 'workflow', 'document'], name: 'DWM Module Development', type: 'Project' },
  { keywords: ['q2', 'q3', 'quarter', 'report', 'financial', 'budget'], name: 'Q3 Strategic Plan', type: 'Project' },
  { keywords: ['client', 'klijent', 'demo', 'onboard'], name: 'Client Onboarding', type: 'Project' },
  { keywords: ['design', 'ui', 'ux', 'mockup', 'figma'], name: 'Design System', type: 'Project' },
  { keywords: ['sprint', 'planning', 'review', 'retro', 'standup'], name: 'IAS Sprint Board', type: 'Project' },
  { keywords: ['architecture', 'backend', 'frontend', 'tech', 'development'], name: 'Technical Architecture', type: 'Project' },
];

function suggestEntities(title: string) {
  if (!title.trim()) return [];
  const lower = title.toLowerCase();
  return ENTITY_KEYWORDS
    .filter(e => e.keywords.some(kw => lower.includes(kw)))
    .map(e => ({ name: e.name, type: e.type }))
    .filter((e, i, arr) => arr.findIndex(x => x.name === e.name) === i)
    .slice(0, 4);
}

function MemberAvatar({ member, size = 28 }: { member: Member; size?: number }) {
  const initials = member.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#1565c0', '#2e7d32', '#6a1b9a', '#c62828', '#e65100', '#00695c'];
  let hash = 0;
  for (let i = 0; i < member.name.length; i++) hash = member.name.charCodeAt(i) + ((hash << 5) - hash);
  const bg = colors[Math.abs(hash) % colors.length];
  if (member.avatar_url) return <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}><img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>;
}

interface Props { channelId: number; channelName: string; onClose: () => void; initialTitle?: string; initialDate?: Date; detectedFrom?: string; }

export default function ScheduleMeetModal({ channelId, channelName, onClose, initialTitle, initialDate, detectedFrom }: Props) {
  const [title, setTitle] = useState(initialTitle || '');
  const [date, setDate] = useState(() => {
    const d = initialDate ? new Date(initialDate) : (() => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(10, 0, 0, 0); return t; })();
    return toLocalDateTimeString(d);
  });
  const [duration, setDuration] = useState(30);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [suggestedEntities, setSuggestedEntities] = useState<{ name: string; type: string }[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<{ name: string; type: string }[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState<PickerKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/channels/${channelId}/members`)
      .then(r => { const mems = r.data.data || []; setMembers(mems); setSelectedMembers(mems.map((m: Member) => m.id)); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [channelId]);

  useEffect(() => {
    const s = suggestEntities(title);
    setSuggestedEntities(s);
    setSelectedEntities(s);
  }, [title]);

  const toggleMember = (id: number) => setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleEntity = (e: { name: string; type: string }) => setSelectedEntities(prev => prev.find(x => x.name === e.name) ? prev.filter(x => x.name !== e.name) : [...prev, e]);

  const handleSchedule = async () => {
    if (!title.trim()) { setError('Meeting title is required'); return; }
    if (!date) { setError('Date and time is required'); return; }
    setSaving(true); setError('');
    try {
      const participantNames = members.filter(m => selectedMembers.includes(m.id)).map(m => m.name);

      // ✅ Fix: messages are at /api/messages, not /api/channels
      await axios.post(`${API}/messages/${channelId}/messages`, {
        body: `📅 Meeting Scheduled: ${title}`,
        message_type: 'meeting_card',
        automation_payload: {
          type: 'meeting_card',
          subject: title,
          meeting_date: new Date(date).toISOString(),
          duration_minutes: duration,
          participants: participantNames,
          entities: selectedEntities.map(e => e.name),
          channel_id: channelId,
          scheduled_by: user?.name,
        },
      });

      axios.post(`${API}/pci/scheduled-meeting`, {
        channel_id: channelId, subject: title,
        meeting_date: new Date(date).toISOString(),
        duration_minutes: duration,
        participants: participantNames,
        entities: selectedEntities,
        people: selectedPeople,
        tags: selectedTags,
      }).catch(() => {});

      axios.post(`${API}/notifications/broadcast`, {
        user_ids: selectedMembers,
        type: 'meeting',
        title: `📅 New meeting: ${title}`,
        body: `${new Date(date).toLocaleString()} · ${duration} min`,
        channel_id: channelId,
      }).catch(() => {});

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to schedule meeting');
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #dde1e7', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {pickerOpen && (
        <EntityPickerModal
          kind={pickerOpen}
          items={pickerOpen === 'entity' ? MOCK_ENTITIES : pickerOpen === 'people' ? MOCK_PEOPLE : MOCK_TAGS}
          alreadySelected={
            pickerOpen === 'entity' ? selectedEntities.map(e => e.name)
            : pickerOpen === 'people' ? selectedPeople
            : selectedTags
          }
          onSelect={(item) => {
            if (pickerOpen === 'entity') {
              if (!selectedEntities.find(x => x.name === item.name)) {
                setSelectedEntities(prev => [...prev, { name: item.name, type: item.type }]);
              }
            } else if (pickerOpen === 'people') {
              if (!selectedPeople.includes(item.name)) setSelectedPeople(prev => [...prev, item.name]);
            } else if (pickerOpen === 'tag') {
              if (!selectedTags.includes(item.name)) setSelectedTags(prev => [...prev, item.name]);
            }
          }}
          onClose={() => setPickerOpen(null)}
        />
      )}
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 500, maxWidth: '95vw', maxHeight: '90vh', boxShadow: '0 8px 40px rgba(0,0,0,.2)', fontFamily: 'Segoe UI, Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: BLUE_DARK }}>📅 Schedule Meeting</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>in {channelName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {detectedFrom && (
          <div style={{ margin: '10px 18px 0', padding: '8px 12px', background: '#fffde7', border: '1px solid #ffe082', borderRadius: 8, fontSize: 11, color: '#5d4037', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Auto-detected from message</div>
              <div style={{ opacity: 0.85, fontStyle: 'italic' }}>"{detectedFrom}"</div>
            </div>
          </div>
        )}

        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 7, fontSize: 12 }}>{error}</div>}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Meeting title <span style={{ color: '#c62828' }}>*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q3 Sprint Planning, DWM Review..." style={inp} autoFocus />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Date & Time <span style={{ color: '#c62828' }}>*</span></label>
              <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ ...inp, cursor: 'pointer' }}>
                {[15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m >= 60 ? `${m / 60}h` : `${m} min`}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span>
                Entities
                {suggestedEntities.length > 0 && <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>— suggestions based on title</span>}
              </span>
              <span
                onClick={() => setPickerOpen('entity')}
                title="Add entity"
                style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', lineHeight: 1, fontWeight: 700, flexShrink: 0 }}
              >+</span>
            </label>
            {(() => {
              // Union of selected + not-yet-selected suggestions, deduped by name
              const displayEntities = [
                ...selectedEntities,
                ...suggestedEntities.filter(s => !selectedEntities.find(x => x.name === s.name)),
              ];
              if (displayEntities.length === 0) {
                return (
                  <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>
                    {title.trim() ? 'No suggestions — click + to add entities' : 'Start typing a title to see suggestions, or click + to add manually'}
                  </div>
                );
              }
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {displayEntities.map(e => {
                    const sel = !!selectedEntities.find(x => x.name === e.name);
                    return (
                      <div key={e.name} onClick={() => toggleEntity(e)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 12, border: `1px solid ${sel ? BLUE : '#dde1e7'}`, background: sel ? '#e3f2fd' : '#fff', color: sel ? BLUE_DARK : '#555' }}>
                        <span>{e.type === 'Company' ? '🏢' : e.type === 'Event' ? '🎫' : e.type === 'Organization' ? '🏛️' : e.type === 'Software' ? '💻' : e.type === 'Award & Grant Program' ? '🏆' : '📁'}</span>
                        <span style={{ fontWeight: sel ? 700 : 400 }}>{e.name}</span>
                        {sel && (
                          <span
                            onClick={evt => { evt.stopPropagation(); setSelectedEntities(prev => prev.filter(x => x.name !== e.name)); }}
                            title="Remove"
                            style={{ fontSize: 12, color: BLUE_DARK, marginLeft: 2, padding: '0 2px', lineHeight: 1 }}
                          >✕</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
              Participants ({selectedMembers.length}/{members.length})
              <span onClick={() => setSelectedMembers(members.map(m => m.id))} style={{ fontWeight: 400, color: BLUE, cursor: 'pointer', marginLeft: 8, fontSize: 11 }}>Select all</span>
            </label>
            {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>Loading...</div> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {members.map(m => {
                  const sel = selectedMembers.includes(m.id);
                  return (
                    <div key={m.id} onClick={() => toggleMember(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 6px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${sel ? BLUE : '#dde1e7'}`, background: sel ? '#e3f2fd' : '#fff' }}>
                      <MemberAvatar member={m} size={22} />
                      <span style={{ fontSize: 12, color: sel ? BLUE_DARK : '#555', fontWeight: sel ? 700 : 400 }}>{m.name}</span>
                      {sel && <span style={{ fontSize: 10, color: BLUE }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* People — PCI contacts beyond Hub participants */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span>Additional People <span style={{ fontWeight: 400, color: '#888' }}>— PCI contacts</span></span>
              <span
                onClick={() => setPickerOpen('people')}
                title="Add person"
                style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', lineHeight: 1, fontWeight: 700, flexShrink: 0 }}
              >+</span>
            </label>
            {selectedPeople.length === 0 ? (
              <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>Click + to add PCI contacts (clients, prospects, external attendees)</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedPeople.map(p => (
                  <div key={p}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 12, border: `1px solid ${BLUE}`, background: '#e3f2fd', color: BLUE_DARK }}>
                    <span>👤</span>
                    <span style={{ fontWeight: 700 }}>{p}</span>
                    <span
                      onClick={() => setSelectedPeople(prev => prev.filter(x => x !== p))}
                      title="Remove"
                      style={{ cursor: 'pointer', fontSize: 12, color: BLUE_DARK, marginLeft: 2, padding: '0 2px', lineHeight: 1 }}
                    >✕</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span>Tags</span>
              <span
                onClick={() => setPickerOpen('tag')}
                title="Add tag"
                style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', lineHeight: 1, fontWeight: 700, flexShrink: 0 }}
              >+</span>
            </label>
            {selectedTags.length === 0 ? (
              <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>Click + to tag this meeting</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedTags.map(t => (
                  <div key={t}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 12, border: `1px solid ${BLUE}`, background: '#e3f2fd', color: BLUE_DARK }}>
                    <span>🏷️</span>
                    <span style={{ fontWeight: 700 }}>{t}</span>
                    <span
                      onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))}
                      title="Remove"
                      style={{ cursor: 'pointer', fontSize: 12, color: BLUE_DARK, marginLeft: 2, padding: '0 2px', lineHeight: 1 }}
                    >✕</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {title && selectedMembers.length > 0 && (
            <div style={{ background: '#f0f7ff', border: '1px solid #90caf9', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: BLUE_DARK, marginBottom: 4 }}>📋 Meeting Summary</div>
              <div style={{ color: '#555' }}>
                <b>{title}</b><br />
                📅 {new Date(date).toLocaleString()}<br />
                ⏱ {duration >= 60 ? `${duration / 60}h` : `${duration} min`} · 👤 {selectedMembers.length} participants<br />
                {selectedEntities.length > 0 && <>🏢 {selectedEntities.map(e => e.name).join(', ')}<br /></>}
                {selectedPeople.length > 0 && <>👥 {selectedPeople.join(', ')}<br /></>}
                {selectedTags.length > 0 && <>🏷️ {selectedTags.join(', ')}</>}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#888' }}>Will notify {selectedMembers.length} members and log to PCI</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #dde1e7', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleSchedule} disabled={saving || !title.trim() || selectedMembers.length === 0}
              style={{ padding: '8px 20px', background: saving || !title.trim() ? '#90caf9' : BLUE, color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
              {saving ? 'Scheduling...' : '📅 Schedule Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
