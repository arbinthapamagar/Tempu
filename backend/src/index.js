import dotenv from 'dotenv';
dotenv.config();

import dbConnect from './db/index.js';
import app from './app.js';

const port = process.env.PORT || 8000;

dbConnect()
    .then(() => {
        app.listen(port, () => {
            console.log(`Shakti backend running on port ${port}`);
        });
    })
    .catch((error) => {
        console.error('Database connection failed:', error);
        process.exit(1);
    });
