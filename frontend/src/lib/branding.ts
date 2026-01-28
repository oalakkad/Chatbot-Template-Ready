/**
 * Branding Configuration Loader
 * 
 * Loads branding settings from branding.config.js and provides
 * them to React components via a hook.
 */

const brandingConfig = require('../../../branding.config.js');

export const BRANDING = brandingConfig;

// Helper function to get color with fallback
export const getColor = (path: string, fallback: string = '#0ea5e9'): string => {
    try {
        const keys = path.split('.');
        let value: any = BRANDING.colors;

        for (const key of keys) {
            value = value[key];
            if (value === undefined) return fallback;
        }

        return value as string;
    } catch {
        return fallback;
    }
};

// Helper function to get text with fallback
export const getText = (path: string, fallback: string = ''): string => {
    try {
        const keys = path.split('.');
        let value: any = BRANDING.text;

        for (const key of keys) {
            value = value[key];
            if (value === undefined) return fallback;
        }

        return value as string;
    } catch {
        return fallback;
    }
};

// Helper to check if feature is enabled
export const isFeatureEnabled = (feature: string): boolean => {
    try {
        return BRANDING.features[feature] === true;
    } catch {
        return false;
    }
};

// Export commonly used values for convenience
export const {
    company,
    branding,
    colors,
    text,
    features,
    auth,
    admin,
    technical
} = BRANDING;
