import { create } from 'zustand';

type MainTab = 'all' | 'dms' | 'calls' | 'files';
type RightPanelTab = 'pci' | 'info' | 'files' | 'log';
type Modal = 'newChannel' | 'newGroup' | 'newMessage' | 'scheduleMeeting' | 'logSettings' | 'endCall' | 'setStatus' | 'automations' | null;
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface UIState {
  mainTab: MainTab;
  rightPanelTab: RightPanelTab;
  rightPanelOpen: boolean;
  aiPanelOpen: boolean;
  autoPanelOpen: boolean;
  inlineSearchOpen: boolean;
  channelSearchQuery: string;
  jumpToMessageId: number | null;
  activeThreadId: number | null;
  showUnreadOnly: boolean;
  activeModal: Modal;
  myStatus: 'online' | 'away' | 'offline';
  myStatusMessage: string;
  dnd: boolean;
  connectionStatus: ConnectionStatus;

  setMainTab: (tab: MainTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanel: () => void;
  toggleAIPanel: () => void;
  toggleAutoPanel: () => void;
  toggleInlineSearch: () => void;
  setChannelSearchQuery: (q: string) => void;
  jumpToMessage: (messageId: number) => void;
  clearJumpToMessage: () => void;
  openThread: (parentId: number) => void;
  closeThread: () => void;
  toggleShowUnreadOnly: () => void;
  openModal: (modal: Modal) => void;
  closeModal: () => void;
  setMyStatus: (status: 'online' | 'away' | 'offline') => void;
  setMyStatusMessage: (msg: string) => void;
  setDnd: (dnd: boolean) => void;
  toggleDnd: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

// Persist DND across reloads
const initialDnd = (() => {
  try { return localStorage.getItem('ias_hub_dnd') === '1'; } catch { return false; }
})();

export const useUIStore = create<UIState>((set) => ({
  mainTab: 'all',
  rightPanelTab: 'pci',
  rightPanelOpen: true,
  aiPanelOpen: false,
  autoPanelOpen: false,
  inlineSearchOpen: false,
  channelSearchQuery: '',
  jumpToMessageId: null,
  activeThreadId: null,
  showUnreadOnly: false,
  activeModal: null,
  myStatus: 'online',
  myStatusMessage: '',
  dnd: initialDnd,
  connectionStatus: 'disconnected',

  setMainTab: (tab) => set({ mainTab: tab }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  toggleRightPanel: () => set(s => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleAIPanel: () => set(s => ({ aiPanelOpen: !s.aiPanelOpen })),
  toggleAutoPanel: () => set(s => ({ autoPanelOpen: !s.autoPanelOpen })),
  toggleInlineSearch: () => set(s => ({ inlineSearchOpen: !s.inlineSearchOpen, channelSearchQuery: s.inlineSearchOpen ? '' : s.channelSearchQuery })),
  setChannelSearchQuery: (channelSearchQuery) => set({ channelSearchQuery }),
  jumpToMessage: (jumpToMessageId) => set({ jumpToMessageId }),
  clearJumpToMessage: () => set({ jumpToMessageId: null }),
  openThread: (activeThreadId) => set({ activeThreadId }),
  closeThread: () => set({ activeThreadId: null }),
  toggleShowUnreadOnly: () => set(s => ({ showUnreadOnly: !s.showUnreadOnly })),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  setMyStatus: (status) => set({ myStatus: status }),
  setMyStatusMessage: (msg) => set({ myStatusMessage: msg }),
  setDnd: (dnd) => {
    try { localStorage.setItem('ias_hub_dnd', dnd ? '1' : '0'); } catch {}
    set({ dnd });
  },
  toggleDnd: () => set(s => {
    const next = !s.dnd;
    try { localStorage.setItem('ias_hub_dnd', next ? '1' : '0'); } catch {}
    return { dnd: next };
  }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
