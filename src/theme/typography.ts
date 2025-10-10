// src/theme/typography.ts
export const Typography = {
    // Font Families
    fonts: {
        heading: 'System', // Will use ASAP Condensed when we load custom fonts
        body: 'System',    // Will use Crimson Text when we load custom fonts
        mono: 'monospace',
    },

    // Font Sizes
    sizes: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        xxxl: 32,
        display: 48,
    },

    // Font Weights
    weights: {
        regular: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    },

    // Line Heights
    lineHeights: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
    },
} as const;