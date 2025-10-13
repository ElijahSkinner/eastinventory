// src/screens/InventoryListScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRole } from '../hooks/useRole';
import { databases, DATABASE_ID, COLLECTIONS, ItemType, InventoryItem } from '../lib/appwrite';
import { Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import ItemDetailModal from '../components/modals/ItemDetailModal';

interface ItemTypeWithCounts extends ItemType {
    availableCount: number;
    stagedCount: number;
    installedCount: number;
    maintenanceCount: number;
    totalCount: number;
}

type TabType = 'all' | 'in-stock' | 'installed';

export default function InventoryListScreen() {
    const { colors } = useTheme();
    const { isAdmin, role, loading: roleLoading } = useRole();

    const [activeTab, setActiveTab] = useState<TabType>('in-stock');
    const [searchQuery, setSearchQuery] = useState('');
    const [itemTypes, setItemTypes] = useState<ItemTypeWithCounts[]>([]);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<InventoryItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingExpanded, setLoadingExpanded] = useState(false);

    useEffect(() => {
        loadItemTypes();
    }, [activeTab]);

    const loadItemTypes = async () => {
        try {
            setLoading(true);

            // Get all item types
            const typesResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.ITEM_TYPES
            );

            // For each item type, get counts
            const typesWithCounts: ItemTypeWithCounts[] = await Promise.all(
                typesResponse.documents.map(async (itemType) => {
                    const [available, staged, installed, maintenance] = await Promise.all([
                        databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [
                            Query.equal('item_type_id', itemType.$id),
                            Query.equal('status', 'available'),
                            Query.limit(1000)
                        ]),
                        databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [
                            Query.equal('item_type_id', itemType.$id),
                            Query.equal('status', 'staged'),
                            Query.limit(1000)
                        ]),
                        databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [
                            Query.equal('item_type_id', itemType.$id),
                            Query.equal('status', 'installed'),
                            Query.limit(1000)
                        ]),
                        databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [
                            Query.equal('item_type_id', itemType.$id),
                            Query.equal('status', 'maintenance'),
                            Query.limit(1000)
                        ])
                    ]);

                    return {
                        ...(itemType as unknown as ItemType),
                        availableCount: available.total,
                        stagedCount: staged.total,
                        installedCount: installed.total,
                        maintenanceCount: maintenance.total,
                        totalCount: available.total + staged.total + installed.total + maintenance.total,
                    };
                })
            );

            // Filter based on active tab
            let filtered = typesWithCounts;
            if (activeTab === 'in-stock') {
                filtered = typesWithCounts.filter(
                    (item) => item.availableCount > 0 || item.stagedCount > 0
                );
            } else if (activeTab === 'installed') {
                filtered = typesWithCounts.filter((item) => item.installedCount > 0);
            }

            // Apply search filter
            if (searchQuery) {
                filtered = filtered.filter((item) =>
                    item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            setItemTypes(filtered);
        } catch (error) {
            console.error('Error loading item types:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadItemTypes();
    }, [activeTab, searchQuery]);

    const handleExpandItem = async (itemTypeId: string) => {
        if (expandedItemId === itemTypeId) {
            // Collapse
            setExpandedItemId(null);
            setExpandedItems([]);
            return;
        }

        // Expand
        setExpandedItemId(itemTypeId);
        setLoadingExpanded(true);

        try {
            // Build query based on active tab
            let queries = [Query.equal('item_type_id', itemTypeId)];

            if (activeTab === 'in-stock') {
                // Note: Appwrite 1.7.4 doesn't support OR, so we'll filter after fetching
                queries = [Query.equal('item_type_id', itemTypeId)];
            } else if (activeTab === 'installed') {
                queries.push(Query.equal('status', 'installed'));
            }

            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                queries
            );

            // Filter by status if in-stock tab (since we can't use OR query)
            let items = response.documents as unknown as InventoryItem[];
            if (activeTab === 'in-stock') {
                items = items.filter(
                    item => item.status === 'available' || item.status === 'staged' || item.status === 'assigned'
                );
            }

            setExpandedItems(items);
        } catch (error) {
            console.error('Error loading inventory items:', error);
        } finally {
            setLoadingExpanded(false);
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'available':
                return colors.status.available;
            case 'assigned':
                return colors.secondary.purple;
            case 'staged':
                return colors.secondary.orange;
            case 'installed':
                return colors.primary.coolGray;
            case 'maintenance':
                return colors.status.maintenance;
            default:
                return colors.text.secondary;
        }
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'available':
                return '🟢';
            case 'assigned':
                return '🔵';
            case 'staged':
                return '🟠';
            case 'installed':
                return '✓';
            case 'maintenance':
                return '🔴';
            default:
                return '⚪';
        }
    };

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'available':
                return 'Available';
            case 'assigned':
                return 'Assigned';
            case 'staged':
                return 'Staged';
            case 'installed':
                return 'Installed';
            case 'maintenance':
                return 'Maintenance';
            default:
                return 'Unknown';
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (loading || roleLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            {/* Header with Role Badge */}
            <View style={[styles.headerContainer, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.headerTitle, { color: colors.primary.coolGray }]}>Inventory</Text>
                <View style={[
                    styles.roleBadge,
                    { backgroundColor: isAdmin ? '#e74c3c' : colors.primary.cyan }
                ]}>
                    <Text style={styles.roleBadgeText}>
                        {isAdmin ? '👑 Admin' : '👤 User'}
                    </Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.background.primary }]}>
                <TextInput
                    style={[styles.searchInput, { color: colors.text.primary, borderColor: colors.ui.border }]}
                    placeholder="Search by name, category, manufacturer..."
                    placeholderTextColor={colors.text.secondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={loadItemTypes}
                />
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: colors.background.primary }]}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'in-stock' && { borderBottomColor: colors.primary.cyan, borderBottomWidth: 3 },
                    ]}
                    onPress={() => setActiveTab('in-stock')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'in-stock' ? colors.primary.cyan : colors.text.secondary },
                        ]}
                    >
                        In Stock
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'installed' && { borderBottomColor: colors.primary.cyan, borderBottomWidth: 3 },
                    ]}
                    onPress={() => setActiveTab('installed')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'installed' ? colors.primary.cyan : colors.text.secondary },
                        ]}
                    >
                        Installed
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'all' && { borderBottomColor: colors.primary.cyan, borderBottomWidth: 3 },
                    ]}
                    onPress={() => setActiveTab('all')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'all' ? colors.primary.cyan : colors.text.secondary },
                        ]}
                    >
                        All Items
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Item List */}
            <ScrollView
                style={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {itemTypes.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            {searchQuery ? 'No items match your search' : 'No items in this category'}
                        </Text>
                    </View>
                ) : (
                    itemTypes.map((itemType) => (
                        <View key={itemType.$id} style={styles.itemTypeContainer}>
                            {/* Item Type Card */}
                            <TouchableOpacity
                                style={[styles.itemTypeCard, { backgroundColor: colors.background.primary }]}
                                onPress={() => handleExpandItem(itemType.$id)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.itemTypeHeader}>
                                    <View style={styles.itemTypeInfo}>
                                        <Text style={[styles.itemTypeName, { color: colors.primary.coolGray }]}>
                                            {itemType.item_name}
                                        </Text>
                                        <Text style={[styles.itemTypeCategory, { color: colors.text.secondary }]}>
                                            {itemType.category}
                                            {itemType.manufacturer && ` • ${itemType.manufacturer}`}
                                        </Text>
                                    </View>
                                    <Text style={[styles.expandIcon, { color: colors.text.secondary }]}>
                                        {expandedItemId === itemType.$id ? '˅' : '›'}
                                    </Text>
                                </View>

                                {/* Counts */}
                                <View style={styles.countsContainer}>
                                    {activeTab === 'in-stock' ? (
                                        <>
                                            <View style={styles.countBadge}>
                                                <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                    Available
                                                </Text>
                                                <Text style={[styles.countValue, { color: colors.status.available }]}>
                                                    {itemType.availableCount}
                                                </Text>
                                            </View>
                                            {itemType.stagedCount > 0 && (
                                                <View style={styles.countBadge}>
                                                    <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                        Staged
                                                    </Text>
                                                    <Text style={[styles.countValue, { color: colors.secondary.orange }]}>
                                                        {itemType.stagedCount}
                                                    </Text>
                                                </View>
                                            )}
                                        </>
                                    ) : activeTab === 'installed' ? (
                                        <View style={styles.countBadge}>
                                            <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                Installed
                                            </Text>
                                            <Text style={[styles.countValue, { color: colors.primary.coolGray }]}>
                                                {itemType.installedCount}
                                            </Text>
                                        </View>
                                    ) : (
                                        <>
                                            <View style={styles.countBadge}>
                                                <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                    In Stock
                                                </Text>
                                                <Text style={[styles.countValue, { color: colors.status.available }]}>
                                                    {itemType.availableCount + itemType.stagedCount}
                                                </Text>
                                            </View>
                                            <View style={styles.countBadge}>
                                                <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                    Installed
                                                </Text>
                                                <Text style={[styles.countValue, { color: colors.primary.coolGray }]}>
                                                    {itemType.installedCount}
                                                </Text>
                                            </View>
                                            <View style={styles.countBadge}>
                                                <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                    Total
                                                </Text>
                                                <Text style={[styles.countValue, { color: colors.text.primary }]}>
                                                    {itemType.totalCount}
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Expanded Individual Items */}
                            {expandedItemId === itemType.$id && (
                                <View style={[styles.expandedContainer, { backgroundColor: colors.background.secondary }]}>
                                    {loadingExpanded ? (
                                        <ActivityIndicator size="small" color={colors.primary.cyan} />
                                    ) : expandedItems.length === 0 ? (
                                        <Text style={[styles.emptyExpandedText, { color: colors.text.secondary }]}>
                                            No items
                                        </Text>
                                    ) : (
                                        expandedItems.map((item, index) => (
                                            <TouchableOpacity
                                                key={item.$id}
                                                style={[styles.inventoryItemCard, { backgroundColor: colors.background.primary }]}
                                                onPress={() => setSelectedItem(item)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.inventoryItemHeader}>
                                                    <View style={styles.inventoryItemInfo}>
                                                        <View style={styles.statusRow}>
                                                            <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
                                                            <View style={styles.itemNameContainer}>
                                                                {item.serial_number ? (
                                                                    <>
                                                                        <Text style={[styles.itemDisplayName, { color: colors.text.primary }]}>
                                                                            {itemType.item_name} #{index + 1}
                                                                        </Text>
                                                                        <Text style={[styles.serialNumberSmall, { color: colors.text.secondary }]}>
                                                                            SN: {item.serial_number}
                                                                        </Text>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Text style={[styles.itemDisplayName, { color: colors.text.primary }]}>
                                                                            {itemType.item_name} #{index + 1}
                                                                        </Text>
                                                                        <Text style={[styles.serialNumberSmall, { color: colors.text.secondary }]}>
                                                                            ...{item.barcode.slice(-4)}
                                                                        </Text>
                                                                    </>
                                                                )}
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

                                                        {item.location && (
                                                            <Text style={[styles.itemLocation, { color: colors.text.secondary }]}>
                                                                📍 {item.location}
                                                            </Text>
                                                        )}

                                                        {item.school_id && (
                                                            <Text style={[styles.itemSchool, { color: colors.secondary.orange }]}>
                                                                🏫 School assigned
                                                            </Text>
                                                        )}

                                                        {/* School-Specific Badge - Admin Only */}
                                                        {isAdmin && item.is_school_specific && (
                                                            <View style={[styles.schoolSpecificBadge, { backgroundColor: colors.secondary.purple + '20' }]}>
                                                                <Text style={[styles.schoolSpecificText, { color: colors.secondary.purple }]}>
                                                                    🔒 School-Specific (NAS)
                                                                </Text>
                                                            </View>
                                                        )}

                                                        <Text style={[styles.itemDate, { color: colors.text.secondary }]}>
                                                            Added {formatDate(item.received_date)}
                                                        </Text>
                                                    </View>

                                                    <Text style={[styles.itemArrow, { color: colors.text.secondary }]}>›</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Item Detail Modal */}
            {selectedItem && (
                <ItemDetailModal
                    visible={!!selectedItem}
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onRefresh={() => {
                        loadItemTypes();
                        if (expandedItemId) {
                            handleExpandItem(expandedItemId);
                        }
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        ...Shadows.sm,
    },
    headerTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
    },
    roleBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    roleBadgeText: {
        color: '#fff',
        fontWeight: Typography.weights.bold,
        fontSize: Typography.sizes.xs,
    },
    searchContainer: {
        padding: Spacing.md,
        ...Shadows.sm,
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    tabContainer: {
        flexDirection: 'row',
        ...Shadows.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    tabText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    listContainer: {
        flex: 1,
        padding: Spacing.md,
    },
    emptyState: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: Typography.sizes.md,
    },
    itemTypeContainer: {
        marginBottom: Spacing.md,
    },
    itemTypeCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.md,
    },
    itemTypeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    itemTypeInfo: {
        flex: 1,
    },
    itemTypeName: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    itemTypeCategory: {
        fontSize: Typography.sizes.sm,
    },
    expandIcon: {
        fontSize: 24,
        marginLeft: Spacing.sm,
    },
    countsContainer: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    countBadge: {
        alignItems: 'center',
    },
    countLabel: {
        fontSize: Typography.sizes.xs,
        marginBottom: Spacing.xs / 2,
    },
    countValue: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    expandedContainer: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        gap: Spacing.sm,
    },
    emptyExpandedText: {
        padding: Spacing.md,
        textAlign: 'center',
        fontSize: Typography.sizes.sm,
    },
    inventoryItemCard: {
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        ...Shadows.sm,
    },
    inventoryItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    inventoryItemInfo: {
        flex: 1,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        gap: Spacing.xs,
    },
    statusIcon: {
        fontSize: 16,
    },
    itemNameContainer: {
        flex: 1,
    },
    itemDisplayName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    serialNumberSmall: {
        fontSize: Typography.sizes.xs,
        fontFamily: 'monospace',
        marginTop: 2,
    },
    serialNumber: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
        fontFamily: 'monospace',
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs / 2,
        borderRadius: BorderRadius.sm,
    },
    statusText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.semibold,
    },
    itemLocation: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    itemSchool: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    schoolSpecificBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs / 2,
        borderRadius: BorderRadius.sm,
        marginTop: Spacing.xs,
        alignSelf: 'flex-start',
    },
    schoolSpecificText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.semibold,
    },
    itemDate: {
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs,
    },
    itemArrow: {
        fontSize: 20,
    },
});