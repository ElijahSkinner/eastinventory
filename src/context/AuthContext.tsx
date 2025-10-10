// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { account, databases, DATABASE_ID, COLLECTIONS, UserSettings } from '../lib/appwrite';
import { Models, ID, Query } from 'appwrite';
import { useTheme } from './ThemeContext';

interface AuthContextType {
    user: Models.User<Models.Preferences> | null;
    userSettings: UserSettings | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
    const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const { setTheme } = useTheme();

    // Check if user is logged in on mount
    useEffect(() => {
        checkUser();
    }, []);

    // Load user settings when user changes
    useEffect(() => {
        if (user) {
            loadUserSettings();
        }
    }, [user]);

    const checkUser = async () => {
        try {
            const currentUser = await account.get();
            setUser(currentUser);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const loadUserSettings = async () => {
        if (!user) return;

        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.USER_SETTINGS,
                [Query.equal('user_id', user.$id)]
            );

            if (response.documents.length > 0) {
                const settings = response.documents[0] as unknown as UserSettings;
                setUserSettings(settings);

                // Apply theme from settings
                if (settings.theme) {
                    setTheme(settings.theme);
                }
            } else {
                // Create default settings for new user
                await createDefaultUserSettings();
            }
        } catch (error) {
            console.error('Error loading user settings:', error);
        }
    };

    const createDefaultUserSettings = async () => {
        if (!user) return;

        try {
            const newSettings = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.USER_SETTINGS,
                ID.unique(),
                {
                    user_id: user.$id,
                    email: user.email,
                    display_name: user.name,
                    theme: 'light',
                    role: 'user',
                    notifications_enabled: true,
                    last_login: new Date().toISOString(),
                }
            );
            setUserSettings(newSettings as UserSettings);
        } catch (error) {
            console.error('Error creating user settings:', error);
        }
    };

    const login = async (email: string, password: string) => {
        try {
            await account.createEmailPasswordSession(email, password);
            const currentUser = await account.get();
            setUser(currentUser);

            // Update last login
            await updateLastLogin(currentUser.$id);
        } catch (error) {
            throw error;
        }
    };

    const register = async (email: string, password: string, name: string) => {
        try {
            await account.create(ID.unique(), email, password, name);
            await login(email, password);
        } catch (error) {
            throw error;
        }
    };

    const logout = async () => {
        try {
            await account.deleteSession('current');
            setUser(null);
            setUserSettings(null);
        } catch (error) {
            throw error;
        }
    };

    const updateLastLogin = async (userId: string) => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.USER_SETTINGS,
                [Query.equal('user_id', userId)]
            );

            if (response.documents.length > 0) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.USER_SETTINGS,
                    response.documents[0].$id,
                    { last_login: new Date().toISOString() }
                );
            }
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    };

    const updateUserSettings = async (settings: Partial<UserSettings>) => {
        if (!userSettings) return;

        try {
            const updated = await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.USER_SETTINGS,
                userSettings.$id,
                settings
            );
            setUserSettings(updated as UserSettings);

            // Apply theme if it was updated
            if (settings.theme) {
                setTheme(settings.theme);
            }
        } catch (error) {
            console.error('Error updating user settings:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                userSettings,
                loading,
                login,
                logout,
                register,
                updateUserSettings,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}