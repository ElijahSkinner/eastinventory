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
import { useRole } from '../hooks/useRole';
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
    category?: string;
}

interface ActiveCheckout {
    $id: string;
    school_id: string;
    checkout_date: string;
    checkout_status: string;
    total_items_needed: number;
    total_items_checked_out: number;
    school?: School;
}

export default function CheckOutScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { isAdmin } = useRole();
    const [permission, requestPermission] = useCameraPermissions();

    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [showSchoolPicker, setShowSchoolPicker] = useState(false);

    const [standardPackage, setStandardPackage] = useState<StandardPackageItem[]>([]);
    const [checkoutProgress, setCheckoutProgress] = useState<CheckoutProgress[]>([]);
    const [currentCheckoutId, setCurrentCheckoutId] = useState<string | null>(null);
    const [activeCheckouts, setActiveCheckouts] = useState<ActiveCheckout[]>([]);

    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [lastScannedItem, setLastScannedItem] = useState<string | null>(null);

    // Cancel checkout modal states
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [checkoutToCancel, setCheckoutToCancel] = useState<ActiveCheckout | null>(null);
    const [cancelStep, setCancelStep] = useState<1 | 2>(1);
    const [canceling, setCanceling] = useState(false);

    const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
    const [scanCooldown, setScanCooldown] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedSchool) {
            loadCheckoutProgress();
            setScanning(true);
        } else {
            setScanning(false);
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

            // Load active checkouts
            const checkoutsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_CHECKOUTS,
                [
                    Query.equal('checkout_status', 'in_progress'),
                    Query.orderDesc('checkout_date'),
                    Query.limit(20)
                ]
            );

            // Load school details for each checkout
            const checkoutsWithSchools = await Promise.all(
                (checkoutsResponse.documents as unknown as ActiveCheckout[]).map(async (checkout) => {
                    try {
                        const school = await databases.getDocument(
                            DATABASE_ID,
                            COLLECTIONS.SCHOOLS,
                            checkout.school_id
                        );
                        return { ...checkout, school: school as unknown as School };
                    } catch (error) {
                        return checkout;
                    }
                })
            );

            setActiveCheckouts(checkoutsWithSchools);

            // Load standard package
            const packageResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.STANDARD_PACKAGE,
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
        if (!selectedSchool) return; // This guard is already there

        try {
            // Find or create checkout session
            const checkoutsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_CHECKOUTS,
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
                    COLLECTIONS.SCHOOL_CHECKOUTS,
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
                        category: pkgItem.itemType?.category,
                        needed: pkgItem.quantity,
                        checked_out: checkedOutResponse.total,
                    };
                })
            );

            progress.sort((a, b) => {
                const aComplete = a.checked_out >= a.needed;
                const bComplete = b.checked_out >= b.needed;
                if (aComplete !== bComplete) return aComplete ? 1 : -1;
                return a.item_name.localeCompare(b.item_name);
            });

            setCheckoutProgress(progress);
        } catch (error) {
            console.error('Error loading checkout progress:', error);
        }
    };


    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        // Add null checks at the beginning
        if (!selectedSchool || !currentCheckoutId) {
            Alert.alert('Error', 'No active checkout session. Please select a school first.');
            return;
        }

        // Prevent rapid scanning
        if (scanCooldown || processing) return;

        // Prevent duplicate scans of same code
        if (lastScannedCode === data) {
            return;
        }

        // Set cooldown
        setScanCooldown(true);
        setLastScannedCode(data);

        // Clear after 2 seconds
        setTimeout(() => {
            setScanCooldown(false);
            setLastScannedCode(null);
        }, 2000);

        setProcessing(true);

        try {
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
                return;
            }

            const item = itemResponse.documents[0] as unknown as InventoryItem;
            const progressItem = checkoutProgress.find(p => p.item_type_id === item.item_type_id);

            if (!progressItem) {
                Alert.alert('Not Needed', 'This item type is not part of the standard school package.');
                setProcessing(false);
                return;
            }

            if (progressItem.checked_out >= progressItem.needed) {
                Alert.alert(
                    'Already Complete',
                    `${progressItem.item_name}: ${progressItem.checked_out}/${progressItem.needed} already checked out.`
                );
                setProcessing(false);
                return;
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                item.$id,
                {
                    status: 'assigned',
                    school_id: selectedSchool.$id,
                    checkout_id: currentCheckoutId, // Now safe because we checked at the start
                }
            );

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

            const checkout = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_CHECKOUTS,
                currentCheckoutId // Now safe
            );

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_CHECKOUTS,
                currentCheckoutId, // Now safe
                {
                    total_items_checked_out: (checkout.total_items_checked_out || 0) + 1,
                }
            );

            setLastScannedItem(progressItem.item_name);
            setTimeout(() => setLastScannedItem(null), 2000);

            await loadCheckoutProgress();

        } catch (error) {
            console.error('Error checking out item:', error);
            Alert.alert('Error', 'Failed to check out item. Please try again.');
        } finally {
            setProcessing(false);
        }
    };


    const handleResumeCheckout = (checkout: ActiveCheckout) => {
        if (checkout.school) {
            setSelectedSchool(checkout.school);
        }
    };

    const handleInitiateCancel = (checkout: ActiveCheckout) => {
        setCheckoutToCancel(checkout);
        setCancelStep(1);
        setShowCancelModal(true);
    };

    const handleCancelCheckout = async () => {
        if (!checkoutToCancel) return;

        setCanceling(true);

        try {
            // 1. Find all items assigned to this checkout
            const assignedItemsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                [
                    Query.equal('checkout_id', checkoutToCancel.$id),
                    Query.limit(1000)
                ]
            );

            const assignedItems = assignedItemsResponse.documents as unknown as InventoryItem[];

            // 2. Un-assign all items (return them to available)
            await Promise.all(
                assignedItems.map(async (item) => {
                    // Update item status back to available
                    await databases.updateDocument(
                        DATABASE_ID,
                        COLLECTIONS.INVENTORY_ITEMS,
                        item.$id,
                        {
                            status: 'available',
                            school_id: null,
                            checkout_id: null,
                        }
                    );

                    // Log the cancellation transaction
                    await databases.createDocument(
                        DATABASE_ID,
                        COLLECTIONS.TRANSACTIONS,
                        ID.unique(),
                        {
                            transaction_type: 'note',
                            inventory_item_id: item.$id,
                            school_id: checkoutToCancel.school_id,
                            performed_by: user?.name || 'Unknown',
                            transaction_date: new Date().toISOString(),
                            notes: `Checkout canceled by ${user?.name}. Item returned to available inventory.`,
                        }
                    );
                })
            );

            // 3. Update checkout status to cancelled
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_CHECKOUTS,
                checkoutToCancel.$id,
                {
                    checkout_status: 'cancelled',
                }
            );

            // 4. Close modal and refresh
            setShowCancelModal(false);
            setCheckoutToCancel(null);
            setCancelStep(1);

            Alert.alert(
                'Checkout Canceled',
                `Successfully canceled checkout for ${checkoutToCancel.school?.school_name}.\n\n${assignedItems.length} items returned to inventory.`
            );

            // Refresh the list
            await loadData();

        } catch (error) {
            console.error('Error canceling checkout:', error);
            Alert.alert('Error', 'Failed to cancel checkout. Please try again.');
        } finally {
            setCanceling(false);
        }
    };

    const getCheckoutProgress = (checkout: ActiveCheckout) => {
        if (checkout.total_items_needed === 0) return 0;
        return Math.round((checkout.total_items_checked_out / checkout.total_items_needed) * 100);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getTotalProgress = () => {
        const totalNeeded = checkoutProgress.reduce((sum, item) => sum + item.needed, 0);
        const totalCheckedOut = checkoutProgress.reduce((sum, item) => sum + item.checked_out, 0);
        return { totalNeeded, totalCheckedOut, percentage: totalNeeded > 0 ? Math.round((totalCheckedOut / totalNeeded) * 100) : 0 };
    };

    const getItemsRemaining = () => {
        return checkoutProgress.filter(item => item.checked_out < item.needed);
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    // No school selected - show active checkouts and new checkout option
    if (!selectedSchool) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ScrollView style={styles.homeContent}>
                    {/* Active Checkouts Section */}
                    {activeCheckouts.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                                In Progress ({activeCheckouts.length})
                            </Text>

                            {activeCheckouts.map((checkout) => {
                                const progress = getCheckoutProgress(checkout);
                                const remaining = checkout.total_items_needed - checkout.total_items_checked_out;

                                return (
                                    <View key={checkout.$id} style={styles.checkoutCardWrapper}>
                                        <TouchableOpacity
                                            style={[styles.checkoutCard, {
                                                backgroundColor: colors.background.primary,
                                                borderLeftColor: progress === 100 ? '#27ae60' : colors.primary.cyan,
                                            }]}
                                            onPress={() => handleResumeCheckout(checkout)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.checkoutCardHeader}>
                                                <View style={styles.checkoutSchoolInfo}>
                                                    <Text style={[styles.checkoutSchoolName, { color: colors.text.primary }]}>
                                                        🏫 {checkout.school?.school_name || 'Unknown School'}
                                                    </Text>
                                                    <Text style={[styles.checkoutTime, { color: colors.text.secondary }]}>
                                                        Started {formatDate(checkout.checkout_date)}
                                                    </Text>
                                                </View>

                                                <View style={[styles.progressCircle, {
                                                    borderColor: progress === 100 ? '#27ae60' : colors.primary.cyan
                                                }]}>
                                                    <Text style={[styles.progressCircleText, {
                                                        color: progress === 100 ? '#27ae60' : colors.primary.cyan
                                                    }]}>
                                                        {progress}%
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.checkoutProgress}>
                                                <View style={[styles.progressBarBg, { backgroundColor: colors.ui.border }]}>
                                                    <View
                                                        style={[
                                                            styles.progressBarFillHome,
                                                            {
                                                                width: `${progress}%`,
                                                                backgroundColor: progress === 100 ? '#27ae60' : colors.primary.cyan,
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                                <Text style={[styles.checkoutStats, { color: colors.text.secondary }]}>
                                                    {checkout.total_items_checked_out} of {checkout.total_items_needed} items
                                                    {remaining > 0 && ` • ${remaining} remaining`}
                                                </Text>
                                            </View>

                                            <View style={styles.checkoutAction}>
                                                <Text style={[styles.resumeText, { color: colors.primary.cyan }]}>
                                                    {progress === 100 ? 'Review & Complete' : 'Resume Scanning'}
                                                </Text>
                                                <Text style={[styles.arrow, { color: colors.primary.cyan }]}>›</Text>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Admin Cancel Button */}
                                        {isAdmin && (
                                            <TouchableOpacity
                                                style={[styles.cancelButton, { backgroundColor: colors.secondary.red }]}
                                                onPress={() => handleInitiateCancel(checkout)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.cancelButtonText}>✕</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* New Checkout Button */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            Start New Checkout
                        </Text>

                        <TouchableOpacity
                            style={[styles.newCheckoutCard, {
                                backgroundColor: colors.background.primary,
                                borderColor: colors.ui.border,
                            }]}
                            onPress={() => setShowSchoolPicker(true)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.newCheckoutIcon, { backgroundColor: `${colors.primary.cyan}20` }]}>
                                <Text style={styles.newCheckoutEmoji}>🏫</Text>
                            </View>
                            <View style={styles.newCheckoutInfo}>
                                <Text style={[styles.newCheckoutTitle, { color: colors.text.primary }]}>
                                    Select School
                                </Text>
                                <Text style={[styles.newCheckoutSubtitle, { color: colors.text.secondary }]}>
                                    Choose which school to check out items for
                                </Text>
                            </View>
                            <Text style={[styles.arrow, { color: colors.primary.cyan }]}>›</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* Cancel Checkout Modal */}
                <Modal visible={showCancelModal} transparent animationType="fade">
                    <Pressable
                        style={styles.cancelModalOverlay}
                        onPress={() => {
                            if (!canceling) {
                                setShowCancelModal(false);
                                setCheckoutToCancel(null);
                                setCancelStep(1);
                            }
                        }}
                    >
                        <Pressable
                            style={[styles.cancelModalContainer, { backgroundColor: colors.background.primary }]}
                            onPress={(e) => e.stopPropagation()}
                        >
                            {cancelStep === 1 ? (
                                // Step 1: Initial Warning
                                <>
                                    <View style={styles.cancelModalHeader}>
                                        <View style={[styles.warningIconContainer, { backgroundColor: `${colors.secondary.red}20` }]}>
                                            <Text style={styles.warningIcon}>⚠️</Text>
                                        </View>
                                        <Text style={[styles.cancelModalTitle, { color: colors.primary.coolGray }]}>
                                            Cancel Checkout?
                                        </Text>
                                        <Text style={[styles.cancelModalSubtitle, { color: colors.text.secondary }]}>
                                            {checkoutToCancel?.school?.school_name}
                                        </Text>
                                    </View>

                                    <View style={styles.cancelModalContent}>
                                        <View style={[styles.warningBox, { backgroundColor: `${colors.secondary.orange}15`, borderColor: colors.secondary.orange }]}>
                                            <Text style={[styles.warningBoxText, { color: colors.text.primary }]}>
                                                This will return <Text style={{ fontWeight: Typography.weights.bold }}>
                                                {checkoutToCancel?.total_items_checked_out || 0} items</Text> back to available inventory.
                                            </Text>
                                        </View>

                                        <View style={styles.detailsList}>
                                            <View style={styles.detailItem}>
                                                <Text style={styles.detailIcon}>📦</Text>
                                                <Text style={[styles.detailText, { color: colors.text.secondary }]}>
                                                    {checkoutToCancel?.total_items_checked_out || 0} of {checkoutToCancel?.total_items_needed || 0} items checked out
                                                </Text>
                                            </View>
                                            <View style={styles.detailItem}>
                                                <Text style={styles.detailIcon}>⏱️</Text>
                                                <Text style={[styles.detailText, { color: colors.text.secondary }]}>
                                                    Started {checkoutToCancel && formatDate(checkoutToCancel.checkout_date)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.cancelModalActions}>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.modalButtonSecondary, {
                                                backgroundColor: colors.background.secondary,
                                                borderColor: colors.ui.border
                                            }]}
                                            onPress={() => {
                                                setShowCancelModal(false);
                                                setCheckoutToCancel(null);
                                                setCancelStep(1);
                                            }}
                                        >
                                            <Text style={[styles.modalButtonText, { color: colors.text.primary }]}>
                                                Keep Checkout
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.modalButtonPrimary, {
                                                backgroundColor: colors.secondary.red
                                            }]}
                                            onPress={() => setCancelStep(2)}
                                        >
                                            <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                                                Continue
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                // Step 2: Final Confirmation
                                <>
                                    <View style={styles.cancelModalHeader}>
                                        <View style={[styles.warningIconContainer, { backgroundColor: `${colors.secondary.red}30` }]}>
                                            <Text style={styles.warningIconLarge}>🛑</Text>
                                        </View>
                                        <Text style={[styles.cancelModalTitle, { color: colors.secondary.red }]}>
                                            Are You Sure?
                                        </Text>
                                        <Text style={[styles.cancelModalSubtitle, { color: colors.text.secondary }]}>
                                            This action cannot be undone
                                        </Text>
                                    </View>

                                    <View style={styles.cancelModalContent}>
                                        <View style={[styles.dangerBox, { backgroundColor: `${colors.secondary.red}15`, borderColor: colors.secondary.red }]}>
                                            <Text style={[styles.dangerBoxTitle, { color: colors.secondary.red }]}>
                                                ⚠️ Final Warning
                                            </Text>
                                            <Text style={[styles.dangerBoxText, { color: colors.text.primary }]}>
                                                Canceling this checkout will:
                                            </Text>
                                            <View style={styles.consequencesList}>
                                                <Text style={[styles.consequenceItem, { color: colors.text.primary }]}>
                                                    • Remove checkout from active list
                                                </Text>
                                                <Text style={[styles.consequenceItem, { color: colors.text.primary }]}>
                                                    • Return all {checkoutToCancel?.total_items_checked_out || 0} items to inventory
                                                </Text>
                                                <Text style={[styles.consequenceItem, { color: colors.text.primary }]}>
                                                    • Clear school assignment
                                                </Text>
                                                <Text style={[styles.consequenceItem, { color: colors.text.primary }]}>
                                                    • Log cancellation in transaction history
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.cancelModalActions}>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.modalButtonSecondary, {
                                                backgroundColor: colors.background.secondary,
                                                borderColor: colors.ui.border
                                            }]}
                                            onPress={() => setCancelStep(1)}
                                            disabled={canceling}
                                        >
                                            <Text style={[styles.modalButtonText, { color: colors.text.primary }]}>
                                                Go Back
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.modalButtonDanger, {
                                                backgroundColor: colors.secondary.red
                                            }]}
                                            onPress={handleCancelCheckout}
                                            disabled={canceling}
                                        >
                                            {canceling ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text style={[styles.modalButtonText, { color: '#fff', fontWeight: Typography.weights.bold }]}>
                                                    Yes, Cancel Checkout
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </Pressable>
                    </Pressable>
                </Modal>

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
                                        style={[styles.schoolOption, { borderBottomColor: colors.ui.divider }]}
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

    const progress = getTotalProgress();
    const itemsRemaining = getItemsRemaining();

    // Split screen: Camera on top, list on bottom
    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            {/* Camera View - Top Half */}
            <View style={styles.cameraSection}>
                {scanning ? (
                    <CameraView
                        style={styles.camera}
                        facing="back"
                        onBarcodeScanned={handleBarcodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
                        }}
                    >
                        <View style={styles.cameraOverlay}>
                            {/* School Header */}
                            {selectedSchool && ( // Add this null check
                                <View style={[styles.schoolHeader, { backgroundColor: 'rgba(0, 147, 178, 0.95)' }]}>
                                    <View style={styles.schoolHeaderContent}>
                                        <Text style={styles.schoolHeaderText}>
                                            🏫 {selectedSchool.school_name}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.changeSchoolButton}
                                            onPress={() => {
                                                setSelectedSchool(null);
                                                setScanning(false);
                                            }}
                                        >
                                            <Text style={styles.changeSchoolText}>Change</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Progress Bar */}
                                    <View style={styles.progressBarContainer}>
                                        <View style={styles.progressBarBg}>
                                            <View
                                                style={[
                                                    styles.progressBarFill,
                                                    {
                                                        width: `${progress.percentage}%`,
                                                        backgroundColor: progress.percentage === 100 ? '#27ae60' : '#fff',
                                                    },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.progressText}>
                                            {progress.totalCheckedOut} / {progress.totalNeeded} ({progress.percentage}%)
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Scan Frame */}
                            <View style={[styles.scanFrame, { borderColor: colors.primary.cyan }]} />

                            {/* Last Scanned Item Feedback */}
                            {lastScannedItem && (
                                <View style={styles.scanFeedback}>
                                    <Text style={styles.scanFeedbackText}>✓ {lastScannedItem}</Text>
                                </View>
                            )}

                            {/* Processing Indicator */}
                            {processing && (
                                <View style={styles.processingOverlay}>
                                    <ActivityIndicator size="large" color="#fff" />
                                    <Text style={styles.processingText}>Processing...</Text>
                                </View>
                            )}
                        </View>
                    </CameraView>
                ) : (
                    <View style={[styles.cameraPlaceholder, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.placeholderText, { color: colors.text.secondary }]}>
                            Camera paused
                        </Text>
                    </View>
                )}
            </View>

            {/* Items List - Bottom Half */}
            <View style={[styles.listSection, { backgroundColor: colors.background.primary }]}>
                <View style={[styles.listHeader, { borderBottomColor: colors.ui.border }]}>
                    <Text style={[styles.listTitle, { color: colors.primary.coolGray }]}>
                        Items Needed ({itemsRemaining.length})
                    </Text>
                </View>

                <ScrollView style={styles.itemsList}>
                    {itemsRemaining.length === 0 ? (
                        <View style={styles.completeState}>
                            <Text style={styles.completeIcon}>✅</Text>
                            <Text style={[styles.completeText, { color: colors.primary.coolGray }]}>
                                All items checked out!
                            </Text>
                            <TouchableOpacity
                                style={[styles.doneButton, { backgroundColor: '#27ae60' }]}
                                onPress={() => {
                                    setSelectedSchool(null);
                                    setScanning(false);
                                    loadData(); // Refresh the list
                                }}
                            >
                                <Text style={styles.doneButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        itemsRemaining.map((item) => {
                            const remaining = item.needed - item.checked_out;

                            return (
                                <View
                                    key={item.item_type_id}
                                    style={[styles.itemRow, { borderBottomColor: colors.ui.divider }]}
                                >
                                    <View style={styles.itemInfo}>
                                        <Text style={[styles.itemName, { color: colors.text.primary }]}>
                                            {item.item_name}
                                        </Text>
                                        {item.category && (
                                            <Text style={[styles.itemCategory, { color: colors.text.secondary }]}>
                                                {item.category}
                                            </Text>
                                        )}
                                    </View>

                                    <View style={styles.itemCount}>
                                        <Text style={[styles.countBadge, {
                                            backgroundColor: `${colors.secondary.orange}20`,
                                            color: colors.secondary.orange
                                        }]}>
                                            {remaining} needed
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    // Home Screen Styles
    homeContent: {
        flex: 1,
    },
    section: {
        padding: Spacing.lg,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    checkoutCardWrapper: {
        position: 'relative',
        marginBottom: Spacing.md,
    },
    checkoutCard: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderLeftWidth: 4,
        ...Shadows.md,
    },
    cancelButton: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.md,
        zIndex: 10,
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: Typography.weights.bold,
        lineHeight: 18,
    },
    checkoutCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    checkoutSchoolInfo: {
        flex: 1,
        paddingRight: Spacing.xl,
    },
    checkoutSchoolName: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
    },
    checkoutTime: {
        fontSize: Typography.sizes.sm,
    },
    progressCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.md,
    },
    progressCircleText: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    checkoutProgress: {
        marginBottom: Spacing.md,
    },
    checkoutStats: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    checkoutAction: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    resumeText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    arrow: {
        fontSize: 24,
    },
    newCheckoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    newCheckoutIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    newCheckoutEmoji: {
        fontSize: 32,
    },
    newCheckoutInfo: {
        flex: 1,
    },
    newCheckoutTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    newCheckoutSubtitle: {
        fontSize: Typography.sizes.sm,
    },
    // Cancel Modal Styles
    cancelModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    cancelModalContainer: {
        width: '100%',
        maxWidth: 450,
        borderRadius: BorderRadius.xl,
        ...Shadows.lg,
        overflow: 'hidden',
    },
    cancelModalHeader: {
        alignItems: 'center',
        padding: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    warningIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    warningIcon: {
        fontSize: 40,
    },
    warningIconLarge: {
        fontSize: 48,
    },
    cancelModalTitle: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    cancelModalSubtitle: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
    },
    cancelModalContent: {
        padding: Spacing.lg,
    },
    warningBox: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        marginBottom: Spacing.lg,
    },
    warningBoxText: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
        lineHeight: Typography.sizes.md * 1.5,
    },
    dangerBox: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
    },
    dangerBoxTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.sm,
    },
    dangerBoxText: {
        fontSize: Typography.sizes.md,
        marginBottom: Spacing.md,
    },
    detailsList: {
        gap: Spacing.sm,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    detailIcon: {
        fontSize: 20,
    },
    detailText: {
        fontSize: Typography.sizes.sm,
        flex: 1,
    },
    consequencesList: {
        marginTop: Spacing.sm,
        gap: Spacing.xs,
    },
    consequenceItem: {
        fontSize: Typography.sizes.sm,
        lineHeight: Typography.sizes.sm * 1.6,
    },
    cancelModalActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    modalButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    modalButtonSecondary: {
        borderWidth: 2,
    },
    modalButtonPrimary: {
        ...Shadows.sm,
    },
    modalButtonDanger: {
        ...Shadows.md,
    },
    modalButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    // Split Screen Layout
    cameraSection: {
        flex: 1,
        backgroundColor: '#000',
    },
    listSection: {
        flex: 1,
    },
    // Camera Styles
    camera: {
        flex: 1,
    },
    cameraPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: Typography.sizes.md,
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: 'space-between',
    },
    schoolHeader: {
        padding: Spacing.md,
    },
    schoolHeaderContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    schoolHeaderText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    changeSchoolButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    changeSchoolText: {
        color: '#fff',
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    progressBarContainer: {
        marginTop: Spacing.xs,
    },
    progressBarBg: {
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: BorderRadius.sm,
        overflow: 'hidden',
        marginBottom: Spacing.xs,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    progressBarFillHome: {
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    progressText: {
        color: '#fff',
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        textAlign: 'center',
    },
    scanFrame: {
        width: 280,
        height: 180,
        borderWidth: 3,
        borderRadius: BorderRadius.md,
        alignSelf: 'center',
        backgroundColor: 'transparent',
    },
    scanFeedback: {
        backgroundColor: 'rgba(39, 174, 96, 0.95)',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignSelf: 'center',
        marginBottom: Spacing.xl,
    },
    scanFeedbackText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    processingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        marginTop: Spacing.md,
    },
    // List Styles
    listHeader: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    listTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    itemsList: {
        flex: 1,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    itemCategory: {
        fontSize: Typography.sizes.sm,
    },
    itemCount: {
        marginLeft: Spacing.md,
    },
    countBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
    },
    completeState: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    completeIcon: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    completeText: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.lg,
    },
    doneButton: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    doneButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    // School Picker Modal Styles
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