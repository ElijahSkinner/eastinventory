// src/screens/ScanInScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { databases, DATABASE_ID, COLLECTIONS, InventoryItem, ItemType } from '../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import NewItemModal, { NewItemData } from '../components/modals/NewItemModal';

export default function ScanInScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [showNewItemModal, setShowNewItemModal] = useState(false);

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        if (processing || !scanning) return;

        setProcessing(true);
        setScanning(false);
        setScannedBarcode(data);

        console.log('Barcode scanned:', data);

        try {
            const itemTypeResponse = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.ITEM_TYPES,
                [Query.equal('barcode', data)]
            );

            if (itemTypeResponse.documents.length > 0) {
                const inventoryResponse = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.INVENTORY_ITEMS,
                    [Query.equal('barcode', data)]
                );

                const itemType = itemTypeResponse.documents[0] as unknown as ItemType;
                const currentQuantity = inventoryResponse.total;

                // Use native confirm/alert for both platforms
                const message = `Found: ${itemType.item_name}\n\nCurrent quantity: ${currentQuantity}\n\nAdd another item?`;

                // Auto-add on mobile for simplicity (you can change this later)
                // Or use a proper confirmation modal
                await addInventoryItem(data, itemType.$id, itemType.item_name);

            } else {
                setShowNewItemModal(true);
            }
        } catch (error) {
            console.error('Error processing barcode:', error);
            alert('Error processing barcode. Please try again.');
            resetScanner();
        }
    };

    const addInventoryItem = async (barcode: string, itemTypeId: string, itemName?: string) => {
        try {
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                ID.unique(),
                {
                    barcode,
                    item_type_id: itemTypeId,
                    status: 'available',
                    is_school_specific: false,
                    received_date: new Date().toISOString(),
                }
            );

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.TRANSACTIONS,
                ID.unique(),
                {
                    transaction_type: 'received',
                    inventory_item_id: itemTypeId,
                    performed_by: user?.name || 'Unknown',
                    transaction_date: new Date().toISOString(),
                    notes: `Scanned in via barcode: ${barcode}`,
                }
            );

            console.log(`Item added: ${itemName || barcode}`);
            resetScanner();
        } catch (error) {
            console.error('Error adding inventory item:', error);
            alert('Failed to add item. Please try again.');
            resetScanner();
        }
    };

    const handleNewItemSubmit = async (itemData: NewItemData) => {
        if (!scannedBarcode) return;

        setShowNewItemModal(false);

        try {
            const newItemType = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.ITEM_TYPES,
                ID.unique(),
                {
                    barcode: scannedBarcode,
                    item_name: itemData.item_name,
                    category: itemData.category,
                    manufacturer: itemData.manufacturer,
                    model: itemData.model,
                    description: itemData.description,
                }
            );

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.INVENTORY_ITEMS,
                ID.unique(),
                {
                    barcode: scannedBarcode,
                    item_type_id: newItemType.$id,
                    status: 'available',
                    is_school_specific: itemData.is_school_specific,
                    serial_number: itemData.serial_number,
                    location: itemData.location,
                    received_date: new Date().toISOString(),
                }
            );

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.TRANSACTIONS,
                ID.unique(),
                {
                    transaction_type: 'received',
                    inventory_item_id: newItemType.$id,
                    performed_by: user?.name || 'Unknown',
                    transaction_date: new Date().toISOString(),
                    notes: `New item created and scanned in: ${itemData.item_name}`,
                }
            );

            window.alert(`Successfully added: ${itemData.item_name}`);
            resetScanner();
        } catch (error) {
            console.error('Error creating new item:', error);
            window.alert('Failed to create item. Please try again.');
            resetScanner();
        }
    };

    const resetScanner = () => {
        setProcessing(false);
        setScanning(true);
        setScannedBarcode(null);
        setShowNewItemModal(false);
    };

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
                    <Text style={[styles.buttonText, { color: colors.text.white }]}>
                        Grant Permission
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {scanning && (
                <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                    }}
                >
                    <View style={styles.overlay}>
                        <View style={styles.scanArea}>
                            <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary.cyan }]} />
                            <View style={[styles.corner, styles.topRight, { borderColor: colors.primary.cyan }]} />
                            <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary.cyan }]} />
                            <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary.cyan }]} />
                        </View>

                        <View style={styles.instructionContainer}>
                            <Text style={styles.instructionText}>
                                Position barcode within the frame
                            </Text>
                        </View>
                    </View>
                </CameraView>
            )}

            {processing && (
                <View style={[styles.processingContainer, { backgroundColor: colors.background.primary }]}>
                    <ActivityIndicator size="large" color={colors.primary.cyan} />
                    <Text style={[styles.processingText, { color: colors.text.primary }]}>
                        Processing barcode...
                    </Text>
                    {scannedBarcode && (
                        <Text style={[styles.barcodeText, { color: colors.text.secondary }]}>
                            {scannedBarcode}
                        </Text>
                    )}
                </View>
            )}

            {scannedBarcode && (
                <NewItemModal
                    visible={showNewItemModal}
                    barcode={scannedBarcode}
                    onConfirm={handleNewItemSubmit}
                    onCancel={() => {
                        setShowNewItemModal(false);
                        resetScanner();
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanArea: {
        width: 300,
        height: 300,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderWidth: 4,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0,
    },
    instructionContainer: {
        position: 'absolute',
        bottom: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    instructionText: {
        color: '#FFFFFF',
        fontSize: Typography.sizes.md,
        textAlign: 'center',
    },
    processingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    processingText: {
        fontSize: Typography.sizes.lg,
        marginTop: Spacing.md,
        fontWeight: Typography.weights.medium,
    },
    barcodeText: {
        fontSize: Typography.sizes.md,
        marginTop: Spacing.sm,
        fontFamily: 'monospace',
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
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
});