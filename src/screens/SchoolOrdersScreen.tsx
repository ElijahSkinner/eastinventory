// src/screens/SchoolOrdersScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Modal,
    Pressable,
    FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useRole } from '../hooks/useRole';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    SchoolOrder,
    SchoolOrderItem,
    School,
    ItemType,
    InventoryItem,
    calculateSchoolOrderProgress,
    getDaysUntilInstall,
    formatDate,
} from '../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { useAuth } from '../context/AuthContext';

interface SchoolOrderWithDetails extends SchoolOrder {
    school?: School;
    items?: (SchoolOrderItem & { itemType?: ItemType })[];
}

export default function SchoolOrdersScreen() {
    const { colors } = useTheme();
    const { isAdmin } = useRole();
    const { user } = useAuth();
    const navigation = useNavigation();

    const [schoolOrders, setSchoolOrders] = useState<SchoolOrderWithDetails[]>([]);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Allocation modal state
    const [allocationModal, setAllocationModal] = useState(false);
    const [selectedOrderItem, setSelectedOrderItem] = useState<SchoolOrderItem | null>(null);
    const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [allocating, setAllocating] = useState(false);

    useEffect(() => {
        loadSchoolOrders();
    }, [filterStatus]);

    const loadSchoolOrders = async () => {
        try {
            setLoading(true);

            const queries = [Query.orderAsc('install_date'), Query.limit(100)];

            if (filterStatus !== 'all') {
                queries.push(Query.equal('order_status', filterStatus));
            }

            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_ORDERS,
                queries
            );

            const orders = response.documents as unknown as SchoolOrder[];

            // Load school details for each order
            const ordersWithDetails = await Promise.all(
                orders.map(async (order) => {
                    try {
                        const school = await databases.getDocument(
                            DATABASE_ID,
                            COLLECTIONS.SCHOOLS,
                            order.school_id
                        );
                        return { ...order, school: school as unknown as School };
                    } catch (error) {
                        return order;
                    }
                })
            );

            setSchoolOrders(ordersWithDetails);
        } catch (error) {
            console.error('Error loading school orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadSchoolOrders();
    }, [filterStatus]);

    const handleExpandOrder = async (orderId: string) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            return;
        }

        setExpandedOrderId(orderId);

        // Load order items
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_ORDER_ITEMS,
                [Query.equal('school_order_id', orderId)]
            );

            const items = response.documents as unknown as SchoolOrderItem[];

            // Load item type details
            const itemsWithTypes = await Promise.all(
                items.map(async (item) => {
                    try {
                        const itemType = await databases.getDocument(
                            DATABASE_ID,
                            COLLECTIONS.ITEM_TYPES,
                            item.item_type_id
                        );
                        return { ...item, itemType: itemType as unknown as ItemType };
                    } catch (error) {
                        return item;
                    }
                })
            );

            // Update the order with items
            setSchoolOrders(prev =>
                prev.map(order =>
                    order.$id === orderId ? { ...order, items: itemsWithTypes } : order
                )
            );
        } catch (error) {
            console.error('Error loading order items:', error);
        }
    };

    const handleAllocateInventory = async (orderItem: SchoolOrderItem) => {
        setSelectedOrderItem(orderItem);
        setSelectedItems([]);

        // Load available inventory for this item type
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                [
                    Query.equal('item_type_id', orderItem.item_type_id),
                    Query.equal('order_status', 'available'),
                    Query.limit(100),
                ]
            );

            setAvailableInventory(response.documents as unknown as InventoryItem[]);
            setAllocationModal(true);
        } catch (error) {
            console.error('Error loading available inventory:', error);
        }
    };

    const handleSelectItem = (itemId: string) => {
        setSelectedItems(prev => {
            if (prev.includes(itemId)) {
                return prev.filter(id => id !== itemId);
            } else {
                return [...prev, itemId];
            }
        });
    };

    const handleConfirmAllocation = async () => {
        if (!selectedOrderItem || selectedItems.length === 0) return;

        setAllocating(true);

        try {
            const order = schoolOrders.find(o =>
                o.items?.some(i => i.$id === selectedOrderItem.$id)
            );

            if (!order) return;

            // Update each selected inventory item
            await Promise.all(
                selectedItems.map(itemId =>
                    databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.INVENTORY_ITEMS,
                        itemId,
                        {
                            status: 'assigned',
                            school_id: order.school_id,
                            school_order_id: order.$id,
                        }
                    )
                )
            );

            // Log transactions
            await Promise.all(
                selectedItems.map(itemId =>
                    databases.createDocument(
                        DATABASE_ID,
                        COLLECTIONS.TRANSACTIONS,
                        ID.unique(),
                        {
                            transaction_type: 'assigned',
                            inventory_item_id: itemId,
                            school_id: order.school_id,
                            performed_by: user?.name || 'Unknown',
                            transaction_date: new Date().toISOString(),
                            notes: `Allocated to ${order.school?.school_name} for install on ${formatDate(order.install_date)}`,
                        }
                    )
                )
            );

            // Update school order item
            const newQuantityAllocated = selectedOrderItem.quantity_allocated + selectedItems.length;
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_ORDER_ITEMS,
                selectedOrderItem.$id,
                {
                    quantity_allocated: newQuantityAllocated,
                }
            );

            // Update school order totals
            const allOrderItems = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_ORDER_ITEMS,
                [Query.equal('school_order_id', order.$id)]
            );

            const totalNeeded = allOrderItems.documents.reduce(
                (sum, item: any) => sum + item.quantity_needed,
                0
            );
            const totalAllocated = allOrderItems.documents.reduce(
                (sum, item: any) => sum + item.quantity_allocated,
                0
            ) + selectedItems.length;

            let newStatus: SchoolOrder['order_status'] = order.order_status;
            if (totalAllocated >= totalNeeded) {
                newStatus = 'ready';
            } else if (totalAllocated > 0 && order.order_status === 'planning') {
                newStatus = 'receiving';
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_ORDERS,
                order.$id,
                {
                    allocated_items: totalAllocated,
                    total_items: totalNeeded,
                    status: newStatus,
                }
            );

            alert(`Successfully allocated ${selectedItems.length} items!`);
            setAllocationModal(false);
            setSelectedOrderItem(null);
            setSelectedItems([]);
            loadSchoolOrders();
            handleExpandOrder(order.$id);

        } catch (error) {
            console.error('Error allocating inventory:', error);
            alert('Failed to allocate items. Please try again.');
        } finally {
            setAllocating(false);
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress < 25) return colors.secondary.red;
        if (progress < 75) return colors.secondary.orange;
        return '#27ae60';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'planning':
                return colors.secondary.blue;
            case 'ordered':
            case 'receiving':
                return colors.secondary.orange;
            case 'ready':
                return '#27ae60';
            case 'installed':
                return colors.primary.coolGray;
            default:
                return colors.text.secondary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'planning':
                return 'Planning';
            case 'ordered':
                return 'Ordered';
            case 'receiving':
                return 'Receiving';
            case 'ready':
                return 'Ready';
            case 'installed':
                return 'Installed';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            {/* Header */}
            <View style={[styles.headerContainer, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.headerTitle, { color: colors.primary.coolGray }]}>
                    School Orders
                </Text>
                {isAdmin && (
                    <View style={[styles.roleBadge, { backgroundColor: '#e74c3c' }]}>
                        <Text style={styles.roleBadgeText}>👑 Admin</Text>
                    </View>
                )}
            </View>

            {/* Status Filter */}
            <View style={[styles.filterContainer, { backgroundColor: colors.background.primary }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['all', 'planning', 'receiving', 'ready', 'installed'].map((status) => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterTab,
                                filterStatus === status && {
                                    backgroundColor: colors.primary.cyan,
                                },
                            ]}
                            onPress={() => setFilterStatus(status)}
                        >
                            <Text
                                style={[
                                    styles.filterTabText,
                                    {
                                        color:
                                            filterStatus === status
                                                ? colors.text.white
                                                : colors.text.secondary,
                                    },
                                ]}
                            >
                                {status === 'all' ? 'All' : getStatusLabel(status)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* School Orders List */}
            <ScrollView
                style={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {schoolOrders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            No school orders yet
                        </Text>
                    </View>
                ) : (
                    schoolOrders.map((order) => {
                        const progress = calculateSchoolOrderProgress(order);
                        const progressColor = getProgressColor(progress);
                        const daysUntil = getDaysUntilInstall(order.install_date);

                        return (
                            <View key={order.$id} style={styles.orderContainer}>
                                {/* Order Card */}
                                <TouchableOpacity
                                    style={[
                                        styles.orderCard,
                                        { backgroundColor: colors.background.primary },
                                    ]}
                                    onPress={() => handleExpandOrder(order.$id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.orderHeader}>
                                        <View style={styles.orderTitleRow}>
                                            <Text style={styles.schoolIcon}>🏫</Text>
                                            <View style={styles.orderInfo}>
                                                <Text
                                                    style={[
                                                        styles.schoolName,
                                                        { color: colors.primary.coolGray },
                                                    ]}
                                                >
                                                    {order.school?.school_name || 'Unknown School'}
                                                </Text>
                                                <Text style={[styles.orderNumber, { color: colors.text.secondary }]}>
                                                    {order.order_number}
                                                </Text>
                                            </View>
                                        </View>

                                        <View
                                            style={[
                                                styles.statusBadge,
                                                { backgroundColor: `${getStatusColor(order.order_status)}20` },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusText,
                                                    { color: getStatusColor(order.order_status) },
                                                ]}
                                            >
                                                {getStatusLabel(order.order_status)}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Progress */}
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressRow}>
                                            <Text style={[styles.progressText, { color: colors.text.secondary }]}>
                                                {order.allocated_items} of {order.total_items} items allocated ({progress}%)
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.progressPercentage,
                                                    { color: progressColor },
                                                ]}
                                            >
                                                {progress}%
                                            </Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.progressBar,
                                                { backgroundColor: colors.ui.border },
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        width: `${progress}%`,
                                                        backgroundColor: progressColor,
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </View>

                                    {/* Install Date */}
                                    <View style={styles.dateRow}>
                                        <Text style={[styles.dateLabel, { color: colors.text.secondary }]}>
                                            Install Date: {formatDate(order.install_date)}
                                        </Text>
                                        {daysUntil >= 0 && (
                                            <View
                                                style={[
                                                    styles.daysUntilBadge,
                                                    {
                                                        backgroundColor:
                                                            daysUntil <= 7
                                                                ? `${colors.secondary.red}20`
                                                                : `${colors.primary.cyan}20`,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.daysUntilText,
                                                        {
                                                            color:
                                                                daysUntil <= 7
                                                                    ? colors.secondary.red
                                                                    : colors.primary.cyan,
                                                        },
                                                    ]}
                                                >
                                                    {daysUntil === 0
                                                        ? 'Today!'
                                                        : daysUntil === 1
                                                            ? '1 day'
                                                            : `${daysUntil} days`}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text
                                        style={[styles.expandIcon, { color: colors.text.secondary }]}
                                    >
                                        {expandedOrderId === order.$id ? '˅' : '›'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Expanded Order Items */}
                                {expandedOrderId === order.$id && order.items && (
                                    <View
                                        style={[
                                            styles.itemsContainer,
                                            { backgroundColor: colors.background.secondary },
                                        ]}
                                    >
                                        {order.items.length === 0 ? (
                                            <Text
                                                style={[
                                                    styles.emptyItems,
                                                    { color: colors.text.secondary },
                                                ]}
                                            >
                                                No items in this order
                                            </Text>
                                        ) : (
                                            order.items.map((item) => {
                                                const itemProgress = Math.round(
                                                    (item.quantity_allocated / item.quantity_needed) * 100
                                                );
                                                const isComplete = item.quantity_allocated >= item.quantity_needed;

                                                return (
                                                    <View
                                                        key={item.$id}
                                                        style={[
                                                            styles.itemCard,
                                                            { backgroundColor: colors.background.primary },
                                                        ]}
                                                    >
                                                        <View style={styles.itemHeader}>
                                                            <Text
                                                                style={[
                                                                    styles.itemName,
                                                                    { color: colors.text.primary },
                                                                ]}
                                                            >
                                                                {item.itemType?.item_name || 'Unknown Item'}
                                                            </Text>
                                                        </View>

                                                        <View style={styles.itemProgress}>
                                                            <Text
                                                                style={[
                                                                    styles.itemStatus,
                                                                    {
                                                                        color: isComplete
                                                                            ? '#27ae60'
                                                                            : colors.secondary.orange,
                                                                    },
                                                                ]}
                                                            >
                                                                {isComplete ? '✓' : '⏳'}{' '}
                                                                {item.quantity_allocated} of {item.quantity_needed}{' '}
                                                                allocated
                                                            </Text>
                                                        </View>

                                                        {!isComplete && (
                                                            <TouchableOpacity
                                                                style={[
                                                                    styles.allocateButton,
                                                                    { backgroundColor: colors.primary.cyan },
                                                                ]}
                                                                onPress={() => handleAllocateInventory(item)}
                                                            >
                                                                <Text style={styles.allocateButtonText}>
                                                                    {item.quantity_allocated > 0
                                                                        ? 'Allocate More'
                                                                        : 'Allocate Inventory'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                );
                                            })
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Create School Order Button (Admin only) */}
            {isAdmin && (
                <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.primary.cyan }]}
                    onPress={() => navigation.navigate('CreateSchoolOrder' as never)}
                >
                    <Text style={styles.createButtonText}>+ New School Order</Text>
                </TouchableOpacity>
            )}

            {/* Allocation Modal */}
            <Modal
                visible={allocationModal}
                transparent
                animationType="slide"
                onRequestClose={() => setAllocationModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setAllocationModal(false)}
                >
                    <Pressable
                        style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <View style={[styles.modalHeader, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.primary.coolGray }]}>
                                Allocate Inventory
                            </Text>
                            <TouchableOpacity
                                onPress={() => setAllocationModal(false)}
                                style={styles.closeButton}
                            >
                                <Text style={[styles.closeButtonText, { color: colors.text.secondary }]}>
                                    ✕
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Available Inventory */}
                        <ScrollView style={styles.modalContent}>
                            <Text style={[styles.modalSubtitle, { color: colors.text.primary }]}>
                                Available Items: {availableInventory.length}
                            </Text>
                            <Text style={[styles.modalHelper, { color: colors.text.secondary }]}>
                                Select items to allocate to this school order
                            </Text>

                            {availableInventory.length === 0 ? (
                                <View style={styles.emptyInventory}>
                                    <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                                        No available inventory for this item type
                                    </Text>
                                </View>
                            ) : (
                                availableInventory.map((item) => (
                                    <TouchableOpacity
                                        key={item.$id}
                                        style={[
                                            styles.inventoryItemCard,
                                            {
                                                backgroundColor: selectedItems.includes(item.$id)
                                                    ? `${colors.primary.cyan}20`
                                                    : colors.background.secondary,
                                                borderColor: selectedItems.includes(item.$id)
                                                    ? colors.primary.cyan
                                                    : colors.ui.border,
                                            },
                                        ]}
                                        onPress={() => handleSelectItem(item.$id)}
                                    >
                                        <View style={styles.inventoryItemInfo}>
                                            <Text
                                                style={[
                                                    styles.inventoryItemBarcode,
                                                    { color: colors.text.primary },
                                                ]}
                                            >
                                                ...{item.barcode.slice(-8)}
                                            </Text>
                                            {item.serial_number && (
                                                <Text
                                                    style={[
                                                        styles.inventoryItemSerial,
                                                        { color: colors.text.secondary },
                                                    ]}
                                                >
                                                    SN: {item.serial_number}
                                                </Text>
                                            )}
                                            {item.location && (
                                                <Text
                                                    style={[
                                                        styles.inventoryItemLocation,
                                                        { color: colors.text.secondary },
                                                    ]}
                                                >
                                                    📍 {item.location}
                                                </Text>
                                            )}
                                        </View>

                                        <View
                                            style={[
                                                styles.checkbox,
                                                {
                                                    backgroundColor: selectedItems.includes(item.$id)
                                                        ? colors.primary.cyan
                                                        : 'transparent',
                                                    borderColor: colors.ui.border,
                                                },
                                            ]}
                                        >
                                            {selectedItems.includes(item.$id) && (
                                                <Text style={styles.checkmark}>✓</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={[styles.modalFooter, { borderTopColor: colors.ui.border }]}>
                            <Text style={[styles.selectedCount, { color: colors.text.secondary }]}>
                                {selectedItems.length} items selected
                            </Text>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.cancelModalButton,
                                        { backgroundColor: colors.background.secondary },
                                    ]}
                                    onPress={() => setAllocationModal(false)}
                                    disabled={allocating}
                                >
                                    <Text style={[styles.cancelModalButtonText, { color: colors.text.primary }]}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.confirmModalButton,
                                        { backgroundColor: colors.primary.cyan },
                                        (selectedItems.length === 0 || allocating) && styles.disabledButton,
                                    ]}
                                    onPress={handleConfirmAllocation}
                                    disabled={selectedItems.length === 0 || allocating}
                                >
                                    {allocating ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.confirmModalButtonText}>
                                            Allocate {selectedItems.length} Items
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
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
    filterContainer: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        ...Shadows.sm,
    },
    filterTab: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        marginRight: Spacing.sm,
    },
    filterTabText: {
        fontSize: Typography.sizes.sm,
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
    orderContainer: {
        marginBottom: Spacing.md,
    },
    orderCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.md,
        position: 'relative',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    orderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    schoolIcon: {
        fontSize: 32,
        marginRight: Spacing.sm,
    },
    orderInfo: {
        flex: 1,
    },
    schoolName: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
    },
    orderNumber: {
        fontSize: Typography.sizes.sm,
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
    progressContainer: {
        marginBottom: Spacing.md,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    progressText: {
        fontSize: Typography.sizes.sm,
    },
    progressPercentage: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    progressBar: {
        height: 8,
        borderRadius: BorderRadius.sm,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateLabel: {
        fontSize: Typography.sizes.sm,
    },
    daysUntilBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs / 2,
        borderRadius: BorderRadius.sm,
    },
    daysUntilText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.bold,
    },
    expandIcon: {
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.lg,
        fontSize: 24,
    },
    itemsContainer: {
        marginTop: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        gap: Spacing.sm,
    },
    emptyItems: {
        padding: Spacing.md,
        textAlign: 'center',
        fontSize: Typography.sizes.sm,
    },
    itemCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        ...Shadows.sm,
    },
    itemHeader: {
        marginBottom: Spacing.sm,
    },
    itemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    itemProgress: {
        marginBottom: Spacing.sm,
    },
    itemStatus: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    allocateButton: {
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    allocateButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    createButton: {
        position: 'absolute',
        bottom: Spacing.lg,
        right: Spacing.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.full,
        ...Shadows.lg,
    },
    createButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '80%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        ...Shadows.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
    },
    closeButton: {
        padding: Spacing.xs,
    },
    closeButtonText: {
        fontSize: 24,
    },
    modalContent: {
        padding: Spacing.lg,
        maxHeight: 400,
    },
    modalSubtitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    modalHelper: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.md,
    },
    emptyInventory: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    inventoryItemCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        borderWidth: 2,
    },
    inventoryItemInfo: {
        flex: 1,
    },
    inventoryItemBarcode: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        fontFamily: 'monospace',
    },
    inventoryItemSerial: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
    },
    inventoryItemLocation: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
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
        fontWeight: 'bold',
    },
    modalFooter: {
        padding: Spacing.lg,
        borderTopWidth: 1,
    },
    selectedCount: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.sm,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    modalButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    cancelModalButton: {
        borderWidth: 1,
    },
    confirmModalButton: {
        ...Shadows.sm,
    },
    cancelModalButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    confirmModalButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    disabledButton: {
        opacity: 0.5,
    },
});