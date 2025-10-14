// src/screens/CheckOutScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { databases, DATABASE_ID, COLLECTIONS, School, InventoryItem, ItemType } from '../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';

interface StandardPackageItem {
    $id: string;
    item_type_id: string;
    quantity: number;
    notes?: string;
    itemType?: ItemType;
}

interface CheckoutProgress {
    item_type_id: string;
    item_name: string;
    needed: number;
    checked_out: number;
}

export default function CheckOutScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [permission, requestPermission] = useCameraPermissions();

    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [showSchoolPicker, setShowSchoolPicker] = useState(false);

    const [standardPackage, setStandardPackage] = useState<StandardPackageItem[]>([]);
    const [checkoutProgress, setCheckoutProgress] = useState<CheckoutProgress[]>([]);
    const [currentCheckoutId, setCurrentCheckoutId] = useState<string | null>(null);

    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            loadCheckoutProgress();
        }
    }, [selectedSchool]);

    const loadData = async () => {
        try {
            // Load schools
            const schoolsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOLS,
                [Query.equal('active', true), Query.limit(100)]
            );
            setSchools(schoolsResponse.documents as unknown as School[]);

            // Load standard package
            const packageResponse = await databases.listDocuments(
                DATABASE_ID,
                'standard_package',
                [Query.limit(100)]
            );

            const packageWithTypes = await Promise.all(
                (packageResponse.documents as unknown as StandardPackageItem[]).map(async (item) => {
                    try {
                        const itemType = await databases.getDocument(
                            DATABASE_ID,
                            COLLECTIONS.ITEM_TYPES,
                            item.item_type_id
                        );
                        return { ...item, itemType: itemType as unknown as ItemType };
                    } catch (error) {
                        return item;
                    }
                })
            );

            setStandardPackage(packageWithTypes);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCheckoutProgress = async () => {
        if (!selectedSchool) return;

        try {
            // Find or create checkout session
            const checkoutsResponse = await databases.listDocuments(
                DATABASE_ID,
                'school_checkouts',
                [
                    Query.equal('school_id', selectedSchool.$id),
                    Query.equal('checkout_status', 'in_progress'),
                    Query.limit(1)
                ]
            );

            let checkoutId: string;

            if (checkoutsResponse.documents.length > 0) {
                checkoutId = checkoutsResponse.documents[0].$id;
            } else {
                // Create new checkout session
                const totalNeeded = standardPackage.reduce((sum, item) => sum + item.quantity, 0);
                const newCheckout = await databases.createDocument(
                    DATABASE_ID,
                    'school_checkouts',
                    ID.unique(),
                    {
                        school_id: selectedSchool.$id,
                        checkout_date: new Date().toISOString(),
                        checkout_status: 'in_progress',
                        checked_out_by: user?.name || 'Unknown',
                        total_items_needed: totalNeeded,
                        total_items_checked_out: 0,
                    }
                );
                checkoutId = newCheckout.$id;
            }

            setCurrentCheckoutId(checkoutId);

            // Calculate progress for each item type
            const progress: CheckoutProgress[] = await Promise.all(
                standardPackage.map(async (pkgItem) => {
                    // Count how many of this type have been checked out
                    const checkedOutResponse = await databases.listDocuments(
                        DATABASE_ID,
                        COLLECTIONS.INVENTORY_ITEMS,
                        [
                            Query.equal('item_type_id', pkgItem.item_type_id),
                            Query.equal('checkout_id', checkoutId),
                            Query.limit(1000)
                        ]
                    );

                    return {
                        item_type_id: pkgItem.item_type_id,
                        item_name: pkgItem.itemType?.item_name || 'Unknown',
                        needed: pkgItem.quantity,
                        checked_out: checkedOutResponse.total,
                    };
                })
            );

            setCheckoutProgress(progress);
        } catch (error) {
            console.error('Error loading checkout progress:', error);
        }
    };

    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        if (processing || !scanning || !selectedSchool || !currentCheckoutId) return;

        setScanning(false);
        setProcessing(true);

        try {
            // Find inventory item by barcode
            const itemResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                [
                    Query.equal('barcode', data),
                    Query.equal('status', 'available'),
                    Query.limit(1)
                ]
            );

            if (itemResponse.documents.length === 0) {
                Alert.alert('Item Not Found', 'No available item found with this barcode.');
                setProcessing(false);
                setScanning(true);
                return;
            }

            const item = itemResponse.documents[0] as unknown as InventoryItem;

            // Check if this item type is needed
            const progressItem = checkoutProgress.find(p => p.item_type_id === item.item_type_id);

            if (!progressItem) {
                Alert.alert('Not Needed', 'This item type is not part of the standard school package.');
                setProcessing(false);
                setScanning(true);
                return;
            }

            if (progressItem.checked_out >= progressItem.needed) {
                Alert.alert(
                    'Already Complete',
                    `${progressItem.item_name}: ${progressItem.checked_out}/${progressItem.needed} already checked out.`
                );
                setProcessing(false);
                setScanning(true);
                return;
            }

            // Check out the item
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                item.$id,
                {
                    status: 'assigned',
                    school_id: selectedSchool.$id,
                    checkout_id: currentCheckoutId,
                }
            );

            // Log transaction
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.TRANSACTIONS,
                ID.unique(),
                {
                    transaction_type: 'assigned',
                    inventory_item_id: item.$id,
                    school_id: selectedSchool.$id,
                    performed_by: user?.name || 'Unknown',
                    transaction_date: new Date().toISOString(),
                    notes: `Checked out to ${selectedSchool.school_name}`,
                }
            );

            // Update checkout totals
            const checkout = await databases.getDocument(DATABASE_ID, 'school_checkouts', currentCheckoutId);
            await databases.updateDocument(
                DATABASE_ID,
                'school_checkouts',
                currentCheckoutId,
                {
                    total_items_checked_out: (checkout.total_items_checked_out || 0) + 1,
                }
            );

            Alert.alert('Success!', `${progressItem.item_name} checked out successfully!`);

            // Reload progress
            await loadCheckoutProgress();

        } catch (error) {
            console.error('Error checking out item:', error);
            Alert.alert('Error', 'Failed to check out item. Please try again.');
        } finally {
            setProcessing(false);
            setScanning(true);
        }
    };

    const handleStartScanning = async () => {
        if (!selectedSchool) {
            Alert.alert('Select School', 'Please select a school first.');
            return;
        }

        if (!permission?.granted) {
            const { status } = await requestPermission();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera permission is required to scan barcodes.');
                return;
            }
        }

        setScanning(true);
    };

    const getTotalProgress = () => {
        const totalNeeded = checkoutProgress.reduce((sum, item) => sum + item.needed, 0);
        const totalCheckedOut = checkoutProgress.reduce((sum, item) => sum + item.checked_out, 0);
        return { totalNeeded, totalCheckedOut, percentage: totalNeeded > 0 ? Math.round((totalCheckedOut / totalNeeded) * 100) : 0 };
    };

    const getItemProgress = (item: CheckoutProgress) => {
        return item.needed > 0 ? Math.round((item.checked_out / item.needed) * 100) : 0;
    };

    // Camera Scanner
    if (scanning) {
        return (
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
                            <Text style={styles.cameraTitle}>Scan Item Barcode</Text>
                            <TouchableOpacity
                                style={styles.cameraCancelButton}
                                onPress={() => setScanning(false)}
                            >
                                <Text style={styles.cameraCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedSchool && (
                            <View style={styles.schoolBanner}>
                                <Text style={styles.schoolBannerText}>
                                    🏫 {selectedSchool.school_name}
                                </Text>
                            </View>
                        )}

                        <View style={[styles.scanFrame, { borderColor: colors.primary.cyan }]} />
                        <Text style={styles.cameraInstructions}>
                            Position the barcode within the frame
                        </Text>
                    </View>
                </CameraView>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    const progress = getTotalProgress();

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            <ScrollView style={styles.content}>
                {/* School Selection */}
                <View style={[styles.card, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Select School
                    </Text>

                    <TouchableOpacity
                        style={[styles.schoolSelector, { backgroundColor: colors.background.secondary, borderColor: colors.ui.border }]}
                        onPress={() => setShowSchoolPicker(true)}
                    >
                        <Text style={[styles.schoolSelectorText, { color: selectedSchool ? colors.text.primary : colors.text.secondary }]}>
                            {selectedSchool ? `🏫 ${selectedSchool.school_name}` : 'Tap to select school...'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Progress Overview */}
                {selectedSchool && checkoutProgress.length > 0 && (
                    <View style={[styles.card, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            Checkout Progress
                        </Text>

                        <View style={styles.progressOverview}>
                            <Text style={[styles.progressText, { color: colors.text.primary }]}>
                                {progress.totalCheckedOut} of {progress.totalNeeded} items ({progress.percentage}%)
                            </Text>
                            <View style={[styles.progressBar, { backgroundColor: colors.ui.border }]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${progress.percentage}%`,
                                            backgroundColor: progress.percentage === 100 ? '#27ae60' : colors.primary.cyan,
                                        },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* Item List */}
                        {checkoutProgress.map((item) => {
                            const itemProgress = getItemProgress(item);
                            const isComplete = item.checked_out >= item.needed;

                            return (
                                <View key={item.item_type_id} style={[styles.itemRow, { borderBottomColor: colors.ui.divider }]}>
                                    <View style={styles.itemInfo}>
                                        <Text style={[styles.itemName, { color: colors.text.primary }]}>
                                            {isComplete ? '✓ ' : ''}{item.item_name}
                                        </Text>
                                        <Text style={[styles.itemCount, { color: isComplete ? '#27ae60' : colors.text.secondary }]}>
                                            {item.checked_out} / {item.needed}
                                        </Text>
                                    </View>
                                    <View style={[styles.miniProgressBar, { backgroundColor: colors.ui.border }]}>
                                        <View
                                            style={[
                                                styles.miniProgressFill,
                                                {
                                                    width: `${itemProgress}%`,
                                                    backgroundColor: isComplete ? '#27ae60' : colors.primary.cyan,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Scan Button */}
                {selectedSchool && (
                    <TouchableOpacity
                        style={[styles.scanButton, { backgroundColor: colors.primary.cyan }]}
                        onPress={handleStartScanning}
                        disabled={processing}
                    >
                        <Text style={styles.scanButtonText}>
                            📷 Start Scanning Items
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* School Picker Modal */}
            <Modal visible={showSchoolPicker} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowSchoolPicker(false)}>
                    <Pressable
                        style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.modalHeader, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.primary.coolGray }]}>
                                Select School
                            </Text>
                            <TouchableOpacity onPress={() => setShowSchoolPicker(false)}>
                                <Text style={[styles.closeButton, { color: colors.text.secondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            {schools.map((school) => (
                                <TouchableOpacity
                                    key={school.$id}
                                    style={[
                                        styles.schoolOption,
                                        {
                                            backgroundColor: selectedSchool?.$id === school.$id ? `${colors.primary.cyan}20` : 'transparent',
                                            borderBottomColor: colors.ui.divider,
                                        },
                                    ]}
                                    onPress={() => {
                                        setSelectedSchool(school);
                                        setShowSchoolPicker(false);
                                    }}
                                >
                                    <Text style={[styles.schoolName, { color: colors.text.primary }]}>
                                        {school.school_name}
                                    </Text>
                                    <Text style={[styles.schoolCode, { color: colors.text.secondary }]}>
                                        Code: {school.school_code}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    card: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    schoolSelector: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    schoolSelectorText: {
        fontSize: Typography.sizes.md,
    },
    progressOverview: {
        marginBottom: Spacing.md,
    },
    progressText: {
        fontSize: Typography.sizes.md,
        marginBottom: Spacing.sm,
        fontWeight: Typography.weights.semibold,
    },
    progressBar: {
        height: 12,
        borderRadius: BorderRadius.sm,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    itemRow: {
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    itemInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    itemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
    },
    itemCount: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    miniProgressBar: {
        height: 6,
        borderRadius: BorderRadius.sm,
        overflow: 'hidden',
    },
    miniProgressFill: {
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    scanButton: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.md,
    },
    scanButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    // Camera styles
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
    schoolBanner: {
        backgroundColor: 'rgba(0, 147, 178, 0.9)',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignSelf: 'center',
    },
    schoolBannerText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    scanFrame: {
        width: 280,
        height: 200,
        borderWidth: 3,
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
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '70%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        ...Shadows.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
    },
    closeButton: {
        fontSize: 24,
    },
    modalContent: {
        maxHeight: 400,
    },
    schoolOption: {
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    schoolName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    schoolCode: {
        fontSize: Typography.sizes.sm,
    },
});