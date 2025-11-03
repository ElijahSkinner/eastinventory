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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { databases, DATABASE_ID, ID, teams, COLLECTIONS } from '../../lib/appwrite'; // Add teams import
import { Query } from 'appwrite';
import {
    Package,
    getStatusColor,
    getStatusIcon,
    getStatusLabel,
    getDaysSinceReceived,
    formatPackageDate,
} from '../../lib/packageTracking';
import {Typography, Spacing, BorderRadius, Shadows, Colors} from '../../theme';
import { PackageTrackingStackParamList } from '../../navigation/AppNavigator';

// FIX: Add the type definition
type MyPackagesNavigationProp = NativeStackNavigationProp<PackageTrackingStackParamList, 'MyPackages'>;

export default function MyPackagesScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();
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
            if (!user) return;

            // Get packages directly addressed to user
            const userPackagesResponse = await databases.listDocuments(
                DATABASE_ID,
                'packages',
                [
                    Query.equal('addressed_to_type', 'user'),
                    Query.equal('addressed_to_id', user.$id),
                    Query.orderDesc('received_date'),
                    Query.limit(100),
                ]
            );

            let allPackages = [...(userPackagesResponse.documents as unknown as Package[])];

            // Also get packages for teams user belongs to
            try {
                const userTeamsResponse = await teams.list();
                // Note: You may need to filter teams where the user is actually a member
                // This is a simplified version - you might need to check memberships
                const userTeamIds = userTeamsResponse.teams.map(team => team.$id);

                if (userTeamIds.length > 0) {
                    const teamPackagesResponse = await databases.listDocuments(
                        DATABASE_ID,
                        'packages',
                        [
                            Query.equal('addressed_to_type', 'team'),
                            // Note: Appwrite may not support Query.equal with array
                            // You might need to make multiple queries or handle differently
                            Query.orderDesc('received_date'),
                            Query.limit(100),
                        ]
                    );

                    // Filter to only teams the user belongs to
                    const teamPackages = (teamPackagesResponse.documents as unknown as Package[])
                        .filter(pkg => pkg.addressed_to_id && userTeamIds.includes(pkg.addressed_to_id));

                    allPackages = [...allPackages, ...teamPackages];
                }
            } catch (teamError) {
                console.error('Error loading team packages:', teamError);
                // Continue with just user packages if team loading fails
            }

            // Sort by received date
            allPackages.sort((a, b) =>
                new Date(b.received_date).getTime() - new Date(a.received_date).getTime()
            );

            setPackages(allPackages);
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

    const handleForward = (pkg: Package) => {
        (navigation as any).navigate('ForwardPackage', { package: pkg });
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

                {/* Action Buttons */}
                {item.status === 'pending_confirmation' && (
                    <>
                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: colors.primary.cyan }]}
                            onPress={() => handleConfirmPackage(item)}
                        >
                            <Text style={styles.confirmButtonText}>✓ Confirm Contents</Text>
                        </TouchableOpacity>

                        {item.forwarding_chain && item.forwarding_chain.length > 0 && (
                            <View style={styles.forwardingHistory}>
                                <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                    Previously handled by:
                                </Text>
                                {item.forwarding_chain.map((person, i) => (
                                    <Text key={i} style={[styles.detailValue, { color: colors.text.primary }]}>
                                        → {person}
                                    </Text>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.forwardButton, { backgroundColor: colors.secondary.orange }]}
                            onPress={() => handleForward(item)}
                        >
                            <Text style={styles.confirmButtonText}>📤 Forward to Someone Else</Text>
                        </TouchableOpacity>
                    </>
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
                            You don&#39;t have any packages yet
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

// ... rest of styles remain the same
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


    forwardingHistory: {
        marginTop: Spacing.md,
        padding: Spacing.sm,
        backgroundColor: 'rgba(0, 147, 178, 0.1)',
        borderRadius: BorderRadius.sm,
    },
    forwardButton: {
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        backgroundColor: Colors.secondary.orange,
        ...Shadows.sm,
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