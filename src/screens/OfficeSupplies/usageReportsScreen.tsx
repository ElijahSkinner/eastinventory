// src/screens/OfficeSupplies/UsageReportsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    OfficeSupplyItem,
    OfficeSupplyTransaction,
} from '../../lib/appwrite';
import { Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface UsageMetrics {
    totalTransactions: number;
    totalItemsDispensed: number;
    totalItemsReceived: number;
    totalShrinkage: number;
    topUsedItems: Array<{ name: string; count: number; category: string }>;
    shrinkageItems: Array<{ name: string; lost: number; value: number }>;
    reorderFrequency: Array<{ name: string; timesOrdered: number }>;
    categoryBreakdown: Array<{ category: string; count: number; percentage: number }>;
    cashMetrics: {
        totalRevenue: number;
        totalVariance: number;
        averageVariance: number;
        cashCountsPerformed: number;
    };
}

export default function UsageReportsScreen() {
    const { colors } = useTheme();

    const [timeRange, setTimeRange] = useState<TimeRange>('30d');
    const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadMetrics();
        }, [timeRange])
    );

    const getStartDate = () => {
        const now = new Date();
        switch (timeRange) {
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            case '90d':
                return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
            case 'all':
                return new Date(0).toISOString();
        }
    };

    const loadMetrics = async () => {
        try {
            setLoading(true);

            const startDate = getStartDate();
            const queries = [
                Query.greaterThan('transaction_date', startDate),
                Query.limit(5000),
            ];

            // Load all transactions
            const transactionsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_TRANSACTIONS,
                queries
            );

            const transactions = transactionsResponse.documents as unknown as OfficeSupplyTransaction[];

            // Load all supply items for reference
            const itemsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                [Query.limit(1000)]
            );

            const items = itemsResponse.documents as unknown as OfficeSupplyItem[];
            const itemsMap = new Map(items.map(item => [item.$id, item]));

            // Calculate metrics
            const calculatedMetrics = calculateMetrics(transactions, itemsMap);
            setMetrics(calculatedMetrics);

        } catch (error) {
            console.error('Error loading metrics:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateMetrics = (
        transactions: OfficeSupplyTransaction[],
        itemsMap: Map<string, OfficeSupplyItem>
    ): UsageMetrics => {
        let totalItemsDispensed = 0;
        let totalItemsReceived = 0;
        let totalShrinkage = 0;

        const itemUsageCount = new Map<string, number>();
        const shrinkageByItem = new Map<string, number>();
        const receivedByItem = new Map<string, number>();

        let totalCashRevenue = 0;
        let totalCashVariance = 0;
        let cashCountsPerformed = 0;

        // Process transactions
        transactions.forEach(txn => {
            const item = itemsMap.get(txn.supply_item_id);
            const itemName = item?.item_name || 'Unknown';

            switch (txn.transaction_type) {
                case 'dispensed':
                    totalItemsDispensed += txn.quantity;
                    itemUsageCount.set(itemName, (itemUsageCount.get(itemName) || 0) + txn.quantity);
                    break;

                case 'received':
                    totalItemsReceived += txn.quantity;
                    receivedByItem.set(itemName, (receivedByItem.get(itemName) || 0) + 1);
                    break;

                case 'shrinkage':
                    totalShrinkage += txn.quantity;
                    shrinkageByItem.set(itemName, (shrinkageByItem.get(itemName) || 0) + txn.quantity);
                    break;

                case 'cash_count':
                    cashCountsPerformed++;
                    if (txn.expected_cash) totalCashRevenue += txn.expected_cash;
                    if (txn.cash_variance) totalCashVariance += txn.cash_variance;
                    break;
            }
        });

        // Top used items
        const topUsedItems = Array.from(itemUsageCount.entries())
            .map(([name, count]) => {
                const item = Array.from(itemsMap.values()).find(i => i.item_name === name);
                return {
                    name,
                    count,
                    category: item?.category || 'Unknown',
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Shrinkage items
        const shrinkageItems = Array.from(shrinkageByItem.entries())
            .map(([name, lost]) => {
                const item = Array.from(itemsMap.values()).find(i => i.item_name === name);
                const value = (item?.unit_cost || 0) * lost;
                return { name, lost, value };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Reorder frequency
        const reorderFrequency = Array.from(receivedByItem.entries())
            .map(([name, timesOrdered]) => ({ name, timesOrdered }))
            .sort((a, b) => b.timesOrdered - a.timesOrdered)
            .slice(0, 10);

        // Category breakdown
        const categoryCount = new Map<string, number>();
        topUsedItems.forEach(item => {
            categoryCount.set(item.category, (categoryCount.get(item.category) || 0) + item.count);
        });

        const totalCategoryCounts = Array.from(categoryCount.values()).reduce((a, b) => a + b, 0);
        const categoryBreakdown = Array.from(categoryCount.entries())
            .map(([category, count]) => ({
                category,
                count,
                percentage: totalCategoryCounts > 0 ? Math.round((count / totalCategoryCounts) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);

        return {
            totalTransactions: transactions.length,
            totalItemsDispensed,
            totalItemsReceived,
            totalShrinkage,
            topUsedItems,
            shrinkageItems,
            reorderFrequency,
            categoryBreakdown,
            cashMetrics: {
                totalRevenue: totalCashRevenue,
                totalVariance: totalCashVariance,
                averageVariance: cashCountsPerformed > 0 ? totalCashVariance / cashCountsPerformed : 0,
                cashCountsPerformed,
            },
        };
    };

    const handleRefresh = () => {
        setRefreshing(true);
        loadMetrics();
    };

    const getTimeRangeLabel = () => {
        switch (timeRange) {
            case '7d': return 'Last 7 Days';
            case '30d': return 'Last 30 Days';
            case '90d': return 'Last 90 Days';
            case 'all': return 'All Time';
        }
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
            {/* Time Range Filter */}
            <View style={[styles.filterBar, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>
                    Period:
                </Text>
                <View style={styles.filterButtons}>
                    {(['7d', '30d', '90d', 'all'] as TimeRange[]).map(range => (
                        <TouchableOpacity
                            key={range}
                            style={[
                                styles.filterButton,
                                timeRange === range && {
                                    backgroundColor: colors.secondary.orange,
                                },
                            ]}
                            onPress={() => setTimeRange(range)}
                        >
                            <Text
                                style={[
                                    styles.filterButtonText,
                                    {
                                        color: timeRange === range ? '#fff' : colors.text.secondary,
                                    },
                                ]}
                            >
                                {range === '7d' ? '7d' : range === '30d' ? '30d' : range === '90d' ? '90d' : 'All'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {/* Key Metrics Overview */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        📊 Overview - {getTimeRangeLabel()}
                    </Text>

                    <View style={styles.metricsGrid}>
                        <View style={[styles.metricCard, { backgroundColor: `${colors.primary.cyan}10` }]}>
                            <Text style={[styles.metricValue, { color: colors.primary.cyan }]}>
                                {metrics?.totalItemsDispensed || 0}
                            </Text>
                            <Text style={[styles.metricLabel, { color: colors.text.secondary }]}>
                                Items Used
                            </Text>
                        </View>

                        <View style={[styles.metricCard, { backgroundColor: `${colors.status.available}10` }]}>
                            <Text style={[styles.metricValue, { color: colors.status.available }]}>
                                {metrics?.totalItemsReceived || 0}
                            </Text>
                            <Text style={[styles.metricLabel, { color: colors.text.secondary }]}>
                                Items Received
                            </Text>
                        </View>

                        <View style={[styles.metricCard, { backgroundColor: `${colors.secondary.red}10` }]}>
                            <Text style={[styles.metricValue, { color: colors.secondary.red }]}>
                                {metrics?.totalShrinkage || 0}
                            </Text>
                            <Text style={[styles.metricLabel, { color: colors.text.secondary }]}>
                                Shrinkage
                            </Text>
                        </View>

                        <View style={[styles.metricCard, { backgroundColor: `${colors.secondary.purple}10` }]}>
                            <Text style={[styles.metricValue, { color: colors.secondary.purple }]}>
                                {metrics?.totalTransactions || 0}
                            </Text>
                            <Text style={[styles.metricLabel, { color: colors.text.secondary }]}>
                                Transactions
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Top Used Items */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        🔥 Most Used Items
                    </Text>

                    {metrics?.topUsedItems && metrics.topUsedItems.length > 0 ? (
                        metrics.topUsedItems.map((item, index) => (
                            <View
                                key={index}
                                style={[styles.listItem, { borderBottomColor: colors.ui.divider }]}
                            >
                                <View style={styles.listItemLeft}>
                                    <View style={[styles.rankBadge, { backgroundColor: colors.primary.cyan }]}>
                                        <Text style={styles.rankText}>#{index + 1}</Text>
                                    </View>
                                    <View style={styles.listItemInfo}>
                                        <Text style={[styles.listItemName, { color: colors.text.primary }]}>
                                            {item.name}
                                        </Text>
                                        <Text style={[styles.listItemCategory, { color: colors.text.secondary }]}>
                                            {item.category}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[styles.listItemValue, { color: colors.primary.cyan }]}>
                                    {item.count} used
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            No usage data for this period
                        </Text>
                    )}
                </View>

                {/* Category Breakdown */}
                {metrics?.categoryBreakdown && metrics.categoryBreakdown.length > 0 && (
                    <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            📂 Usage by Category
                        </Text>

                        {metrics.categoryBreakdown.map((cat, index) => (
                            <View key={index} style={styles.categoryItem}>
                                <View style={styles.categoryHeader}>
                                    <Text style={[styles.categoryName, { color: colors.text.primary }]}>
                                        {cat.category}
                                    </Text>
                                    <Text style={[styles.categoryPercentage, { color: colors.primary.cyan }]}>
                                        {cat.percentage}%
                                    </Text>
                                </View>
                                <View style={[styles.progressBar, { backgroundColor: colors.ui.border }]}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${cat.percentage}%`,
                                                backgroundColor: colors.primary.cyan,
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.categoryCount, { color: colors.text.secondary }]}>
                                    {cat.count} items used
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Shrinkage Report */}
                {metrics?.shrinkageItems && metrics.shrinkageItems.length > 0 && (
                    <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                                ⚠️ Shrinkage Report
                            </Text>
                            <View style={[styles.costBadge, { backgroundColor: `${colors.secondary.red}20` }]}>
                                <Text style={[styles.costBadgeText, { color: colors.secondary.red }]}>
                                    -${metrics.shrinkageItems.reduce((sum, item) => sum + item.value, 0).toFixed(2)}
                                </Text>
                            </View>
                        </View>

                        {metrics.shrinkageItems.map((item, index) => (
                            <View
                                key={index}
                                style={[styles.listItem, { borderBottomColor: colors.ui.divider }]}
                            >
                                <View style={styles.listItemInfo}>
                                    <Text style={[styles.listItemName, { color: colors.text.primary }]}>
                                        {item.name}
                                    </Text>
                                    <Text style={[styles.shrinkageDetails, { color: colors.secondary.red }]}>
                                        {item.lost} items lost • ${item.value.toFixed(2)} value
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Reorder Frequency */}
                {metrics?.reorderFrequency && metrics.reorderFrequency.length > 0 && (
                    <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            🔄 Reorder Frequency
                        </Text>
                        <Text style={[styles.sectionSubtitle, { color: colors.text.secondary }]}>
                            Items ordered most frequently
                        </Text>

                        {metrics.reorderFrequency.map((item, index) => (
                            <View
                                key={index}
                                style={[styles.listItem, { borderBottomColor: colors.ui.divider }]}
                            >
                                <Text style={[styles.listItemName, { color: colors.text.primary }]}>
                                    {item.name}
                                </Text>
                                <Text style={[styles.listItemValue, { color: colors.status.available }]}>
                                    {item.timesOrdered}x ordered
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Cash Metrics (for snacks/items for sale) */}
                {metrics?.cashMetrics && metrics.cashMetrics.cashCountsPerformed > 0 && (
                    <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            💰 Cash Reconciliation
                        </Text>

                        <View style={styles.cashMetricsGrid}>
                            <View style={styles.cashMetricItem}>
                                <Text style={[styles.cashMetricLabel, { color: colors.text.secondary }]}>
                                    Total Revenue
                                </Text>
                                <Text style={[styles.cashMetricValue, { color: colors.status.available }]}>
                                    ${metrics.cashMetrics.totalRevenue.toFixed(2)}
                                </Text>
                            </View>

                            <View style={styles.cashMetricItem}>
                                <Text style={[styles.cashMetricLabel, { color: colors.text.secondary }]}>
                                    Total Variance
                                </Text>
                                <Text
                                    style={[
                                        styles.cashMetricValue,
                                        {
                                            color:
                                                metrics.cashMetrics.totalVariance >= 0
                                                    ? colors.status.available
                                                    : colors.secondary.red,
                                        },
                                    ]}
                                >
                                    {metrics.cashMetrics.totalVariance >= 0 ? '+' : ''}$
                                    {metrics.cashMetrics.totalVariance.toFixed(2)}
                                </Text>
                            </View>

                            <View style={styles.cashMetricItem}>
                                <Text style={[styles.cashMetricLabel, { color: colors.text.secondary }]}>
                                    Avg. Variance
                                </Text>
                                <Text
                                    style={[
                                        styles.cashMetricValue,
                                        {
                                            color:
                                                metrics.cashMetrics.averageVariance >= 0
                                                    ? colors.status.available
                                                    : colors.secondary.red,
                                        },
                                    ]}
                                >
                                    {metrics.cashMetrics.averageVariance >= 0 ? '+' : ''}$
                                    {metrics.cashMetrics.averageVariance.toFixed(2)}
                                </Text>
                            </View>

                            <View style={styles.cashMetricItem}>
                                <Text style={[styles.cashMetricLabel, { color: colors.text.secondary }]}>
                                    Counts Performed
                                </Text>
                                <Text style={[styles.cashMetricValue, { color: colors.primary.cyan }]}>
                                    {metrics.cashMetrics.cashCountsPerformed}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Insights */}
                {metrics && (
                    <View style={[styles.section, { backgroundColor: `${colors.primary.cyan}10` }]}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            💡 Insights
                        </Text>

                        {metrics.totalShrinkage > 0 && (
                            <View style={styles.insightItem}>
                                <Text style={styles.insightIcon}>⚠️</Text>
                                <Text style={[styles.insightText, { color: colors.text.primary }]}>
                                    {metrics.totalShrinkage} items lost to shrinkage in this period
                                </Text>
                            </View>
                        )}

                        {metrics.topUsedItems.length > 0 && (
                            <View style={styles.insightItem}>
                                <Text style={styles.insightIcon}>🔥</Text>
                                <Text style={[styles.insightText, { color: colors.text.primary }]}>
                                    <Text style={{ fontWeight: Typography.weights.bold }}>
                                        {metrics.topUsedItems[0].name}
                                    </Text>{' '}
                                    is your most-used item with {metrics.topUsedItems[0].count} uses
                                </Text>
                            </View>
                        )}

                        {metrics.cashMetrics.averageVariance < -5 && (
                            <View style={styles.insightItem}>
                                <Text style={styles.insightIcon}>💸</Text>
                                <Text style={[styles.insightText, { color: colors.text.primary }]}>
                                    Average cash variance is negative. Review pricing and inventory counts.
                                </Text>
                            </View>
                        )}

                        {metrics.totalItemsDispensed === 0 && (
                            <View style={styles.insightItem}>
                                <Text style={styles.insightIcon}>📭</Text>
                                <Text style={[styles.insightText, { color: colors.text.primary }]}>
                                    No dispensing activity recorded in this period
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    filterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        ...Shadows.sm,
    },
    filterLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        marginRight: Spacing.sm,
    },
    filterButtons: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    filterButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    filterButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    content: {
        flex: 1,
    },
    section: {
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    sectionSubtitle: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.md,
        marginTop: -Spacing.sm,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    metricCard: {
        flex: 1,
        minWidth: '45%',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    metricValue: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    metricLabel: {
        fontSize: Typography.sizes.xs,
        textAlign: 'center',
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    listItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    rankBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    rankText: {
        color: '#fff',
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
    },
    listItemInfo: {
        flex: 1,
    },
    listItemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    listItemCategory: {
        fontSize: Typography.sizes.sm,
    },
    listItemValue: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    categoryItem: {
        marginBottom: Spacing.md,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    categoryName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    categoryPercentage: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    progressBar: {
        height: 8,
        borderRadius: BorderRadius.sm,
        overflow: 'hidden',
        marginBottom: Spacing.xs,
    },
    progressFill: {
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    categoryCount: {
        fontSize: Typography.sizes.sm,
    },
    costBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.md,
    },
    costBadgeText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    shrinkageDetails: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
    },
    cashMetricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    cashMetricItem: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        padding: Spacing.md,
    },
    cashMetricLabel: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs,
    },
    cashMetricValue: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
    },
    insightItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    insightIcon: {
        fontSize: 20,
        marginTop: 2,
    },
    insightText: {
        flex: 1,
        fontSize: Typography.sizes.md,
        lineHeight: Typography.sizes.md * 1.5,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: Typography.sizes.md,
        padding: Spacing.lg,
    },
});