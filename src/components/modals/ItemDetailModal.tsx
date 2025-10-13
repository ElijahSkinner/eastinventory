// src/components/modals/ItemDetailModal.tsx
import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    TextInput,
    Switch,
    Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';
import { databases, DATABASE_ID, COLLECTIONS, InventoryItem, ItemType, Transaction, School } from '../../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

interface ItemDetailModalProps {
    visible: boolean;
    item: InventoryItem;
    onClose: () => void;
    onRefresh?: () => void;
}

export default function ItemDetailModal({ visible, item, onClose, onRefresh }: ItemDetailModalProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const {
        isAdmin,
        canDelete,
        canAssignSchools,
        canEditSerialNumber,
        canToggleSchoolSpecific,
        loading: roleLoading
    } = useRole();

    const [itemType, setItemType] = useState<ItemType | null>(null);
    const [school, setSchool] = useState<School | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit mode
    const [editing, setEditing] = useState(false);
    const [schools, setSchools] = useState<School[]>([]);

    // Camera scanning for SN
    const [scanningSerialNumber, setScanningSerialNumber] = useState(false);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    // Editable fields - everyone can edit
    const [editLocation, setEditLocation] = useState(item?.location || '');
    const [editNotes, setEditNotes] = useState(item?.notes || '');
    const [editStatus, setEditStatus] = useState(item?.status || 'available');

    // Admin-only editable fields
    const [editSerialNumber, setEditSerialNumber] = useState(item?.serial_number || '');
    const [editSchoolId, setEditSchoolId] = useState(item?.school_id || '');
    const [editIsSchoolSpecific, setEditIsSchoolSpecific] = useState(item?.is_school_specific || false);

    useEffect(() => {
        if (visible && item) {
            loadItemDetails();
            setEditLocation(item.location || '');
            setEditNotes(item.notes || '');
            setEditStatus(item.status || 'available');
            setEditSerialNumber(item.serial_number || '');
            setEditSchoolId(item.school_id || '');
            setEditIsSchoolSpecific(item.is_school_specific || false);
        }
    }, [visible, item]);

    const loadItemDetails = async () => {
        setLoading(true);
        try {
            // Load item type
            const itemTypeDoc = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.ITEM_TYPES,
                item.item_type_id
            );
            setItemType(itemTypeDoc as unknown as ItemType);

            // Load school if assigned
            if (item.school_id) {
                try {
                    const schoolDoc = await databases.getDocument(
                        DATABASE_ID,
                        COLLECTIONS.SCHOOLS,
                        item.school_id
                    );
                    setSchool(schoolDoc as unknown as School);
                } catch (error) {
                    console.log('School not found or error loading school:', error);
                }
            }

            // Load all schools for picker
            const schoolsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOLS
            );
            setSchools(schoolsResponse.documents as unknown as School[]);

            // Load transaction history
            const transactionsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.TRANSACTIONS,
                [
                    Query.equal('inventory_item_id', item.$id),
                    Query.orderDesc('transaction_date'),
                    Query.limit(50)
                ]
            );
            setTransactions(transactionsResponse.documents as unknown as Transaction[]);
        } catch (error) {
            console.error('Error loading item details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        try {
            // Build update object based on permissions
            const updateData: any = {
                location: editLocation,
                notes: editNotes,
                status: editStatus,
            };

            // Only include admin fields if user is admin
            if (canEditSerialNumber) {
                updateData.serial_number = editSerialNumber;
            }

            if (canToggleSchoolSpecific) {
                updateData.is_school_specific = editIsSchoolSpecific;
            }

            if (canAssignSchools) {
                updateData.school_id = editSchoolId || null;
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                item.$id,
                updateData
            );

            // Log transaction
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.TRANSACTIONS,
                ID.unique(),
                {
                    transaction_type: 'note',
                    inventory_item_id: item.$id,
                    performed_by: user?.name || 'Unknown',
                    transaction_date: new Date().toISOString(),
                    notes: `Updated item details`,
                }
            );

            alert('Item updated successfully!');
            setEditing(false);
            if (onRefresh) onRefresh();
            loadItemDetails();
        } catch (error: any) {
            console.error('Error updating item:', error);
            alert('Failed to update item');
        }
    };

    const handleDeleteItem = async () => {
        if (!canDelete) {
            alert('You do not have permission to delete items');
            return;
        }

        const confirmed = confirm(
            'Are you sure you want to delete this item? This cannot be undone.'
        );

        if (!confirmed) return;

        try {
            await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                item.$id
            );

            alert('Item deleted successfully');
            if (onRefresh) onRefresh();
            onClose();
        } catch (error: any) {
            console.error('Error deleting item:', error);
            if (error.code === 401) {
                alert('You do not have permission to delete items');
            } else {
                alert('Failed to delete item');
            }
        }
    };

    const handleScanSerialNumber = async () => {
        if (!cameraPermission) {
            const { status } = await requestCameraPermission();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera permission is required to scan barcodes.');
                return;
            }
        }

        if (!cameraPermission?.granted) {
            const { status } = await requestCameraPermission();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera permission is required to scan barcodes.');
                return;
            }
        }

        setScanningSerialNumber(true);
    };

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        setEditSerialNumber(data);
        setScanningSerialNumber(false);
        Alert.alert('Success', 'Serial number scanned successfully!');
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'available':
                return colors.status.available;
            case 'assigned':
                return colors.secondary.purple;
            case 'staged':
                return colors.secondary.orange;
            case 'installed':
                return colors.primary.coolGray;
            case 'maintenance':
                return colors.status.maintenance;
            default:
                return colors.text.secondary;
        }
    };

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'available':
                return '🟢 Available';
            case 'assigned':
                return '🔵 Assigned';
            case 'staged':
                return '🟠 Staged';
            case 'installed':
                return '✓ Installed';
            case 'maintenance':
                return '🔴 Maintenance';
            default:
                return 'Unknown';
        }
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'received':
                return '📦';
            case 'assigned':
                return '🏫';
            case 'staged':
                return '📤';
            case 'installed':
                return '✓';
            case 'maintenance':
                return '🔧';
            case 'note':
                return '📝';
            default:
                return '•';
        }
    };

    const getTransactionLabel = (type: string) => {
        switch (type) {
            case 'received':
                return 'Received';
            case 'assigned':
                return 'Assigned to School';
            case 'staged':
                return 'Staged for Installation';
            case 'installed':
                return 'Installed';
            case 'maintenance':
                return 'Sent for Maintenance';
            case 'note':
                return 'Note Added';
            default:
                return type;
        }
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    // Camera Scanner Modal for Serial Number
    if (scanningSerialNumber) {
        return (
            <Modal visible={true} transparent={false} animationType="slide">
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        facing="back"
                        onBarcodeScanned={handleBarcodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
                        }}
                    >
                        <View style={styles.cameraOverlay}>
                            <View style={styles.cameraHeader}>
                                <Text style={styles.cameraTitle}>Scan Serial Number Barcode</Text>
                                <TouchableOpacity
                                    style={styles.cameraCancelButton}
                                    onPress={() => setScanningSerialNumber(false)}
                                >
                                    <Text style={styles.cameraCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.scanFrame} />
                            <Text style={styles.cameraInstructions}>
                                Position the barcode within the frame
                            </Text>
                        </View>
                    </CameraView>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.ui.border }]}>
                        <View style={styles.headerContent}>
                            <View style={styles.titleContainer}>
                                <Text style={[styles.title, { color: colors.primary.coolGray }]}>
                                    {itemType?.item_name || 'Item Details'}
                                </Text>
                                {isAdmin && (
                                    <View style={styles.adminBadge}>
                                        <Text style={styles.adminBadgeText}>👑</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Text style={[styles.closeButtonText, { color: colors.text.secondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {itemType?.category && (
                            <Text style={[styles.categoryText, { color: colors.text.secondary }]}>
                                {itemType.category}
                                {itemType.manufacturer && ` • ${itemType.manufacturer}`}
                                {itemType.model && ` ${itemType.model}`}
                            </Text>
                        )}

                        {/* Edit/Delete Buttons */}
                        {!editing && !loading && (
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.editButton, { backgroundColor: colors.primary.cyan }]}
                                    onPress={() => setEditing(true)}
                                >
                                    <Text style={styles.buttonText}>✏️ Edit</Text>
                                </TouchableOpacity>

                                {canDelete && (
                                    <TouchableOpacity
                                        style={[styles.deleteButton, { backgroundColor: '#e74c3c' }]}
                                        onPress={handleDeleteItem}
                                    >
                                        <Text style={styles.buttonText}>🗑️ Delete</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Save/Cancel Buttons */}
                        {editing && (
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.saveButton, { backgroundColor: '#27ae60' }]}
                                    onPress={handleSaveEdit}
                                >
                                    <Text style={styles.buttonText}>💾 Save</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.cancelButton, { backgroundColor: '#95a5a6' }]}
                                    onPress={() => setEditing(false)}
                                >
                                    <Text style={styles.buttonText}>✕ Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary.cyan} />
                        </View>
                    ) : (
                        <ScrollView style={styles.content}>
                            {/* Item Details Section */}
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                                    Item Details
                                </Text>

                                {/* Serial Number - Admin can edit */}
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                        Serial Number {isAdmin && '(Admin)'}
                                    </Text>
                                    {editing && canEditSerialNumber ? (
                                        <View style={styles.inputWithIcon}>
                                            <TextInput
                                                style={[styles.inputWithButton, {
                                                    backgroundColor: colors.background.secondary,
                                                    color: colors.text.primary,
                                                    borderColor: colors.ui.border
                                                }]}
                                                value={editSerialNumber}
                                                onChangeText={setEditSerialNumber}
                                                placeholder="Enter serial number"
                                                placeholderTextColor={colors.text.secondary}
                                            />
                                            <TouchableOpacity
                                                style={[styles.scanButton, { backgroundColor: colors.primary.cyan }]}
                                                onPress={handleScanSerialNumber}
                                            >
                                                <Text style={styles.scanButtonText}>📷</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                            {item.serial_number || 'N/A'}
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                        Barcode
                                    </Text>
                                    <Text style={[styles.detailValue, { color: colors.text.primary, fontFamily: 'monospace' }]}>
                                        {item.barcode}
                                    </Text>
                                </View>

                                {/* Status - Everyone can edit */}
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>Status</Text>
                                    {editing ? (
                                        <Picker
                                            selectedValue={editStatus}
                                            onValueChange={setEditStatus}
                                            style={[styles.picker, { color: colors.text.primary }]}
                                        >
                                            <Picker.Item label="Available" value="available" />
                                            <Picker.Item label="Assigned" value="assigned" />
                                            <Picker.Item label="Staged" value="staged" />
                                            <Picker.Item label="Installed" value="installed" />
                                            <Picker.Item label="Maintenance" value="maintenance" />
                                        </Picker>
                                    ) : (
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
                                    )}
                                </View>

                                {/* Location - Everyone can edit */}
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                        Location
                                    </Text>
                                    {editing ? (
                                        <TextInput
                                            style={[styles.input, {
                                                backgroundColor: colors.background.secondary,
                                                color: colors.text.primary,
                                                borderColor: colors.ui.border
                                            }]}
                                            value={editLocation}
                                            onChangeText={setEditLocation}
                                            placeholder="Enter location"
                                            placeholderTextColor={colors.text.secondary}
                                        />
                                    ) : (
                                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                            {item.location ? `📍 ${item.location}` : 'Not set'}
                                        </Text>
                                    )}
                                </View>

                                {/* School Assignment - Admin only */}
                                {(canAssignSchools || school) && (
                                    <View style={styles.detailRow}>
                                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                            School {isAdmin && '(Admin)'}
                                        </Text>
                                        {editing && canAssignSchools ? (
                                            <Picker
                                                selectedValue={editSchoolId}
                                                onValueChange={setEditSchoolId}
                                                style={[styles.picker, { color: colors.text.primary }]}
                                            >
                                                <Picker.Item label="None" value="" />
                                                {schools.map(s => (
                                                    <Picker.Item
                                                        key={s.$id}
                                                        label={s.school_name}
                                                        value={s.$id}
                                                    />
                                                ))}
                                            </Picker>
                                        ) : school ? (
                                            <View>
                                                <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                                    🏫 {school.school_name}
                                                </Text>
                                                {school.school_code && (
                                                    <Text style={[styles.detailSubtext, { color: colors.text.secondary }]}>
                                                        Code: {school.school_code}
                                                    </Text>
                                                )}
                                            </View>
                                        ) : (
                                            <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                                Not assigned
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* School-Specific Toggle - Admin only */}
                                {canToggleSchoolSpecific && (
                                    <View style={styles.detailRow}>
                                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                            School-Specific (NAS) {isAdmin && '(Admin)'}
                                        </Text>
                                        {editing ? (
                                            <Switch
                                                value={editIsSchoolSpecific}
                                                onValueChange={setEditIsSchoolSpecific}
                                            />
                                        ) : (
                                            <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                                {item.is_school_specific ? 'Yes' : 'No'}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {item.is_school_specific && !editing && (
                                    <View style={[styles.warningBadge, { backgroundColor: colors.secondary.purple + '20' }]}>
                                        <Text style={[styles.warningText, { color: colors.secondary.purple }]}>
                                            🔵 School-Specific Item - Only for {school?.school_name || 'assigned school'}
                                        </Text>
                                    </View>
                                )}

                                {/* Notes - Everyone can edit */}
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                                        Notes
                                    </Text>
                                    {editing ? (
                                        <TextInput
                                            style={[styles.textArea, {
                                                backgroundColor: colors.background.secondary,
                                                color: colors.text.primary,
                                                borderColor: colors.ui.border
                                            }]}
                                            value={editNotes}
                                            onChangeText={setEditNotes}
                                            placeholder="Add notes..."
                                            placeholderTextColor={colors.text.secondary}
                                            multiline
                                            numberOfLines={4}
                                        />
                                    ) : (
                                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                                            {item.notes || 'No notes'}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {/* Transaction History Section */}
                            <View style={styles.section}>
                                <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                                    Transaction History
                                </Text>

                                {transactions.length === 0 ? (
                                    <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                                        No transaction history available
                                    </Text>
                                ) : (
                                    <View style={styles.timeline}>
                                        {transactions.map((transaction, index) => (
                                            <View key={transaction.$id} style={styles.timelineItem}>
                                                <View style={styles.timelineIconContainer}>
                                                    <Text style={styles.timelineIcon}>
                                                        {getTransactionIcon(transaction.transaction_type)}
                                                    </Text>
                                                    {index < transactions.length - 1 && (
                                                        <View
                                                            style={[styles.timelineLine, { backgroundColor: colors.ui.divider }]}
                                                        />
                                                    )}
                                                </View>

                                                <View style={styles.timelineContent}>
                                                    <Text style={[styles.timelineDate, { color: colors.text.secondary }]}>
                                                        {formatDateTime(transaction.transaction_date)}
                                                    </Text>
                                                    <Text style={[styles.timelineTitle, { color: colors.text.primary }]}>
                                                        {getTransactionLabel(transaction.transaction_type)}
                                                    </Text>
                                                    <Text style={[styles.timelinePerformer, { color: colors.text.secondary }]}>
                                                        By {transaction.performed_by}
                                                    </Text>
                                                    {transaction.notes && (
                                                        <Text style={[styles.timelineNotes, { color: colors.text.secondary }]}>
                                                            {transaction.notes}
                                                        </Text>
                                                    )}
                                                    {transaction.installation_location && (
                                                        <Text style={[styles.timelineLocation, { color: colors.secondary.orange }]}>
                                                            📍 {transaction.installation_location}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    )}

                    {/* Footer */}
                    <View style={[styles.footer, { borderTopColor: colors.ui.border }]}>
                        <TouchableOpacity
                            style={[styles.footerButton, { backgroundColor: colors.background.secondary }]}
                            onPress={onClose}
                        >
                            <Text style={[styles.footerButtonText, { color: colors.text.primary }]}>Close</Text>
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
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '90%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        ...Shadows.lg,
    },
    header: {
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: Spacing.sm,
    },
    title: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        flex: 1,
    },
    adminBadge: {
        marginLeft: Spacing.xs,
    },
    adminBadgeText: {
        fontSize: 20,
    },
    closeButton: {
        padding: Spacing.xs,
    },
    closeButtonText: {
        fontSize: 24,
    },
    categoryText: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.sm,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    editButton: {
        flex: 1,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    deleteButton: {
        flex: 1,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    saveButton: {
        flex: 1,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    cancelButton: {
        flex: 1,
        padding: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: Typography.weights.semibold,
        fontSize: Typography.sizes.sm,
    },
    loadingContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    content: {
        maxHeight: 500,
    },
    section: {
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: Spacing.sm,
        gap: Spacing.md,
    },
    detailLabel: {
        fontSize: Typography.sizes.sm,
        flex: 1,
    },
    detailValue: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
        flex: 2,
        textAlign: 'right',
    },
    detailSubtext: {
        fontSize: Typography.sizes.xs,
        textAlign: 'right',
        marginTop: Spacing.xs / 2,
    },
    input: {
        flex: 2,
        borderWidth: 1,
        borderRadius: BorderRadius.sm,
        padding: Spacing.sm,
        fontSize: Typography.sizes.md,
    },
    inputWithIcon: {
        flex: 2,
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    inputWithButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: BorderRadius.sm,
        padding: Spacing.sm,
        fontSize: Typography.sizes.md,
    },
    scanButton: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanButtonText: {
        fontSize: 20,
    },
    textArea: {
        flex: 2,
        borderWidth: 1,
        borderRadius: BorderRadius.sm,
        padding: Spacing.sm,
        fontSize: Typography.sizes.md,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    picker: {
        flex: 2,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    statusText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    warningBadge: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
    },
    warningText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    emptyText: {
        padding: Spacing.md,
        textAlign: 'center',
        fontSize: Typography.sizes.sm,
    },
    timeline: {
        paddingLeft: Spacing.sm,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: Spacing.md,
    },
    timelineIconContainer: {
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    timelineIcon: {
        fontSize: 24,
        width: 32,
        textAlign: 'center',
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginTop: Spacing.xs,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: Spacing.md,
    },
    timelineDate: {
        fontSize: Typography.sizes.xs,
        marginBottom: Spacing.xs / 2,
    },
    timelineTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    timelinePerformer: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs,
    },
    timelineNotes: {
        fontSize: Typography.sizes.sm,
        fontStyle: 'italic',
        marginTop: Spacing.xs,
    },
    timelineLocation: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    footer: {
        padding: Spacing.md,
        borderTopWidth: 1,
    },
    footerButton: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    footerButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    // Camera Scanner Styles
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'space-between',
        padding: Spacing.xl,
    },
    cameraHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.xl,
    },
    cameraTitle: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    cameraCancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    cameraCancelText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    scanFrame: {
        width: 280,
        height: 200,
        borderWidth: 2,
        borderColor: '#0093B2',
        borderRadius: BorderRadius.md,
        alignSelf: 'center',
        backgroundColor: 'transparent',
    },
    cameraInstructions: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
    },
});