import 'dotenv/config';
import fs from 'fs';

export const CONFIG = {
    PLEX_SERVER: process.env.PLEX_SERVER,
    PLEX_TOKEN: process.env.PLEX_TOKEN,
    LOCAL_PATH: process.env.LOCAL_PATH,
    TRANSFER_SPEED_LIMIT: process.env.TRANSFER_SPEED_LIMIT 
        ? parseInt(process.env.TRANSFER_SPEED_LIMIT) * 1024 * 1024 : null, // Convert MB to bytes, null means unthrottled
};

export const CONFIG_REQUIREMENTS = {
    PLEX_SERVER: {
        validate: (url) => url.startsWith('http://') || url.startsWith('https://'),
        message: 'PLEX_SERVER must be a valid HTTP/HTTPS URL'
    },
    PLEX_TOKEN: {
        validate: (token) => typeof token === 'string' && token.length > 0,
        message: 'PLEX_TOKEN is required'
    },
    LOCAL_PATH: {
        validate: (path) => typeof path === 'string' && fs.existsSync(path),
        message: 'LOCAL_PATH must exist on the filesystem'
    }
};
