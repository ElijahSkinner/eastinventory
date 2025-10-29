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
    SHLineItem,
    ItemType,
    IncomingShipment,
} from '../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, CommonStyles } from '../theme';

interface ReceivingSession {
    sku: string;
    SHLineItem: SHLineItem;
    itemType: ItemType;
    IncomingShipment: IncomingShipment;
    quantityToReceive: number;
    location: string;
}

export default function ReceivingScreen({ route }: any) {
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

    // Auto-scan if SKU is passed from navigation
    useEffect(() => {
        if (route?.params?.sku) {
            handleSKUScan(route.params.sku);
        }
    }, [route?.params?.sku]);

    const selectLineItem = async (poLineItem: SHLineItem) => {
        try {
            // Load item type
            const itemType = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.ITEM_TYPES,
                poLineItem.item_type_id
            );

            // Load Incoming Shipment
            const IncomingShipment = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.PURCHASE_ORDERS,
                poLineItem.purchase_order_id
            );

            // Create receiving session
            setReceivingSession({
                sku: poLineItem.sku,
                SHLineItem: poLineItem,
                itemType: itemType as unknown as ItemType,
                IncomingShipment: IncomingShipment as unknown as IncomingShipment,
                quantityToReceive: 0,
                location: '',
            });

            // Pre-fill with remaining quantity
            const remaining = poLineItem.quantity_ordered - poLineItem.quantity_received;
            setQuantityInput(remaining.toString());
            setLocationInput('');
            setProcessing(false);

        } catch (error) {
            console.error('Error loading shipment details:', error);
            Alert.alert('Error', 'Failed to load shipment details.');
            setProcessing(false);
        }
    };

    const handleSKUScan = async (sku: string) => {
        setScanning(false);
        setProcessing(true);

        try {
            // Find ALL incomplete line items with this SKU
            const lineItemsResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.po_LINE_ITEMS,
                [Query.equal('sku', sku), Query.limit(100)]
            );

            if (lineItemsResponse.documents.length === 0) {
                Alert.alert(
                    'SKU Not Found',
                    `No Incoming Shipment found for SKU: ${sku}\n\nThis SKU may not be in any active Incoming Shipments.`
                );
                setProcessing(false);
                return;
            }

            // Filter to only incomplete line items
            const incompleteLineItems = lineItemsResponse.documents.filter((doc: any) =>
                doc.quantity_received < doc.quantity_ordered
            );

            if (incompleteLineItems.length === 0) {
                Alert.alert(
                    'All Orders Complete',
                    `All Incoming Shipments for SKU ${sku} have been fully received.`
                );
                setProcessing(false);
                return;
            }

            if (incompleteLineItems.length > 1) {
                // Load PO details for each line item to show to user
                const lineItemsWithPO = await Promise.all(
                    incompleteLineItems.map(async (lineItem: any) => {
                        const po = await databases.getDocument(
                            DATABASE_ID,
                            COLLECTIONS.PURCHASE_ORDERS,
                            lineItem.purchase_order_id
                        );
                        return { lineItem, po };
                    })
                );

                // Create alert options for each PO
                const poOptions = lineItemsWithPO.map(({ lineItem, po }: any, index) => {
                    const remaining = lineItem.quantity_ordered - lineItem.quantity_received;
                    return {
                        text: `${po.po_number} - ${remaining} remaining`,
                        onPress: () => selectLineItem(lineItem as any),
                    };
                });

                Alert.alert(
                    'Multiple Shipments Found',
                    `This SKU has ${incompleteLineItems.length} incomplete shipments. Which one are you receiving?`,
                    [
                        ...poOptions,
                        { text: 'Cancel', style: 'cancel', onPress: () => setProcessing(false) }
                    ]
                );
                return;
            }

            // Only one incomplete shipment - proceed directly
            await selectLineItem(incompleteLineItems[0] as any);

        } catch (error) {
            console.error('Error processing SKU:', error);
            Alert.alert('Error', 'Failed to process SKU. Please try again.');
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

        const remaining = receivingSession.SHLineItem.quantity_ordered - receivingSession.SHLineItem.quantity_received;

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
                        barcode: receivingSession.sku,
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
                        notes: `Received via PO ${receivingSession.IncomingShipment.po_number} (SKU: ${receivingSession.sku})`,
                    }
                );

                createdItems.push(newItem);
            }

            // Update PO line item quantity received
            const newQuantityReceived = receivingSession.SHLineItem.quantity_received + quantity;
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.po_LINE_ITEMS,
                receivingSession.SHLineItem.$id,
                {
                    quantity_received: newQuantityReceived,
                }
            );

            // Update PO totals based on LINE ITEMS after update
            const allLineItems = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.po_LINE_ITEMS,
                [Query.equal('purchase_order_id', receivingSession.IncomingShipment.$id)]
            );

            // Calculate totals from LINE ITEMS (after the update above)
            let totalOrdered = 0;
            let totalReceived = 0;

            for (const lineItem of allLineItems.documents) {
                const item = lineItem as any;
                totalOrdered += item.quantity_ordered;
                totalReceived += item.quantity_received;
            }

            console.log('📊 PO Totals:', { totalOrdered, totalReceived });

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
                receivingSession.IncomingShipment.$id,
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
                ...prev.slice(0, 4),
            ]);

            Alert.alert(
                'Success!',
                `${quantity} ${receivingSession.itemType.item_name}(s) received successfully!\n\nPO Progress: ${totalReceived} of ${totalOrdered}`
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
            <View style={CommonStyles.camera.container}>
                <CameraView
                    style={CommonStyles.camera.camera}
                    facing="back"
                    onBarcodeScanned={handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
                    }}
                >
                    <View style={CommonStyles.camera.overlay}>
                        <View style={CommonStyles.camera.header}>
                            <Text style={CommonStyles.camera.title}>Scan SKU Barcode</Text>
                            <TouchableOpacity
                                style={CommonStyles.camera.cancelButton}
                                onPress={() => setScanning(false)}
                            >
                                <Text style={styles.cameraCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={[CommonStyles.camera.scanFrame, { borderColor: colors.primary.cyan }]} />
                        <Text style={CommonStyles.camera.instructions}>
                            Position the SKU barcode within the frame
                        </Text>
                    </View>
                </CameraView>
            </View>
        );
    }

    // Receiving Session View
    if (receivingSession) {
        const remaining = receivingSession.SHLineItem.quantity_ordered - receivingSession.SHLineItem.quantity_received;

        return (
            <View style={[CommonStyles.containers.flex, { backgroundColor: colors.background.secondary }]}>
                <ScrollView style={styles.sessionContainer}>
                    {/* Success Header */}
                    <View style={[styles.successHeader, { backgroundColor: colors.primary.cyan }]}>
                        <Text style={styles.successIcon}>✓</Text>
                        <Text style={styles.successText}>SKU Found: {receivingSession.sku}</Text>
                    </View>

                    {/* Item Details */}
                    <View style={[CommonStyles.cards.base, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.itemName, { color: colors.primary.coolGray }]}>
                            {receivingSession.itemType.item_name}
                        </Text>
                        <Text style={[styles.poInfo, { color: colors.text.secondary }]}>
                            {receivingSession.IncomingShipment.po_number} • {receivingSession.IncomingShipment.vendor}
                        </Text>

                        <View style={styles.quantityGrid}>
                            <View style={styles.quantityBox}>
                                <Text style={[styles.quantityLabel, { color: colors.text.secondary }]}>
                                    Expected
                                </Text>
                                <Text style={[styles.quantityValue, { color: colors.text.primary }]}>
                                    {receivingSession.SHLineItem.quantity_ordered}
                                </Text>
                            </View>

                            <View style={styles.quantityBox}>
                                <Text style={[styles.quantityLabel, { color: colors.text.secondary }]}>
                                    Received
                                </Text>
                                <Text style={[styles.quantityValue, { color: colors.secondary.orange }]}>
                                    {receivingSession.SHLineItem.quantity_received}
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
                    <View style={[CommonStyles.cards.base, { backgroundColor: colors.background.primary }]}>
                        <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                            How many are you receiving? <Text style={CommonStyles.forms.required}>*</Text>
                        </Text>
                        <TextInput
                            style={[
                                CommonStyles.inputs.base,
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

                        <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                            Location (optional)
                        </Text>
                        <TextInput
                            style={[
                                CommonStyles.inputs.base,
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
                            style={[
                                CommonStyles.buttons.secondary,
                                { backgroundColor: colors.background.primary, borderColor: colors.ui.border }
                            ]}
                            onPress={handleCancelReceiving}
                            disabled={processing}
                        >
                            <Text style={[CommonStyles.buttons.text, { color: colors.text.primary }]}>
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                CommonStyles.buttons.primary,
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
                                <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>
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
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.primary }]}>
                <Text style={[styles.permissionText, { color: colors.text.primary }]}>
                    Camera permission is required to scan barcodes
                </Text>
                <TouchableOpacity
                    style={[CommonStyles.buttons.primary, { backgroundColor: colors.primary.cyan }]}
                    onPress={requestPermission}
                >
                    <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[CommonStyles.containers.flex, { backgroundColor: colors.background.secondary }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Scanner Section */}
                <View style={[CommonStyles.sections.container, {
                    backgroundColor: colors.background.primary,
                    marginBottom: Spacing.md,
                }]}>
                    <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                        📦 Receive Items
                    </Text>

                    <TouchableOpacity
                        style={[CommonStyles.buttons.primary, {
                            backgroundColor: colors.primary.cyan,
                            marginBottom: Spacing.md,
                        }]}
                        onPress={() => setScanning(true)}
                        disabled={processing}
                    >
                        <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>📷 Scan SKU Barcode</Text>
                    </TouchableOpacity>

                    <Text style={[styles.orText, { color: colors.text.secondary }]}>
                        or enter SKU manually
                    </Text>

                    <View style={styles.manualInputRow}>
                        <TextInput
                            style={[
                                CommonStyles.inputs.base,
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
                            style={[styles.submitButton, {
                                backgroundColor: colors.primary.cyan,
                                opacity: (processing || !manualSKU.trim()) ? 0.5 : 1
                            }]}
                            onPress={handleManualSKUSubmit}
                            disabled={processing || !manualSKU.trim()}
                        >
                            <Text style={[CommonStyles.buttons.text, styles.submitButtonText]}>→</Text>
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
                    <View style={[CommonStyles.sections.container, { backgroundColor: colors.background.primary }]}>
                        <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                            Recent Scans
                        </Text>

                        {recentReceipts.map((receipt, index) => (
                            <View
                                key={index}
                                style={[
                                    CommonStyles.lists.item,
                                    { borderBottomColor: colors.ui.divider },
                                ]}
                            >
                                <Text style={styles.recentIcon}>✓</Text>
                                <View style={CommonStyles.containers.flex}>
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
    scrollContent: {
        padding: Spacing.lg,
    },
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
    quantityInput: {
        fontSize: Typography.sizes.xxl,
        textAlign: 'center',
        fontWeight: Typography.weights.bold,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    receiveButton: {
        flex: 2,
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
    },
    submitButton: {
        width: 56,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: Typography.weights.bold,
        lineHeight: 28,
    },
    processingIndicator: {
        marginTop: Spacing.md,
    },
    recentIcon: {
        fontSize: 20,
        marginRight: Spacing.md,
        color: '#27ae60',
    },
    recentItemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    recentSKU: {
        fontSize: Typography.sizes.sm,
    },
    cameraCancelText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
});