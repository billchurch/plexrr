import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';
import { formatSpeed, formatEta } from '../utils/formatters.js';
import { CONFIG } from '../config/config.js';
import { TRANSFER_CONSTANTS } from '../config/constants.js';
import { ThrottledStream } from '../utils/ThrottledStream.js';

/**
 * Transfers a file from a remote server to a local directory using SFTP.
 * @param {string} filePath - The path of the file to be transferred on the remote server.
 * @param {string} libraryType - The type of library the file belongs to.
 * @returns {Promise<string>} - A promise that resolves with a message indicating the successful download of the file.
 */
export function transferFile(filePath, libraryType, options = {}) {
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

        let activeChunks = 0;

        // Timing and progress tracking
        let transferred = 0;
        let lastTransferred = 0;
        let lastTime = Date.now();
        let avgSpeed = 0;
        const speedSamples = [];
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

                const remoteFilePath = `${CONFIG.REMOTE_PATH}${filePath}`;
                const localFilePath = `${CONFIG.LOCAL_PATH}${filePath}`;                

                // Add detailed logging before file operations
                console.log('\nFile Path Details:');
                console.log('Original Path:', filePath);
                console.log('Remote Path:', remoteFilePath);
                console.log('Local Path:', localFilePath);

                // Check remote file existence before proceeding
                try {
                    const remoteStats = await new Promise((resolve, reject) => {
                        sftp.stat(remoteFilePath, (err, stats) => {
                            if (err) {
                                console.error('Remote file check failed:', {
                                    path: remoteFilePath,
                                    error: err.message
                                });
                                reject(err);
                                return;
                            }
                            resolve(stats);
                        });
                    });
                    
                    console.log('Remote file stats:', {
                        size: remoteStats.size,
                        mode: remoteStats.mode,
                        accessTime: remoteStats.atime,
                        modifyTime: remoteStats.mtime
                    });
                } catch (err) {
                    throw new Error(`Remote file not accessible: ${remoteFilePath} (${err.message})`);
                }

                const localDir = path.dirname(localFilePath);
                await fs.promises.mkdir(localDir, { recursive: true });

                const remoteStats = await new Promise((resolve, reject) => {
                    sftp.stat(remoteFilePath, (err, stats) => err ? reject(err) : resolve(stats));
                });

                const startPosition = await getResumePosition(localFilePath);
                const fileSize = remoteStats.size;

                if (startPosition >= fileSize) {
                    conn.end(); // Close the SSH connection
                    resolve({
                        status: 'skipped',
                        message: 'File already completely downloaded'
                    });
                    return;
                }

                console.log('\nTransfer Details:');
                console.log('Remote Path:', remoteFilePath);
                console.log('Local Path:', localFilePath);
                console.log('File Size:', fileSize);
                console.log('Resume Position:', startPosition);
                console.log('\nStarting transfer...\n');

                const bar = new ProgressBar('Downloading [:bar] :percent :timeLeft :speed', {
                    ...TRANSFER_CONSTANTS.PROGRESS_BAR,
                    total: fileSize,
                    curr: startPosition
                });

                transferred = startPosition;
                lastTransferred = startPosition;

                const readStream = sftp.createReadStream(remoteFilePath, {
                    start: startPosition,
                    highWaterMark: TRANSFER_CONSTANTS.CHUNK_SIZE,
                    autoClose: true
                });

                const writeStream = fs.createWriteStream(localFilePath, {
                    flags: startPosition ? 'a' : 'w',
                    start: startPosition,
                    highWaterMark: TRANSFER_CONSTANTS.CHUNK_SIZE
                });

                let dataStream = readStream;
                
                // Add throttling if speed limit set
                if (CONFIG.TRANSFER_SPEED_LIMIT) {
                    const throttledStream = new ThrottledStream({
                        bytesPerSecond: CONFIG.TRANSFER_SPEED_LIMIT
                    });
                    dataStream = readStream.pipe(throttledStream);
                }

                // Maintain existing chunk handling and progress tracking
                dataStream.on('data', (chunk) => {
                    activeChunks++;
                    transferred += chunk.length;
                    
                    // Memory management
                    if (activeChunks >= TRANSFER_CONSTANTS.MAX_CONCURRENT_CHUNKS) {
                        readStream.pause();
                    }

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

                    // Backpressure check
                    if (!writeStream.write(chunk)) {
                        readStream.pause();
                    }
                });

                writeStream.on('drain', () => {
                    activeChunks--;
                    readStream.resume();
                });

                // Completion handling
                readStream.on('end', () => {
                    writeStream.end();
                });

                writeStream.on('finish', () => {
                    bar.terminate();
                    conn.end();
                    resolve('\nTransfer complete!');
                });

                // Error handling with cleanup
                function handleStreamError(err) {
                    bar.terminate();
                    readStream.destroy();
                    writeStream.destroy();
                    conn.end();
                    reject(new Error(`Stream error: ${err.message}`));
                }

                readStream.on('error', handleStreamError);
                writeStream.on('error', handleStreamError);

            } catch (err) {
                console.error('Transfer operation details:', {
                    error: err.message,
                    libraryType,
                    originalPath: filePath
                });
                conn.end();
                throw new Error(`Transfer failed: ${err.message}`);
            }
        }).connect({
            host: CONFIG.REMOTE_HOST,
            username: CONFIG.REMOTE_USER,
            privateKey: fs.readFileSync(CONFIG.SSH_PRIVATE_KEY),
            readyTimeout: TRANSFER_CONSTANTS.READY_TIMEOUT,
            keepaliveInterval: TRANSFER_CONSTANTS.KEEPALIVE_INTERVAL
        });
    });
}
