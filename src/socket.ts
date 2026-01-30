import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*", // Adjust this for production
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('join-admin', () => {
      socket.join('admin-room');
      console.log(`👤 User ${socket.id} joined admin room`);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected');
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const notifyAdmin = (data: any) => {
  if (io) {
    io.to('admin-room').emit('notification', data);
  }
};
