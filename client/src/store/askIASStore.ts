import { create } from 'zustand';

/**
 * Ask IAS — modal state + multi-turn chat history.
 *
 * History is kept in memory while the modal is open. Per spec, closing the
 * modal clears the history (next open starts fresh). Persistence across
 * sessions is explicitly NOT supported in MVP.
 */

export interface Turn {
  id: string;                    // local unique id
  role: 'user' | 'assistant';
  content: string;               // user: question text; assistant: RAW JSON string from API
  parsed?: any;                  // assistant only: parsed AskResponse object
  loading?: boolean;             // assistant only: true while awaiting response
  error?: string;                // assistant only: fatal error message
  createdAt: number;
}

interface AskIASState {
  isOpen: boolean;
  history: Turn[];

  /** Source ids that have been marked done locally — filtered out of rendered
   *  list responses. Cleared on close alongside history. */
  dismissedSourceIds: Set<string>;

  /** Monotonic counter. Increments when another part of the app wants the
   *  modal's prompt to take focus (e.g. Cmd+K pressed while already open).
   *  The modal effect watches this and re-focuses on change. */
  focusPromptToken: number;

  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Raise focus request. Triggers the modal to focus its prompt input. */
  requestPromptFocus: () => void;

  appendUserTurn: (text: string) => string;           // returns turn id
  startAssistantTurn: () => string;                   // adds a loading turn, returns id
  completeAssistantTurn: (id: string, content: string, parsed?: any) => void;
  failAssistantTurn: (id: string, error: string) => void;

  dismissSourceId: (sourceId: string) => void;
  restoreSourceId: (sourceId: string) => void;

  /** Remove turns from the end up to and including the given id. Used by
   *  retry to erase a failed assistant turn plus its paired user turn before
   *  re-submitting. */
  retryTruncate: (assistantTurnId: string) => { question: string } | null;

  clearHistory: () => void;
}

let idCounter = 0;
const nextId = () => `turn-${Date.now()}-${++idCounter}`;

export const useAskIASStore = create<AskIASState>((set, get) => ({
  isOpen: false,
  history: [],
  dismissedSourceIds: new Set<string>(),
  focusPromptToken: 0,

  open: () => set({ isOpen: true }),
  close: () => set({
    isOpen: false,
    history: [],
    dismissedSourceIds: new Set<string>(),
  }),
  toggle: () => set(s => s.isOpen
    ? { isOpen: false, history: [], dismissedSourceIds: new Set<string>() }
    : { isOpen: true }),
  requestPromptFocus: () => set(s => ({ focusPromptToken: s.focusPromptToken + 1 })),

  appendUserTurn: (text: string) => {
    const id = nextId();
    set(s => ({
      history: [...s.history, {
        id, role: 'user', content: text, createdAt: Date.now(),
      }],
    }));
    return id;
  },

  startAssistantTurn: () => {
    const id = nextId();
    set(s => ({
      history: [...s.history, {
        id, role: 'assistant', content: '', loading: true, createdAt: Date.now(),
      }],
    }));
    return id;
  },

  completeAssistantTurn: (id, content, parsed) => {
    set(s => ({
      history: s.history.map(t => t.id === id
        ? { ...t, content, parsed, loading: false, error: undefined }
        : t),
    }));
  },

  failAssistantTurn: (id, error) => {
    set(s => ({
      history: s.history.map(t => t.id === id
        ? { ...t, loading: false, error }
        : t),
    }));
  },

  clearHistory: () => set({ history: [], dismissedSourceIds: new Set<string>() }),

  dismissSourceId: (sourceId: string) => set(s => {
    const next = new Set(s.dismissedSourceIds);
    next.add(sourceId);
    return { dismissedSourceIds: next };
  }),

  restoreSourceId: (sourceId: string) => set(s => {
    const next = new Set(s.dismissedSourceIds);
    next.delete(sourceId);
    return { dismissedSourceIds: next };
  }),

  retryTruncate: (assistantTurnId: string) => {
    const state = get();
    const idx = state.history.findIndex(t => t.id === assistantTurnId);
    if (idx === -1) return null;
    // Assistant turn is idx; the paired user turn is immediately before.
    const userTurn = state.history[idx - 1];
    if (!userTurn || userTurn.role !== 'user') return null;
    set({ history: state.history.slice(0, idx - 1) });
    return { question: userTurn.content };
  },
}));
