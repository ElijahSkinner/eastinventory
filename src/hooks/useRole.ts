// src/hooks/useRole.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { account } from '../lib/appwrite';

export type UserRole = 'admin' | 'user';

export function useRole() {
    const { user } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            checkAdminStatus();
        } else {
            setIsAdmin(false);
            setLoading(false);
        }
    }, [user]);

    const checkAdminStatus = async () => {
        if (!user) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        try {
            console.log('🔍 Checking admin status for user:', user.$id);
            console.log('📋 User labels:', user.labels);

            // Method 1: Check if user has 'admin' label
            const hasAdminLabel = user.labels?.includes('admin');

            if (hasAdminLabel) {
                console.log('✅ User has admin label');
                setIsAdmin(true);
                setLoading(false);
                return;
            }

            // Method 2: Try to get user's team memberships via prefs
            try {
                const prefs = await account.getPrefs();
                console.log('📋 User prefs:', prefs);

                // Check if there's a teams array in prefs
                if (prefs.teams && Array.isArray(prefs.teams)) {
                    const isInAdminTeam = prefs.teams.some(
                        (teamName: string) => teamName.toLowerCase() === 'admin'
                    );

                    if (isInAdminTeam) {
                        console.log('✅ User is in admin team (via prefs)');
                        setIsAdmin(true);
                        setLoading(false);
                        return;
                    }
                }
            } catch (prefsError) {
                console.log('⚠️ Could not check prefs:', prefsError);
            }

            // Method 3: Check user labels again for 'admin' (case insensitive)
            const isAdminByLabel = user.labels?.some(
                (label: string) => label.toLowerCase() === 'admin'
            );

            console.log('👑 Is admin (by label)?', isAdminByLabel);
            setIsAdmin(isAdminByLabel || false);

        } catch (error) {
            console.error('❌ Error checking admin status:', error);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    // Get labels for additional role info
    const labels = user?.labels || [];
    const hasUserLabel = labels.includes('user');

    // Determine role for display
    const role: UserRole = isAdmin ? 'admin' : 'user';

    // Permissions based on role
    const canEdit = true;                    // Everyone can edit basic fields
    const canDelete = isAdmin;               // Only admins can delete
    const canManageSchools = isAdmin;        // Only admins can add/edit schools
    const canEditItemTypes = isAdmin;        // Only admins can edit item type definitions
    const canEditHistory = isAdmin;          // Only admins can edit transactions
    const canAssignSchools = isAdmin;        // Only admins can assign items to schools
    const canEditSerialNumber = isAdmin;     // Only admins can edit serial numbers
    const canToggleSchoolSpecific = isAdmin; // Only admins can toggle school-specific flag
    const canEditSensitiveFields = isAdmin;  // Only admins can edit serial numbers, school-specific flags

    return {
        role,
        isAdmin,
        canEdit,
        canDelete,
        canManageSchools,
        canEditItemTypes,
        canEditHistory,
        canAssignSchools,
        canEditSerialNumber,
        canToggleSchoolSpecific,
        canEditSensitiveFields,
        loading,
        labels,
        hasUserLabel,
    };
}