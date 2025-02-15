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
    
    const processMediaItem = (item) => {
        const baseInfo = {
            name: item.title,
            id: item.ratingKey,
            type: item.type
        };

        switch(item.type) {
            case 'show':
                return {
                    ...baseInfo,
                    name: `${item.title} (TV Show)`,
                    ratingKey: item.ratingKey
                };
            case 'artist':
                return {
                    ...baseInfo,
                    name: `${item.title} (Artist)`,
                    ratingKey: item.ratingKey
                };
            default:
                const mediaPart = item.Media?.[0]?.Part?.[0];
                return {
                    ...baseInfo,
                    downloadKey: mediaPart?.key || null,    // Internal Plex path for downloading
                    filePath: mediaPart?.file || null,      // Full filesystem path
                    mediaInfo: item.Media
                };
        }
    };
    
    return data.MediaContainer.Metadata.map(processMediaItem);
}

// New function to fetch seasons for a show
/**
 * Fetches seasons for a given TV show in a Plex library.
 *
 * @param {string} showRatingKey - The rating key of the TV show to fetch seasons for.
 * @returns {Promise<{ name: string, id: string, type: 'season', key: string }>} - An array of season objects, each with a name, ID, type, and key.
 */
export async function getSeasons(showRatingKey) {
    const url = `${CONFIG.PLEX_SERVER}/library/metadata/${showRatingKey}/children?X-Plex-Token=${CONFIG.PLEX_TOKEN}`;
    const { data } = await axiosInstance.get(url);
    return data.MediaContainer.Metadata.map(season => ({
        name: season.title,
        id: season.ratingKey,
        type: 'season',
        key: season.key
    }));
}
 /**
 * Fetches episodes for a given season in a Plex library.
 *
 * @param {string} seasonRatingKey - The rating key of the season to fetch episodes for.
 * @returns {Promise<{ name: string, id: string, type: 'episode', downloadKey: string | null, filePath: string | null }>} - An array of episode objects, each with a name, ID, type, download key, and file path.
 */
export async function getEpisodes(seasonRatingKey) {
    const url = `${CONFIG.PLEX_SERVER}/library/metadata/${seasonRatingKey}/children?X-Plex-Token=${CONFIG.PLEX_TOKEN}`;
    const { data } = await axiosInstance.get(url);
    
    console.log('Episode data:', JSON.stringify(data.MediaContainer.Metadata[0], null, 2));
    
    return data.MediaContainer.Metadata.map(episode => {
        const mediaPart = episode.Media?.[0]?.Part?.[0];
        const downloadKey = mediaPart?.key;
        const filePath = mediaPart?.file;
        
        console.log('Episode processing:', {
            title: episode.title,
            downloadKey,
            filePath,
            mediaPart
        });
        
        return {
            name: `${episode.index}. ${episode.title}`,
            id: episode.ratingKey,
            type: 'episode',
            downloadKey,
            filePath
        };
    });
}
/**
 * Fetches a list of albums for a given artist in a Plex library.
 *
 * @param {string} artistRatingKey - The rating key of the artist to fetch albums for.
 * @returns {Promise<{ name: string, id: string, type: 'album', year: number | null }>} - An array of album objects, each with a name, ID, type, and year.
 */
export async function getAlbums(artistRatingKey) {
    const url = `${CONFIG.PLEX_SERVER}/library/metadata/${artistRatingKey}/children?X-Plex-Token=${CONFIG.PLEX_TOKEN}`;
    const { data } = await axiosInstance.get(url);
    return data.MediaContainer.Metadata.map(album => ({
        name: `${album.title} (${album.year || 'Unknown Year'})`,
        id: album.ratingKey,
        type: 'album',
        year: album.year
    }));
}

/**
 * Fetches a list of tracks for a given album in a Plex library.
 *
 * @param {string} albumRatingKey - The rating key of the album to fetch tracks for.
 * @returns {Promise<{ name: string, id: string, type: 'track', downloadKey: string | null, filePath: string | null }>} - An array of track objects, each with a name, ID, type, download key, and file path.
 */
export async function getTracks(albumRatingKey) {
    const url = `${CONFIG.PLEX_SERVER}/library/metadata/${albumRatingKey}/children?X-Plex-Token=${CONFIG.PLEX_TOKEN}`;
    const { data } = await axiosInstance.get(url);
    return data.MediaContainer.Metadata.map(track => {
        const mediaPart = track.Media?.[0]?.Part?.[0];
        return {
            name: `${track.index || '0'}. ${track.title}`,
            id: track.ratingKey,
            type: 'track',
            downloadKey: mediaPart?.key || null,    // Add this
            filePath: mediaPart?.file || null       // Add this
        };
    });
}