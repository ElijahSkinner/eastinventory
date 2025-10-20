// src/screens/InventoryListScreen.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
    assignedCount: number;
    installedCount: number;
    maintenanceCount: number;
    totalCount: number;
    items?: InventoryItem[]; // Cache items for this type
}

type TabType = 'all' | 'in-stock' | 'installed';

// Cache configuration
const CACHE_DURATION = 30000; // 30 seconds

interface CacheData {
    itemTypes: ItemTypeWithCounts[];
    allItems: InventoryItem[];
    timestamp: number;
}

export default function InventoryListScreen() {
    const { colors } = useTheme();
    const { isAdmin, role, loading: roleLoading } = useRole();

    const [activeTab, setActiveTab] = useState<TabType>('in-stock');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [itemTypes, setItemTypes] = useState<ItemTypeWithCounts[]>([]);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<InventoryItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searching, setSearching] = useState(false);

    // Cache
    const cacheRef = useRef<CacheData | null>(null);

    // Debounce timer ref
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadItemTypes();
        }, [activeTab, searchQuery])
    );

    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const loadItemTypes = async (forceRefresh = false) => {
        try {
            setLoading(true);

            // Check cache first
            const now = Date.now();
            const cachedData = cacheRef.current;
            const isCacheValid = cachedData &&
                !forceRefresh &&
                (now - cachedData.timestamp) < CACHE_DURATION;

            let allItemTypes: ItemType[];
            let allInventoryItems: InventoryItem[];

            if (isCacheValid && cachedData) {
                // Use cached data
                allItemTypes = cachedData.itemTypes;
                allInventoryItems = cachedData.allItems;
            } else {
                // Fetch fresh data - parallel queries for speed
                const [typesResponse, itemsResponse] = await Promise.all([
                    databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.ITEM_TYPES,
                        [Query.limit(100)]
                    ),
                    databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.INVENTORY_ITEMS,
                        [Query.limit(5000)] // Adjust based on your inventory size
                    )
                ]);

                allItemTypes = typesResponse.documents as unknown as ItemType[];
                allInventoryItems = itemsResponse.documents as unknown as InventoryItem[];

                // Update cache
                cacheRef.current = {
                    itemTypes: allItemTypes as ItemTypeWithCounts[],
                    allItems: allInventoryItems,
                    timestamp: now
                };
            }

            // Process data: count items for each type
            const typesWithCounts: ItemTypeWithCounts[] = allItemTypes.map((itemType) => {
                // Filter items for this type
                const itemsForType = allInventoryItems.filter(
                    item => item.item_type_id === itemType.$id
                );

                // Count by status
                const availableCount = itemsForType.filter(i => i.status === 'available').length;
                const stagedCount = itemsForType.filter(i => i.status === 'staged').length;
                const assignedCount = itemsForType.filter(i => i.status === 'assigned').length;
                const installedCount = itemsForType.filter(i => i.status === 'installed').length;
                const maintenanceCount = itemsForType.filter(i => i.status === 'maintenance').length;

                return {
                    ...itemType,
                    availableCount,
                    stagedCount,
                    assignedCount,
                    installedCount,
                    maintenanceCount,
                    totalCount: itemsForType.length,
                    items: itemsForType, // Cache items for quick access
                };
            });

            // Filter based on active tab
            let filtered = typesWithCounts;
            if (activeTab === 'in-stock') {
                filtered = typesWithCounts.filter(
                    (item) => item.availableCount > 0 || item.stagedCount > 0
                );
            } else if (activeTab === 'installed') {
                filtered = typesWithCounts.filter((item) =>
                    item.assignedCount > 0 || item.installedCount > 0
                );
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
            setSearching(false);
        }
    };

    // Handle search input with debouncing
    const handleSearchChange = (text: string) => {
        setSearchInput(text);

        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set searching state
        if (text !== searchQuery) {
            setSearching(true);
        }

        // Set new timeout for debounced search
        searchTimeoutRef.current = setTimeout(() => {
            setSearchQuery(text);
        }, 500); // Wait 500ms after user stops typing
    };

    // Manual search trigger
    const handleSearchSubmit = () => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        setSearchQuery(searchInput);
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadItemTypes(true); // Force refresh
    }, [activeTab, searchQuery]);

    const handleExpandItem = (itemTypeId: string) => {
        if (expandedItemId === itemTypeId) {
            setExpandedItemId(null);
            setExpandedItems([]);
            return;
        }

        setExpandedItemId(itemTypeId);

        // Find the item type with cached items
        const itemType = itemTypes.find(it => it.$id === itemTypeId);
        if (!itemType || !itemType.items) {
            setExpandedItems([]);
            return;
        }

        // Filter by status based on active tab
        let items = itemType.items;
        if (activeTab === 'in-stock') {
            items = items.filter(
                item => item.status === 'available' || item.status === 'staged'
            );
        } else if (activeTab === 'installed') {
            items = items.filter(
                item => item.status === 'assigned' || item.status === 'installed'
            );
        }

        setExpandedItems(items);
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

            {/* Search Bar with Manual Search Button */}
            <View style={[styles.searchContainer, { backgroundColor: colors.background.primary }]}>
                <View style={styles.searchInputContainer}>
                    <TextInput
                        style={[styles.searchInput, {
                            color: colors.text.primary,
                            borderColor: colors.ui.border
                        }]}
                        placeholder="Search by name, category, manufacturer..."
                        placeholderTextColor={colors.text.secondary}
                        value={searchInput}
                        onChangeText={handleSearchChange}
                        onSubmitEditing={handleSearchSubmit}
                        returnKeyType="search"
                    />
                    <TouchableOpacity
                        style={[styles.searchButton, { backgroundColor: colors.primary.cyan }]}
                        onPress={handleSearchSubmit}
                    >
                        {searching ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.searchIcon}>🔍</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
                                        <>
                                            {itemType.assignedCount > 0 && (
                                                <View style={styles.countBadge}>
                                                    <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                        Assigned
                                                    </Text>
                                                    <Text style={[styles.countValue, { color: colors.secondary.purple }]}>
                                                        {itemType.assignedCount}
                                                    </Text>
                                                </View>
                                            )}
                                            {itemType.installedCount > 0 && (
                                                <View style={styles.countBadge}>
                                                    <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                        Installed
                                                    </Text>
                                                    <Text style={[styles.countValue, { color: colors.primary.coolGray }]}>
                                                        {itemType.installedCount}
                                                    </Text>
                                                </View>
                                            )}
                                        </>
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
                                            {itemType.assignedCount > 0 && (
                                                <View style={styles.countBadge}>
                                                    <Text style={[styles.countLabel, { color: colors.text.secondary }]}>
                                                        Assigned
                                                    </Text>
                                                    <Text style={[styles.countValue, { color: colors.secondary.purple }]}>
                                                        {itemType.assignedCount}
                                                    </Text>
                                                </View>
                                            )}
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
                                    {expandedItems.length === 0 ? (
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
                        loadItemTypes(true); // Force refresh to clear cache
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
    searchInputContainer: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    searchButton: {
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
    },
    searchIcon: {
        fontSize: 20,
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