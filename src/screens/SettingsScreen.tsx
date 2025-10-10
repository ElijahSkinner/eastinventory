// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import LogoutConfirmModal from '../components/modals/LogoutConfirmModal';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface Props {
    navigation: SettingsScreenNavigationProp;
}

export default function SettingsScreen({ navigation }: Props) {
    const { user, userSettings, logout, updateUserSettings } = useAuth();
    const { theme, colors, toggleTheme } = useTheme();
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogout = async () => {
        console.log('Logout confirmed');
        setShowLogoutModal(false);
        try {
            console.log('Calling logout function...');
            await logout();
            console.log('Logout successful');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const handleThemeToggle = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        toggleTheme();

        try {
            await updateUserSettings({ theme: newTheme });
        } catch (error) {
            console.error('Failed to save theme preference:', error);
        }
    };

    const handleNotificationsToggle = async (value: boolean) => {
        try {
            await updateUserSettings({ notifications_enabled: value });
        } catch (error) {
            console.error('Failed to update notification settings:', error);
        }
    };

    const styles = createStyles(colors);

    return (
        <>
            <ScrollView style={styles.container}>
                {/* User Info Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Account</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Name</Text>
                        <Text style={styles.value}>{user?.name || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.value}>{user?.email || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Role</Text>
                        <Text style={styles.value}>{userSettings?.role || 'User'}</Text>
                    </View>
                </View>

                {/* Appearance Settings */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Appearance</Text>
                    <View style={styles.settingRow}>
                        <View>
                            <Text style={styles.settingLabel}>Dark Mode</Text>
                            <Text style={styles.settingDescription}>
                                {theme === 'dark' ? 'Enabled' : 'Disabled'}
                            </Text>
                        </View>
                        <Switch
                            value={theme === 'dark'}
                            onValueChange={handleThemeToggle}
                            trackColor={{ false: colors.ui.border, true: colors.primary.cyan }}
                            thumbColor={colors.background.primary}
                        />
                    </View>
                </View>

                {/* Notification Settings */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Notifications</Text>
                    <View style={styles.settingRow}>
                        <View>
                            <Text style={styles.settingLabel}>Enable Notifications</Text>
                            <Text style={styles.settingDescription}>
                                Receive alerts for inventory changes
                            </Text>
                        </View>
                        <Switch
                            value={userSettings?.notifications_enabled ?? true}
                            onValueChange={handleNotificationsToggle}
                            trackColor={{ false: colors.ui.border, true: colors.primary.cyan }}
                            thumbColor={colors.background.primary}
                        />
                    </View>
                </View>

                {/* About Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>About</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Version</Text>
                        <Text style={styles.value}>1.0.0</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Last Login</Text>
                        <Text style={styles.value}>
                            {userSettings?.last_login
                                ? new Date(userSettings.last_login).toLocaleDateString()
                                : 'N/A'}
                        </Text>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={() => setShowLogoutModal(true)}
                >
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Building communities through service and technology
                    </Text>
                </View>
            </ScrollView>

            {/* Logout Confirmation Modal */}
            <LogoutConfirmModal
                visible={showLogoutModal}
                onConfirm={handleLogout}
                onCancel={() => setShowLogoutModal(false)}
            />
        </>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.secondary,
    },
    card: {
        backgroundColor: colors.background.primary,
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    cardTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        color: colors.primary.coolGray,
        marginBottom: Spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.ui.divider,
    },
    label: {
        fontSize: Typography.sizes.md,
        color: colors.text.secondary,
    },
    value: {
        fontSize: Typography.sizes.md,
        color: colors.text.primary,
        fontWeight: Typography.weights.medium,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    settingLabel: {
        fontSize: Typography.sizes.md,
        color: colors.text.primary,
        fontWeight: Typography.weights.medium,
        marginBottom: Spacing.xs,
    },
    settingDescription: {
        fontSize: Typography.sizes.sm,
        color: colors.text.secondary,
    },
    logoutButton: {
        backgroundColor: colors.secondary.red,
        margin: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.sm,
    },
    logoutButtonText: {
        color: colors.text.white,
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    footer: {
        padding: Spacing.lg,
        alignItems: 'center',
    },
    footerText: {
        fontSize: Typography.sizes.sm,
        color: colors.text.secondary,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});