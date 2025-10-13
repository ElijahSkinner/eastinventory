// src/hooks/useRole.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { databases, DATABASE_ID } from '../lib/appwrite';
import { Query } from 'appwrite';

export type UserRole = 'admin' | 'user';

export function useRole() {
    const { user } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAdminStatus();
    }, [user]);

    const checkAdminStatus = async () => {
        if (!user) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        try {
            // Check if user is member of "admin" team
            // Appwrite stores team memberships, we can check by listing teams
            const response = await fetch(
                `${process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT}/teams`,
                {
                    method: 'GET',
                    headers: {
                        'X-Appwrite-Project': process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '',
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                }
            );

            if (response.ok) {
                const data = await response.json();
                // Check if user is in a team named "admin"
                const isInAdminTeam = data.teams?.some(
                    (team: any) => team.name.toLowerCase() === 'admin'
                );
                setIsAdmin(isInAdminTeam);
            } else {
                setIsAdmin(false);
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
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