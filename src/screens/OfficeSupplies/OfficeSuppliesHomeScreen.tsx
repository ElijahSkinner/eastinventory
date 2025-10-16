// src/screens/OfficeSupplies/OfficeSuppliesHomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useNavigation } from "@react-navigation/native";

export default function OfficeSuppliesHomeScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation();

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.secondary.orange }]}>
                <Text style={styles.headerEmoji}>📎</Text>
                <Text style={styles.headerTitle}>Office Supplies</Text>
                <Text style={styles.headerSubtitle}>Track consumables, reorders, and usage</Text>
            </View>

            {/* Quick Stats */}
            <View style={[styles.statsCard, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.statsTitle, { color: colors.primary.coolGray }]}>
                    📊 Quick Stats
                </Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.secondary.red }]}>0</Text>
                        <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                            Low Stock
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.secondary.orange }]}>0</Text>
                        <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                            Need Reorder
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary.cyan }]}>0</Text>
                        <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                            Total Items
                        </Text>
                    </View>
                </View>
            </View>

            {/* Menu Options */}
            <View style={styles.menuContainer}>
                <TouchableOpacity
                    style={[styles.menuCard, { backgroundColor: colors.background.primary }]}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('SupplyInventoryScreen.tsx' as never)}
                >
                    <View style={styles.menuCardContent}>
                        <Text style={styles.menuIcon}>📋</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={[styles.menuTitle, { color: colors.primary.coolGray }]}>
                                Supply Inventory
                            </Text>
                            <Text style={[styles.menuDescription, { color: colors.text.secondary }]}>
                                View all office supplies and stock levels
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.arrow, { color: colors.text.secondary }]}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.menuCard, { backgroundColor: colors.background.primary }]}
                    activeOpacity={0.7}
                    onPress={() => alert('Coming soon!')}
                >
                    <View style={styles.menuCardContent}>
                        <Text style={styles.menuIcon}>📦</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={[styles.menuTitle, { color: colors.primary.coolGray }]}>
                                Receive Supplies
                            </Text>
                            <Text style={[styles.menuDescription, { color: colors.text.secondary }]}>
                                Log incoming supply deliveries
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.arrow, { color: colors.text.secondary }]}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.menuCard, { backgroundColor: colors.background.primary }]}
                    activeOpacity={0.7}
                    onPress={() => alert('Coming soon!')}
                >
                    <View style={styles.menuCardContent}>
                        <Text style={styles.menuIcon}>📤</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={[styles.menuTitle, { color: colors.primary.coolGray }]}>
                                Dispense Supplies
                            </Text>
                            <Text style={[styles.menuDescription, { color: colors.text.secondary }]}>
                                Track supplies given to staff
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.arrow, { color: colors.text.secondary }]}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.menuCard, { backgroundColor: colors.background.primary }]}
                    activeOpacity={0.7}
                    onPress={() => alert('Coming soon!')}
                >
                    <View style={styles.menuCardContent}>
                        <Text style={styles.menuIcon}>🔔</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={[styles.menuTitle, { color: colors.primary.coolGray }]}>
                                Reorder Alerts
                            </Text>
                            <Text style={[styles.menuDescription, { color: colors.text.secondary }]}>
                                Items below minimum stock levels
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.badge, { backgroundColor: colors.secondary.red }]}>
                        <Text style={styles.badgeText}>0</Text>
                    </View>
                    <Text style={[styles.arrow, { color: colors.text.secondary }]}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.menuCard, { backgroundColor: colors.background.primary }]}
                    activeOpacity={0.7}
                    onPress={() => alert('Coming soon!')}
                >
                    <View style={styles.menuCardContent}>
                        <Text style={styles.menuIcon}>📊</Text>
                        <View style={styles.menuTextContainer}>
                            <Text style={[styles.menuTitle, { color: colors.primary.coolGray }]}>
                                Usage Reports
                            </Text>
                            <Text style={[styles.menuDescription, { color: colors.text.secondary }]}>
                                Consumption trends and shrinkage
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.arrow, { color: colors.text.secondary }]}>›</Text>
                </TouchableOpacity>
            </View>

            {/* Info Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.infoTitle, { color: colors.primary.coolGray }]}>
                    🚀 Getting Started
                </Text>
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                    This module helps you track office supplies, monitor usage, and manage reorders automatically.
                </Text>
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                    • Set reorder points for each item{'\n'}
                    • Track who takes supplies{'\n'}
                    • Monitor shrinkage and waste{'\n'}
                    • Generate reorder lists automatically
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    headerEmoji: {
        fontSize: 48,
        marginBottom: Spacing.sm,
    },
    headerTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        color: '#fff',
        marginBottom: Spacing.xs,
    },
    headerSubtitle: {
        fontSize: Typography.sizes.md,
        color: '#fff',
        opacity: 0.9,
    },
    statsCard: {
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    statsTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
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
    menuContainer: {
        padding: Spacing.md,
        gap: Spacing.md,
    },
    menuCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Shadows.md,
    },
    menuCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIcon: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
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
        fontSize: 24,
        marginLeft: Spacing.sm,
    },
    infoCard: {
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
        marginBottom: Spacing.xl,
    },
    infoTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    infoText: {
        fontSize: Typography.sizes.md,
        lineHeight: Typography.sizes.md * 1.5,
        marginBottom: Spacing.sm,
    },
});