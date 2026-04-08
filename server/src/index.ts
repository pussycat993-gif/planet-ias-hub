import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import callRoutes from './routes/calls';
import pciRoutes from './routes/pci';
import automationRoutes from './automation/routes';

import { registerSocketHandlers } from './socket/handlers';
import { authMiddleware } from './middleware/auth';
import { startAutomationEngine } from './automation/index';

dotenv.config();

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// PCI webhook routes (no session auth — validated by JWT_SECRET header)
app.use('/api/automation/dwm-trigger', automationRoutes);
app.use('/api/automation/auto-channel', automationRoutes);
app.use('/api/pci/scheduled-meeting', pciRoutes);

// Protected routes
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/channels', authMiddleware, channelRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/calls', authMiddleware, callRoutes);
app.use('/api/pci', authMiddleware, pciRoutes);
app.use('/api/automation', authMiddleware, automationRoutes);

// Socket.io
registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`IAS Hub server running on port ${PORT}`);
  // Start automation engine after server is up
  startAutomationEngine();
});
