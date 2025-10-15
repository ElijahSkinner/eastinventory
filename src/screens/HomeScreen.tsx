// src/screens/HomeScreen.tsx (Enhanced)
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { Query } from 'appwrite';

interface DashboardStats {
    posInProgress: number;
    itemsReceiving: number;
    totalInventory: number;
    schoolsPendingPrep: number;
    availableItems: number;
    assignedItems: number;
}

export default function HomeScreen() {
    const { colors, theme } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();

    const [stats, setStats] = useState<DashboardStats>({
        posInProgress: 0,
        itemsReceiving: 0,
        totalInventory: 0,
        schoolsPendingPrep: 0,
        availableItems: 0,
        assignedItems: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboardStats();
    }, []);

    const loadDashboardStats = async () => {
        try {
            setLoading(true);

            const [
                posOrdered,
                posPartiallyReceived,
                inventoryTotal,
                inventoryAvailable,
                inventoryAssigned,
                schoolCheckoutsInProgress,
            ] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PURCHASE_ORDERS, [
                    Query.equal('order_status', 'ordered'),
                    Query.limit(1),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.PURCHASE_ORDERS, [
                    Query.equal('order_status', 'partially_received'),
                    Query.limit(1),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [Query.limit(1)]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [
                    Query.equal('status', 'available'),
                    Query.limit(1),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [
                    Query.equal('status', 'assigned'),
                    Query.limit(1),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOL_CHECKOUTS, [
                    Query.equal('checkout_status', 'in_progress'),
                    Query.limit(1),
                ]),
            ]);

            setStats({
                posInProgress: posOrdered.total + posPartiallyReceived.total,
                itemsReceiving: posPartiallyReceived.total,
                totalInventory: inventoryTotal.total,
                schoolsPendingPrep: schoolCheckoutsInProgress.total,
                availableItems: inventoryAvailable.total,
                assignedItems: inventoryAssigned.total,
            });
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    const handleRefresh = () => {
        setRefreshing(true);
        loadDashboardStats();
    };

    const menuItems = [
        {
            title: 'Purchase Orders',
            description: 'Manage vendor orders',
            icon: '📦',
            route: 'PurchaseOrders' as const,
            color: colors.primary.cyan,
            badge: stats.posInProgress > 0 ? stats.posInProgress : undefined,
        },
        {
            title: 'Receive Items',
            description: 'Scan and receive inventory',
            icon: '📷',
            route: 'Receiving' as const,
            color: colors.secondary.orange,
            badge: stats.itemsReceiving > 0 ? stats.itemsReceiving : undefined,
        },
        {
            title: 'View Inventory',
            description: 'Browse all items in stock',
            icon: '📋',
            route: 'Inventory' as const,
            color: colors.secondary.purple,
            badge: stats.availableItems > 0 ? stats.availableItems : undefined,
        },
        {
            title: 'Check Out Items',
            description: 'Assign items to schools',
            icon: '📤',
            route: 'CheckOut' as const,
            color: colors.secondary.blue,
            badge: stats.schoolsPendingPrep > 0 ? stats.schoolsPendingPrep : undefined,
        },
        {
            title: 'Settings',
            description: 'App preferences and account',
            icon: '⚙️',
            route: 'Settings' as const,
            color: colors.primary.coolGray,
        },
    ];

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: colors.background.secondary }}
            contentContainerStyle={{ padding: Spacing.lg }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
        >
            {/* Welcome Section */}
            <View style={[styles.welcomeCard, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.welcomeText, { color: colors.primary.cyan }]}>
                    Welcome, {user?.name}!
                </Text>
                <Text style={[styles.tagline, { color: colors.text.secondary }]}>
                    Education Accelerated by Service and Technology
                </Text>
            </View>

            {/* Quick Stats */}
            {loading ? (
                <View style={[styles.statsCard, { backgroundColor: colors.background.primary }]}>
                    <ActivityIndicator size="small" color={colors.primary.cyan} />
                </View>
            ) : (
                <View style={[styles.statsCard, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.statsTitle, { color: colors.primary.coolGray }]}>
                        📊 Quick Stats
                    </Text>

                    <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.secondary.blue }]}>
                                {stats.posInProgress}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                                POs in Progress
                            </Text>
                        </View>

                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.secondary.orange }]}>
                                {stats.itemsReceiving}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                                Items Receiving
                            </Text>
                        </View>

                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.primary.cyan }]}>
                                {stats.totalInventory}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                                Total Inventory
                            </Text>
                        </View>

                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: colors.secondary.purple }]}>
                                {stats.schoolsPendingPrep}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                                Schools Pending
                            </Text>
                        </View>
                    </View>

                    <View style={[styles.inventoryBreakdown, { borderTopColor: colors.ui.divider }]}>
                        <View style={styles.breakdownItem}>
                            <Text style={[styles.breakdownLabel, { color: colors.text.secondary }]}>
                                🟢 Available
                            </Text>
                            <Text style={[styles.breakdownValue, { color: colors.text.primary }]}>
                                {stats.availableItems}
                            </Text>
                        </View>
                        <View style={styles.breakdownItem}>
                            <Text style={[styles.breakdownLabel, { color: colors.text.secondary }]}>
                                🔵 Assigned
                            </Text>
                            <Text style={[styles.breakdownValue, { color: colors.text.primary }]}>
                                {stats.assignedItems}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Menu Cards */}
            <View style={styles.menuContainer}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.menuCard,
                            {
                                backgroundColor: colors.background.primary,
                                borderLeftColor: item.color
                            }
                        ]}
                        onPress={() => navigation.navigate(item.route as never)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuCardContent}>
                            <Text style={styles.menuIcon}>{item.icon}</Text>
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuTitle, { color: colors.primary.coolGray }]}>
                                    {item.title}
                                </Text>
                                <Text style={[styles.menuDescription, { color: colors.text.secondary }]}>
                                    {item.description}
                                </Text>
                            </View>
                        </View>

                        {item.badge && (
                            <View style={[styles.badge, { backgroundColor: item.color }]}>
                                <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                        )}

                        <Text style={[styles.arrow, { color: colors.text.secondary }]}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Footer */}
            <View style={[
                styles.footer,
                {
                    backgroundColor: colors.secondary.lightGray,
                    borderLeftColor: colors.primary.cyan
                }
            ]}>
                <Text style={[styles.footerText, { color: colors.text.primary }]}>
                    Building communities through service and technology
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    welcomeCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        ...Shadows.sm,
        alignItems: 'center',
    },
    welcomeText: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    tagline: {
        fontSize: Typography.sizes.sm,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    statsCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },
    statsTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    statItem: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        padding: Spacing.md,
    },
    statValue: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    statLabel: {
        fontSize: Typography.sizes.sm,
        textAlign: 'center',
    },
    inventoryBreakdown: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: Spacing.md,
        borderTopWidth: 1,
    },
    breakdownItem: {
        alignItems: 'center',
    },
    breakdownLabel: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs / 2,
    },
    breakdownValue: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    menuContainer: {
        gap: Spacing.md,
    },
    menuCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Shadows.md,
        borderLeftWidth: 4,
        position: 'relative',
    },
    menuCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIcon: {
        fontSize: 40,
        marginRight: Spacing.md,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    menuDescription: {
        fontSize: Typography.sizes.sm,
    },
    badge: {
        minWidth: 24,
        height: 24,
        borderRadius: BorderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xs,
        marginRight: Spacing.sm,
    },
    badgeText: {
        color: '#fff',
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.bold,
    },
    arrow: {
        fontSize: 30,
        marginLeft: Spacing.sm,
    },
    footer: {
        marginTop: Spacing.xl,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderLeftWidth: 4,
    },
    footerText: {
        fontSize: Typography.sizes.sm,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});