// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
    navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
    const { colors, theme } = useTheme();
    const { user } = useAuth();
    const logoSource = theme === 'dark'
        ? require('../../assets/logos/EAST_Logo_White_Horz.png')
        : require('../../assets/logos/EAST_Logo_2c_Horz.png');
    const menuItems = [
        {
            title: 'Scan In Items',
            description: 'Receive and inventory new equipment',
            icon: '📦',
            route: 'ScanIn' as const,
            color: colors.primary.cyan,
        },
        {
            title: 'Check Out to School',
            description: 'Prepare items for school installation',
            icon: '🏫',
            route: 'CheckOut' as const,
            color: colors.secondary.orange,
        },
        {
            title: 'View Inventory',
            description: 'Browse all items in stock',
            icon: '📋',
            route: 'InventoryList' as const,
            color: colors.secondary.purple,
        },
        {
            title: 'Settings',
            description: 'App preferences and account',
            icon: '⚙️',
            route: 'Settings' as const,
            color: colors.secondary.blue,
        },
    ];

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: colors.background.secondary }}
            contentContainerStyle={{ padding: Spacing.lg }}
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
                        onPress={() => navigation.navigate(item.route)}
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
    container: {
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
    },
    logoHorizontal: {
        width: 200,
        height: 60,
        marginBottom: Spacing.md,
    },
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