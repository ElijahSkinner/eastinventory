// src/screens/PackageTracking/PackageTrackingHomeScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { databases, DATABASE_ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import {
    Package,
    getStatusColor,
    getStatusIcon,
    getDaysSinceReceived,
} from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows, CommonStyles } from '../../theme';

export default function PackageTrackingHomeScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();

    const [packages, setPackages] = useState<Package[]>([]);
    const [stats, setStats] = useState({
        pending: 0,
        confirmed: 0,
        completed: 0,
        needsAttention: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadPackages();
    }, []);

    const loadPackages = async () => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                'packages',
                [
                    Query.orderDesc('received_date'),
                    Query.limit(100),
                ]
            );

            const pkgs = response.documents as unknown as Package[];
            setPackages(pkgs);

            // Calculate stats
            const pending = pkgs.filter((p) => p.status === 'pending_confirmation').length;
            const confirmed = pkgs.filter((p) => p.status === 'confirmed').length;
            const completed = pkgs.filter((p) => p.status === 'completed').length;
            const needsAttention = pkgs.filter((p) => {
                return (
                    p.status === 'pending_confirmation' && getDaysSinceReceived(p.received_date) > 1
                );
            }).length;

            setStats({ pending, confirmed, completed, needsAttention });
        } catch (error) {
            console.error('Error loading packages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadPackages();
    };

    const navigateToReceivePackage = () => {
        navigation.navigate('ReceivePackage' as never);
    };

    const navigateToMyPackages = () => {
        navigation.navigate('MyPackages' as never);
    };

    const navigateToAllPackages = () => {
        navigation.navigate('AllPackages' as never);
    };

    const navigateToManageRecipients = () => {
        navigation.navigate('ManageRecipients' as never);
    };

    if (loading) {
        return (
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary.cyan}
                    />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.primary.coolGray }]}>
                        📦 Package Tracking
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                        Manage incoming packages and deliveries
                    </Text>
                </View>

                {/* Quick Stats */}
                <View style={styles.statsGrid}>
                    <View
                        style={[
                            styles.statCard,
                            {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                            },
                        ]}
                    >
                        <Text style={[styles.statValue, { color: getStatusColor('pending_confirmation') }]}>
                            {stats.pending}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                            Pending
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.statCard,
                            {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                            },
                        ]}
                    >
                        <Text style={[styles.statValue, { color: getStatusColor('confirmed') }]}>
                            {stats.confirmed}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                            Confirmed
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.statCard,
                            {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                            },
                        ]}
                    >
                        <Text style={[styles.statValue, { color: getStatusColor('completed') }]}>
                            {stats.completed}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                            Completed
                        </Text>
                    </View>

                    {stats.needsAttention > 0 && (
                        <View
                            style={[
                                styles.statCard,
                                styles.attentionCard,
                                {
                                    backgroundColor: '#FFF3CD',
                                    borderColor: '#E6A65D',
                                },
                            ]}
                        >
                            <Text style={[styles.statValue, { color: '#E6A65D' }]}>
                                {stats.needsAttention}
                            </Text>
                            <Text style={[styles.statLabel, { color: '#856404' }]}>
                                Needs Attention
                            </Text>
                        </View>
                    )}
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Quick Actions
                    </Text>

                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary.cyan }]}
                        onPress={navigateToReceivePackage}
                    >
                        <Text style={styles.actionIcon}>📥</Text>
                        <Text style={styles.actionText}>Receive New Package</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            {
                                backgroundColor: colors.background.secondary,
                                borderWidth: 1,
                                borderColor: colors.ui.border,
                            },
                        ]}
                        onPress={navigateToMyPackages}
                    >
                        <Text style={styles.actionIcon}>📦</Text>
                        <Text style={[styles.actionText, { color: colors.text.primary }]}>
                            My Packages
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            {
                                backgroundColor: colors.background.secondary,
                                borderWidth: 1,
                                borderColor: colors.ui.border,
                            },
                        ]}
                        onPress={navigateToAllPackages}
                    >
                        <Text style={styles.actionIcon}>📋</Text>
                        <Text style={[styles.actionText, { color: colors.text.primary }]}>
                            All Packages
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            {
                                backgroundColor: colors.background.secondary,
                                borderWidth: 1,
                                borderColor: colors.ui.border,
                            },
                        ]}
                        onPress={navigateToManageRecipients}
                    >
                        <Text style={styles.actionIcon}>👥</Text>
                        <Text style={[styles.actionText, { color: colors.text.primary }]}>
                            Manage Recipients
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Packages */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Recent Packages
                    </Text>

                    {packages.slice(0, 5).map((pkg) => (
                        <View
                            key={pkg.$id}
                            style={[
                                styles.packageCard,
                                {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                },
                            ]}
                        >
                            <View style={styles.packageHeader}>
                                <Text style={styles.packageIcon}>
                                    {getStatusIcon(pkg.status)}
                                </Text>
                                <View style={styles.packageInfo}>
                                    <Text style={[styles.packageTracking, { color: colors.text.primary }]}>
                                        {pkg.tracking_number}
                                    </Text>
                                    <Text style={[styles.packageAddressee, { color: colors.text.secondary }]}>
                                        To: {pkg.addressed_to}
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.statusBadge,
                                        { backgroundColor: `${getStatusColor(pkg.status)}20` },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusText,
                                            { color: getStatusColor(pkg.status) },
                                        ]}
                                    >
                                        {pkg.status.replace('_', ' ').toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.packageDetails}>
                                <Text style={[styles.packageDetail, { color: colors.text.secondary }]}>
                                    From: {pkg.sender}
                                </Text>
                                <Text style={[styles.packageDetail, { color: colors.text.secondary }]}>
                                    Packages: {pkg.number_of_packages}
                                </Text>
                                <Text style={[styles.packageDetail, { color: colors.text.secondary }]}>
                                    Location: {pkg.location}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: Spacing.lg,
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
    },
    subtitle: {
        fontSize: Typography.sizes.md,
        marginTop: Spacing.xs,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: Spacing.md,
        gap: Spacing.md,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        borderWidth: 1,
        ...Shadows.sm,
    },
    attentionCard: {
        minWidth: '100%',
    },
    statValue: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: Typography.weights.bold,
    },
    statLabel: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    section: {
        padding: Spacing.lg,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        ...Shadows.sm,
    },
    actionIcon: {
        fontSize: 24,
        marginRight: Spacing.md,
    },
    actionText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        color: '#fff',
    },
    packageCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        ...Shadows.sm,
    },
    packageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    packageIcon: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    packageInfo: {
        flex: 1,
    },
    packageTracking: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        fontFamily: 'monospace',
    },
    packageAddressee: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    statusText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.bold,
    },
    packageDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    packageDetail: {
        fontSize: Typography.sizes.sm,
    },
});