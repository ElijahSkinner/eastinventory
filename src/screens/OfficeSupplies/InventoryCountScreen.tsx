// src/screens/OfficeSupplies/InventoryCountScreen.tsx
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    OfficeSupplyItem,
} from '../../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface CountItem extends OfficeSupplyItem {
    actualCount?: number;
    itemsSold?: number;
    expectedRevenue?: number;
    variance?: number;
}

type TabType = 'supplies' | 'snacks';

export default function InventoryCountScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<TabType>('supplies');
    const [supplies, setSupplies] = useState<CountItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [actualCash, setActualCash] = useState('');
    const [notes, setNotes] = useState('');

    useFocusEffect(
        useCallback(() => {
            loadSupplies();
        }, [activeTab])
    );

    const loadSupplies = async () => {
        try {
            setLoading(true);
            const queries = [Query.orderAsc('category'), Query.limit(1000)];

            // Filter based on active tab
            if (activeTab === 'snacks') {
                queries.push(Query.equal('is_for_sale', true));
            } else {
                queries.push(Query.equal('is_for_sale', false));
            }

            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                queries
            );
            setSupplies(response.documents as unknown as CountItem[]);
        } catch (error) {
            console.error('Error loading supplies:', error);
            Alert.alert('Error', 'Failed to load supplies');
        } finally {
            setLoading(false);
        }
    };

    const updateActualCount = (itemId: string, count: string) => {
        setSupplies(prev =>
            prev.map(item => {
                if (item.$id === itemId) {
                    const actualCount = count === '' ? undefined : parseInt(count);
                    if (actualCount === undefined) {
                        return { ...item, actualCount: undefined, itemsSold: undefined, expectedRevenue: undefined, variance: undefined };
                    }

                    const itemsSold = item.current_quantity - actualCount;
                    const expectedRevenue = item.is_for_sale ? itemsSold * (item.charge_price || 0) : 0;
                    const variance = actualCount - item.current_quantity;

                    return {
                        ...item,
                        actualCount,
                        itemsSold,
                        expectedRevenue,
                        variance,
                    };
                }
                return item;
            })
        );
    };

    const getFilteredSupplies = () => {
        return supplies; // Already filtered by query
    };

    const calculateTotals = () => {
        const itemsWithCounts = supplies.filter(s => s.actualCount !== undefined);

        if (activeTab === 'snacks') {
            const totalItemsSold = itemsWithCounts.reduce((sum, s) => sum + (s.itemsSold || 0), 0);
            const totalExpectedRevenue = itemsWithCounts.reduce((sum, s) => sum + (s.expectedRevenue || 0), 0);
            const totalShrinkage = itemsWithCounts.reduce((sum, s) => sum + Math.abs(Math.min(s.variance || 0, 0)), 0);
            const totalOverage = itemsWithCounts.reduce((sum, s) => sum + Math.max(s.variance || 0, 0), 0);

            return {
                itemsWithCounts: itemsWithCounts.length,
                totalItemsSold,
                totalExpectedRevenue,
                totalShrinkage,
                totalOverage,
            };
        }

        return {
            itemsWithCounts: itemsWithCounts.length,
            totalItemsSold: 0,
            totalExpectedRevenue: 0,
            totalShrinkage: 0,
            totalOverage: 0,
        };
    };

    const handleSubmit = async () => {
        const itemsWithCounts = supplies.filter(s => s.actualCount !== undefined);

        if (itemsWithCounts.length === 0) {
            Alert.alert('No Counts', 'Please count at least one item before submitting.');
            return;
        }

        const totals = calculateTotals();

        if (activeTab === 'snacks') {
            // Require cash count for snacks
            if (!actualCash.trim()) {
                Alert.alert('Cash Count Required', 'Please enter the actual cash amount in the box.');
                return;
            }

            const actualCashNum = parseFloat(actualCash);
            if (isNaN(actualCashNum) || actualCashNum < 0) {
                Alert.alert('Invalid Amount', 'Please enter a valid cash amount.');
                return;
            }

            const cashVariance = actualCashNum - totals.totalExpectedRevenue;

            const confirmMessage =
                `Snack Inventory Count Summary:\n\n` +
                `Items Counted: ${totals.itemsWithCounts} of ${supplies.length}\n` +
                `Items Sold: ${totals.totalItemsSold}\n` +
                `Expected Revenue: ${totals.totalExpectedRevenue.toFixed(2)}\n` +
                `Actual Cash: ${actualCashNum.toFixed(2)}\n` +
                `Cash Variance: ${cashVariance.toFixed(2)} ${cashVariance >= 0 ? '(Over)' : '(Short)'}\n\n` +
                `Shrinkage: ${totals.totalShrinkage} items\n` +
                `Overage: ${totals.totalOverage} items\n\n` +
                `Submit this count?`;

            Alert.alert('Confirm Count', confirmMessage, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit',
                    onPress: async () => {
                        await processInventoryCount(itemsWithCounts, totals, actualCashNum, cashVariance);
                    }
                },
            ]);
        } else {
            // Office supplies - simpler confirmation
            const confirmMessage =
                `Office Supply Count Summary:\n\n` +
                `Items Counted: ${totals.itemsWithCounts} of ${supplies.length}\n\n` +
                `Submit this count?`;

            Alert.alert('Confirm Count', confirmMessage, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit',
                    onPress: async () => {
                        await processInventoryCount(itemsWithCounts, totals, 0, 0);
                    }
                },
            ]);
        }
    };

    const processInventoryCount = async (
        itemsWithCounts: CountItem[],
        totals: any,
        actualCashNum: number,
        cashVariance: number
    ) => {
        setSubmitting(true);

        try {
            // Update each counted item and create transactions
            for (const item of itemsWithCounts) {
                // Update the item's current quantity
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                    item.$id,
                    {
                        current_quantity: item.actualCount!,
                    }
                );

                // Create inventory count transaction
                // ✅ FIX: Ensure all required fields are provided
                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.OFFICE_SUPPLY_TRANSACTIONS,
                    ID.unique(),
                    {
                        supply_item_id: item.$id,  // ✅ This is the correct field
                        transaction_type: 'inventory_count',
                        quantity: item.itemsSold || 0,
                        previous_quantity: item.current_quantity,
                        new_quantity: item.actualCount!,
                        performed_by: user?.name || 'Unknown',
                        transaction_date: new Date().toISOString(),
                        unit_cost_at_transaction: item.unit_cost || undefined,
                        charge_price_at_transaction: item.charge_price || undefined,
                        expected_cash: item.expectedRevenue || undefined,
                        notes: activeTab === 'snacks'
                            ? `Snack count - ${item.itemsSold} sold, ${item.variance} variance`
                            : `Supply count - ${item.variance} variance`,
                    }
                );

                // Only track shrinkage for snacks
                if (activeTab === 'snacks' && item.variance && item.variance < 0) {
                    await databases.createDocument(
                        DATABASE_ID,
                        COLLECTIONS.OFFICE_SUPPLY_TRANSACTIONS,
                        ID.unique(),
                        {
                            supply_item_id: item.$id,  // ✅ This is the correct field
                            transaction_type: 'shrinkage',
                            quantity: Math.abs(item.variance),
                            previous_quantity: item.current_quantity,
                            new_quantity: item.actualCount!,
                            performed_by: user?.name || 'Unknown',
                            transaction_date: new Date().toISOString(),
                            unit_cost_at_transaction: item.unit_cost || undefined,
                            charge_price_at_transaction: item.charge_price || undefined,
                            notes: `Shrinkage detected: ${Math.abs(item.variance)} items missing`,
                        }
                    );
                }
            }

            // Create ONE cash reconciliation transaction only for snacks
            if (activeTab === 'snacks' && itemsWithCounts.length > 0) {
                const referenceItem = itemsWithCounts[0];
                const itemsList = itemsWithCounts.map(i => `${i.item_name} (${i.itemsSold})`).join(', ');

                // ✅ FIX: Use a valid supply_item_id from the first counted item
                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.OFFICE_SUPPLY_TRANSACTIONS,
                    ID.unique(),
                    {
                        supply_item_id: referenceItem.$id,  // ✅ Use first item as reference
                        transaction_type: 'cash_count',
                        quantity: totals.totalItemsSold,
                        previous_quantity: 0,
                        new_quantity: 0,
                        performed_by: user?.name || 'Unknown',
                        transaction_date: new Date().toISOString(),
                        expected_cash: totals.totalExpectedRevenue || undefined,
                        actual_cash: actualCashNum || undefined,
                        cash_variance: cashVariance || undefined,
                        notes: `Cash reconciliation - Items: ${itemsList}. ${notes.trim()}`,
                    }
                );
            }

            let successMessage = `${activeTab === 'snacks' ? 'Snack' : 'Supply'} count completed successfully.\n\n${totals.itemsWithCounts} items updated`;

            if (activeTab === 'snacks') {
                successMessage += `\nCash variance: $${cashVariance.toFixed(2)}`;
            }

            Alert.alert('Count Submitted!', successMessage);

            // Reset form
            setActualCash('');
            setNotes('');
            loadSupplies();

        } catch (error: any) {
            console.error('Error processing count:', error);
            // ✅ Better error handling to see what went wrong
            console.error('Error details:', JSON.stringify(error, null, 2));
            Alert.alert('Error', `Failed to process inventory count: ${error.message || 'Unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const totals = calculateTotals();
    const actualCashNum = parseFloat(actualCash) || 0;
    const cashVariance = actualCashNum - totals.totalExpectedRevenue;
    const filteredSupplies = getFilteredSupplies();

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.secondary.orange} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: colors.background.primary }]}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'supplies' && { borderBottomColor: colors.secondary.orange, borderBottomWidth: 3 },
                    ]}
                    onPress={() => setActiveTab('supplies')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'supplies' ? colors.secondary.orange : colors.text.secondary },
                        ]}
                    >
                        Office Supplies
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'snacks' && { borderBottomColor: colors.secondary.orange, borderBottomWidth: 3 },
                    ]}
                    onPress={() => setActiveTab('snacks')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'snacks' ? colors.secondary.orange : colors.text.secondary },
                        ]}
                    >
                        Snacks & Drinks
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Instructions */}
                <View style={[styles.infoCard, { backgroundColor: colors.primary.cyan + '20' }]}>
                    <Text style={[styles.infoText, { color: colors.text.primary }]}>
                        {activeTab === 'supplies'
                            ? '📋 Count office supplies to maintain accurate inventory levels'
                            : '🍿 Count snacks & drinks, then reconcile cash'}
                    </Text>
                </View>

                {filteredSupplies.length === 0 ? (
                    <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            {activeTab === 'snacks'
                                ? 'No snacks or drinks marked for sale yet.\n\nAdd items and mark them as "For Sale" when creating them.'
                                : 'No office supply items found.'}
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Count Items */}
                        <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                            <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                                Count Items
                            </Text>

                            {filteredSupplies.map(item => (
                                <View key={item.$id} style={[styles.countItem, { borderBottomColor: colors.ui.divider }]}>
                                    <View style={styles.countItemInfo}>
                                        <Text style={[styles.countItemName, { color: colors.text.primary }]}>
                                            {item.item_name}
                                        </Text>
                                        <Text style={[styles.countItemCurrent, { color: colors.text.secondary }]}>
                                            System: {item.current_quantity} {item.unit}s
                                            {activeTab === 'snacks' && item.charge_price && ` • ${item.charge_price.toFixed(2)} each`}
                                        </Text>
                                        {item.actualCount !== undefined && (
                                            <>
                                                {activeTab === 'snacks' && (
                                                    <Text style={[styles.countItemSold, { color: colors.primary.cyan }]}>
                                                        Sold: {item.itemsSold} • Revenue: ${item.expectedRevenue?.toFixed(2)}
                                                    </Text>
                                                )}
                                                {item.variance !== 0 && (
                                                    <Text style={[
                                                        styles.countItemVariance,
                                                        { color: item.variance! < 0 ? colors.secondary.red : colors.status.available }
                                                    ]}>
                                                        {item.variance! < 0 ? '⚠️ Shrinkage' : '✓ Overage'}: {Math.abs(item.variance!)} items
                                                    </Text>
                                                )}
                                            </>
                                        )}
                                    </View>
                                    <TextInput
                                        style={[styles.countInput, {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary
                                        }]}
                                        value={item.actualCount?.toString() || ''}
                                        onChangeText={(text) => updateActualCount(item.$id, text)}
                                        placeholder="Count"
                                        placeholderTextColor={colors.text.secondary}
                                        keyboardType="number-pad"
                                    />
                                </View>
                            ))}
                        </View>

                        {/* Cash Count - Only for snacks */}
                        {totals.itemsWithCounts > 0 && activeTab === 'snacks' && (
                            <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                                <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                                    Cash Reconciliation
                                </Text>

                                <View style={[styles.summaryCard, { backgroundColor: colors.background.secondary }]}>
                                    <View style={styles.summaryRow}>
                                        <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>
                                            Items Sold:
                                        </Text>
                                        <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                                            {totals.totalItemsSold}
                                        </Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Text style={[styles.summaryLabel, { color: colors.text.secondary }]}>
                                            Expected Revenue:
                                        </Text>
                                        <Text style={[styles.summaryValue, { color: colors.primary.cyan }]}>
                                            ${totals.totalExpectedRevenue.toFixed(2)}
                                        </Text>
                                    </View>
                                    {totals.totalShrinkage > 0 && (
                                        <View style={styles.summaryRow}>
                                            <Text style={[styles.summaryLabel, { color: colors.secondary.red }]}>
                                                ⚠️ Shrinkage:
                                            </Text>
                                            <Text style={[styles.summaryValue, { color: colors.secondary.red }]}>
                                                {totals.totalShrinkage} items
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <Text style={[styles.label, { color: colors.text.primary }]}>
                                    Actual Cash in Box *
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: colors.background.secondary,
                                        borderColor: colors.ui.border,
                                        color: colors.text.primary
                                    }]}
                                    value={actualCash}
                                    onChangeText={setActualCash}
                                    placeholder="0.00"
                                    placeholderTextColor={colors.text.secondary}
                                    keyboardType="decimal-pad"
                                />

                                {actualCash && (
                                    <View style={[
                                        styles.varianceCard,
                                        {
                                            backgroundColor: cashVariance === 0
                                                ? `${colors.status.available}20`
                                                : cashVariance > 0
                                                    ? `${colors.primary.cyan}20`
                                                    : `${colors.secondary.red}20`,
                                            borderColor: cashVariance === 0
                                                ? colors.status.available
                                                : cashVariance > 0
                                                    ? colors.primary.cyan
                                                    : colors.secondary.red
                                        }
                                    ]}>
                                        <Text style={[styles.varianceLabel, { color: colors.text.secondary }]}>
                                            Cash Variance:
                                        </Text>
                                        <Text style={[
                                            styles.varianceValue,
                                            {
                                                color: cashVariance === 0
                                                    ? colors.status.available
                                                    : cashVariance > 0
                                                        ? colors.primary.cyan
                                                        : colors.secondary.red
                                            }
                                        ]}>
                                            {cashVariance === 0 ? '✓' : cashVariance > 0 ? '↑' : '↓'} ${Math.abs(cashVariance).toFixed(2)}
                                            {cashVariance > 0 ? ' Over' : cashVariance < 0 ? ' Short' : ' Perfect!'}
                                        </Text>
                                    </View>
                                )}

                                <Text style={[styles.label, { color: colors.text.primary }]}>
                                    Notes (Optional)
                                </Text>
                                <TextInput
                                    style={[styles.input, styles.textArea, {
                                        backgroundColor: colors.background.secondary,
                                        borderColor: colors.ui.border,
                                        color: colors.text.primary
                                    }]}
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Any notes about this count..."
                                    placeholderTextColor={colors.text.secondary}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Submit Button */}
            {totals.itemsWithCounts > 0 && (
                <View style={[styles.footer, {
                    backgroundColor: colors.background.primary,
                    borderTopColor: colors.ui.border
                }]}>
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.primary.cyan }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>
                                ✓ Submit Count ({totals.itemsWithCounts} items)
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    content: {
        flex: 1,
    },
    infoCard: {
        margin: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    infoText: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
        fontWeight: Typography.weights.medium,
    },
    section: {
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    emptyText: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
        lineHeight: Typography.sizes.md * 1.6,
    },
    countItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    countItemInfo: {
        flex: 1,
        marginRight: Spacing.md,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.xs / 2,
    },
    countItemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    forSaleBadge: {
        paddingHorizontal: Spacing.xs,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
    },
    forSaleBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.bold,
    },
    countItemCurrent: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs / 2,
    },
    countItemSold: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
        marginTop: Spacing.xs / 2,
    },
    countItemVariance: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
        marginTop: Spacing.xs / 2,
    },
    countInput: {
        width: 80,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        fontSize: Typography.sizes.md,
        textAlign: 'center',
        fontWeight: Typography.weights.bold,
    },
    summaryCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    summaryLabel: {
        fontSize: Typography.sizes.md,
    },
    summaryValue: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    label: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    varianceCard: {
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        alignItems: 'center',
    },
    varianceLabel: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs,
    },
    varianceValue: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
    },
    footer: {
        padding: Spacing.md,
        borderTopWidth: 1,
    },
    submitButton: {
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.md,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
});