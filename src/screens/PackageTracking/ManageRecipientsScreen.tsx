// src/screens/PackageTracking/ManageRecipientsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    TextInput,
    Alert,
    Modal,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { databases, DATABASE_ID, ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import { PackageRecipient } from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function ManageRecipientsScreen() {
    const { colors } = useTheme();

    const [recipients, setRecipients] = useState<PackageRecipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRecipient, setEditingRecipient] = useState<PackageRecipient | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [department, setDepartment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadRecipients();
    }, []);

    const loadRecipients = async () => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                'package_recipients',
                [Query.orderAsc('name'), Query.limit(200)]
            );
            setRecipients(response.documents as unknown as PackageRecipient[]);
        } catch (error) {
            console.error('Error loading recipients:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadRecipients();
    };

    const handleAdd = () => {
        setEditingRecipient(null);
        setName('');
        setEmail('');
        setDepartment('');
        setShowAddModal(true);
    };

    const handleEdit = (recipient: PackageRecipient) => {
        setEditingRecipient(recipient);
        setName(recipient.name);
        setEmail(recipient.email);
        setDepartment(recipient.department || '');
        setShowAddModal(true);
    };

    const handleSubmit = async () => {
        if (!name.trim() || !email.trim()) {
            Alert.alert('Validation Error', 'Name and email are required');
            return;
        }

        setSubmitting(true);

        try {
            if (editingRecipient) {
                // Update
                await databases.updateDocument(
                    DATABASE_ID,
                    'package_recipients',
                    editingRecipient.$id,
                    {
                        name: name.trim(),
                        email: email.trim(),
                        department: department.trim() || null,
                    }
                );
                Alert.alert('Success', 'Recipient updated successfully');
            } else {
                // Create
                await databases.createDocument(
                    DATABASE_ID,
                    'package_recipients',
                    ID.unique(),
                    {
                        name: name.trim(),
                        email: email.trim(),
                        department: department.trim() || null,
                        active: true,
                        notification_preference: 'email',
                    }
                );
                Alert.alert('Success', 'Recipient added successfully');
            }

            setShowAddModal(false);
            loadRecipients();
        } catch (error: any) {
            console.error('Error saving recipient:', error);
            Alert.alert('Error', 'Failed to save recipient: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (recipient: PackageRecipient) => {
        try {
            await databases.updateDocument(
                DATABASE_ID,
                'package_recipients',
                recipient.$id,
                {
                    active: !recipient.active,
                }
            );
            loadRecipients();
        } catch (error: any) {
            console.error('Error toggling recipient:', error);
            Alert.alert('Error', 'Failed to update recipient status');
        }
    };

    const renderRecipientItem = ({ item }: { item: PackageRecipient }) => (
        <View
            style={[
                styles.recipientCard,
                {
                    backgroundColor: item.active
                        ? colors.background.secondary
                        : colors.background.secondary + '80',
                    borderColor: colors.ui.border,
                },
            ]}
        >
            <View style={styles.recipientInfo}>
                <Text
                    style={[
                        styles.recipientName,
                        {
                            color: item.active ? colors.text.primary : colors.text.secondary,
                        },
                    ]}
                >
                    {item.name}
                </Text>
                <Text style={[styles.recipientEmail, { color: colors.text.secondary }]}>
                    {item.email}
                </Text>
                {item.department && (
                    <Text style={[styles.recipientDepartment, { color: colors.text.secondary }]}>
                        {item.department}
                    </Text>
                )}
            </View>

            <View style={styles.recipientActions}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        { backgroundColor: colors.background.primary },
                    ]}
                    onPress={() => handleEdit(item)}
                >
                    <Text style={styles.actionIcon}>✏️</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        {
                            backgroundColor: item.active
                                ? colors.secondary.orange
                                : colors.primary.cyan,
                        },
                    ]}
                    onPress={() => handleToggleActive(item)}
                >
                    <Text style={styles.actionText}>
                        {item.active ? '⏸️' : '▶️'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            {/* Add/Edit Modal */}
            <Modal visible={showAddModal} transparent animationType="slide">
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setShowAddModal(false)}
                    >
                        <Pressable
                            style={[
                                styles.modalContainer,
                                { backgroundColor: colors.background.primary },
                            ]}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Text style={[styles.modalTitle, { color: colors.primary.coolGray }]}>
                                {editingRecipient ? 'Edit Recipient' : 'Add Recipient'}
                            </Text>

                            <View style={styles.formField}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>
                                    Name *
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="Enter name"
                                    placeholderTextColor={colors.text.secondary}
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>

                            <View style={styles.formField}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>
                                    Email *
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="Enter email"
                                    placeholderTextColor={colors.text.secondary}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View style={styles.formField}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>
                                    Department (Optional)
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="Enter department"
                                    placeholderTextColor={colors.text.secondary}
                                    value={department}
                                    onChangeText={setDepartment}
                                />
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                        },
                                    ]}
                                    onPress={() => setShowAddModal(false)}
                                    disabled={submitting}
                                >
                                    <Text
                                        style={[
                                            styles.modalButtonText,
                                            { color: colors.text.primary },
                                        ]}
                                    >
                                        Cancel
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        {
                                            backgroundColor: submitting
                                                ? colors.ui.border
                                                : colors.primary.cyan,
                                        },
                                    ]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.modalButtonText}>
                                            {editingRecipient ? 'Update' : 'Add'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {/* List */}
            <FlatList
                data={recipients}
                renderItem={renderRecipientItem}
                keyExtractor={(item) => item.$id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary.cyan}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>👥</Text>
                        <Text style={[styles.emptyText, { color: colors.text.primary }]}>
                            No recipients found
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
                            Add recipients to get started
                        </Text>
                    </View>
                }
            />

            {/* FAB */}
            <TouchableOpacity
                style={[styles.fab, { backgroundColor: colors.primary.cyan }]}
                onPress={handleAdd}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: Spacing.md,
    },
    recipientCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        ...Shadows.sm,
    },
    recipientInfo: {
        flex: 1,
    },
    recipientName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    recipientEmail: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
    },
    recipientDepartment: {
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs / 2,
    },
    recipientActions: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.sm,
    },
    actionIcon: {
        fontSize: 16,
    },
    actionText: {
        fontSize: 16,
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    emptyText: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs,
    },
    emptySubtext: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: Spacing.lg,
        right: Spacing.lg,
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.lg,
    },
    fabText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: Typography.weights.bold,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
        maxHeight: '80%',
        ...Shadows.lg,
    },
    modalTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.lg,
    },
    formField: {
        marginBottom: Spacing.md,
    },
    label: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    modalButton: {
        flex: 1,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        borderWidth: 1,
    },
    modalButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        color: '#fff',
    },
});