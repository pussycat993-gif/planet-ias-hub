import { Server, Socket } from 'socket.io';

export function registerSocketHandlers(io: Server) {

  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.auth.userId;
    console.log(`User connected: ${userId}`);

    // Presence
    socket.broadcast.emit('presence:update', { userId, status: 'online' });

    // Join channel room
    socket.on('channel:join', (channelId: string) => {
      socket.join(channelId);
    });

    // Send message
    socket.on('message:send', (data: {
      channelId: string;
      body: string;
      fileUrl?: string;
    }) => {
      io.to(data.channelId).emit('message:receive', {
        ...data,
        senderId: userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Typing indicator
    socket.on('typing:start', (channelId: string) => {
      socket.to(channelId).emit('typing:update', { userId, typing: true });
    });
    socket.on('typing:stop', (channelId: string) => {
      socket.to(channelId).emit('typing:update', { userId, typing: false });
    });

    // Call signaling
    socket.on('call:start', (data: { channelId: string; type: 'audio' | 'video' }) => {
      socket.to(data.channelId).emit('call:incoming', { ...data, callerId: userId });
    });
    socket.on('call:end', (channelId: string) => {
      io.to(channelId).emit('call:ended', { userId });
    });

    // Disconnect
    socket.on('disconnect', () => {
      socket.broadcast.emit('presence:update', { userId, status: 'offline' });
      console.log(`User disconnected: ${userId}`);
    });
  });
}
