import React, { useState } from 'react';
import axios from 'axios';
import EntityPickerModal, { PickerKind, PickerItem } from './EntityPickerModal';
import { MOCK_ENTITIES, MOCK_PEOPLE, MOCK_TAGS } from '../../utils/pickerData';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const BLUE = '#1976d2';

// ── Props ──────────────────────────────────────────────────────
interface Props {
  // Prefill values (from a call, a transcript, or manual invocation)
  initialSubject?: string;
  initialNote?: string;
  initialActivityType?: string;
  initialParticipants?: string[];
  initialEntities?: string[];
  onClose: () => void;
  onSaved?: () => void;
}

// ── Component ──────────────────────────────────────────────────
// Reusable "New Activity" modal. Same layout as the post-call variant:
// plavi header, Activity Info card on the left, Note below it, right panel
// with Entity / People / Tag each having a + button that opens the picker.
export default function LogActivityModal({
  initialSubject = '',
  initialNote = '',
  initialActivityType = 'Note',
  initialParticipants = [],
  initialEntities = [],
  onClose,
  onSaved,
}: Props) {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const [subject, setSubject] = useState(initialSubject);
  const [activityType, setActivityType] = useState(initialActivityType);
  const [activityClass, setActivityClass] = useState('Business');
  const [note, setNote] = useState(initialNote);
  const [people, setPeople] = useState<string[]>(initialParticipants);
  const [entities, setEntities] = useState<string[]>(initialEntities);
  const [tags, setTags] = useState<string[]>([]);
  const [priority, setPriority] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<PickerKind | null>(null);

  const removePerson = (p: string) => setPeople(prev => prev.filter(x => x !== p));
  const removeEntity = (e: string) => setEntities(prev => prev.filter(x => x !== e));
  const removeTag    = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const handlePickerSelect = (item: PickerItem) => {
    if (pickerOpen === 'entity' && !entities.includes(item.name)) setEntities(prev => [...prev, item.name]);
    if (pickerOpen === 'people' && !people.includes(item.name))   setPeople(prev => [...prev, item.name]);
    if (pickerOpen === 'tag'    && !tags.includes(item.name))     setTags(prev => [...prev, item.name]);
    // Keep picker open so user can add multiple
  };

  const pickerData = pickerOpen === 'entity' ? MOCK_ENTITIES
                   : pickerOpen === 'people' ? MOCK_PEOPLE
                   : pickerOpen === 'tag'    ? MOCK_TAGS
                   : [];
  const pickerSelected = pickerOpen === 'entity' ? entities
                       : pickerOpen === 'people' ? people
                       : pickerOpen === 'tag'    ? tags
                       : [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/pci/activity-log`, {
        activity_type: activityType,
        Activity_Subject: subject || `${activityType} — ${new Date().toLocaleString()}`,
        Activity_DateTime: new Date().toISOString(),
        Status: 'Complete',
        People: people,
        Entities: entities,
        Tags: tags,
        Note: note,
        Priority: priority,
      });
    } catch { /* PCI not connected, ignore */ }
    setSaved(true);
    setTimeout(() => {
      onSaved?.();
      onClose();
    }, 1200);
    setSaving(false);
  };

  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  // ── Saved confirmation screen ────────────────────────────
  if (saved) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 12, width: 400, padding: '40px 30px', boxShadow: '0 12px 50px rgba(0,0,0,.3)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#2e7d32' }}>Logged to PLANet IAS!</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Activity saved successfully</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, Arial, sans-serif' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, width: 860, maxWidth: '96vw', height: '80vh', boxShadow: '0 12px 50px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header bar */}
        <div style={{ background: BLUE, color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>⚡ New Activity</span>
          <span style={{ fontSize: 12, opacity: .8 }}>AI Functionality In Development</span>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 18, opacity: .8 }}>✕</span>
        </div>

        {pickerOpen && (
          <EntityPickerModal
            kind={pickerOpen}
            items={pickerData}
            alreadySelected={pickerSelected}
            onSelect={handlePickerSelect}
            onClose={() => setPickerOpen(null)}
          />
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left — Activity Info + Note */}
          <div style={{ flex: 1, borderRight: '1px solid #eee', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
            <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 14, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, color: '#555', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>Activity Info</div>

              {/* Subject */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#555', width: 90, flexShrink: 0 }}>Subject</span>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="What is this about?"
                    style={{ ...inp }} />
                  <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: '#e3f2fd', border: `1px solid ${BLUE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: BLUE, fontWeight: 700, cursor: 'pointer' }}>AI</div>
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#555', width: 70, flexShrink: 0 }}>Start</span>
                  <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px', background: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {today} <span style={{ fontSize: 14 }}>📅</span>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#555', width: 70, flexShrink: 0 }}>End</span>
                  <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '6px 8px', background: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {today} <span style={{ fontSize: 14 }}>📅</span>
                  </div>
                </div>
              </div>

              {/* Type + Priority */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#555', width: 70, flexShrink: 0 }}>Type</span>
                  <select value={activityType} onChange={e => setActivityType(e.target.value)} style={{ ...inp, flex: 1 }}>
                    {['Meeting', 'Call', 'Email', 'Task', 'Note', 'Audio', 'Video'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Priority</span>
                  <input type="checkbox" checked={priority} onChange={e => setPriority(e.target.checked)} />
                  <span style={{ fontSize: 12, color: '#555' }}>Yes</span>
                </div>
              </div>

              {/* Class */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#555', width: 70, flexShrink: 0 }}>Class</span>
                <select value={activityClass} onChange={e => setActivityClass(e.target.value)} style={{ ...inp, flex: 1 }}>
                  {['Business', 'Personal', 'Internal', 'Client'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Note — fills remaining space */}
            <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 14, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontWeight: 700, color: '#555', fontSize: 13, marginBottom: 8, textAlign: 'center', flexShrink: 0 }}>Note</div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Add details about this activity…"
                style={{ ...inp, flex: 1, resize: 'none', fontSize: 12, lineHeight: 1.5, minHeight: 0 }} />
            </div>
          </div>

          {/* Right — Entity, People, Tag (equal-height columns) */}
          <div style={{ width: 240, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

            {/* Entity */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#e8e8e8', padding: '6px 10px', borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: 12, color: '#444', flexShrink: 0 }}>
                <span>Entity</span>
                <span onClick={() => setPickerOpen('entity')} style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}>+</span>
              </div>
              <div style={{ border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 6px 6px', flex: 1, padding: 8, overflowY: 'auto', minHeight: 0 }}>
                {entities.length === 0
                  ? <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', textAlign: 'center', paddingTop: 8 }}>Click + to add entities</div>
                  : entities.map(e => (
                    <div key={e} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                      <span style={{ color: BLUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏢 {e}</span>
                      <span onClick={() => removeEntity(e)} style={{ cursor: 'pointer', color: '#bbb', fontSize: 14, flexShrink: 0, marginLeft: 6 }}>✕</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* People */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#e8e8e8', padding: '6px 10px', borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: 12, color: '#444', flexShrink: 0 }}>
                <span>People</span>
                <span onClick={() => setPickerOpen('people')} style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}>+</span>
              </div>
              <div style={{ border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 6px 6px', flex: 1, padding: 8, overflowY: 'auto', minHeight: 0 }}>
                {people.length === 0
                  ? <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', textAlign: 'center', paddingTop: 8 }}>Click + to add people</div>
                  : people.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                      <span style={{ color: BLUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👤 {p}</span>
                      <span onClick={() => removePerson(p)} style={{ cursor: 'pointer', color: '#bbb', fontSize: 14, flexShrink: 0, marginLeft: 6 }}>✕</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Tag */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#e8e8e8', padding: '6px 10px', borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: 12, color: '#444', flexShrink: 0 }}>
                <span>Tag</span>
                <span onClick={() => setPickerOpen('tag')} style={{ width: 20, height: 20, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}>+</span>
              </div>
              <div style={{ border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 6px 6px', flex: 1, padding: 8, overflowY: 'auto', minHeight: 0 }}>
                {tags.length === 0
                  ? <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', textAlign: 'center', paddingTop: 6 }}>Click + to add tags</div>
                  : tags.map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                      <span style={{ color: BLUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏷️ {t}</span>
                      <span onClick={() => removeTag(t)} style={{ cursor: 'pointer', color: '#bbb', fontSize: 14, flexShrink: 0, marginLeft: 6 }}>✕</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #eee', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>✕ Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '8px 24px', background: saving ? '#90caf9' : BLUE, color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 700 }}>
            {saving ? 'Saving...' : '✓ Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
