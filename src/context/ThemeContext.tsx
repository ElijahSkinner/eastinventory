// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define light color scheme
const lightColors = {
    primary: {
        cyan: '#0093B2',
        coolGray: '#53565A',
    },
    secondary: {
        red: '#76232F',
        blue: '#005587',
        orange: '#E6A65D',
        purple: '#7E5475',
        lightGray: '#D0D0CE',
    },
    background: {
        primary: '#FFFFFF',
        secondary: '#F5F5F5',
        accent: '#0093B2',
    },
    text: {
        primary: '#53565A',
        secondary: '#83868A',
        white: '#FFFFFF',
        onAccent: '#FFFFFF',
    },
    status: {
        available: '#0093B2',
        checkedOut: '#E6A65D',
        reserved: '#7E5475',
        maintenance: '#76232F',
    },
    ui: {
        border: '#D0D0CE',
        divider: '#E5E5E5',
        shadow: 'rgba(83, 86, 90, 0.1)',
    },
};

// Define dark color scheme
const darkColors = {
    primary: {
        cyan: '#0093B2',
        coolGray: '#D0D0CE',
    },
    secondary: {
        red: '#76232F',
        blue: '#005587',
        orange: '#E6A65D',
        purple: '#7E5475',
        lightGray: '#53565A',
    },
    background: {
        primary: '#1A1A1A',
        secondary: '#2A2A2A',
        accent: '#0093B2',
    },
    text: {
        primary: '#E5E5E5',
        secondary: '#B0B0B0',
        white: '#FFFFFF',
        onAccent: '#FFFFFF',
    },
    status: {
        available: '#0093B2',
        checkedOut: '#E6A65D',
        reserved: '#7E5475',
        maintenance: '#76232F',
    },
    ui: {
        border: '#3A3A3A',
        divider: '#333333',
        shadow: 'rgba(0, 0, 0, 0.3)',
    },
};

type ThemeMode = 'light' | 'dark';
type ColorScheme = typeof lightColors;

interface ThemeContextType {
    theme: ThemeMode;
    colors: ColorScheme;
    toggleTheme: () => void;
    setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>('light');

    const colors = theme === 'light' ? lightColors : darkColors;

    const toggleTheme = () => {
        setThemeState(prev => prev === 'light' ? 'dark' : 'light');
    };

    const setTheme = (newTheme: ThemeMode) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}