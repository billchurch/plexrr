
import inquirer from 'inquirer';
import { 
    getLibraries, 
    getMedia, 
    getSeasons, 
    getEpisodes,
    getAlbums,
    getTracks
} from './services/plexService.js';
import { transferFile } from './services/transferService.js';
import { validateConfig } from './utils/validator.js';
async function main() {
    try {
        // Validate configuration before proceeding
        validateConfig();
        
        console.log('Configuration validated successfully');
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
        const media = await getMedia(selectedLibrary.key);
        
        if (selectedLibrary.type === 'artist') {
            // Music handling
            const { selectedArtist } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedArtist',
                message: 'Select an Artist:',
                choices: media.map(artist => ({
                    name: artist.name,
                    value: artist
                }))
            }]);

            const albums = await getAlbums(selectedArtist.ratingKey);
            const { selectedAlbum } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedAlbum',
                message: 'Select an Album:',
                choices: albums.map(album => ({
                    name: album.name,
                    value: album
                }))
            }]);

            const tracks = await getTracks(selectedAlbum.id);
            const { selectedTrack } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedTrack',
                message: 'Select a Track:',
                choices: tracks.map(track => ({
                    name: track.name,
                    value: track.filePath,
                    disabled: !track.filePath
                }))
            }]);

            if (selectedTrack) {
                await transferFile(selectedTrack, 'artist');
            }
        } else if (selectedLibrary.type === 'show') {
            // TV Show handling
            const { selectedShow } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedShow',
                message: 'Select a TV Show:',
                choices: media.map(show => ({
                    name: show.name,
                    value: show
                }))
            }]);

            const seasons = await getSeasons(selectedShow.ratingKey);
            const { selectedSeason } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedSeason',
                message: 'Select a Season:',
                choices: seasons.map(season => ({
                    name: season.name,
                    value: season
                }))
            }]);

            const episodes = await getEpisodes(selectedSeason.id);
            const { selectedEpisode } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedEpisode',
                message: 'Select an Episode:',
                choices: episodes.map(episode => ({
                    name: episode.name,
                    value: episode.filePath,
                    disabled: !episode.filePath
                }))
            }]);

            if (selectedEpisode) {
                await transferFile(selectedEpisode, 'show');
            }
        } else {
            // Movies handling (existing code)
            const { selectedMedia } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedMedia',
                message: 'Select a movie to sync:',
                choices: media.map(m => ({
                    name: m.name,
                    value: m.filePath,
                    disabled: !m.filePath
                }))
            }]);

            await transferFile(selectedMedia, 'movie');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
