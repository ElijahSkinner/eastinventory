// src/screens/PackageTracking/MyPackagesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    TextInput,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { databases, DATABASE_ID, ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import {
    Package,
    getStatusColor,
    getStatusIcon,
    getStatusLabel,
    getDaysSinceReceived,
    formatPackageDate,
} from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function MyPackagesScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();

    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmationNotes, setConfirmationNotes] = useState('');
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        loadMyPackages();
    }, []);

    const loadMyPackages = async () => {
        try {
            // Load packages addressed to the current user
            // This assumes we can match by name or email
            const response = await databases.listDocuments(
                DATABASE_ID,
                'packages',
                [
                    Query.orderDesc('received_date'),
                    Query.limit(100),
                ]
            );

            // Filter to only packages for this user
            const userPackages = (response.documents as unknown as Package[]).filter((pkg) => {
                // Match by name or email
                const userName = user?.name?.toLowerCase();
                const userEmail = user?.email?.toLowerCase();
                const addressedTo = pkg.addressed_to.toLowerCase();

                return (
                    addressedTo.includes(userName || '') ||
                    addressedTo.includes(userEmail || '')
                );
            });

            setPackages(userPackages);
        } catch (error) {
            console.error('Error loading packages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadMyPackages();
    };

    const handleConfirmPackage = (pkg: Package) => {
        setSelectedPackage(pkg);
        setShowConfirmModal(true);
    };

    const submitConfirmation = async () => {
        if (!selectedPackage) return;

        // Validate - Ask for confirmation twice
        Alert.alert(
            'Confirm Contents',
            'Are the contents correct?',
            [
                {
                    text: 'No',
                    style: 'cancel',
                },
                {
                    text: 'Yes',
                    onPress: () => {
                        // Second confirmation
                        Alert.alert(
                            'Final Confirmation',
                            'Did you check all packages? This action cannot be undone.',
                            [
                                {
                                    text: 'Cancel',
                                    style: 'cancel',
                                },
                                {
                                    text: 'Confirm',
                                    onPress: async () => {
                                        await processConfirmation();
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    const processConfirmation = async () => {
        if (!selectedPackage) return;

        setConfirming(true);

        try {
            await databases.updateDocument(
                DATABASE_ID,
                'packages',
                selectedPackage.$id,
                {
                    status: 'completed',
                    contents_confirmed_by: user?.name || user?.email || 'Unknown',
                    contents_confirmed_date: new Date().toISOString(),
                    completion_notes: confirmationNotes.trim() || null,
                    location: 'With Addressee',
                }
            );

            // Create notification record
            await databases.createDocument(
                DATABASE_ID,
                'package_notifications',
                ID.unique(),
                {
                    package_id: selectedPackage.$id,
                    recipient_id: user?.$id || '',
                    notification_type: 'completed',
                    sent_date: new Date().toISOString(),
                    read: true,
                    read_date: new Date().toISOString(),
                }
            );

            Alert.alert('Success', 'Package confirmed successfully!');
            setShowConfirmModal(false);
            setSelectedPackage(null);
            setConfirmationNotes('');
            loadMyPackages();
        } catch (error: any) {
            console.error('Error confirming package:', error);
            Alert.alert('Error', 'Failed to confirm package: ' + error.message);
        } finally {
            setConfirming(false);
        }
    };

    const renderPackageItem = ({ item }: { item: Package }) => {
        const daysSince = getDaysSinceReceived(item.received_date);
        const isOverdue = daysSince > 1 && item.status === 'pending_confirmation';

        return (
            <View
                style={[
                    styles.packageCard,
                    {
                        backgroundColor: colors.background.secondary,
                        borderColor: isOverdue ? '#E6A65D' : colors.ui.border,
                        borderWidth: isOverdue ? 2 : 1,
                    },
                ]}
            >
                {/* Header */}
                <View style={styles.packageHeader}>
                    <Text style={styles.packageIcon}>{getStatusIcon(item.status)}</Text>
                    <View style={styles.packageInfo}>
                        <Text style={[styles.packageTracking, { color: colors.text.primary }]}>
                            {item.tracking_number}
                        </Text>
                        <Text style={[styles.packageDate, { color: colors.text.secondary }]}>
                            Received: {formatPackageDate(item.received_date)}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.statusBadge,
                            { backgroundColor: `${getStatusColor(item.status)}20` },
                        ]}
                    >
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {getStatusLabel(item.status)}
                        </Text>
                    </View>
                </View>

                {/* Details */}
                <View style={styles.packageDetails}>
                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            From:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {item.sender}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            Packages:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {item.number_of_packages}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            Location:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {item.location}
                        </Text>
                    </View>

                    {item.carrier && (
                        <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                Carrier:
                            </Text>
                            <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                {item.carrier}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Overdue Warning */}
                {isOverdue && (
                    <View
                        style={[
                            styles.warningBanner,
                            { backgroundColor: '#FFF3CD', borderColor: '#E6A65D' },
                        ]}
                    >
                        <Text style={[styles.warningText, { color: '#856404' }]}>
                            ⚠️ Needs attention - Received {daysSince} days ago
                        </Text>
                    </View>
                )}

                {/* Action Button */}
                {item.status === 'pending_confirmation' && (
                    <TouchableOpacity
                        style={[styles.confirmButton, { backgroundColor: colors.primary.cyan }]}
                        onPress={() => handleConfirmPackage(item)}
                    >
                        <Text style={styles.confirmButtonText}>✓ Confirm Contents</Text>

                        {item.forwarding_chain && (
                            <View style={styles.forwardingHistory}>
                                <Text>Previously handled by:</Text>
                                {item.forwarding_chain.map((person, i) => (
                                    <Text key={i}>→ {person}</Text>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.forwardButton}
                            onPress={() => handleForward(item)}
                        >
                            <Text>📤 Forward to Someone Else</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}

                {item.status === 'completed' && item.completion_notes && (
                    <View style={styles.notesContainer}>
                        <Text style={[styles.notesLabel, { color: colors.text.secondary }]}>
                            Notes:
                        </Text>
                        <Text style={[styles.notesText, { color: colors.text.primary }]}>
                            {item.completion_notes}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            {/* Confirmation Modal */}
            {showConfirmModal && selectedPackage && (
                <View style={styles.modalOverlay}>
                    <View
                        style={[
                            styles.modalContainer,
                            { backgroundColor: colors.background.primary },
                        ]}
                    >
                        <Text style={[styles.modalTitle, { color: colors.primary.coolGray }]}>
                            Confirm Package Contents
                        </Text>

                        <View style={styles.modalContent}>
                            <Text style={[styles.modalText, { color: colors.text.primary }]}>
                                Tracking: {selectedPackage.tracking_number}
                            </Text>
                            <Text style={[styles.modalText, { color: colors.text.primary }]}>
                                From: {selectedPackage.sender}
                            </Text>
                            <Text style={[styles.modalText, { color: colors.text.primary }]}>
                                Packages: {selectedPackage.number_of_packages}
                            </Text>

                            <TextInput
                                style={[
                                    styles.notesInput,
                                    {
                                        backgroundColor: colors.background.secondary,
                                        borderColor: colors.ui.border,
                                        color: colors.text.primary,
                                    },
                                ]}
                                placeholder="Add notes (optional)"
                                placeholderTextColor={colors.text.secondary}
                                multiline
                                numberOfLines={4}
                                value={confirmationNotes}
                                onChangeText={setConfirmationNotes}
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
                                onPress={() => {
                                    setShowConfirmModal(false);
                                    setSelectedPackage(null);
                                    setConfirmationNotes('');
                                }}
                                disabled={confirming}
                            >
                                <Text style={[styles.modalButtonText, { color: colors.text.primary }]}>
                                    Cancel
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    {
                                        backgroundColor: confirming
                                            ? colors.ui.border
                                            : colors.primary.cyan,
                                    },
                                ]}
                                onPress={submitConfirmation}
                                disabled={confirming}
                            >
                                {confirming ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.modalButtonText}>✓ Confirm</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            <FlatList
                data={packages}
                renderItem={renderPackageItem}
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
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={[styles.emptyText, { color: colors.text.primary }]}>
                            No packages found
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.text.secondary }]}>
                            You don't have any packages yet
                        </Text>
                    </View>
                }
            />
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
    packageCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
        ...Shadows.md,
    },
    packageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    packageIcon: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    packageInfo: {
        flex: 1,
    },
    packageTracking: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        fontFamily: 'monospace',
    },
    packageDate: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    statusText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.bold,
    },
    packageDetails: {
        gap: Spacing.xs,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: Typography.sizes.sm,
    },
    detailValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    warningBanner: {
        marginTop: Spacing.md,
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
    },
    warningText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        textAlign: 'center',
    },
    confirmButton: {
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.sm,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    notesContainer: {
        marginTop: Spacing.md,
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
        backgroundColor: 'rgba(0, 147, 178, 0.1)',
    },
    notesLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    notesText: {
        fontSize: Typography.sizes.sm,
        fontStyle: 'italic',
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
    // Modal styles
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.lg,
    },
    modalTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    modalContent: {
        marginBottom: Spacing.lg,
    },
    modalText: {
        fontSize: Typography.sizes.md,
        marginBottom: Spacing.sm,
    },
    notesInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
        marginTop: Spacing.md,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
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