import { CONFIG_REQUIREMENTS } from '../config/config.js';

/**
 * Validates the application configuration by checking the environment variables against the required configuration.
 * If any configuration requirements are not met, an error is thrown with the list of validation failures.
 * @returns {boolean} `true` if the configuration is valid, otherwise throws an error.
 */
export function validateConfig() {
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