import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// WebRTC signaling for in-app support calls. The backend never sees media - it
// only relays SDP offers/answers and ICE candidates between the two peers that
// share a ticket "room", plus the call lifecycle (invite/accept/reject/end).
//
// Rooms are keyed by ticket id: `ticket:<id>`. A call is 1:1 (rider ↔ agent).

function verifyToken(token, role) {
    if (!token) return null;
    try {
        const secret = role === 'admin'
            ? process.env.ADMIN_ACCESS_TOKEN_SECRET
            : process.env.ACCESS_TOKEN_SECRET;
        const decoded = jwt.verify(token, secret);
        return { id: decoded._id, role: role === 'admin' ? 'admin' : 'user' };
    } catch {
        return null;
    }
}

export function initSignaling(httpServer) {
    const allowed = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : [];

    const io = new Server(httpServer, {
        cors: {
            origin: (origin, cb) => {
                // Mobile (no origin) and configured web origins are allowed.
                if (!origin || allowed.length === 0 || allowed.includes(origin)) cb(null, true);
                else cb(new Error('Not allowed by CORS'));
            },
            methods: ['GET', 'POST'],
        },
    });

    // Authenticate every socket. Clients pass { token, role } in handshake.auth.
    io.use((socket, next) => {
        const { token, role } = socket.handshake.auth || {};
        const identity = verifyToken(token, role);
        if (!identity) return next(new Error('Unauthorized'));
        socket.identity = identity;
        next();
    });

    io.on('connection', (socket) => {
        const me = socket.identity;

        // Join a ticket's call room.
        socket.on('call:join', ({ room }) => {
            if (!room) return;
            socket.join(`ticket:${room}`);
        });

        socket.on('call:leave', ({ room }) => {
            if (room) socket.leave(`ticket:${room}`);
        });

        // Caller rings the other side. media: 'audio' | 'video'.
        socket.on('call:invite', ({ room, media }) => {
            if (!room) return;
            socket.to(`ticket:${room}`).emit('call:incoming', { from: me, media });
        });

        socket.on('call:accept', ({ room }) => {
            socket.to(`ticket:${room}`).emit('call:accepted', { from: me });
        });

        socket.on('call:reject', ({ room }) => {
            socket.to(`ticket:${room}`).emit('call:rejected', { from: me });
        });

        socket.on('call:end', ({ room }) => {
            socket.to(`ticket:${room}`).emit('call:ended', { from: me });
        });

        // Pure relay for SDP (offer/answer) and ICE candidates.
        socket.on('call:signal', ({ room, data }) => {
            if (!room || !data) return;
            socket.to(`ticket:${room}`).emit('call:signal', { from: me, data });
        });
    });

    return io;
}
