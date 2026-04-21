import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useChatStore } from '../../store/chatStore';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

interface Group {
  id: number;
  name: string;
  description: string;
  logo_color: string | null;
  logo_abbr: string | null;
  logo_url: string | null;
}

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

function GroupLogo({ group, size = 36 }: { group: Group; size?: number }) {
  if (group.logo_url) {
    return (
      <div style={{ width: size, height: size, borderRadius: size * 0.25, overflow: 'hidden', flexShrink: 0 }}>
        <img src={group.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  const bg = group.logo_color || BLUE;
  const abbr = group.logo_abbr || group.name.slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.25), background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.3), fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {abbr}
    </div>
  );
}

const LOGO_COLORS = ['#1565c0', '#1b5e20', '#4a148c', '#b71c1c', '#e65100', '#006064', '#37474f', '#880e4f'];

function EditGroupModal({ group, onClose, onSaved }: {
  group: Group; onClose: () => void; onSaved: (g: Group) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [logoColor, setLogoColor] = useState(group.logo_color || BLUE);
  const [logoAbbr, setLogoAbbr] = useState(group.logo_abbr || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(group.logo_url);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/channels/${group.id}/members`),
      axios.get(`${API}/users`),
    ]).then(([mRes, uRes]) => {
      setMembers(mRes.data.data || []);
      setAllUsers(uRes.data.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [group.id]);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addMember = async (user: Member) => {
    try {
      await axios.post(`${API}/channels/${group.id}/members`, { user_id: user.id });
      setMembers(prev => [...prev, user]);
    } catch { setMembers(prev => [...prev, user]); }
  };

  const removeMember = (userId: number) => {
    setMembers(prev => prev.filter(m => m.id !== userId));
    axios.delete(`${API}/channels/${group.id}/members/${userId}`).catch(() => {});
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await axios.patch(`${API}/channels/${group.id}`, {
        name: name.trim(), description,
        logo_color: logoColor,
        logo_abbr: logoAbbr || name.slice(0, 2).toUpperCase(),
        logo_url: logoUrl,
      });
      onSaved({ ...group, name: name.trim(), description, logo_color: logoColor, logo_abbr: logoAbbr || name.slice(0, 2).toUpperCase(), logo_url: logoUrl });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const filteredUsers = allUsers.filter(u =>
    !members.find(m => m.id === u.id) &&
    (u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #dde1e7', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 500, maxWidth: '95vw', maxHeight: '90vh', boxShadow: '0 8px 40px rgba(0,0,0,.2)', fontFamily: 'Segoe UI, Arial, sans-serif', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GroupLogo group={{ ...group, logo_color: logoColor, logo_abbr: logoAbbr || name.slice(0, 2).toUpperCase(), logo_url: logoUrl }} size={32} />
            <span style={{ fontWeight: 700, fontSize: 15, color: BLUE_DARK }}>Edit Group</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 7, fontSize: 12 }}>{error}</div>}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Group name <span style={{ color: '#c62828' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} style={inp} autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="What is this group for? (optional)" />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Logo</label>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Color</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, width: 110 }}>
                  {LOGO_COLORS.map(c => (
                    <div key={c} onClick={() => setLogoColor(c)} style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: 'pointer', border: `2.5px solid ${logoColor === c ? '#000' : 'transparent'}`, boxSizing: 'border-box', transition: 'border-color .15s' }} />
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Abbreviation</div>
                <input value={logoAbbr} onChange={e => setLogoAbbr(e.target.value.toUpperCase().slice(0, 4))} placeholder={name.slice(0, 2).toUpperCase() || 'GR'} style={{ ...inp, letterSpacing: 3, fontSize: 15, fontWeight: 700, textAlign: 'center', padding: '6px 10px' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Image</div>
                <div onClick={() => fileRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 8, border: '2px dashed #90caf9', background: logoUrl ? 'transparent' : '#f0f7ff', backgroundImage: logoUrl ? `url(${logoUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20 }}>
                  {!logoUrl && '📷'}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />
                {logoUrl && <div onClick={() => setLogoUrl(null)} style={{ fontSize: 10, color: '#888', cursor: 'pointer', marginTop: 3, textAlign: 'center' }}>Remove</div>}
              </div>
            </div>
            {/* Preview */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <GroupLogo group={{ ...group, logo_color: logoColor, logo_abbr: logoAbbr || name.slice(0, 2).toUpperCase(), logo_url: logoUrl }} size={32} />
              <span style={{ fontSize: 12, color: '#555' }}>Preview</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>
              Members ({members.length})
            </label>
            {loading ? (
              <div style={{ fontSize: 12, color: '#aaa', padding: '8px 0' }}>Loading members...</div>
            ) : (
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid #eee', borderRadius: 7, marginBottom: 8 }}>
                {members.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: 12, color: '#aaa', textAlign: 'center' }}>No members</div>
                ) : members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{m.name.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: '#888' }}>{m.role || m.email}</div>
                    </div>
                    <span onClick={() => removeMember(m.id)} title="Remove" style={{ color: '#ddd', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#c62828')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#ddd')}
                    >✕</span>
                  </div>
                ))}
              </div>
            )}
            <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search to add members..." style={{ ...inp, fontSize: 12, padding: '7px 10px', marginBottom: memberSearch ? 4 : 0 }} />
            {memberSearch && filteredUsers.length > 0 && (
              <div style={{ border: '1px solid #eee', borderRadius: 7, maxHeight: 120, overflowY: 'auto' }}>
                {filteredUsers.slice(0, 6).map(u => (
                  <div key={u.id} onClick={() => { addMember(u); setMemberSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e3f2fd', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{u.name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: '#888' }}>{u.email}</div>
                    </div>
                    <span style={{ fontSize: 11, color: BLUE }}>+ Add</span>
                  </div>
                ))}
              </div>
            )}
            {memberSearch && filteredUsers.length === 0 && (
              <div style={{ fontSize: 11, color: '#aaa', padding: '6px 0' }}>No users found</div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #dde1e7', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} style={{ padding: '8px 20px', background: saving || !name.trim() ? '#90caf9' : BLUE, color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyGroupsPanel() {
  const { channels, selectChannel } = useChatStore();
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    setGroups(channels.groups.map(ch => ({
      id: ch.id,
      name: ch.name,
      description: '',
      logo_color: ch.logo_color || null,
      logo_abbr: ch.logo_abbr || null,
      logo_url: ch.logo_url || null,
    })));
  }, [channels.groups]);

  const handleSaved = (updated: Group) => {
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {editingGroup && (
        <EditGroupModal group={editingGroup} onClose={() => setEditingGroup(null)} onSaved={handleSaved} />
      )}

      <div style={{ padding: '8px 11px 4px', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        My Groups ({groups.length})
      </div>

      {groups.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', color: '#aaa' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⬡</div>
          <div style={{ fontSize: 13 }}>No groups yet</div>
          <div style={{ fontSize: 11, marginTop: 4, color: '#bbb' }}>Create one from the toolbar</div>
        </div>
      ) : groups.map(group => (
        <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f7f9fc')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <div onClick={() => selectChannel(group.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <GroupLogo group={group} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: BLUE_DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
              {group.description && <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{group.description}</div>}
            </div>
          </div>
          <div onClick={() => setEditingGroup(group)} title="Edit group" style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ccc', fontSize: 13, flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e3f2fd'; e.currentTarget.style.color = BLUE; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
          >✏️</div>
        </div>
      ))}
    </div>
  );
}
