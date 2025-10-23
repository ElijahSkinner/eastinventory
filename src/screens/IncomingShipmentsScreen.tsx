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
import { Typography, Spacing, BorderRadius, Shadows, CommonStyles } from '../theme';
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
        }, [filterStatus])
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
    }, [filterStatus]);

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
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[CommonStyles.containers.flex, { backgroundColor: colors.background.secondary }]}>
            {/* Header with Admin Badge */}
            <View style={[CommonStyles.headers.container, { backgroundColor: colors.background.primary }]}>
                <Text style={[CommonStyles.headers.title, { color: colors.primary.coolGray }]}>
                    Incoming Shipments
                </Text>
                {isAdmin && (
                    <View style={[CommonStyles.badges.pill, { backgroundColor: '#e74c3c' }]}>
                        <Text style={[CommonStyles.badges.text, { color: '#fff' }]}>👑 Admin</Text>
                    </View>
                )}
            </View>

            {/* Search and Filter */}
            <View style={[styles.searchContainer, { backgroundColor: colors.background.primary }]}>
                <View style={styles.searchRow}>
                    <TextInput
                        style={[
                            CommonStyles.inputs.search,
                            {
                                color: colors.text.primary,
                                borderColor: colors.ui.border,
                                flex: 1,
                            },
                        ]}
                        placeholder="Search by SH# or vendor..."
                        placeholderTextColor={colors.text.secondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={loadIncomingShipments}
                        returnKeyType="search"
                    />
                    <TouchableOpacity
                        style={[CommonStyles.buttons.primary, { backgroundColor: colors.primary.cyan, marginLeft: Spacing.sm }]}
                        onPress={loadIncomingShipments}
                    >
                        <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>🔍</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Status Filter Tabs */}
            <View style={[styles.filterContainer, { backgroundColor: colors.background.primary }]}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: Spacing.md }}
                >
                    {['all', 'ordered', 'partially_received', 'fully_received'].map((status, index) => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterTab,
                                {
                                    backgroundColor: filterStatus === status
                                        ? colors.primary.cyan
                                        : 'transparent',
                                    marginRight: index < 3 ? Spacing.sm : 0,
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

            {/* List */}
            <ScrollView
                style={CommonStyles.containers.flex}
                contentContainerStyle={{ padding: Spacing.md }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {IncomingShipments.length === 0 ? (
                    <View style={CommonStyles.empty.container}>
                        <Text style={CommonStyles.empty.emoji}>📦</Text>
                        <Text style={[CommonStyles.empty.text, { color: colors.primary.coolGray }]}>
                            No Incoming Shipments found
                        </Text>
                        <Text style={[CommonStyles.empty.subtext, { color: colors.text.secondary }]}>
                            {searchQuery || filterStatus !== 'all'
                                ? 'Try adjusting your filters'
                                : 'Create a new Incoming Shipment to get started'}
                        </Text>
                    </View>
                ) : (
                    IncomingShipments.map((sh) => {
                        const isExpanded = expandedSHId === sh.$id;
                        const progress = calculateSHProgress(sh);

                        return (
                            <View key={sh.$id} style={styles.shContainer}>
                                <TouchableOpacity
                                    style={[CommonStyles.cards.interactive, { backgroundColor: colors.background.primary }]}
                                    onPress={() => handleExpandPO(sh.$id)}
                                    activeOpacity={0.7}
                                >
                                    {/* Header */}
                                    <View style={styles.shHeader}>
                                        <View style={styles.shTitleRow}>
                                            <Text style={CommonStyles.icons.large}>{getStatusIcon(sh.order_status)}</Text>
                                            <View style={styles.shInfo}>
                                                <Text style={[styles.shNumber, { color: colors.text.primary }]}>
                                                    {sh.po_number}
                                                </Text>
                                                <Text style={[styles.vendor, { color: colors.text.secondary }]}>
                                                    {sh.vendor}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={[CommonStyles.badges.base, { backgroundColor: `${getStatusColor(sh.order_status)}20` }]}>
                                            <Text style={[CommonStyles.badges.text, { color: getStatusColor(sh.order_status) }]}>
                                                {getStatusLabel(sh.order_status)}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Progress */}
                                    <View style={CommonStyles.progress.container}>
                                        <Text style={[CommonStyles.progress.text, { color: colors.text.secondary }]}>
                                            {sh.received_items} of {sh.total_items} items received
                                        </Text>
                                        <View style={[CommonStyles.progress.bar, { backgroundColor: colors.ui.border }]}>
                                            <View
                                                style={[
                                                    CommonStyles.progress.fill,
                                                    {
                                                        width: `${progress}%`,
                                                        backgroundColor: progress === 100 ? '#27ae60' : colors.primary.cyan,
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </View>

                                    <Text style={[styles.orderDate, { color: colors.text.secondary }]}>
                                        Ordered: {formatDate(sh.order_date)}
                                        {sh.expected_delivery && ` • Expected: ${formatDate(sh.expected_delivery)}`}
                                    </Text>

                                    <Text style={[styles.expandIcon, { color: colors.text.secondary }]}>
                                        {isExpanded ? '▼' : '▶'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Expanded Line Items */}
                                {isExpanded && (
                                    <View
                                        style={[
                                            styles.lineItemsContainer,
                                            { backgroundColor: colors.background.secondary },
                                        ]}
                                    >
                                        {loadingLineItems ? (
                                            <ActivityIndicator size="small" color={colors.primary.cyan} />
                                        ) : lineItems.length === 0 ? (
                                            <Text style={[styles.emptyLineItems, { color: colors.text.secondary }]}>
                                                No line items found
                                            </Text>
                                        ) : (
                                            lineItems.map((lineItem) => {
                                                const isComplete =
                                                    lineItem.quantity_received >= lineItem.quantity_ordered;

                                                return (
                                                    <View
                                                        key={lineItem.$id}
                                                        style={[
                                                            CommonStyles.cards.compact,
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
                                                                {isComplete ? '✓ Complete' : '⏳ In Progress'} •{' '}
                                                                {lineItem.quantity_received} / {lineItem.quantity_ordered}
                                                            </Text>

                                                            <View style={[CommonStyles.progress.bar, { backgroundColor: colors.ui.border }]}>
                                                                <View
                                                                    style={[
                                                                        CommonStyles.progress.fill,
                                                                        {
                                                                            width: `${Math.round(
                                                                                (lineItem.quantity_received /
                                                                                    lineItem.quantity_ordered) *
                                                                                100
                                                                            )}%`,
                                                                            backgroundColor: isComplete
                                                                                ? '#27ae60'
                                                                                : colors.primary.cyan,
                                                                        },
                                                                    ]}
                                                                />
                                                            </View>
                                                        </View>

                                                        {!isComplete && (
                                                            <TouchableOpacity
                                                                style={[
                                                                    CommonStyles.buttons.primary,
                                                                    { backgroundColor: colors.primary.cyan },
                                                                ]}
                                                                onPress={() => {
                                                                    navigation.navigate('Receiving', { sku: lineItem.sku });
                                                                }}
                                                            >
                                                                <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>
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
                    style={[CommonStyles.buttons.fab, { backgroundColor: colors.primary.cyan }]}
                    onPress={() => {
                        // Use CommonActions to navigate to root stack
                        navigation.dispatch(
                            CommonActions.navigate({
                                name: 'CreatePurchaseOrder',
                            })
                        );
                    }}
                >
                    <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>+ New Incoming Shipment</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // Custom styles specific to IncomingShipmentsScreen
    searchContainer: {
        padding: Spacing.md,
        ...Shadows.sm,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterContainer: {
        paddingVertical: Spacing.md,
        ...Shadows.sm,
    },
    filterTab: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
    },
    filterTabText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    shContainer: {
        marginBottom: Spacing.md,
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
        gap: Spacing.sm,
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
        marginBottom: Spacing.xs,
    },
});