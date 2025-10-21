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
import { CommonStyles, Spacing, Typography } from '../theme';
import { useAuth } from '../context/AuthContext';

interface SchoolOrderWithDetails extends SchoolOrder {
    school?: School;
    items?: (SchoolOrderItem & { itemType?: ItemType })[];
}

// ====== EXTRACTED HELPER FUNCTIONS ======
const getProgressColor = (progress: number, colors: any) => {
    if (progress < 25) return colors.secondary.red;
    if (progress < 75) return colors.secondary.orange;
    return '#27ae60';
};

const getStatusColor = (status: string, colors: any) => {
    const statusMap: Record<string, string> = {
        planning: colors.secondary.blue,
        ordered: colors.secondary.orange,
        receiving: colors.secondary.orange,
        ready: '#27ae60',
        installed: colors.primary.coolGray,
    };
    return statusMap[status] || colors.text.secondary;
};

const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
        planning: 'Planning',
        ordered: 'Ordered',
        receiving: 'Receiving',
        ready: 'Ready',
        installed: 'Installed',
    };
    return labelMap[status] || status;
};

const getDaysLabel = (days: number) => {
    if (days === 0) return 'Today!';
    if (days === 1) return '1 day';
    return `${days} days`;
};

// ====== EXTRACTED SUB-COMPONENTS ======
const OrderCard = React.memo(({
                                  order,
                                  expanded,
                                  onPress,
                                  colors
                              }: {
    order: SchoolOrderWithDetails;
    expanded: boolean;
    onPress: () => void;
    colors: any;
}) => {
    const progress = calculateSchoolOrderProgress(order);
    const progressColor = getProgressColor(progress, colors);
    const statusColor = getStatusColor(order.order_status, colors);
    const daysUntil = getDaysUntilInstall(order.install_date);

    return (
        <TouchableOpacity
            style={[CommonStyles.cards.base, { backgroundColor: colors.background.primary }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Header */}
            <View style={styles.orderHeader}>
                <View style={CommonStyles.rows.withGap}>
                    <Text style={CommonStyles.icons.xlarge}>🏫</Text>
                    <View style={CommonStyles.containers.flex}>
                        <Text style={[styles.boldText, { color: colors.primary.coolGray }]}>
                            {order.school?.school_name || 'Unknown School'}
                        </Text>
                        <Text style={[styles.smallText, { color: colors.text.secondary }]}>
                            {order.order_number}
                        </Text>
                    </View>
                </View>
                <View style={[CommonStyles.badges.base, { backgroundColor: `${statusColor}20` }]}>
                    <Text style={[CommonStyles.badges.text, { color: statusColor }]}>
                        {getStatusLabel(order.order_status)}
                    </Text>
                </View>
            </View>

            {/* Progress */}
            <View style={CommonStyles.progress.container}>
                <View style={styles.spaceBetween}>
                    <Text style={[CommonStyles.progress.text, { color: colors.text.secondary }]}>
                        {order.allocated_items} of {order.total_items} items allocated
                    </Text>
                    <Text style={[styles.boldText, { color: progressColor }]}>{progress}%</Text>
                </View>
                <View style={[CommonStyles.progress.bar, { backgroundColor: colors.ui.border }]}>
                    <View style={[CommonStyles.progress.fill, { width: `${progress}%`, backgroundColor: progressColor }]} />
                </View>
            </View>

            {/* Date */}
            <View style={styles.spaceBetween}>
                <Text style={[styles.smallText, { color: colors.text.secondary }]}>
                    Install Date: {formatDate(order.install_date)}
                </Text>
                {daysUntil >= 0 && (
                    <View style={[CommonStyles.badges.base, {
                        backgroundColor: daysUntil <= 7 ? `${colors.secondary.red}20` : `${colors.primary.cyan}20`
                    }]}>
                        <Text style={[CommonStyles.badges.text, {
                            color: daysUntil <= 7 ? colors.secondary.red : colors.primary.cyan
                        }]}>
                            {getDaysLabel(daysUntil)}
                        </Text>
                    </View>
                )}
            </View>

            <Text style={[styles.expandIcon, { color: colors.text.secondary }]}>
                {expanded ? '˅' : '›'}
            </Text>
        </TouchableOpacity>
    );
});

const OrderItemCard = React.memo(({
                                      item,
                                      onAllocate,
                                      colors
                                  }: {
    item: SchoolOrderItem & { itemType?: ItemType };
    onAllocate: () => void;
    colors: any;
}) => {
    const isComplete = item.quantity_allocated >= item.quantity_needed;
    const statusColor = isComplete ? '#27ae60' : colors.secondary.orange;

    return (
        <View style={[CommonStyles.cards.compact, { backgroundColor: colors.background.primary }]}>
            <Text style={[styles.mediumText, { color: colors.text.primary }]}>
                {item.itemType?.item_name || 'Unknown Item'}
            </Text>
            <Text style={[styles.smallText, { color: statusColor, marginVertical: Spacing.sm }]}>
                {isComplete ? '✓' : '⏳'} {item.quantity_allocated} of {item.quantity_needed} allocated
            </Text>
            {!isComplete && (
                <TouchableOpacity
                    style={[CommonStyles.buttons.primary, { backgroundColor: colors.primary.cyan }]}
                    onPress={onAllocate}
                >
                    <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>
                        {item.quantity_allocated > 0 ? 'Allocate More' : 'Allocate Inventory'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

const InventoryItemCard = React.memo(({
                                          item,
                                          selected,
                                          onPress,
                                          colors
                                      }: {
    item: InventoryItem;
    selected: boolean;
    onPress: () => void;
    colors: any;
}) => (
    <TouchableOpacity
        style={[styles.inventoryCard, {
            backgroundColor: selected ? `${colors.primary.cyan}20` : colors.background.secondary,
            borderColor: selected ? colors.primary.cyan : colors.ui.border,
        }]}
        onPress={onPress}
    >
        <View style={CommonStyles.containers.flex}>
            <Text style={[styles.monoText, { color: colors.text.primary }]}>
                ...{item.barcode.slice(-8)}
            </Text>
            {item.serial_number && (
                <Text style={[styles.tinyText, { color: colors.text.secondary }]}>
                    SN: {item.serial_number}
                </Text>
            )}
            {item.location && (
                <Text style={[styles.tinyText, { color: colors.text.secondary }]}>
                    📍 {item.location}
                </Text>
            )}
        </View>
        <View style={[CommonStyles.checkbox.base, {
            backgroundColor: selected ? colors.primary.cyan : 'transparent',
            borderColor: colors.ui.border,
        }]}>
            {selected && <Text style={CommonStyles.checkbox.checkmark}>✓</Text>}
        </View>
    </TouchableOpacity>
));

// ====== MAIN COMPONENT ======
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
    const [allocationModal, setAllocationModal] = useState(false);
    const [selectedOrderItem, setSelectedOrderItem] = useState<SchoolOrderItem | null>(null);
    const [availableInventory, setAvailableInventory] = useState<InventoryItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [allocating, setAllocating] = useState(false);

    useEffect(() => {
        loadSchoolOrders();
    }, [filterStatus]);

    const loadSchoolOrders = useCallback(async () => {
        try {
            setLoading(true);
            const queries = [Query.orderAsc('install_date'), Query.limit(100)];
            if (filterStatus !== 'all') queries.push(Query.equal('order_status', filterStatus));

            const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_ORDERS, queries);
            const orders = await Promise.all(
                (response.documents as unknown as SchoolOrder[]).map(async (order) => {
                    try {
                        const school = await databases.getDocument(DATABASE_ID, COLLECTIONS.SCHOOLS, order.school_id);
                        return { ...order, school: school as unknown as School };
                    } catch {
                        return order;
                    }
                })
            );
            setSchoolOrders(orders);
        } catch (error) {
            console.error('Error loading school orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterStatus]);

    const handleExpandOrder = useCallback(async (orderId: string) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            return;
        }

        setExpandedOrderId(orderId);
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_ORDER_ITEMS,
                [Query.equal('school_order_id', orderId)]
            );

            const itemsWithTypes = await Promise.all(
                (response.documents as unknown as SchoolOrderItem[]).map(async (item) => {
                    try {
                        const itemType = await databases.getDocument(DATABASE_ID, COLLECTIONS.ITEM_TYPES, item.item_type_id);
                        return { ...item, itemType: itemType as unknown as ItemType };
                    } catch {
                        return item;
                    }
                })
            );

            setSchoolOrders(prev => prev.map(order =>
                order.$id === orderId ? { ...order, items: itemsWithTypes } : order
            ));
        } catch (error) {
            console.error('Error loading order items:', error);
        }
    }, [expandedOrderId]);

    const handleAllocateInventory = useCallback(async (orderItem: SchoolOrderItem) => {
        setSelectedOrderItem(orderItem);
        setSelectedItems([]);

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
    }, []);

    const handleSelectItem = useCallback((itemId: string) => {
        setSelectedItems(prev =>
            prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
        );
    }, []);

    const handleConfirmAllocation = useCallback(async () => {
        if (!selectedOrderItem || selectedItems.length === 0) return;

        setAllocating(true);
        try {
            const order = schoolOrders.find(o => o.items?.some(i => i.$id === selectedOrderItem.$id));
            if (!order) return;

            // Parallel updates
            await Promise.all([
                ...selectedItems.map(itemId => databases.updateDocument(
                    DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, itemId,
                    { status: 'assigned', school_id: order.school_id, school_order_id: order.$id }
                )),
                ...selectedItems.map(itemId => databases.createDocument(
                    DATABASE_ID, COLLECTIONS.TRANSACTIONS, ID.unique(),
                    {
                        transaction_type: 'assigned',
                        inventory_item_id: itemId,
                        school_id: order.school_id,
                        performed_by: user?.name || 'Unknown',
                        transaction_date: new Date().toISOString(),
                        notes: `Allocated to ${order.school?.school_name} for install on ${formatDate(order.install_date)}`,
                    }
                )),
            ]);

            const newQuantityAllocated = selectedOrderItem.quantity_allocated + selectedItems.length;
            await databases.updateDocument(
                DATABASE_ID, COLLECTIONS.SCHOOL_ORDER_ITEMS, selectedOrderItem.$id,
                { quantity_allocated: newQuantityAllocated }
            );

            const allOrderItems = await databases.listDocuments(
                DATABASE_ID, COLLECTIONS.SCHOOL_ORDER_ITEMS,
                [Query.equal('school_order_id', order.$id)]
            );

            const totalNeeded = allOrderItems.documents.reduce((sum, item: any) => sum + item.quantity_needed, 0);
            const totalAllocated = allOrderItems.documents.reduce((sum, item: any) => sum + item.quantity_allocated, 0) + selectedItems.length;

            let newStatus: SchoolOrder['order_status'] = order.order_status;
            if (totalAllocated >= totalNeeded) newStatus = 'ready';
            else if (totalAllocated > 0 && order.order_status === 'planning') newStatus = 'receiving';

            await databases.updateDocument(DATABASE_ID, COLLECTIONS.SCHOOL_ORDERS, order.$id, {
                allocated_items: totalAllocated,
                total_items: totalNeeded,
                order_status: newStatus,
            });

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
    }, [selectedOrderItem, selectedItems, schoolOrders, user, loadSchoolOrders, handleExpandOrder]);

    if (loading) {
        return (
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[CommonStyles.containers.flex, { backgroundColor: colors.background.secondary }]}>
            {/* Header */}
            <View style={[CommonStyles.headers.container, { backgroundColor: colors.background.primary }]}>
                <Text style={[CommonStyles.headers.title, { color: colors.primary.coolGray }]}>School Orders</Text>
                {isAdmin && (
                    <View style={[CommonStyles.badges.pill, { backgroundColor: '#e74c3c' }]}>
                        <Text style={[CommonStyles.badges.text, { color: '#fff' }]}>👑 Admin</Text>
                    </View>
                )}
            </View>

            {/* Filter */}
            <View style={[CommonStyles.filters.container, { backgroundColor: colors.background.primary }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['all', 'planning', 'receiving', 'ready', 'installed'].map((status) => (
                        <TouchableOpacity
                            key={status}
                            style={[CommonStyles.filters.tab, filterStatus === status && { backgroundColor: colors.primary.cyan }]}
                            onPress={() => setFilterStatus(status)}
                        >
                            <Text style={[CommonStyles.filters.tabText, {
                                color: filterStatus === status ? colors.text.white : colors.text.secondary
                            }]}>
                                {status === 'all' ? 'All' : getStatusLabel(status)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Orders List */}
            <ScrollView
                style={CommonStyles.containers.flex}
                contentContainerStyle={styles.listPadding}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSchoolOrders} />}
            >
                {schoolOrders.length === 0 ? (
                    <View style={CommonStyles.empty.container}>
                        <Text style={[CommonStyles.empty.text, { color: colors.text.secondary }]}>No school orders yet</Text>
                    </View>
                ) : (
                    schoolOrders.map((order) => (
                        <View key={order.$id} style={styles.orderGap}>
                            <OrderCard
                                order={order}
                                expanded={expandedOrderId === order.$id}
                                onPress={() => handleExpandOrder(order.$id)}
                                colors={colors}
                            />
                            {expandedOrderId === order.$id && order.items && (
                                <View style={[styles.itemsContainer, { backgroundColor: colors.background.secondary }]}>
                                    {order.items.length === 0 ? (
                                        <Text style={[styles.centerText, { color: colors.text.secondary }]}>No items in this order</Text>
                                    ) : (
                                        order.items.map((item) => (
                                            <OrderItemCard
                                                key={item.$id}
                                                item={item}
                                                onAllocate={() => handleAllocateInventory(item)}
                                                colors={colors}
                                            />
                                        ))
                                    )}
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* FAB */}
            {isAdmin && (
                <TouchableOpacity
                    style={[CommonStyles.buttons.fab, { backgroundColor: colors.primary.cyan }]}
                    onPress={() => navigation.navigate('CreateSchoolOrder' as never)}
                >
                    <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>+ New School Order</Text>
                </TouchableOpacity>
            )}

            {/* Allocation Modal */}
            <Modal visible={allocationModal} transparent animationType="slide" onRequestClose={() => setAllocationModal(false)}>
                <Pressable style={CommonStyles.modals.overlay} onPress={() => setAllocationModal(false)}>
                    <Pressable style={[CommonStyles.modals.container, { backgroundColor: colors.background.primary }]} onPress={(e) => e.stopPropagation()}>
                        <View style={[CommonStyles.modals.header, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[CommonStyles.modals.title, { color: colors.primary.coolGray }]}>Allocate Inventory</Text>
                            <TouchableOpacity onPress={() => setAllocationModal(false)} style={CommonStyles.modals.closeButton}>
                                <Text style={[styles.largeText, { color: colors.text.secondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalPadding}>
                            <Text style={[styles.boldText, { color: colors.text.primary }]}>
                                Available Items: {availableInventory.length}
                            </Text>
                            <Text style={[CommonStyles.forms.helperText, { color: colors.text.secondary }]}>
                                Select items to allocate to this school order
                            </Text>

                            {availableInventory.length === 0 ? (
                                <View style={CommonStyles.empty.container}>
                                    <Text style={[CommonStyles.empty.text, { color: colors.text.secondary }]}>
                                        No available inventory for this item type
                                    </Text>
                                </View>
                            ) : (
                                availableInventory.map((item) => (
                                    <InventoryItemCard
                                        key={item.$id}
                                        item={item}
                                        selected={selectedItems.includes(item.$id)}
                                        onPress={() => handleSelectItem(item.$id)}
                                        colors={colors}
                                    />
                                ))
                            )}
                        </ScrollView>

                        <View style={[CommonStyles.modals.footer, { borderTopColor: colors.ui.border }]}>
                            <Text style={[styles.smallText, { color: colors.text.secondary, marginBottom: Spacing.sm }]}>
                                {selectedItems.length} items selected
                            </Text>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[CommonStyles.buttons.secondary, {
                                        backgroundColor: colors.background.secondary,
                                        borderColor: colors.ui.border
                                    }]}
                                    onPress={() => setAllocationModal(false)}
                                    disabled={allocating}
                                >
                                    <Text style={[CommonStyles.buttons.text, { color: colors.text.primary }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        CommonStyles.buttons.primary,
                                        { backgroundColor: colors.primary.cyan },
                                        (selectedItems.length === 0 || allocating) && styles.disabled,
                                    ]}
                                    onPress={handleConfirmAllocation}
                                    disabled={selectedItems.length === 0 || allocating}
                                >
                                    {allocating ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>
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
    // Reusable text styles
    tinyText: { fontSize: Typography.sizes.xs, marginTop: 2 },
    smallText: { fontSize: Typography.sizes.sm },
    mediumText: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.semibold },
    boldText: { fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold },
    largeText: { fontSize: 24 },
    monoText: { fontSize: Typography.sizes.md, fontWeight: Typography.weights.semibold, fontFamily: 'monospace' },

    // Layout helpers
    spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    listPadding: { padding: Spacing.md },
    orderGap: { marginBottom: Spacing.md },
    modalPadding: { padding: Spacing.lg, maxHeight: 400 },
    centerText: { padding: Spacing.md, textAlign: 'center', fontSize: Typography.sizes.sm },

    // Specific layouts
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    expandIcon: { position: 'absolute', right: Spacing.lg, bottom: Spacing.lg, fontSize: 24 },
    itemsContainer: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: 12, gap: Spacing.sm },
    inventoryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: 8, marginBottom: Spacing.sm, borderWidth: 2 },
    modalButtons: { flexDirection: 'row', gap: Spacing.md },
    disabled: { opacity: 0.5 },
});