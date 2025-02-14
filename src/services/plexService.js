import axios from 'axios';
import axiosRetry from 'axios-retry';
import { CONFIG } from '../config/config.js';

const axiosInstance = axios.create();

/**
 * Configures the Axios instance with retry options for handling network errors and 5xx server errors.
 * The retry delay increases progressively with each attempt (1s, 2s, 3s).
 * Logs the retry attempt and error reason to the console.
 */
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
 * Fetch available libraries from Plex
 */
export async function getLibraries() {
    const url = `${CONFIG.PLEX_SERVER}/library/sections?X-Plex-Token=${CONFIG.PLEX_TOKEN}`;
    const { data } = await axiosInstance.get(url);
    return data.MediaContainer.Directory.map((lib) => ({
        name: lib.title,
        key: lib.key,
        type: lib.type
    }));
}

/**
 * Fetches media items from a Plex library specified by the provided `libraryKey`.
 * 
 * @param {string} libraryKey - The key of the Plex library to fetch media items from.
 * @returns {Promise<{ name: string, id: string, filePath: string | null, mediaInfo: any[] }>} - An array of media items, each with a name, ID, file path, and media information.
 */
export async function getMedia(libraryKey) {
    const url = `${CONFIG.PLEX_SERVER}/library/sections/${libraryKey}/all?X-Plex-Token=${CONFIG.PLEX_TOKEN}`;
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
