import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import dbConnect from './db/index.js';
import app from './app.js';
import { initSignaling } from './socket/signaling.js';

const port = process.env.PORT || 8000;

dbConnect()
    .then(() => {
        // Wrap Express in an HTTP server so socket.io (WebRTC signaling) can share the port.
        const server = http.createServer(app);
        initSignaling(server);

        server.listen(port, () => {
            console.log(`Tempu backend running on port ${port}`);
        });
    })
    .catch((error) => {
        console.error('Database connection failed:', error);
        process.exit(1);
    });
