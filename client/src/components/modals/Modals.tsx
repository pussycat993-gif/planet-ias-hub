import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import SetStatusModal from './SetStatusModal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';
const BLUE_DARK = '#1565c0';

// ── Shared Modal Shell ────────────────────────────────────
function Modal({ title, onClose, children, width = 480 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width, maxWidth: '95vw', boxShadow: '0 8px 40px rgba(0,0,0,.2)', fontFamily: 'Segoe UI, Arial, sans-serif', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: BLUE_DARK }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', lineHeight: 1, padding: '0 4px' }}>✕</button>
        </div>
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>
        {label} {required && <span style={{ color: '#c62828' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #dde1e7',
  borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};

// ── Logo Upload ───────────────────────────────────────────
function LogoUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div onClick={() => ref.current?.click()} style={{ width: 56, height: 56, borderRadius: 10, border: '2px dashed #90caf9', background: value ? 'transparent' : '#f0f7ff', backgroundImage: value ? `url(${value})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 22, color: BLUE, flexShrink: 0 }}>
        {!value && '📷'}
      </div>
      <div>
        <button onClick={() => ref.current?.click()} style={{ fontSize: 12, color: BLUE, border: `1px solid ${BLUE}`, background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {value ? 'Change logo' : 'Upload logo'}
        </button>
        {value && <button onClick={() => onChange(null)} style={{ fontSize: 12, color: '#888', border: '1px solid #dde1e7', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 6 }}>Remove</button>}
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>PNG, JPG up to 2MB</div>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

// ── Member Picker ─────────────────────────────────────────
interface HubUser { id: number; name: string; email: string; }

function MemberPicker({ selected, onChange }: { selected: HubUser[]; onChange: (u: HubUser[]) => void }) {
  const [users, setUsers] = useState<HubUser[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => { axios.get(`${API}/users`).then(r => setUsers(r.data.data || [])).catch(() => {}); }, []);

  const filtered = users.filter(u => !selected.find(s => s.id === u.id) && (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())));
  const add = (u: HubUser) => onChange([...selected, u]);
  const remove = (id: number) => onChange(selected.filter(u => u.id !== id));

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {selected.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 20, padding: '3px 8px 3px 6px', fontSize: 12 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{u.name.charAt(0)}</div>
              <span style={{ color: BLUE_DARK }}>{u.name}</span>
              <span onClick={() => remove(u.id)} style={{ cursor: 'pointer', color: '#888', fontSize: 14, lineHeight: 1 }}>×</span>
            </div>
          ))}
        </div>
      )}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." style={{ ...inputStyle, marginBottom: 6 }} />
      <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #eee', borderRadius: 7 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '10px 12px', color: '#aaa', fontSize: 12 }}>{users.length === 0 ? 'Loading...' : 'No users found'}</div>
        ) : filtered.map(u => (
          <div key={u.id} onClick={() => add(u)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', fontSize: 13 }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e3f2fd', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{u.name.charAt(0)}</div>
            <div>
              <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: BLUE }}>+ Add</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean; }) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{ background: disabled || loading ? '#90caf9' : BLUE, color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', fontSize: 13, fontFamily: 'inherit', cursor: disabled || loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
      {loading ? 'Saving...' : children}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 14 }}>{msg}</div>;
}

// ── New Channel ───────────────────────────────────────────
function NewChannelModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [logo, setLogo] = useState<string | null>(null);
  const [members, setMembers] = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { fetchChannels, selectChannel } = useChatStore();

  const handleCreate = async () => {
    if (!name.trim()) { setError('Channel name is required'); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/channels`, { name: name.trim().toLowerCase().replace(/\s+/g, '-'), type, description, logo_url: logo, member_ids: members.map(m => m.id) });
      await fetchChannels();
      selectChannel(data.data.id);
      onClose();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to create channel'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="+ New Channel" onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <Field label="Channel name" required>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. project-alpha" style={inputStyle} autoFocus />
        {name && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>#{name.toLowerCase().replace(/\s+/g, '-')}</div>}
      </Field>
      <Field label="Type">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['public', 'private'] as const).map(t => (
            <div key={t} onClick={() => setType(t)} style={{ flex: 1, padding: '8px 12px', border: `2px solid ${type === t ? BLUE : '#dde1e7'}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, textAlign: 'center', background: type === t ? '#e3f2fd' : '#fff', color: type === t ? BLUE_DARK : '#555', fontWeight: type === t ? 700 : 400 }}>
              {t === 'public' ? '🌐 Public' : '🔒 Private'}
            </div>
          ))}
        </div>
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this channel about? (optional)" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
      <Field label="Logo">
        <LogoUpload value={logo} onChange={setLogo} />
      </Field>
      <Field label="Add members">
        <MemberPicker selected={members} onChange={setMembers} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #dde1e7', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
        <PrimaryBtn onClick={handleCreate} disabled={!name.trim()} loading={loading}>Create Channel</PrimaryBtn>
      </div>
    </Modal>
  );
}

// ── New Group ─────────────────────────────────────────────
function NewGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [members, setMembers] = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { fetchChannels, selectChannel } = useChatStore();

  const handleCreate = async () => {
    if (!name.trim()) { setError('Group name is required'); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/channels`, { name: name.trim(), type: 'group', description, logo_url: logo, member_ids: members.map(m => m.id) });
      await fetchChannels();
      selectChannel(data.data.id);
      onClose();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to create group'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="⬡ New Group" onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <Field label="Group name" required>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Design Team" style={inputStyle} autoFocus />
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this group for? (optional)" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>
      <Field label="Logo">
        <LogoUpload value={logo} onChange={setLogo} />
      </Field>
      <Field label="Add members">
        <MemberPicker selected={members} onChange={setMembers} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #dde1e7', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
        <PrimaryBtn onClick={handleCreate} disabled={!name.trim()} loading={loading}>Create Group</PrimaryBtn>
      </div>
    </Modal>
  );
}

// ── New Message (DM) ──────────────────────────────────────
function NewMessageModal({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<HubUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchChannels, selectChannel } = useChatStore();

  useEffect(() => { axios.get(`${API}/users`).then(r => setUsers(r.data.data || [])).catch(() => {}); }, []);

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const openDM = async (user: HubUser) => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/channels/dm`, { user_id: user.id });
      await fetchChannels();
      selectChannel(data.data.id);
      onClose();
    } catch (err: any) { console.error('DM error:', err); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="✎ New Message" onClose={onClose} width={400}>
      <Field label="Search people">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email..." autoFocus style={inputStyle} />
      </Field>
      <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>{users.length === 0 ? 'Loading...' : 'No users found'}</div>
        ) : filtered.map(u => (
          <div key={u.id} onClick={() => !loading && openDM(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: loading ? 'wait' : 'pointer', borderBottom: '1px solid #f5f5f5' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{u.name.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
            </div>
            <span style={{ fontSize: 12, color: BLUE }}>💬 Message</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── Root export ───────────────────────────────────────────
export default function Modals() {
  const { activeModal, closeModal } = useUIStore();
  if (!activeModal) return null;
  if (activeModal === 'newChannel') return <NewChannelModal onClose={closeModal} />;
  if (activeModal === 'newGroup') return <NewGroupModal onClose={closeModal} />;
  if (activeModal === 'newMessage') return <NewMessageModal onClose={closeModal} />;
  if (activeModal === 'setStatus') return <SetStatusModal onClose={closeModal} />;
  return null;
}
