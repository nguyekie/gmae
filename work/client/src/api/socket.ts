import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './client';

let socket: Socket | null = null;
let savedCharacterId: string | null = null;

export function connectSocket(token: string, characterId: string) {
  if (socket) return socket;
  savedCharacterId = characterId;
  socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket', 'polling'] });
  socket.connect();
  socket.emit('auth', { token, characterId });
  return socket;
}

export function getSocket(characterId?: string): Socket | null {
  if (socket) return socket;
  const token = localStorage.getItem('etheria_token');
  const id = characterId ?? savedCharacterId;
  if (!token || !id) return null;
  return connectSocket(token, id);
}
