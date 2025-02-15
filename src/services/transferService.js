import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import ProgressBar from 'progress';
import { formatSpeed, formatEta } from '../utils/formatters.js';
import { CONFIG } from '../config/config.js';
import { TRANSFER_CONSTANTS } from '../config/constants.js';
import { ThrottledStream } from '../utils/ThrottledStream.js';

/**
 * Retrieves the file size of a remote file by making a HEAD request to the provided URL.
 * @param {string} url - The URL of the remote file.
 * @returns {Promise<number>} - A promise that resolves with the file size in bytes.
 */
async function getFileSize(url) {
    const protocol = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        protocol.request(url, { method: 'HEAD' }, (res) => {
            resolve(parseInt(res.headers['content-length'], 10));
        }).on('error', reject).end();
    });
}

/**
 * Transfers a file from Plex server to a local directory using direct download.
 * @param {string} key - The Plex media key for the file.
 * @param {string} libraryType - The type of library the file belongs to.
 * @returns {Promise<string>} - A promise that resolves with a message indicating the successful download.
 */
export async function transferFile(downloadKey, filePath, options = {}) {
    console.time('transfer-function');
    
    // Use internal Plex path for downloading
    const url = `${CONFIG.PLEX_SERVER}${downloadKey}?download=1&X-Plex-Token=${CONFIG.PLEX_TOKEN}`;
    // Use friendly path for local storage
    const localFilePath = `${CONFIG.LOCAL_PATH}${filePath}`;

    console.log('\nFile Path Details:');
    console.log('Plex URL:', url);
    console.log('Local Path:', localFilePath);
    
    // Ensure download directory exists
    const localDir = path.dirname(localFilePath);
    await fs.promises.mkdir(localDir, { recursive: true });

    // Get total file size with HEAD request
    const fileSize = await getFileSize(url);
    console.log('Total file size:', fileSize);

    // Check existing file size for resume
    let startPosition = 0;
    try {
        const stats = await fs.promises.stat(localFilePath);
        startPosition = stats.size;
        
        if (startPosition >= fileSize) {
            console.timeEnd('transfer-function');
            return {
                status: 'skipped',
                message: `File already exists and is complete: ${localFilePath}`
            };
        }
    } catch (err) {
        console.log('Starting fresh download');
    }

    // Only set up transfer resources if we're actually going to download
    return new Promise((resolve, reject) => {
        const options = {
            headers: startPosition ? {
                'Range': `bytes=${startPosition}-`
            } : {}
        };

        // console.log('Request options:', {
        //     startPosition,
        //     headers: options.headers
        // });

        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, options, (response) => {
            // console.log('Download response:', {
            //     statusCode: response.statusCode,
            //     headers: response.headers
            // });

            if (response.statusCode !== 200 && response.statusCode !== 206) {
                return reject(new Error(`Failed to download: ${response.statusCode}`));
            }

            const writeStream = fs.createWriteStream(localFilePath, {
                flags: startPosition ? 'a' : 'w',
                start: startPosition
            });

            // Setup progress tracking
            let transferred = startPosition;
            let lastTransferred = startPosition;
            let lastTime = Date.now();
            let avgSpeed = 0;
            const speedSamples = [];

            const progressText = startPosition > 0 
            ? 'Resuming  [:bar] :percent :timeLeft :speed'
            : 'Downloading [:bar] :percent :timeLeft :speed';
        
        const bar = new ProgressBar(progressText, {
            ...TRANSFER_CONSTANTS.PROGRESS_BAR,
            total: fileSize,
            curr: startPosition  // Initialize with existing progress
        });

            let dataStream = response;

            // Add throttling if speed limit set
            if (CONFIG.TRANSFER_SPEED_LIMIT) {
                const throttledStream = new ThrottledStream({
                    bytesPerSecond: CONFIG.TRANSFER_SPEED_LIMIT
                });
                dataStream = response.pipe(throttledStream);
            }

            dataStream.on('data', chunk => {
                transferred += chunk.length;
                
                // Progress and timing updates
                const now = Date.now();
                const timeDiff = now - lastTime;

                if (timeDiff >= 1000) {
                    const currentSpeed = (transferred - lastTransferred) / (timeDiff / 1000);
                    speedSamples.push(currentSpeed);
                    if (speedSamples.length > TRANSFER_CONSTANTS.SPEED_SAMPLE_SIZE) {
                        speedSamples.shift();
                    }
                    avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;

                    const remainingBytes = fileSize - transferred;
                    const eta = Math.ceil(remainingBytes / avgSpeed);

                    bar.tick(transferred - lastTransferred, {
                        speed: formatSpeed(avgSpeed),
                        timeLeft: formatEta(eta)
                    });

                    lastTransferred = transferred;
                    lastTime = now;
                }
            });

            dataStream.pipe(writeStream);

            writeStream.on('finish', () => {
                bar.terminate();
                resolve('\nTransfer complete!');
            });

            // Error handling
            dataStream.on('error', err => {
                bar.terminate();
                writeStream.destroy();
                fs.unlink(localFilePath, () => reject(new Error(`Download error: ${err.message}`)));
            });

            writeStream.on('error', err => {
                bar.terminate();
                writeStream.destroy();
                fs.unlink(localFilePath, () => reject(new Error(`Write error: ${err.message}`)));
            });
        }).on('error', err => {
            writeStream.destroy();
            fs.unlink(localFilePath, () => reject(new Error(`Connection error: ${err.message}`)));
        });
    });
}