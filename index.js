import 'dotenv/config';
import axios from 'axios';
import inquirer from 'inquirer';
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';
import { debuglog } from 'util';
import axiosRetry from 'axios-retry';

const debug = debuglog('plexrr');

const PLEX_SERVER = process.env.PLEX_SERVER;
const PLEX_TOKEN = process.env.PLEX_TOKEN;
const REMOTE_HOST = process.env.REMOTE_HOST;
const REMOTE_USER = process.env.REMOTE_USER;
const REMOTE_PATH = process.env.REMOTE_PATH;
const LOCAL_PATH = process.env.LOCAL_PATH;
const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY;

/**
 * Defines the configuration requirements for the application, including validation rules and error messages.
 * This object is used to validate the environment variables against the required configuration.
 */
const CONFIG_REQUIREMENTS = {
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

const axiosInstance = axios.create();

axiosRetry(axiosInstance, {
    retries: 3,
    retryDelay: (retryCount) => {
        return retryCount * 1000; // Progressive delay: 1s, 2s, 3s
    },
    retryCondition: (error) => {
        // Retry on network errors or 5xx server errors
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               (error.response && error.response.status >= 500);
    },
    onRetry: (retryCount, error, requestConfig) => {
        console.log(`Retry attempt ${retryCount} for request to ${requestConfig.url}`);
        console.log(`Reason: ${error.message}`);
    }
});

/**
 * Validates the application configuration by checking the environment variables against the required configuration.
 * If any configuration requirements are not met, an error is thrown with the list of validation failures.
 * @returns {boolean} `true` if the configuration is valid, otherwise throws an error.
 */
function validateConfig() {
    const errors = [];
    
    for (const [key, requirement] of Object.entries(CONFIG_REQUIREMENTS)) {
        const value = process.env[key];
        
        // Check if value exists
        if (!value) {
            errors.push(`${key} is not set in environment variables`);
            continue;
        }

        // Run specific validation
        if (!requirement.validate(value)) {
            errors.push(requirement.message);
        }
    }

    if (errors.length > 0) {
        throw new Error('Configuration validation failed:\n' + errors.join('\n'));
    }

    return true;
}

/**
 * Formats a bytes per second value into a human-readable string.
 * @param {number} bytesPerSecond - The bytes per second value to format.
 * @returns {string} The formatted bytes per second value with the appropriate unit (B/s, KB/s, MB/s, GB/s).
 */
function formatSpeed(bytesPerSecond) {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let value = bytesPerSecond;
    let unitIndex = 0;

    while (value > 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
}


/**
 * Formats a given number of seconds into a human-readable string representation.
 * The format will be in the form of "Xs", "Xm Xs", "Xh Xm Xs", or "Xd Xh Xm Xs" depending on the magnitude of the input.
 * @param {number} seconds - The number of seconds to format.
 * @returns {string} The formatted string representation of the input seconds.
 */
function formatEta(seconds) {
    if (seconds < 60) {
        return `${Math.ceil(seconds)}s`;
    }

    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.ceil(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.ceil(seconds % 60);
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.ceil(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
}

/**
 * Fetch available libraries from Plex
 */
async function getLibraries() {
    const url = `${PLEX_SERVER}/library/sections?X-Plex-Token=${PLEX_TOKEN}`;
    const { data } = await axiosInstance.get(url);
    return data.MediaContainer.Directory.map((lib) => ({
        name: lib.title,
        key: lib.key,
        type: lib.type
    }));
}

/**
 * Fetch media from a selected library
 * @param {string} libraryKey - The Plex library key
 */
async function getMedia(libraryKey) {
    const url = `${PLEX_SERVER}/library/sections/${libraryKey}/all?X-Plex-Token=${PLEX_TOKEN}`;
    const { data } = await axiosInstance.get(url);
    return data.MediaContainer.Metadata.map((item) => {
        // Log full item details for debugging
        // debug('\nPlex Media Item Details:');
        // debug('Title:', item.title);
        // debug('Rating Key:', item.ratingKey);
        // debug('Media Info:', JSON.stringify(item.Media, null, 2));
        // debug('File Path from Plex:', item.Media?.[0]?.Part?.[0]?.file);

        return {
            name: item.title,
            id: item.ratingKey,
            filePath: item.Media?.[0]?.Part?.[0]?.file || null,
            mediaInfo: item.Media
        };
    }).filter((item) => item.filePath);
}

/**
 * Transfers a file from a remote server to a local directory using SFTP.
 * @param {string} filePath - The path of the file to be transferred on the remote server.
 * @param {string} libraryType - The type of library the file belongs to.
 * @returns {Promise<string>} - A promise that resolves with a message indicating the successful download of the file.
 */
function transferFile(filePath, libraryType) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        // Add connection error handlers
        conn.on('error', (err) => {
            console.error('SSH Connection error:', err.message);
            conn.end();
            reject(new Error(`SSH Connection failed: ${err.message}`));
        });

        conn.on('timeout', () => {
            console.error('SSH Connection timed out');
            conn.end();
            reject(new Error('SSH Connection timed out'));
        });

        conn.on('close', (hadError) => {
            if (hadError) {
                console.error('SSH Connection closed due to error');
                reject(new Error('SSH Connection closed unexpectedly'));
            }
        });

        async function getResumePosition(localPath) {
            try {
                const stats = await fs.promises.stat(localPath);
                return stats.size;
            } catch {
                return 0;
            }
        }

        conn.on('ready', async () => {
            try {
                const sftp = await new Promise((resolve, reject) => {
                    conn.sftp((err, sftp) => {
                        if (err) {
                            console.error('SFTP session creation failed:', err.message);
                            reject(new Error(`SFTP session failed: ${err.message}`));
                            return;
                        }
                        resolve(sftp);
                    });
                });

                const pathMap = {
                    movie: 'movies',
                    show: 'tv',
                    artist: 'music',
                    // Add other library types as needed
                };

                const libraryPath = pathMap[libraryType] || 'other';
                const relativePath = filePath.split(`/${libraryPath}/`)[1];
                const remoteFilePath = `${REMOTE_PATH}/${libraryPath}/${relativePath}`;
                const localFilePath = `${LOCAL_PATH}/${libraryPath}/${relativePath}`;

                const localDir = path.dirname(localFilePath);
                await fs.promises.mkdir(localDir, { recursive: true });

                const remoteStats = await new Promise((resolve, reject) => {
                    sftp.stat(remoteFilePath, (err, stats) => err ? reject(err) : resolve(stats));
                });

                const startPosition = await getResumePosition(localFilePath);
                const fileSize = remoteStats.size;

                if (startPosition >= fileSize) {
                    resolve('File already completely downloaded');
                    return;
                }

                console.log('\nTransfer Details:');
                console.log('Remote Path:', remoteFilePath);
                console.log('Local Path:', localFilePath);
                console.log('File Size:', fileSize);
                console.log('Resume Position:', startPosition);
                console.log('\nStarting transfer...\n');

                const bar = new ProgressBar('Downloading [:bar] :percent :timeLeft :speed', {
                    complete: '=',
                    incomplete: ' ',
                    width: 50,
                    total: fileSize,
                    curr: startPosition
                });

                let transferred = startPosition;
                let lastTransferred = startPosition;
                let lastTime = Date.now();
                let avgSpeed = 0;
                const speedSamples = [];
                const SAMPLE_SIZE = 10; // Average over last 10 seconds

                sftp.createReadStream(remoteFilePath, { start: startPosition })
                    .on('data', (chunk) => {
                        transferred += chunk.length;
                        const now = Date.now();
                        const timeDiff = now - lastTime;

                        if (timeDiff >= 1000) {
                            const currentSpeed = (transferred - lastTransferred) / (timeDiff / 1000);
                            speedSamples.push(currentSpeed);
                            if (speedSamples.length > SAMPLE_SIZE) {
                                speedSamples.shift();
                            }
                            avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;

                            const remainingBytes = fileSize - transferred;
                            const eta = Math.ceil(remainingBytes / avgSpeed);

                            bar.tick(transferred - lastTransferred, {
                                speed: formatSpeed(avgSpeed),
                                timeLeft: formatEta(eta)  // Using our custom token name
                            });

                            lastTransferred = transferred;
                            lastTime = now;
                        }
                    })
                    .pipe(fs.createWriteStream(localFilePath, {
                        flags: startPosition ? 'a' : 'w',
                        start: startPosition
                    }))
                    .on('finish', () => {
                        bar.terminate();
                        conn.end();
                        resolve('\nTransfer complete!');
                    })
                    .on('error', (err) => {
                        bar.terminate();
                        conn.end();
                        reject(err);
                    });

            } catch (err) {
                console.error('Transfer operation failed:', err.message);
                conn.end();
                reject(new Error(`Transfer failed: ${err.message}`));
            }
        }).connect({
            host: REMOTE_HOST,
            username: REMOTE_USER,
            privateKey: fs.readFileSync(SSH_PRIVATE_KEY),
            readyTimeout: 20000, // 20 second timeout
            keepaliveInterval: 10000, // Send keepalive every 10 seconds
        });
    });
}
/**
 * Main function to handle user interaction
 */
async function main() {
    try {
        // Validate configuration before proceeding
        validateConfig();
        
        console.log('Configuration validated successfully');
        console.log('Fetching libraries...');
        
        // Rest of the existing main function code...
        
    } catch (err) {
        console.error('Startup failed:');
        console.error(err.message);
        process.exit(1);
    }

    try {
        console.log('Fetching libraries...');
        const libraries = await getLibraries();
        const { selectedLibrary } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedLibrary',
                message: 'Select a library:',
                choices: libraries.map((lib) => ({ 
                    name: lib.name, 
                    value: { key: lib.key, type: lib.type }
                })),
            },
        ]);

        console.log('Fetching media...');
        const media = await getMedia(selectedLibrary.key, selectedLibrary.type);
        const { selectedMedia } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedMedia',
                message: 'Select a movie/TV show to sync:',
                choices: media.map((m) => ({ name: m.name, value: m.filePath })),
            },
        ]);

        // Find the selected media object to access its full metadata
        const selectedMediaObject = media.find(m => m.filePath === selectedMedia);

        console.log('\nSelected Media Details:');
        console.log('Title:', selectedMediaObject.name);
        console.log('File Path:', selectedMediaObject.filePath);
        console.log('Media Info:', JSON.stringify(selectedMediaObject.mediaInfo, null, 2));

        const result = await transferFile(selectedMedia, selectedLibrary.type);
        console.log(result);
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
