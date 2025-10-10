// src/screens/InventoryListScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';

export default function InventoryListScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Inventory List - Coming Soon</Text>
            <Text style={styles.subtext}>This is where you'll view all inventory items</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background.primary,
        padding: Spacing.lg,
    },
    text: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: Colors.primary.coolGray,
        marginBottom: Spacing.md,
    },
    subtext: {
        fontSize: Typography.sizes.md,
        color: Colors.text.secondary,
        textAlign: 'center',
    },
});