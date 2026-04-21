import { Server, Socket } from 'socket.io';
import pool from '../db/auth';
import { processNotification } from '../automation/smartNotifications';
import { registerMediasoupHandlers } from '../mediasoup/handlers';

export function registerSocketHandlers(io: Server) {

  io.on('connection', async (socket: Socket) => {
    const userId = socket.handshake.auth.userId as number;
    if (!userId) { socket.disconnect(); return; }

    console.log(`Socket connected: user ${userId}`);

    // Join personal room for notifications
    socket.join(`user:${userId}`);

    // Update presence to online
    await pool.query(
      "UPDATE users SET status = 'online', last_seen_at = NOW() WHERE id = $1",
      [userId]
    );
    socket.broadcast.emit('presence:update', { userId, status: 'online' });

    // ── mediasoup WebRTC handlers ─────────────────────────
    registerMediasoupHandlers(io, socket, userId);

    // ── Channel events ────────────────────────────────────
    socket.on('channel:join', (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('channel:leave', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    // ── Message events ────────────────────────────────────
    socket.on('message:send', async (data: {
      channelId: string;
      body: string;
      messageType?: string;
      replyToId?: number;
    }) => {
      try {
        const { rows: inserted } = await pool.query(
          `INSERT INTO messages (channel_id, sender_id, body, message_type, reply_to_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [data.channelId, userId, data.body, data.messageType || 'text', data.replyToId || null]
        );
        const messageId = inserted[0].id;

        // Re-fetch with sender joined so clients get a ready-to-render payload
        const { rows } = await pool.query(
          `SELECT m.*,
            json_build_object(
              'id', u.id,
              'name', u.name,
              'avatar_url', u.avatar_url,
              'status', u.status
            ) AS sender,
            '[]'::json AS reactions
           FROM messages m
           LEFT JOIN users u ON u.id = m.sender_id
           WHERE m.id = $1`,
          [messageId]
        );
        const message = rows[0];

        io.to(`channel:${data.channelId}`).emit('message:receive', message);

        // Thread reply: broadcast thread:update so open panels append it
        // and main timeline rows bump their reply counter.
        if (data.replyToId) {
          io.to(`channel:${data.channelId}`).emit('thread:update', {
            parent_id: data.replyToId,
            reply: message,
          });
        }

        const { rows: members } = await pool.query(
          'SELECT user_id FROM channel_members WHERE channel_id = $1',
          [data.channelId]
        );
        const memberIds = members.map(m => m.user_id);

        await processNotification(
          {
            type: 'message',
            channelId: parseInt(data.channelId),
            messageId: message.id,
            senderId: userId,
            body: data.body,
          },
          memberIds
        );
      } catch (err) {
        console.error('message:send error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing indicators ─────────────────────────────────
    socket.on('typing:start', (channelId: string) => {
      socket.to(`channel:${channelId}`).emit('typing:update', { userId, typing: true });
    });

    socket.on('typing:stop', (channelId: string) => {
      socket.to(`channel:${channelId}`).emit('typing:update', { userId, typing: false });
    });

    // ── Call signaling (basic — join/leave notifications) ─
    socket.on('call:start', (data: { channelId: string; type: 'audio' | 'video' }) => {
      socket.to(`channel:${data.channelId}`).emit('call:incoming', {
        callerId: userId,
        channelId: data.channelId,
        type: data.type,
      });
    });

    socket.on('call:end', (channelId: string) => {
      io.to(`channel:${channelId}`).emit('call:ended', { userId, channelId });
    });

    // ── Presence ──────────────────────────────────────────
    socket.on('presence:update', async (data: { status: 'online' | 'away' | 'offline' }) => {
      await pool.query(
        'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
        [data.status, userId]
      );
      socket.broadcast.emit('presence:update', { userId, status: data.status });
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: user ${userId}`);
      await pool.query(
        "UPDATE users SET status = 'offline', last_seen_at = NOW() WHERE id = $1",
        [userId]
      );
      socket.broadcast.emit('presence:update', { userId, status: 'offline' });
    });
  });
}
