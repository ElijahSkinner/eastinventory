// src/screens/OfficeSupplies/ReorderAlertsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Share,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    OfficeSupplyItem,
    needsReorder,
    getReorderPriority,
    formatQuantity,
} from '../../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OfficeSuppliesStackParamList } from '../../navigation/AppNavigator';

type ReorderAlertsNavigationProp = NativeStackNavigationProp<
    OfficeSuppliesStackParamList,
    'ReorderAlerts'
>;

interface ReorderItem extends OfficeSupplyItem {
    priority: 'critical' | 'urgent' | 'low';
}

export default function ReorderAlertsScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<ReorderAlertsNavigationProp>();

    const [reorderItems, setReorderItems] = useState<ReorderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    useFocusEffect(
        useCallback(() => {
            loadReorderItems();
        }, [])
    );

    const loadReorderItems = async () => {
        try {
            setLoading(true);

            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                [Query.limit(1000), Query.orderAsc('item_name')]
            );

            const allItems = response.documents as unknown as OfficeSupplyItem[];

            // Filter items that need reordering
            const itemsNeedingReorder = allItems
                .filter(item => needsReorder(item))
                .map(item => ({
                    ...item,
                    priority: getReorderPriority(item),
                }));

            // Sort by priority: critical > urgent > low
            itemsNeedingReorder.sort((a, b) => {
                const priorityOrder = { critical: 0, urgent: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });

            setReorderItems(itemsNeedingReorder);
        } catch (error) {
            console.error('Error loading reorder items:', error);
            Alert.alert('Error', 'Failed to load reorder alerts');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadReorderItems();
    };

    const toggleItemSelection = (itemId: string) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const selectAllInPriority = (priority: 'critical' | 'urgent' | 'low') => {
        const itemsInPriority = reorderItems
            .filter(item => item.priority === priority)
            .map(item => item.$id);

        setSelectedItems(prev => {
            const newSet = new Set(prev);
            itemsInPriority.forEach(id => newSet.add(id));
            return newSet;
        });
    };

    const clearSelection = () => {
        setSelectedItems(new Set());
    };

    const generateShoppingList = () => {
        if (selectedItems.size === 0) {
            Alert.alert('No Items Selected', 'Please select items to add to the shopping list.');
            return;
        }

        const selectedReorderItems = reorderItems.filter(item => selectedItems.has(item.$id));

        let shoppingList = '📋 EAST Office Supplies - Reorder List\n';
        shoppingList += `Generated: ${new Date().toLocaleDateString()}\n\n`;

        // Group by priority
        ['critical', 'urgent', 'low'].forEach(priority => {
            const itemsInPriority = selectedReorderItems.filter(
                item => item.priority === priority
            );

            if (itemsInPriority.length > 0) {
                const priorityEmoji = priority === 'critical' ? '🔴' : priority === 'urgent' ? '🟠' : '🟡';
                shoppingList += `${priorityEmoji} ${priority.toUpperCase()}\n`;
                shoppingList += '─────────────────────\n';

                itemsInPriority.forEach(item => {
                    shoppingList += `\n${item.item_name}\n`;
                    shoppingList += `  • Order: ${item.reorder_quantity} ${item.unit}s\n`;
                    shoppingList += `  • Current: ${item.current_quantity} ${item.unit}s\n`;
                    if (item.supplier) {
                        shoppingList += `  • Supplier: ${item.supplier}\n`;
                    }
                    if (item.supplier_sku) {
                        shoppingList += `  • SKU: ${item.supplier_sku}\n`;
                    }
                    if (item.unit_cost) {
                        const totalCost = item.unit_cost * item.reorder_quantity;
                        shoppingList += `  • Est. Cost: $${totalCost.toFixed(2)}\n`;
                    }
                });

                shoppingList += '\n';
            }
        });

        // Calculate total
        const totalEstCost = selectedReorderItems.reduce((sum, item) => {
            return sum + ((item.unit_cost || 0) * item.reorder_quantity);
        }, 0);

        shoppingList += '═════════════════════\n';
        shoppingList += `Total Items: ${selectedItems.size}\n`;
        if (totalEstCost > 0) {
            shoppingList += `Estimated Total: $${totalEstCost.toFixed(2)}\n`;
        }

        return shoppingList;
    };

    const handleExportList = async () => {
        try {
            const list = generateShoppingList();
            if (!list) {
                Alert.alert('Error', 'Failed to generate shopping list');
                return;
            }
            await Share.share({
                message: list,
                title: 'Office Supplies Reorder List',
            });
        } catch (error) {
            console.error('Error sharing list:', error);
        }
    };

    const handleMarkAsOrdered = async () => {
        if (selectedItems.size === 0) {
            Alert.alert('No Items Selected', 'Please select items to mark as ordered.');
            return;
        }

        Alert.alert(
            'Mark as Ordered',
            `Mark ${selectedItems.size} items as ordered?\n\nThis is just a note - you'll still need to receive them when they arrive.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Ordered',
                    onPress: async () => {
                        try {
                            // You could add a "last_ordered_date" field to track this
                            Alert.alert(
                                'Noted!',
                                'Items marked. Remember to receive them when they arrive using the Receive Supplies screen.'
                            );
                            clearSelection();
                        } catch (error) {
                            console.error('Error marking items:', error);
                            Alert.alert('Error', 'Failed to mark items as ordered.');
                        }
                    }
                },
            ]
        );
    };

    const getPriorityColor = (priority: 'critical' | 'urgent' | 'low') => {
        switch (priority) {
            case 'critical':
                return colors.secondary.red;
            case 'urgent':
                return colors.secondary.orange;
            case 'low':
                return colors.primary.cyan;
        }
    };

    const getPriorityIcon = (priority: 'critical' | 'urgent' | 'low') => {
        switch (priority) {
            case 'critical':
                return '🔴';
            case 'urgent':
                return '🟠';
            case 'low':
                return '🟡';
        }
    };

    const getPriorityLabel = (priority: 'critical' | 'urgent' | 'low') => {
        switch (priority) {
            case 'critical':
                return 'OUT OF STOCK';
            case 'urgent':
                return 'URGENT';
            case 'low':
                return 'Low Stock';
        }
    };

    const getItemsByPriority = (priority: 'critical' | 'urgent' | 'low') => {
        return reorderItems.filter(item => item.priority === priority);
    };

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
                    <Text style={[styles.statValue, { color: colors.secondary.red }]}>
                        {getItemsByPriority('critical').length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                        Critical
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.secondary.orange }]}>
                        {getItemsByPriority('urgent').length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                        Urgent
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary.cyan }]}>
                        {getItemsByPriority('low').length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                        Low Stock
                    </Text>
                </View>
            </View>

            {reorderItems.length === 0 ? (
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                    }
                >
                    <Text style={styles.emptyEmoji}>✅</Text>
                    <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
                        All Stocked Up!
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
                        No items need reordering right now.
                    </Text>
                </ScrollView>
            ) : (
                <>
                    {/* Action Bar */}
                    {selectedItems.size > 0 && (
                        <View style={[styles.actionBar, { backgroundColor: colors.primary.cyan }]}>
                            <Text style={styles.actionBarText}>
                                {selectedItems.size} selected
                            </Text>
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                                    onPress={clearSelection}
                                >
                                    <Text style={styles.actionButtonText}>Clear</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.3)' }]}
                                    onPress={handleExportList}
                                >
                                    <Text style={styles.actionButtonText}>📤 Export</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Reorder List */}
                    <ScrollView
                        style={styles.listContainer}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                    >
                        {['critical', 'urgent', 'low'].map(priority => {
                            const items = getItemsByPriority(priority as any);
                            if (items.length === 0) return null;

                            return (
                                <View key={priority} style={styles.prioritySection}>
                                    {/* Priority Header */}
                                    <View style={[
                                        styles.priorityHeader,
                                        { backgroundColor: colors.background.primary }
                                    ]}>
                                        <View style={styles.priorityTitleRow}>
                                            <Text style={styles.priorityIcon}>
                                                {getPriorityIcon(priority as any)}
                                            </Text>
                                            <View>
                                                <Text style={[
                                                    styles.priorityTitle,
                                                    { color: getPriorityColor(priority as any) }
                                                ]}>
                                                    {getPriorityLabel(priority as any)}
                                                </Text>
                                                <Text style={[styles.priorityCount, { color: colors.text.secondary }]}>
                                                    {items.length} {items.length === 1 ? 'item' : 'items'}
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={[
                                                styles.selectAllButton,
                                                { borderColor: getPriorityColor(priority as any) }
                                            ]}
                                            onPress={() => selectAllInPriority(priority as any)}
                                        >
                                            <Text style={[
                                                styles.selectAllText,
                                                { color: getPriorityColor(priority as any) }
                                            ]}>
                                                Select All
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Items */}
                                    <View style={[
                                        styles.itemsContainer,
                                        { backgroundColor: colors.background.secondary }
                                    ]}>
                                        {items.map(item => {
                                            const isSelected = selectedItems.has(item.$id);
                                            const estimatedCost = (item.unit_cost || 0) * item.reorder_quantity;

                                            return (
                                                <TouchableOpacity
                                                    key={item.$id}
                                                    style={[
                                                        styles.reorderItem,
                                                        {
                                                            backgroundColor: colors.background.primary,
                                                            borderColor: isSelected
                                                                ? getPriorityColor(priority as any)
                                                                : colors.ui.border,
                                                            borderWidth: isSelected ? 2 : 1,
                                                        }
                                                    ]}
                                                    onPress={() => toggleItemSelection(item.$id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.itemContent}>
                                                        <View style={styles.itemHeader}>
                                                            <Text style={[styles.itemName, { color: colors.text.primary }]}>
                                                                {item.item_name}
                                                            </Text>
                                                            <View style={[
                                                                styles.checkbox,
                                                                {
                                                                    backgroundColor: isSelected
                                                                        ? getPriorityColor(priority as any)
                                                                        : 'transparent',
                                                                    borderColor: getPriorityColor(priority as any),
                                                                }
                                                            ]}>
                                                                {isSelected && <Text style={styles.checkmark}>✓</Text>}
                                                            </View>
                                                        </View>

                                                        <View style={styles.itemDetails}>
                                                            <View style={styles.detailRow}>
                                                                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                                                    Current Stock:
                                                                </Text>
                                                                <Text style={[
                                                                    styles.detailValue,
                                                                    { color: getPriorityColor(priority as any) }
                                                                ]}>
                                                                    {formatQuantity(item.current_quantity, item.unit)}
                                                                </Text>
                                                            </View>

                                                            <View style={styles.detailRow}>
                                                                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                                                    Reorder Point:
                                                                </Text>
                                                                <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                                                    {formatQuantity(item.reorder_point, item.unit)}
                                                                </Text>
                                                            </View>

                                                            <View style={[
                                                                styles.reorderAmountBadge,
                                                                { backgroundColor: `${getPriorityColor(priority as any)}20` }
                                                            ]}>
                                                                <Text style={[
                                                                    styles.reorderAmountText,
                                                                    { color: getPriorityColor(priority as any) }
                                                                ]}>
                                                                    📦 Order: {formatQuantity(item.reorder_quantity, item.unit)}
                                                                </Text>
                                                                {estimatedCost > 0 && (
                                                                    <Text style={[
                                                                        styles.estimatedCost,
                                                                        { color: colors.text.secondary }
                                                                    ]}>
                                                                        Est. ${estimatedCost.toFixed(2)}
                                                                    </Text>
                                                                )}
                                                            </View>

                                                            {item.supplier && (
                                                                <Text style={[styles.supplierInfo, { color: colors.text.secondary }]}>
                                                                    Supplier: {item.supplier}
                                                                    {item.supplier_sku && ` • SKU: ${item.supplier_sku}`}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </>
            )}
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
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
    },
    actionBarText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    actionButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    emptyTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    emptySubtitle: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
    },
    listContainer: {
        flex: 1,
    },
    prioritySection: {
        marginBottom: Spacing.md,
    },
    priorityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        marginHorizontal: Spacing.md,
        marginTop: Spacing.md,
        borderRadius: BorderRadius.md,
        ...Shadows.sm,
    },
    priorityTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    priorityIcon: {
        fontSize: 24,
    },
    priorityTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    priorityCount: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
    },
    selectAllButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    selectAllText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    itemsContainer: {
        padding: Spacing.sm,
        marginHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.xs,
    },
    reorderItem: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        ...Shadows.sm,
    },
    itemContent: {
        gap: Spacing.sm,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        flex: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.md,
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: Typography.weights.bold,
    },
    itemDetails: {
        gap: Spacing.xs,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: Typography.sizes.sm,
    },
    detailValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    reorderAmountBadge: {
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
        marginTop: Spacing.xs,
    },
    reorderAmountText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
    },
    estimatedCost: {
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs / 2,
    },
    supplierInfo: {
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs,
    },
});