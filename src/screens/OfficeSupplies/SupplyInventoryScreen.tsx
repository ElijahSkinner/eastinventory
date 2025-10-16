// src/screens/OfficeSupplies/SupplyInventoryScreen.tsx
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    OfficeSupplyItem,
    needsReorder,
    getReorderPriority,
    formatQuantity,
} from '../../lib/appwrite';
import { Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

type FilterType = 'all' | 'low-stock' | 'in-stock';

interface SupplyByCategory {
    category: string;
    items: OfficeSupplyItem[];
}

export default function SupplyInventoryScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { isAdmin } = useRole();
    const navigation = useNavigation();

    const [supplies, setSupplies] = useState<OfficeSupplyItem[]>([]);
    const [filteredSupplies, setFilteredSupplies] = useState<SupplyByCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadSupplies();
        }, [])
    );

    const loadSupplies = async () => {
        try {
            setLoading(true);

            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                [Query.limit(1000), Query.orderAsc('item_name')]
            );

            const items = response.documents as unknown as OfficeSupplyItem[];
            setSupplies(items);
            filterAndGroupSupplies(items, activeFilter, searchQuery);
        } catch (error) {
            console.error('Error loading supplies:', error);
            Alert.alert('Error', 'Failed to load supplies');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterAndGroupSupplies = (
        items: OfficeSupplyItem[],
        filter: FilterType,
        search: string
    ) => {
        let filtered = items;

        // Apply filter
        if (filter === 'low-stock') {
            filtered = items.filter(item => needsReorder(item));
        } else if (filter === 'in-stock') {
            filtered = items.filter(item => item.current_quantity > item.reorder_point);
        }

        // Apply search
        if (search) {
            filtered = filtered.filter(item =>
                item.item_name.toLowerCase().includes(search.toLowerCase()) ||
                item.category.toLowerCase().includes(search.toLowerCase()) ||
                item.supplier?.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Group by category
        const grouped: { [key: string]: OfficeSupplyItem[] } = {};
        filtered.forEach(item => {
            if (!grouped[item.category]) {
                grouped[item.category] = [];
            }
            grouped[item.category].push(item);
        });

        // Convert to array and sort
        const groupedArray: SupplyByCategory[] = Object.keys(grouped)
            .sort()
            .map(category => ({
                category,
                items: grouped[category],
            }));

        setFilteredSupplies(groupedArray);
    };

    const handleFilterChange = (filter: FilterType) => {
        setActiveFilter(filter);
        filterAndGroupSupplies(supplies, filter, searchQuery);
    };

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        filterAndGroupSupplies(supplies, activeFilter, text);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadSupplies();
    };

    const getStockColor = (item: OfficeSupplyItem) => {
        if (item.current_quantity === 0) return colors.secondary.red;
        if (needsReorder(item)) return colors.secondary.orange;
        return colors.status.available;
    };

    const getStockIcon = (item: OfficeSupplyItem) => {
        if (item.current_quantity === 0) return '🔴';
        if (needsReorder(item)) return '🟠';
        return '🟢';
    };

    const getTotalStats = () => {
        const total = supplies.length;
        const lowStock = supplies.filter(item => needsReorder(item)).length;
        const outOfStock = supplies.filter(item => item.current_quantity === 0).length;

        return { total, lowStock, outOfStock };
    };

    const stats = getTotalStats();

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.secondary.orange} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            {/* Header Stats */}
            <View style={[styles.statsBar, { backgroundColor: colors.background.primary }]}>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary.cyan }]}>
                        {stats.total}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                        Total
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.secondary.orange }]}>
                        {stats.lowStock}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                        Low Stock
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.secondary.red }]}>
                        {stats.outOfStock}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                        Out of Stock
                    </Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.background.primary }]}>
                <TextInput
                    style={[styles.searchInput, {
                        backgroundColor: colors.background.secondary,
                        color: colors.text.primary,
                        borderColor: colors.ui.border
                    }]}
                    placeholder="Search supplies..."
                    placeholderTextColor={colors.text.secondary}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                />
            </View>

            {/* Filter Tabs */}
            <View style={[styles.filterContainer, { backgroundColor: colors.background.primary }]}>
                <TouchableOpacity
                    style={[
                        styles.filterTab,
                        activeFilter === 'all' && { backgroundColor: colors.secondary.orange }
                    ]}
                    onPress={() => handleFilterChange('all')}
                >
                    <Text style={[
                        styles.filterTabText,
                        { color: activeFilter === 'all' ? '#fff' : colors.text.secondary }
                    ]}>
                        All
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.filterTab,
                        activeFilter === 'low-stock' && { backgroundColor: colors.secondary.orange }
                    ]}
                    onPress={() => handleFilterChange('low-stock')}
                >
                    <Text style={[
                        styles.filterTabText,
                        { color: activeFilter === 'low-stock' ? '#fff' : colors.text.secondary }
                    ]}>
                        Low Stock
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.filterTab,
                        activeFilter === 'in-stock' && { backgroundColor: colors.secondary.orange }
                    ]}
                    onPress={() => handleFilterChange('in-stock')}
                >
                    <Text style={[
                        styles.filterTabText,
                        { color: activeFilter === 'in-stock' ? '#fff' : colors.text.secondary }
                    ]}>
                        In Stock
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Supply List */}
            <ScrollView
                style={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {filteredSupplies.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>📦</Text>
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            {searchQuery ? 'No supplies match your search' : 'No supplies found'}
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
                            {!searchQuery && 'Tap + to add your first supply item'}
                        </Text>
                    </View>
                ) : (
                    filteredSupplies.map(group => (
                        <View key={group.category} style={styles.categoryContainer}>
                            {/* Category Header */}
                            <TouchableOpacity
                                style={[styles.categoryHeader, { backgroundColor: colors.background.primary }]}
                                onPress={() => setExpandedCategory(
                                    expandedCategory === group.category ? null : group.category
                                )}
                                activeOpacity={0.7}
                            >
                                <View style={styles.categoryTitleRow}>
                                    <Text style={[styles.categoryTitle, { color: colors.primary.coolGray }]}>
                                        {group.category}
                                    </Text>
                                    <Text style={[styles.categoryCount, { color: colors.text.secondary }]}>
                                        ({group.items.length})
                                    </Text>
                                </View>
                                <Text style={[styles.expandIcon, { color: colors.text.secondary }]}>
                                    {expandedCategory === group.category ? '˅' : '›'}
                                </Text>
                            </TouchableOpacity>

                            {/* Category Items */}
                            {expandedCategory === group.category && (
                                <View style={[styles.itemsContainer, { backgroundColor: colors.background.secondary }]}>
                                    {group.items.map(item => (
                                        <TouchableOpacity
                                            key={item.$id}
                                            style={[styles.itemCard, { backgroundColor: colors.background.primary }]}
                                            onPress={() => alert('Item details coming soon!')}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.itemHeader}>
                                                <View style={styles.itemTitleRow}>
                                                    <Text style={styles.stockIcon}>
                                                        {getStockIcon(item)}
                                                    </Text>
                                                    <Text style={[styles.itemName, { color: colors.text.primary }]}>
                                                        {item.item_name}
                                                    </Text>
                                                </View>

                                                <View style={[
                                                    styles.quantityBadge,
                                                    { backgroundColor: `${getStockColor(item)}20` }
                                                ]}>
                                                    <Text style={[
                                                        styles.quantityText,
                                                        { color: getStockColor(item) }
                                                    ]}>
                                                        {formatQuantity(item.current_quantity, item.unit)}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.itemDetails}>
                                                <Text style={[styles.itemDetailText, { color: colors.text.secondary }]}>
                                                    Reorder at: {item.reorder_point} {item.unit}s
                                                </Text>
                                                {item.location && (
                                                    <Text style={[styles.itemDetailText, { color: colors.text.secondary }]}>
                                                        📍 {item.location}
                                                    </Text>
                                                )}
                                                {item.supplier && (
                                                    <Text style={[styles.itemDetailText, { color: colors.text.secondary }]}>
                                                        Supplier: {item.supplier}
                                                    </Text>
                                                )}
                                            </View>

                                            {needsReorder(item) && (
                                                <View style={[
                                                    styles.reorderAlert,
                                                    { backgroundColor: `${colors.secondary.red}15` }
                                                ]}>
                                                    <Text style={[
                                                        styles.reorderAlertText,
                                                        { color: colors.secondary.red }
                                                    ]}>
                                                        🔔 Needs Reorder: {item.reorder_quantity} {item.unit}s
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Add Button */}
            <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.secondary.orange }]}
                onPress={() => alert('Add supply screen coming soon!')}
            >
                <Text style={styles.addButtonText}>+ Add Supply</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: Spacing.md,
        ...Shadows.sm,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
    },
    statLabel: {
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs / 2,
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
    filterContainer: {
        flexDirection: 'row',
        padding: Spacing.sm,
        gap: Spacing.sm,
        ...Shadows.sm,
    },
    filterTab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    filterTabText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    listContainer: {
        flex: 1,
    },
    emptyState: {
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
    categoryContainer: {
        marginBottom: Spacing.sm,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        marginHorizontal: Spacing.md,
        marginTop: Spacing.md,
        borderRadius: BorderRadius.md,
        ...Shadows.sm,
    },
    categoryTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    categoryTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    categoryCount: {
        fontSize: Typography.sizes.sm,
    },
    expandIcon: {
        fontSize: 24,
    },
    itemsContainer: {
        padding: Spacing.sm,
        marginHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.xs,
    },
    itemCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        ...Shadows.sm,
    },
    itemHeader: {
        marginBottom: Spacing.sm,
    },
    itemTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        gap: Spacing.xs,
    },
    stockIcon: {
        fontSize: 16,
    },
    itemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        flex: 1,
    },
    quantityBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
        alignSelf: 'flex-start',
        marginTop: Spacing.xs,
    },
    quantityText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
    },
    itemDetails: {
        gap: Spacing.xs / 2,
    },
    itemDetailText: {
        fontSize: Typography.sizes.sm,
    },
    reorderAlert: {
        marginTop: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
    },
    reorderAlertText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    addButton: {
        position: 'absolute',
        bottom: Spacing.lg,
        right: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.full,
        ...Shadows.lg,
    },
    addButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
});