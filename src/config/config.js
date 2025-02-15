import 'dotenv/config';
import fs from 'fs';

export const CONFIG = {
    PLEX_SERVER: process.env.PLEX_SERVER,
    PLEX_TOKEN: process.env.PLEX_TOKEN,
    REMOTE_HOST: process.env.REMOTE_HOST,
    REMOTE_USER: process.env.REMOTE_USER,
    REMOTE_PATH: process.env.REMOTE_PATH,
    LOCAL_PATH: process.env.LOCAL_PATH,
    SSH_PRIVATE_KEY: process.env.SSH_PRIVATE_KEY,
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
    REMOTE_HOST: {
        validate: (host) => typeof host === 'string' && host.length > 0,
        message: 'REMOTE_HOST is required'
    },
    REMOTE_USER: {
        validate: (user) => typeof user === 'string' && user.length > 0,
        message: 'REMOTE_USER is required'
    },
    REMOTE_PATH: {
        validate: (path) => typeof path === 'string' && path.startsWith('/'),
        message: 'REMOTE_PATH must be an absolute path'
    },
    LOCAL_PATH: {
        validate: (path) => typeof path === 'string' && fs.existsSync(path),
        message: 'LOCAL_PATH must exist on the filesystem'
    },
    SSH_PRIVATE_KEY: {
        validate: (path) => typeof path === 'string' && fs.existsSync(path),
        message: 'SSH_PRIVATE_KEY must point to a valid key file'
    }
};
