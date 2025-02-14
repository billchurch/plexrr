
import inquirer from 'inquirer';
import { getLibraries, getMedia } from './services/plexService.js';
import { transferFile } from './services/transferService.js';
import { validateConfig } from './utils/validator.js';

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
