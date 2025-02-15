
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

async function selectMedia(media, prompt) {
    const { selected } = await inquirer.prompt([{
        type: 'list',
        name: 'selected',
        message: prompt,
        choices: media.map(item => ({
            name: item.name,
            value: item
        }))
    }]);
    return selected;
}
async function main() {
    try {
        validateConfig();
        console.log('Configuration validated successfully');
        
        // Get and select library
        const libraries = await getLibraries();
        const { selectedLibrary } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedLibrary',
            message: 'Select a library:',
            choices: libraries.map(lib => ({ 
                name: lib.name, 
                value: { key: lib.key, type: lib.type }
            }))
        }]);

        // Get initial media list
        const mediaList = await getMedia(selectedLibrary.key);
        let selectedItem = await selectMedia(mediaList, 'Select media:');
        // Handle nested media types
        if (selectedItem.type === 'show') {
            const seasons = await getSeasons(selectedItem.ratingKey);
            console.log('Selected season data:', seasons[0]);
            
            const selectedSeason = await selectMedia(seasons, 'Select season:');
            const episodes = await getEpisodes(selectedSeason.id);
            console.log('Episode data sample:', episodes[0]);
            
            selectedItem = await selectMedia(episodes, 'Select episode:');
            console.log('Final selected item:', selectedItem);
        } else if (selectedItem.type === 'artist') {
            const albums = await getAlbums(selectedItem.ratingKey);
            const selectedAlbum = await selectMedia(albums, 'Select album:');
            const tracks = await getTracks(selectedAlbum.id);
            selectedItem = await selectMedia(tracks, 'Select track:');
        }

        // Transfer the selected media
        if (selectedItem.downloadKey && selectedItem.filePath) {
            const result = await transferFile(selectedItem.downloadKey, selectedItem.filePath);
            if (result.status === 'skipped') {
                console.log('\n' + result.message);
                process.exit(0);
            }
        } else {
            console.log('No valid download path found for selected media');
        }
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}
main();
