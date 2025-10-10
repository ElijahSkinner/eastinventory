// src/components/modals/LogoutConfirmModal.tsx
import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface LogoutConfirmModalProps {
    visible: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function LogoutConfirmModal({
                                               visible,
                                               onConfirm,
                                               onCancel,
                                           }: LogoutConfirmModalProps) {
    const { colors } = useTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable
                style={styles.overlay}
                onPress={onCancel}
            >
                <Pressable
                    style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.ui.border }]}>
                        <Text style={[styles.title, { color: colors.primary.coolGray }]}>
                            Logout
                        </Text>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Text style={[styles.message, { color: colors.text.primary }]}>
                            Are you sure you want to logout?
                        </Text>
                        <Text style={[styles.subMessage, { color: colors.text.secondary }]}>
                            You'll need to login again to access the inventory system.
                        </Text>
                    </View>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton, { backgroundColor: colors.background.secondary, borderColor: colors.ui.border }]}
                            onPress={onCancel}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.buttonText, { color: colors.text.primary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.confirmButton, { backgroundColor: colors.secondary.red }]}
                            onPress={onConfirm}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.buttonText, { color: colors.text.white }]}>
                                Logout
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        borderRadius: BorderRadius.lg,
        ...Shadows.lg,
        overflow: 'hidden',
    },
    header: {
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
    },
    content: {
        padding: Spacing.lg,
    },
    message: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
        marginBottom: Spacing.sm,
    },
    subMessage: {
        fontSize: Typography.sizes.sm,
        lineHeight: Typography.lineHeights.relaxed * Typography.sizes.sm,
    },
    buttonContainer: {
        flexDirection: 'row',
        padding: Spacing.md,
        gap: Spacing.md,
    },
    button: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.sm,
    },
    cancelButton: {
        borderWidth: 1,
    },
    confirmButton: {
        // Red background from inline style
    },
    buttonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
});