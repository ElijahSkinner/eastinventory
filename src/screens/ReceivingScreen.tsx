// src/screens/ReceivingScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    ScrollView,
    Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    POLineItem,
    ItemType,
    PurchaseOrder,
} from '../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';

interface ReceivingSession {
    sku: string;
    poLineItem: POLineItem;
    itemType: ItemType;
    purchaseOrder: PurchaseOrder;
    quantityToReceive: number;
    location: string;
}

export default function ReceivingScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [permission, requestPermission] = useCameraPermissions();

    const [scanning, setScanning] = useState(false);
    const [manualSKU, setManualSKU] = useState('');
    const [processing, setProcessing] = useState(false);
    const [receivingSession, setReceivingSession] = useState<ReceivingSession | null>(null);
    const [quantityInput, setQuantityInput] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [recentReceipts, setRecentReceipts] = useState<Array<{ sku: string; quantity: number; itemName: string }>>([]);

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    const handleSKUScan = async (sku: string) => {
        setScanning(false);
        setProcessing(true);

        try {
            // Find PO line item with this SKU
            const lineItemsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.PO_LINE_ITEMS,
                [Query.equal('sku', sku), Query.limit(1)]
            );

            if (lineItemsResponse.documents.length === 0) {
                Alert.alert(
                    'SKU Not Found',
                    `No purchase order found for SKU: ${sku}\n\nThis SKU may not be in any active purchase orders.`
                );
                setProcessing(false);
                return;
            }

            const poLineItem = lineItemsResponse.documents[0] as unknown as POLineItem;

            // Check if already fully received
            if (poLineItem.quantity_received >= poLineItem.quantity_ordered) {
                Alert.alert(
                    'Already Complete',
                    `This line item has already been fully received (${poLineItem.quantity_received} of ${poLineItem.quantity_ordered}).`
                );
                setProcessing(false);
                return;
            }

            // Load item type
            const itemType = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.ITEM_TYPES,
                poLineItem.item_type_id
            );

            // Load purchase order
            const purchaseOrder = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.PURCHASE_ORDERS,
                poLineItem.purchase_order_id
            );

            // Create receiving session
            setReceivingSession({
                sku,
                poLineItem: poLineItem as POLineItem,
                itemType: itemType as unknown as ItemType,
                purchaseOrder: purchaseOrder as unknown as PurchaseOrder,
                quantityToReceive: 0,
                location: '',
            });

            // Pre-fill with remaining quantity
            const remaining = poLineItem.quantity_ordered - poLineItem.quantity_received;
            setQuantityInput(remaining.toString());
            setLocationInput('');

        } catch (error) {
            console.error('Error processing SKU:', error);
            Alert.alert('Error', 'Failed to process SKU. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (!scanning) return;
        handleSKUScan(data);
    };

    const handleManualSKUSubmit = () => {
        if (!manualSKU.trim()) {
            Alert.alert('Error', 'Please enter a SKU');
            return;
        }
        handleSKUScan(manualSKU.trim());
        setManualSKU('');
    };

    const handleReceiveItems = async () => {
        if (!receivingSession) return;

        const quantity = parseInt(quantityInput);

        if (isNaN(quantity) || quantity <= 0) {
            Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0');
            return;
        }

        const remaining = receivingSession.poLineItem.quantity_ordered - receivingSession.poLineItem.quantity_received;

        if (quantity > remaining) {
            Alert.alert(
                'Over Receiving',
                `You are trying to receive ${quantity} items, but only ${remaining} remain on this PO.\n\nDo you want to receive all ${remaining} items instead?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: `Receive ${remaining}`, onPress: () => processReceiving(remaining) },
                ]
            );
            return;
        }

        processReceiving(quantity);
    };

    const processReceiving = async (quantity: number) => {
        if (!receivingSession) return;

        setProcessing(true);

        try {
            // Create individual inventory items
            const createdItems = [];
            for (let i = 0; i < quantity; i++) {
                const newItem = await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.INVENTORY_ITEMS,
                    ID.unique(),
                    {
                        barcode: receivingSession.sku, // Use SKU as barcode for now
                        item_type_id: receivingSession.itemType.$id,
                        status: 'available',
                        location: locationInput || undefined,
                        is_school_specific: false,
                        received_date: new Date().toISOString(),
                    }
                );

                // Log transaction for each item
                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.TRANSACTIONS,
                    ID.unique(),
                    {
                        transaction_type: 'received',
                        inventory_item_id: newItem.$id,
                        performed_by: user?.name || 'Unknown',
                        transaction_date: new Date().toISOString(),
                        notes: `Received via PO ${receivingSession.purchaseOrder.po_number} (SKU: ${receivingSession.sku})`,
                    }
                );

                createdItems.push(newItem);
            }

            // Update PO line item quantity received
            const newQuantityReceived = receivingSession.poLineItem.quantity_received + quantity;
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.PO_LINE_ITEMS,
                receivingSession.poLineItem.$id,
                {
                    quantity_received: newQuantityReceived,
                }
            );

            // ===== FIX: Update PO totals based on LINE ITEMS, not inventory items =====
            const allLineItems = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.PO_LINE_ITEMS,
                [Query.equal('purchase_order_id', receivingSession.purchaseOrder.$id)]
            );

            // Calculate totals from LINE ITEMS
            let totalOrdered = 0;
            let totalReceived = 0;

            for (const lineItem of allLineItems.documents) {
                const item = lineItem as any;
                totalOrdered += item.quantity_ordered;
                totalReceived += item.quantity_received;
            }

            // Determine new PO status
            let newPOStatus: 'ordered' | 'partially_received' | 'fully_received' = 'ordered';
            if (totalReceived >= totalOrdered) {
                newPOStatus = 'fully_received';
            } else if (totalReceived > 0) {
                newPOStatus = 'partially_received';
            }

            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.PURCHASE_ORDERS,
                receivingSession.purchaseOrder.$id,
                {
                    received_items: totalReceived,
                    total_items: totalOrdered,
                    order_status: newPOStatus,
                }
            );

            // Add to recent receipts
            setRecentReceipts(prev => [
                {
                    sku: receivingSession.sku,
                    quantity,
                    itemName: receivingSession.itemType.item_name,
                },
                ...prev.slice(0, 4), // Keep last 5
            ]);

            Alert.alert(
                'Success!',
                `${quantity} ${receivingSession.itemType.item_name}(s) received successfully!`
            );

            // Reset session
            setReceivingSession(null);
            setQuantityInput('');
            setLocationInput('');

        } catch (error) {
            console.error('Error receiving items:', error);
            Alert.alert('Error', 'Failed to receive items. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const handleCancelReceiving = () => {
        setReceivingSession(null);
        setQuantityInput('');
        setLocationInput('');
    };

    // Camera Scanner View
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
                            <Text style={styles.cameraTitle}>Scan SKU Barcode</Text>
                            <TouchableOpacity
                                style={styles.cameraCancelButton}
                                onPress={() => setScanning(false)}
                            >
                                <Text style={styles.cameraCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.scanFrame, { borderColor: colors.primary.cyan }]} />
                        <Text style={styles.cameraInstructions}>
                            Position the SKU barcode within the frame
                        </Text>
                    </View>
                </CameraView>
            </View>
        );
    }

    // Receiving Session View
    if (receivingSession) {
        const remaining = receivingSession.poLineItem.quantity_ordered - receivingSession.poLineItem.quantity_received;

        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ScrollView style={styles.sessionContainer}>
                    {/* Success Header */}
                    <View style={[styles.successHeader, { backgroundColor: colors.primary.cyan }]}>
                        <Text style={styles.successIcon}>✓</Text>
                        <Text style={styles.successText}>SKU Found: {receivingSession.sku}</Text>
                    </View>

                    {/* Item Details */}
                    <View style={[styles.detailsCard, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.itemName, { color: colors.primary.coolGray }]}>
                            {receivingSession.itemType.item_name}
                        </Text>
                        <Text style={[styles.poInfo, { color: colors.text.secondary }]}>
                            {receivingSession.purchaseOrder.po_number} • {receivingSession.purchaseOrder.vendor}
                        </Text>

                        <View style={styles.quantityGrid}>
                            <View style={styles.quantityBox}>
                                <Text style={[styles.quantityLabel, { color: colors.text.secondary }]}>
                                    Expected
                                </Text>
                                <Text style={[styles.quantityValue, { color: colors.text.primary }]}>
                                    {receivingSession.poLineItem.quantity_ordered}
                                </Text>
                            </View>

                            <View style={styles.quantityBox}>
                                <Text style={[styles.quantityLabel, { color: colors.text.secondary }]}>
                                    Received
                                </Text>
                                <Text style={[styles.quantityValue, { color: colors.secondary.orange }]}>
                                    {receivingSession.poLineItem.quantity_received}
                                </Text>
                            </View>

                            <View style={styles.quantityBox}>
                                <Text style={[styles.quantityLabel, { color: colors.text.secondary }]}>
                                    Remaining
                                </Text>
                                <Text style={[styles.quantityValue, { color: colors.primary.cyan }]}>
                                    {remaining}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Receiving Form */}
                    <View style={[styles.formCard, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.formLabel, { color: colors.text.primary }]}>
                            How many are you receiving? *
                        </Text>
                        <TextInput
                            style={[
                                styles.quantityInput,
                                {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                    color: colors.text.primary,
                                },
                            ]}
                            value={quantityInput}
                            onChangeText={setQuantityInput}
                            keyboardType="number-pad"
                            placeholder="Enter quantity"
                            placeholderTextColor={colors.text.secondary}
                        />

                        <Text style={[styles.formLabel, { color: colors.text.primary, marginTop: Spacing.md }]}>
                            Location (optional)
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
                            value={locationInput}
                            onChangeText={setLocationInput}
                            placeholder="e.g., Shelf A-3"
                            placeholderTextColor={colors.text.secondary}
                        />
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.cancelButton, { backgroundColor: colors.background.primary, borderColor: colors.ui.border }]}
                            onPress={handleCancelReceiving}
                            disabled={processing}
                        >
                            <Text style={[styles.cancelButtonText, { color: colors.text.primary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.receiveButton,
                                { backgroundColor: colors.primary.cyan },
                                processing && styles.disabledButton,
                            ]}
                            onPress={handleReceiveItems}
                            disabled={processing}
                        >
                            {processing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.receiveButtonText}>
                                    Receive {quantityInput || '?'} Items
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // Main Scanner View
    if (!permission) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.permissionText, { color: colors.text.primary }]}>
                    Camera permission is required to scan barcodes
                </Text>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary.cyan }]}
                    onPress={requestPermission}
                >
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            <ScrollView style={styles.content}>
                {/* Scanner Section */}
                <View style={[styles.scannerCard, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        📦 Receive Items
                    </Text>

                    <TouchableOpacity
                        style={[styles.scanButton, { backgroundColor: colors.primary.cyan }]}
                        onPress={() => setScanning(true)}
                        disabled={processing}
                    >
                        <Text style={styles.scanButtonText}>📷 Scan SKU Barcode</Text>
                    </TouchableOpacity>

                    <Text style={[styles.orText, { color: colors.text.secondary }]}>
                        or enter SKU manually
                    </Text>

                    <View style={styles.manualInputRow}>
                        <TextInput
                            style={[
                                styles.manualInput,
                                {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                    color: colors.text.primary,
                                },
                            ]}
                            value={manualSKU}
                            onChangeText={setManualSKU}
                            placeholder="Enter SKU..."
                            placeholderTextColor={colors.text.secondary}
                            onSubmitEditing={handleManualSKUSubmit}
                        />
                        <TouchableOpacity
                            style={[styles.submitButton, { backgroundColor: colors.primary.cyan }]}
                            onPress={handleManualSKUSubmit}
                            disabled={processing || !manualSKU.trim()}
                        >
                            <Text style={styles.submitButtonText}>→</Text>
                        </TouchableOpacity>
                    </View>

                    {processing && (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary.cyan}
                            style={styles.processingIndicator}
                        />
                    )}
                </View>

                {/* Recent Receipts */}
                {recentReceipts.length > 0 && (
                    <View style={[styles.recentCard, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            Recent Scans
                        </Text>

                        {recentReceipts.map((receipt, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.recentItem,
                                    { borderBottomColor: colors.ui.divider },
                                ]}
                            >
                                <Text style={styles.recentIcon}>✓</Text>
                                <View style={styles.recentInfo}>
                                    <Text style={[styles.recentItemName, { color: colors.text.primary }]}>
                                        {receipt.itemName}
                                    </Text>
                                    <Text style={[styles.recentSKU, { color: colors.text.secondary }]}>
                                        SKU: {receipt.sku} • {receipt.quantity} items received
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
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
    scannerCard: {
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
    scanButton: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.sm,
        marginBottom: Spacing.md,
    },
    scanButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    orText: {
        textAlign: 'center',
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.md,
    },
    manualInputRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    manualInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    submitButton: {
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: Typography.weights.bold,
    },
    processingIndicator: {
        marginTop: Spacing.md,
    },
    recentCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    recentIcon: {
        fontSize: 20,
        marginRight: Spacing.md,
        color: '#27ae60',
    },
    recentInfo: {
        flex: 1,
    },
    recentItemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    recentSKU: {
        fontSize: Typography.sizes.sm,
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
    // Receiving session styles
    sessionContainer: {
        flex: 1,
        padding: Spacing.lg,
    },
    successHeader: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    successIcon: {
        fontSize: 48,
        color: '#fff',
        marginBottom: Spacing.sm,
    },
    successText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    detailsCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
        marginBottom: Spacing.md,
    },
    itemName: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    poInfo: {
        fontSize: Typography.sizes.md,
        marginBottom: Spacing.lg,
    },
    quantityGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.md,
    },
    quantityBox: {
        flex: 1,
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: 'rgba(0, 147, 178, 0.1)',
        borderRadius: BorderRadius.md,
    },
    quantityLabel: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs,
    },
    quantityValue: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
    },
    formCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
        marginBottom: Spacing.md,
    },
    formLabel: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
        marginBottom: Spacing.sm,
    },
    quantityInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        fontSize: Typography.sizes.xxl,
        textAlign: 'center',
        fontWeight: Typography.weights.bold,
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    cancelButton: {
        flex: 1,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        borderWidth: 1,
    },
    cancelButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    receiveButton: {
        flex: 2,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.md,
    },
    receiveButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    disabledButton: {
        opacity: 0.6,
    },
    permissionText: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.xl,
    },
    button: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.md,
        ...Shadows.sm,
    },
    buttonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
});