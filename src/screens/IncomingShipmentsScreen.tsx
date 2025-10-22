// src/screens/IncomingShipmentsScreen.tsx
import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useRole } from '../hooks/useRole';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    IncomingShipment,
    SHLineItem,
    ItemType,
    calculateSHProgress,
    getStatusIcon,
    formatDate,
} from '../lib/appwrite';
import { Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProcurementStackParamList, RootStackParamList } from '../navigation/AppNavigator';
import { CommonActions } from '@react-navigation/native';

export default function IncomingShipmentsScreen() {
    const { colors } = useTheme();
    const { isAdmin } = useRole();

    type IncomingShipmentsNavigationProp = CompositeNavigationProp<
        NativeStackNavigationProp<ProcurementStackParamList, 'PurchaseOrders'>,
        NativeStackNavigationProp<RootStackParamList>
    >;
    const navigation = useNavigation<IncomingShipmentsNavigationProp>();

    const [IncomingShipments, setIncomingShipments] = useState<IncomingShipment[]>([]);
    const [expandedSHId, setExpandedSHId] = useState<string | null>(null);
    const [lineItems, setLineItems] = useState<(SHLineItem & { itemType?: ItemType })[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingLineItems, setLoadingLineItems] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useFocusEffect(
        useCallback(() => {
            loadIncomingShipments();
        }, [filterStatus, searchQuery])
    );

    const loadIncomingShipments = async () => {
        try {
            setLoading(true);

            const queries = [Query.orderDesc('order_date'), Query.limit(100)];

            if (filterStatus !== 'all') {
                queries.push(Query.equal('order_status', filterStatus));
            }

            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.PURCHASE_ORDERS,
                queries
            );

            let orders = response.documents as unknown as IncomingShipment[];

            // Apply search filter
            if (searchQuery) {
                orders = orders.filter(
                    (sh) =>
                        sh.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        sh.vendor.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            setIncomingShipments(orders);
        } catch (error) {
            console.error('Error loading Incoming Shipments:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadIncomingShipments();
    }, [filterStatus, searchQuery]);

    const handleExpandPO = async (poId: string) => {
        if (expandedSHId === poId) {
            setExpandedSHId(null);
            setLineItems([]);
            return;
        }

        setExpandedSHId(poId);
        setLoadingLineItems(true);

        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.po_LINE_ITEMS,
                [Query.equal('purchase_order_id', poId)]
            );

            const items = response.documents as unknown as SHLineItem[];

            // Load item type details for each line item
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

            setLineItems(itemsWithTypes);
        } catch (error) {
            console.error('Error loading line items:', error);
        } finally {
            setLoadingLineItems(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ordered':
                return colors.secondary.blue;
            case 'partially_received':
                return colors.secondary.orange;
            case 'fully_received':
                return '#27ae60';
            case 'cancelled':
                return colors.secondary.red;
            default:
                return colors.text.secondary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'ordered':
                return 'Ordered';
            case 'partially_received':
                return 'Receiving';
            case 'fully_received':
                return 'Complete';
            case 'cancelled':
                return 'Cancelled';
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
            {/* Header with Admin Badge */}
            <View style={[styles.headerContainer, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.headerTitle, { color: colors.primary.coolGray }]}>
                    Incoming Shipments
                </Text>
                {isAdmin && (
                    <View style={[styles.roleBadge, { backgroundColor: '#e74c3c' }]}>
                        <Text style={styles.roleBadgeText}>👑 Admin</Text>
                    </View>
                )}
            </View>

            {/* Search and Filter */}
            <View style={[styles.searchContainer, { backgroundColor: colors.background.primary }]}>
                <TextInput
                    style={[
                        styles.searchInput,
                        { color: colors.text.primary, borderColor: colors.ui.border },
                    ]}
                    placeholder="Search by PO# or vendor..."
                    placeholderTextColor={colors.text.secondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={loadIncomingShipments}
                />
            </View>

            {/* Status Filter Tabs */}
            <View style={[styles.filterContainer, { backgroundColor: colors.background.primary }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['all', 'ordered', 'partially_received', 'fully_received'].map((status) => (
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
                                {status === 'all'
                                    ? 'All'
                                    : status === 'partially_received'
                                        ? 'In Progress'
                                        : status === 'fully_received'
                                            ? 'Complete'
                                            : 'Ordered'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* SH List */}
            <ScrollView
                style={styles.listContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {IncomingShipments.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            {searchQuery ? 'No Incoming Shipments match your search' : 'No Incoming Shipments yet'}
                        </Text>
                    </View>
                ) : (
                    IncomingShipments.map((sh) => {
                        const progress = calculateSHProgress(sh);
                        const statusColor = getStatusColor(sh.order_status);

                        return (
                            <View key={sh.$id} style={styles.shContainer}>
                                {/* sh Card */}
                                <TouchableOpacity
                                    style={[
                                        styles.shCard,
                                        { backgroundColor: colors.background.primary },
                                    ]}
                                    onPress={() => handleExpandPO(sh.$id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.shHeader}>
                                        <View style={styles.shTitleRow}>
                                            <Text style={styles.statusIcon}>{getStatusIcon(sh.order_status)}</Text>
                                            <View style={styles.shInfo}>
                                                <Text
                                                    style={[
                                                        styles.shNumber,
                                                        { color: colors.primary.coolGray },
                                                    ]}
                                                >
                                                    {sh.po_number}
                                                </Text>
                                                <Text style={[styles.vendor, { color: colors.text.secondary }]}>
                                                    {sh.vendor}
                                                </Text>
                                            </View>
                                        </View>

                                        <View
                                            style={[
                                                styles.statusBadge,
                                                { backgroundColor: `${statusColor}20` },
                                            ]}
                                        >
                                            <Text style={[styles.statusText, { color: statusColor }]}>
                                                {getStatusLabel(sh.order_status)}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Progress */}
                                    <View style={styles.progressContainer}>
                                        <Text style={[styles.progressText, { color: colors.text.secondary }]}>
                                            {sh.received_items} of {sh.total_items} items received ({progress}%)
                                        </Text>
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
                                                        backgroundColor: statusColor,
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </View>

                                    <Text style={[styles.orderDate, { color: colors.text.secondary }]}>
                                        Ordered: {formatDate(sh.order_date)}
                                    </Text>

                                    <Text
                                        style={[styles.expandIcon, { color: colors.text.secondary }]}
                                    >
                                        {expandedSHId === sh.$id ? '˅' : '›'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Expanded Line Items */}
                                {expandedSHId === sh.$id && (
                                    <View
                                        style={[
                                            styles.lineItemsContainer,
                                            { backgroundColor: colors.background.secondary },
                                        ]}
                                    >
                                        {loadingLineItems ? (
                                            <ActivityIndicator size="small" color={colors.primary.cyan} />
                                        ) : lineItems.length === 0 ? (
                                            <Text
                                                style={[
                                                    styles.emptyLineItems,
                                                    { color: colors.text.secondary },
                                                ]}
                                            >
                                                No line items
                                            </Text>
                                        ) : (
                                            lineItems.map((lineItem) => {
                                                const lineProgress = Math.round(
                                                    (lineItem.quantity_received / lineItem.quantity_ordered) *
                                                    100
                                                );
                                                const isComplete =
                                                    lineItem.quantity_received >= lineItem.quantity_ordered;

                                                return (
                                                    <View
                                                        key={lineItem.$id}
                                                        style={[
                                                            styles.lineItemCard,
                                                            { backgroundColor: colors.background.primary },
                                                        ]}
                                                    >
                                                        <View style={styles.lineItemHeader}>
                                                            <Text
                                                                style={[
                                                                    styles.lineItemName,
                                                                    { color: colors.text.primary },
                                                                ]}
                                                            >
                                                                {lineItem.itemType?.item_name || 'Unknown Item'}
                                                            </Text>
                                                            <Text
                                                                style={[
                                                                    styles.lineItemSKU,
                                                                    { color: colors.text.secondary },
                                                                ]}
                                                            >
                                                                SKU: {lineItem.sku}
                                                            </Text>
                                                        </View>

                                                        <View style={styles.lineItemProgress}>
                                                            <Text
                                                                style={[
                                                                    styles.lineItemStatus,
                                                                    {
                                                                        color: isComplete
                                                                            ? '#27ae60'
                                                                            : colors.secondary.orange,
                                                                    },
                                                                ]}
                                                            >
                                                                {isComplete ? '✓' : '⏳'}{' '}
                                                                {lineItem.quantity_received} of{' '}
                                                                {lineItem.quantity_ordered} received ({lineProgress}%)
                                                            </Text>
                                                        </View>

                                                        {!isComplete && (
                                                            <TouchableOpacity
                                                                style={[
                                                                    styles.receiveButton,
                                                                    { backgroundColor: colors.primary.cyan },
                                                                ]}
                                                                onPress={() => {
                                                                    navigation.navigate('Receiving', { sku: lineItem.sku });
                                                                }}
                                                            >
                                                                <Text style={styles.receiveButtonText}>
                                                                    Receive More Items
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

            {/* Create PO Button (Admin only) */}
            {isAdmin && (
                <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.primary.cyan }]}
                    onPress={() => {
                        // Use CommonActions to navigate to root stack
                        navigation.dispatch(
                            CommonActions.navigate({
                                name: 'CreatePurchaseOrder',
                            })
                        );
                    }}
                >
                    <Text style={styles.createButtonText}>+ New Incoming Shipment</Text>
                </TouchableOpacity>
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
    shContainer: {
        marginBottom: Spacing.md,
    },
    shCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.md,
        position: 'relative',
    },
    shHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    shTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    statusIcon: {
        fontSize: 24,
        marginRight: Spacing.sm,
    },
    shInfo: {
        flex: 1,
    },
    shNumber: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
    },
    vendor: {
        fontSize: Typography.sizes.md,
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
        marginBottom: Spacing.sm,
    },
    progressText: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs,
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
    orderDate: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    expandIcon: {
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.lg,
        fontSize: 24,
    },
    lineItemsContainer: {
        marginTop: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        gap: Spacing.sm,
    },
    emptyLineItems: {
        padding: Spacing.md,
        textAlign: 'center',
        fontSize: Typography.sizes.sm,
    },
    lineItemCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        ...Shadows.sm,
    },
    lineItemHeader: {
        marginBottom: Spacing.sm,
    },
    lineItemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    lineItemSKU: {
        fontSize: Typography.sizes.sm,
        fontFamily: 'monospace',
    },
    lineItemProgress: {
        marginBottom: Spacing.sm,
    },
    lineItemStatus: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    receiveButton: {
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    receiveButtonText: {
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
});