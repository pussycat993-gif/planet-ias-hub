import { useCallback } from 'react';
import axios from 'axios';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { useAskIASStore } from '../store/askIASStore';
import type { ListItem } from '../components/ai/ResponseRenderer';

const API     = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const PCI_URL = import.meta.env.VITE_PCI_URL || '';

/**
 * Ask IAS — action handlers for list items.
 *
 * Open routing:
 *   - channel  → select the channel in Hub and close the modal
 *   - meeting  → if a call is already active, no-op; if the item is "live",
 *                select channel + start a video call; otherwise just select
 *   - activity → open the PCI deep link in a new tab
 *   - external → target_id is a full URL; open in a new tab
 *
 * Done routing:
 *   - Optimistically dismiss the item (hide from the rendered list)
 *   - POST /api/ai/mark-done with { source_id, title, type_badge }
 *   - On failure, restore the item and surface a console warning
 */

export interface UseAskIASActions {
  openItem: (item: ListItem) => void;
  markDone: (item: ListItem) => Promise<void>;
  canJoin:  (item: ListItem) => boolean;
  joinMeeting: (item: ListItem) => void;
}

export function useAskIASActions(): UseAskIASActions {
  const { close: closeModal, dismissSourceId, restoreSourceId } = useAskIASStore();
  const { selectChannel } = useChatStore();
  const callActive = useCallStore(s => s.active);
  const startCall  = useCallStore(s => (s as any).startCall as ((ch: number, kind: 'audio' | 'video') => void) | undefined);

  const openItem = useCallback((item: ListItem) => {
    const { link } = item;
    if (!link) return;

    switch (link.kind) {
      case 'channel': {
        if (typeof link.target_id === 'number') {
          selectChannel(link.target_id);
          closeModal();
        }
        return;
      }

      case 'meeting': {
        if (typeof link.target_id === 'number') {
          selectChannel(link.target_id);
          closeModal();
        }
        return;
      }

      case 'activity': {
        if (!PCI_URL) {
          console.warn('[Ask IAS] VITE_PCI_URL not configured; cannot open activity deep link');
          return;
        }
        const target = encodeURIComponent(String(link.target_id));
        window.open(`${PCI_URL}/activity/${target}`, '_blank', 'noopener,noreferrer');
        return;
      }

      case 'external': {
        const url = String(link.target_id || '');
        if (!url) return;
        // Only allow http(s) — never follow "javascript:" or other risky schemes.
        if (!/^https?:\/\//i.test(url)) {
          console.warn('[Ask IAS] external link did not start with http(s); ignoring', url);
          return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    }
  }, [selectChannel, closeModal]);

  const markDone = useCallback(async (item: ListItem) => {
    const key = item.source_id || `${item.link?.kind}-${item.link?.target_id}` || item.title;

    // Optimistic dismiss
    dismissSourceId(key);

    try {
      await axios.post(`${API}/ai/mark-done`, {
        source_id: item.source_id || key,
        title: item.title,
        type_badge: item.type_badge,
      }, { timeout: 8000 });
      // Stay dismissed on success.
    } catch (err: any) {
      // Restore on failure so the user can try again
      restoreSourceId(key);
      console.warn('[Ask IAS] mark-done failed:', err?.response?.data?.error || err?.message);
    }
  }, [dismissSourceId, restoreSourceId]);

  // Meeting-specific: show Join button when the badge indicates it's live or
  // starting in the next few minutes and there isn't already a call active.
  const canJoin = useCallback((item: ListItem) => {
    if (item.type_badge !== 'Meeting') return false;
    if (callActive) return false;
    const u = (item.urgency_badge || '').toLowerCase();
    return u === 'live' || u.startsWith('in ');
  }, [callActive]);

  const joinMeeting = useCallback((item: ListItem) => {
    if (!canJoin(item)) {
      // Fall back to Open behaviour
      openItem(item);
      return;
    }
    const target = item.link?.target_id;
    if (typeof target !== 'number') return;

    selectChannel(target);
    if (typeof startCall === 'function') {
      // Small delay so the channel panel is mounted before we kick off media.
      setTimeout(() => startCall(target, 'video'), 200);
    }
    closeModal();
  }, [canJoin, openItem, selectChannel, startCall, closeModal]);

  return { openItem, markDone, canJoin, joinMeeting };
}
