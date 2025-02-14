/**
 * Formats a bytes per second value into a human-readable string.
 * @param {number} bytesPerSecond - The bytes per second value to format.
 * @returns {string} The formatted bytes per second value with the appropriate unit (B/s, KB/s, MB/s, GB/s).
 */
export function formatSpeed(bytesPerSecond) {
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
export function formatEta(seconds) {
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