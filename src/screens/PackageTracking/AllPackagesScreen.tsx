// src/screens/PackageTracking/AllPackagesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { databases, DATABASE_ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import {
    Package,
    getStatusColor,
    getStatusIcon,
    getStatusLabel,
    formatPackageDate,
    PackageStatus,
} from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function AllPackagesScreen() {
    const { colors } = useTheme();

    const [packages, setPackages] = useState<Package[]>([]);
    const [filteredPackages, setFilteredPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<PackageStatus | 'all'>('all');

    useEffect(() => {
        loadPackages();
    }, []);

    useEffect(() => {
        filterPackages();
    }, [packages, searchQuery, statusFilter]);

    const loadPackages = async () => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                'packages',
                [Query.orderDesc('received_date'), Query.limit(200)]
            );
            setPackages(response.documents as unknown as Package[]);
        } catch (error) {
            console.error('Error loading packages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterPackages = () => {
        let filtered = packages;

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter((pkg) => pkg.status === statusFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (pkg) =>
                    pkg.tracking_number.toLowerCase().includes(query) ||
                    pkg.addressed_to.toLowerCase().includes(query) ||
                    pkg.sender.toLowerCase().includes(query)
            );
        }

        setFilteredPackages(filtered);
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadPackages();
    };

    const renderPackageItem = ({ item }: { item: Package }) => (
        <View
            style={[
                styles.packageCard,
                { backgroundColor: colors.background.secondary, borderColor: colors.ui.border },
            ]}
        >
            <View style={styles.packageHeader}>
                <Text style={styles.packageIcon}>{getStatusIcon(item.status)}</Text>
                <View style={styles.packageInfo}>
                    <Text style={[styles.packageTracking, { color: colors.text.primary }]}>
                        {item.tracking_number}
                    </Text>
                    <Text style={[styles.packageAddressee, { color: colors.text.secondary }]}>
                        To: {item.addressed_to}
                    </Text>
                </View>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: `${getStatusColor(item.status)}20` },
                    ]}
                >
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {getStatusLabel(item.status)}
                    </Text>
                </View>
            </View>

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
                        Received:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                        {formatPackageDate(item.received_date)}
                    </Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                        Location:
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                        {item.location}
                    </Text>
                </View>
            </View>
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
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={[
                        styles.searchInput,
                        {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary,
                        },
                    ]}
                    placeholder="Search by tracking #, recipient, or sender..."
                    placeholderTextColor={colors.text.secondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Status Filter Tabs */}
            <View style={[styles.filterTabs, { backgroundColor: colors.background.secondary }]}>
                {(['all', 'pending_confirmation', 'confirmed', 'completed'] as const).map(
                    (status) => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterTab,
                                statusFilter === status && {
                                    backgroundColor: colors.primary.cyan,
                                },
                            ]}
                            onPress={() => setStatusFilter(status)}
                        >
                            <Text
                                style={[
                                    styles.filterTabText,
                                    {
                                        color:
                                            statusFilter === status
                                                ? '#fff'
                                                : colors.text.primary,
                                    },
                                ]}
                            >
                                {status === 'all' ? 'All' : getStatusLabel(status)}
                            </Text>
                        </TouchableOpacity>
                    )
                )}
            </View>

            {/* Package List */}
            <FlatList
                data={filteredPackages}
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
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={[styles.emptyText, { color: colors.text.primary }]}>
                            No packages found
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
                            Try adjusting your filters
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
    searchContainer: {
        padding: Spacing.md,
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    filterTabs: {
        flexDirection: 'row',
        padding: Spacing.xs,
        ...Shadows.sm,
    },
    filterTab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        borderRadius: BorderRadius.sm,
        marginHorizontal: Spacing.xs / 2,
    },
    filterTabText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.semibold,
    },
    listContent: {
        padding: Spacing.md,
    },
    packageCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        ...Shadows.sm,
    },
    packageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    packageIcon: {
        fontSize: 28,
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
        gap: Spacing.xs / 2,
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