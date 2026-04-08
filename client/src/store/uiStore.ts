import { create } from 'zustand';

type MainTab = 'channels' | 'dms' | 'calls' | 'files';
type RightPanelTab = 'pci' | 'info' | 'files' | 'log';
type Modal = 'newChannel' | 'newGroup' | 'newMessage' | 'logSettings' | 'endCall' | 'setStatus' | 'automations' | null;

interface UIState {
  mainTab: MainTab;
  rightPanelTab: RightPanelTab;
  rightPanelOpen: boolean;
  aiPanelOpen: boolean;
  autoPanelOpen: boolean;
  inlineSearchOpen: boolean;
  activeModal: Modal;
  myStatus: 'online' | 'away' | 'offline';
  myStatusMessage: string;

  setMainTab: (tab: MainTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanel: () => void;
  toggleAIPanel: () => void;
  toggleAutoPanel: () => void;
  toggleInlineSearch: () => void;
  openModal: (modal: Modal) => void;
  closeModal: () => void;
  setMyStatus: (status: 'online' | 'away' | 'offline') => void;
  setMyStatusMessage: (msg: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mainTab: 'channels',
  rightPanelTab: 'pci',
  rightPanelOpen: true,
  aiPanelOpen: false,
  autoPanelOpen: false,
  inlineSearchOpen: false,
  activeModal: null,
  myStatus: 'online',
  myStatusMessage: '',

  setMainTab: (tab) => set({ mainTab: tab }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  toggleRightPanel: () => set(s => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleAIPanel: () => set(s => ({ aiPanelOpen: !s.aiPanelOpen })),
  toggleAutoPanel: () => set(s => ({ autoPanelOpen: !s.autoPanelOpen })),
  toggleInlineSearch: () => set(s => ({ inlineSearchOpen: !s.inlineSearchOpen })),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  setMyStatus: (status) => set({ myStatus: status }),
  setMyStatusMessage: (msg) => set({ myStatusMessage: msg }),
}));
