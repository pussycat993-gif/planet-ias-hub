import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const pciClient = axios.create({
  baseURL: process.env.PCI_API_URL,
  timeout: 10000,
});

// Attach JWT to every PCI request
pciClient.interceptors.request.use((config) => {
  config.headers['Authorization'] = `Bearer ${process.env.JWT_SECRET}`;
  return config;
});

export const verifyPCIToken = (token: string) =>
  pciClient.post('/api/ias-connect/auth/verify', { token });

export const getPCIUsers = () =>
  pciClient.get('/api/ias-connect/users');

export const getPCIContact = (id: number) =>
  pciClient.get(`/api/ias-connect/contact/${id}`);

export const logActivityToPCI = (payload: {
  activity_type: string;
  Activity_Subject: string;
  Activity_DateTime: string;
  Duration: number;
  Status: string;
  People: number[];
  Entities: number[];
  Documents?: string[];
}) => pciClient.post('/api/ias-connect/activity-log', payload);

export const pushScheduledMeeting = (payload: {
  channel_id: string;
  subject: string;
  date: string;
  duration_minutes: number;
  participants: string[];
  pci_activity_id: number;
}) => pciClient.post('/api/ias-connect/scheduled-meeting', payload);

export const cancelScheduledMeeting = (id: number) =>
  pciClient.delete(`/api/ias-connect/scheduled-meeting/${id}`);

export default pciClient;
