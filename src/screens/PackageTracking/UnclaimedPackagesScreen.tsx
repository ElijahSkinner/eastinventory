// src/screens/PackageTracking/UnclaimedPackagesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { databases, DATABASE_ID, ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import { Package, formatPackageDate } from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function UnclaimedPackagesScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();

    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [claiming, setClaiming] = useState<string | null>(null);

    useEffect(() => {
        loadUnclaimedPackages();
    }, []);

    const loadUnclaimedPackages = async () => {
        try {
            // Query for packages marked as unclaimed or addressed to "EAST Initiative"
            const response = await databases.listDocuments(
                DATABASE_ID,
                'packages',
                [
                    Query.equal('addressed_to_type', 'unclaimed'),
                    Query.equal('status', 'pending_claim'),
                    Query.orderDesc('received_date'),
                    Query.limit(100),
                ]
            );
            setPackages(response.documents as unknown as Package[]);
        } catch (error) {
            console.error('Error loading unclaimed packages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadUnclaimedPackages();
    };

    const handleClaim = async (pkg: Package) => {
        Alert.alert(
            'Claim Package',
            `Are you sure you want to claim this package?\n\nTracking: ${pkg.tracking_number}\nFrom: ${pkg.sender}`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Yes, Claim It',
                    onPress: () => processClaim(pkg),
                },
            ]
        );
    };

    const processClaim = async (pkg: Package) => {
        setClaiming(pkg.$id);

        try {
            await databases.updateDocument(
                DATABASE_ID,
                'packages',
                pkg.$id,
                {
                    addressed_to: user?.name || user?.email || 'Unknown',
                    addressed_to_type: 'staff',
                    addressed_to_id: user?.$id || null,
                    status: 'pending_confirmation',
                    needs_claim: false,
                    claimed_by: user?.name || user?.email || 'Unknown',
                    claimed_date: new Date().toISOString(),
                    current_handler: user?.name || user?.email || 'Unknown',
                }
            );

            // Create transaction record
            await databases.createDocument(
                DATABASE_ID,
                'transactions',
                ID.unique(),
                {
                    transaction_type: 'note',
                    inventory_item_id: pkg.$id,
                    performed_by: user?.name || 'Unknown',
                    transaction_date: new Date().toISOString(),
                    notes: `Package claimed by ${user?.name || user?.email}`,
                }
            );

            Alert.alert(
                'Success',
                'Package claimed! You can now confirm the contents in "My Packages".',
                [
                    {
                        text: 'OK',
                        onPress: () => loadUnclaimedPackages(),
                    },
                ]
            );
        } catch (error: any) {
            console.error('Error claiming package:', error);
            Alert.alert('Error', 'Failed to claim package: ' + error.message);
        } finally {
            setClaiming(null);
        }
    };

    const renderPackageItem = ({ item }: { item: Package }) => (
        <View
            style={[
                styles.packageCard,
                {
                    backgroundColor: colors.background.secondary,
                    borderColor: '#E6A65D',
                    borderWidth: 2,
                },
            ]}
        >
            {/* Header */}
            <View style={styles.packageHeader}>
                <Text style={styles.packageIcon}>📦</Text>
                <View style={styles.packageInfo}>
                    <Text style={[styles.packageTracking, { color: colors.text.primary }]}>
                        {item.tracking_number}
                    </Text>
                    <Text style={[styles.packageDate, { color: colors.text.secondary }]}>
                        Received: {formatPackageDate(item.received_date)}
                    </Text>
                </View>
                <View
                    style={[
                        styles.unclaimedBadge,
                        { backgroundColor: '#FFF3CD', borderColor: '#E6A65D' },
                    ]}
                >
                    <Text style={[styles.unclaimedText, { color: '#856404' }]}>
                        UNCLAIMED
                    </Text>
                </View>
            </View>

            {/* Details */}
            <View style={styles.packageDetails}>
                <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                        From:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                        {item.sender}
                    </Text>
                </View>

                <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                        Packages:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                        {item.number_of_packages}
                    </Text>
                </View>

                {item.carrier && (
                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            Carrier:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {item.carrier}
                        </Text>
                    </View>
                )}

                <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                        Location:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                        {item.location}
                    </Text>
                </View>
            </View>

            {/* Claim Button */}
            <TouchableOpacity
                style={[
                    styles.claimButton,
                    {
                        backgroundColor:
                            claiming === item.$id ? colors.ui.border : colors.primary.cyan,
                    },
                ]}
                onPress={() => handleClaim(item)}
                disabled={claiming === item.$id}
            >
                {claiming === item.$id ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.claimButtonText}>🙋 This is Mine!</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            {/* Header Info */}
            <View style={[styles.infoCard, { backgroundColor: '#FFF3CD', borderColor: '#E6A65D' }]}>
                <Text style={[styles.infoIcon]}>❓</Text>
                <View style={styles.infoText}>
                    <Text style={[styles.infoTitle, { color: '#856404' }]}>
                        Unclaimed Packages
                    </Text>
                    <Text style={[styles.infoSubtitle, { color: '#856404' }]}>
                        These packages were addressed to "EAST Initiative" without a specific
                        recipient. If you're expecting a delivery, claim it below!
                    </Text>
                </View>
            </View>

            <FlatList
                data={packages}
                renderItem={renderPackageItem}
                keyExtractor={(item) => item.$id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary.cyan}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>✅</Text>
                        <Text style={[styles.emptyText, { color: colors.text.primary }]}>
                            No Unclaimed Packages
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
                            All packages have been claimed!
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoCard: {
        flexDirection: 'row',
        padding: Spacing.md,
        margin: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        ...Shadows.sm,
    },
    infoIcon: {
        fontSize: 40,
        marginRight: Spacing.md,
    },
    infoText: {
        flex: 1,
    },
    infoTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    infoSubtitle: {
        fontSize: Typography.sizes.sm,
        lineHeight: Typography.lineHeights.normal * Typography.sizes.sm,
    },
    listContent: {
        padding: Spacing.md,
    },
    packageCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
        ...Shadows.md,
    },
    packageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
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
    packageDate: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
    },
    unclaimedBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
    },
    unclaimedText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.bold,
    },
    packageDetails: {
        gap: Spacing.xs,
        marginBottom: Spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: Typography.sizes.sm,
    },
    detailValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    claimButton: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.sm,
    },
    claimButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    emptyText: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs,
    },
    emptySubtext: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
    },
});