import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Server } from 'socket.io';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import callRoutes from './routes/calls';
import pciRoutes from './routes/pci';
import fileRoutes from './routes/files';
import notificationRoutes from './routes/notifications';
import automationRoutes from './automation/routes';

import { registerSocketHandlers } from './socket/handlers';
import { authMiddleware } from './middleware/auth';
import { startAutomationEngine } from './automation/index';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// ── Public routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── PCI webhook routes (JWT_SECRET header auth, not session) ──
app.use('/api/pci/scheduled-meeting', pciRoutes);
app.use('/api/automation/dwm-trigger', automationRoutes);
app.use('/api/automation/auto-channel', automationRoutes);

// ── Protected routes ──────────────────────────────────────
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/channels', authMiddleware, channelRoutes);
app.use('/api/channels', authMiddleware, fileRoutes);   // file upload per channel
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/files', authMiddleware, fileRoutes);       // file download/delete
app.use('/api/calls', authMiddleware, callRoutes);
app.use('/api/pci', authMiddleware, pciRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/automation', authMiddleware, automationRoutes);

// ── Static uploads ────────────────────────────────────────
const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadPath));

// ── Socket.io ─────────────────────────────────────────────
registerSocketHandlers(io);

// ── Health check ──────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.0' }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 IAS Hub server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  startAutomationEngine();
});
