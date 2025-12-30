import http from 'node:http';
import { Server } from 'socket.io';

console.log('Server main.ts started');

const httpServer = http.createServer((req, res) => {
  res.end('Bouncer http server is running\n');
});

const ioServer = new Server(httpServer, {
  cors: {
    origin: '*', // TODO-PROD:: restrict this once I know my prod domain
  },
});

ioServer.on('connection', (socket) => {
  console.log('New client connected, socket id:', socket.id);
  socket.emit('hello_event', 'Hello Message from Socket.IO!');

  socket.on('disconnect', () => {
    console.log('Client disconnected, socket id:', socket.id);
  });
});

httpServer.listen(4001, () => {
  console.log('Server is listening on port 4001');
});
