import { create } from 'zustand';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface PCIActivity {
  id: number;
  type: string;
  subject: string;
  date: string;
  status: 'Active' | 'Complete' | 'Canceled';
}

export interface PCIEntity {
  id: number;
  name: string;
  type: string;
}

export interface PCIPerson {
  id: number;
  name: string;
  role: string;
  email: string;
  company: string;
  status: string;
  avatar_url?: string;
}

export interface PCIContext {
  person: PCIPerson | null;
  recent_activities: PCIActivity[];
  open_tasks: PCIActivity[];
  entities: PCIEntity[];
}

interface PCIStore {
  context: PCIContext | null;
  loading: boolean;
  selectedPersonId: number | null;

  fetchContext: (personId: number) => Promise<void>;
  clearContext: () => void;
  logActivity: (payload: any) => Promise<void>;
}

export const usePCIStore = create<PCIStore>((set) => ({
  context: null,
  loading: false,
  selectedPersonId: null,

  fetchContext: async (personId: number) => {
    set({ loading: true, selectedPersonId: personId });
    try {
      const { data } = await axios.get(`${API}/pci/context/${personId}`);
      set({ context: data.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  clearContext: () => set({ context: null, selectedPersonId: null }),

  logActivity: async (payload: any) => {
    await axios.post(`${API}/pci/activity-log`, payload);
  },
}));
