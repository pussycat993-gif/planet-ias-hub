import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pciClient: AxiosInstance = axios.create({
  baseURL: process.env.PCI_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Attach JWT to every PCI request
pciClient.interceptors.request.use((config) => {
  config.headers['Authorization'] = `Bearer ${process.env.JWT_SECRET}`;
  config.headers['X-IAS-Hub-Tenant'] = process.env.TENANT_ID || 'default';
  return config;
});

// Log PCI errors
pciClient.interceptors.response.use(
  res => res,
  err => {
    console.error('PCI API error:', err.response?.status, err.response?.data || err.message);
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────

export const verifyPCIToken = (token: string) =>
  pciClient.post('/api/ias-connect/auth/verify', { token });

// ── Users ─────────────────────────────────────────────────

export const getPCIUsers = () =>
  pciClient.get('/api/ias-connect/users');

// ── Contact context (right panel) ─────────────────────────

export const getPCIContact = (personId: number) =>
  pciClient.get(`/api/ias-connect/contact/${personId}`);

// ── Presence ──────────────────────────────────────────────

export const updatePCIPresence = (userId: number, status: string) =>
  pciClient.post(`/api/ias-connect/presence/${userId}`, { status });

// ── Activity logging ──────────────────────────────────────

export interface ActivityLogPayload {
  activity_type: string;
  Activity_Subject: string;
  Activity_DateTime: string;
  Duration: number;
  Status: 'Complete';
  People: number[];
  Entities: number[];
  Documents?: string[];
  Note?: string;
}

export const logActivityToPCI = (payload: ActivityLogPayload) =>
  pciClient.post('/api/ias-connect/activity-log', payload);

// ── Scheduled meetings ────────────────────────────────────

export interface ScheduledMeetingPayload {
  channel_id: number;
  pci_activity_id: number;
  subject: string;
  meeting_date: string;
  duration_minutes: number;
  participants: string[];
}

export const pushScheduledMeeting = (payload: ScheduledMeetingPayload) =>
  pciClient.post('/api/ias-connect/scheduled-meeting', payload);

export const cancelScheduledMeeting = (pciActivityId: number) =>
  pciClient.delete(`/api/ias-connect/scheduled-meeting/${pciActivityId}`);

// ── DWM workflow ──────────────────────────────────────────

export const sendDWMAction = (workflowStepId: number, action: 'approve' | 'reject', userId: number) =>
  pciClient.post('/api/ias-connect/dwm-action', {
    workflow_step_id: workflowStepId,
    action,
    hub_user_id: userId,
  });

export default pciClient;
