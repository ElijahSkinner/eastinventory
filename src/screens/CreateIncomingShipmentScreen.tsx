// src/screens/CreateIncomingShipmentScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Modal,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { databases, DATABASE_ID, COLLECTIONS, ItemType } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows, CommonStyles } from '../theme';

interface LineItem {
    id: string;
    item_type_id: string;
    item_type_name: string;
    sku: string;
    quantity: string;
}

export default function CreateIncomingShipmentScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();

    const [vendor, setVendor] = useState('');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
    const [expectedDelivery, setExpectedDelivery] = useState('');
    const [notes, setNotes] = useState('');
    const [lineItems, setLineItems] = useState<LineItem[]>([]);
    const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // For adding new line item
    const [showAddLineItem, setShowAddLineItem] = useState(false);
    const [showItemTypePicker, setShowItemTypePicker] = useState(false);
    const [selectedItemType, setSelectedItemType] = useState('');
    const [newSKU, setNewSKU] = useState('');
    const [newQuantity, setNewQuantity] = useState('');
    const [itemTypeSearch, setItemTypeSearch] = useState('');

    // Camera scanning for SKU
    const [scanningSKU, setScanningSKU] = useState(false);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    useEffect(() => {
        loadItemTypes();
    }, []);

    const loadItemTypes = async () => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.ITEM_TYPES,
                [Query.limit(500)]
            );
            setItemTypes(response.documents as unknown as ItemType[]);
        } catch (error) {
            console.error('Error loading item types:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter item types based on search
    const filteredItemTypes = itemTypes.filter(type =>
        type.item_name.toLowerCase().includes(itemTypeSearch.toLowerCase()) ||
        type.category.toLowerCase().includes(itemTypeSearch.toLowerCase()) ||
        (type.manufacturer && type.manufacturer.toLowerCase().includes(itemTypeSearch.toLowerCase()))
    );

    const handleScanSKU = async () => {
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

        setScanningSKU(true);
    };

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        setNewSKU(data);
        setScanningSKU(false);
        Alert.alert('Success', 'SKU scanned successfully!');
    };

    const handleAddLineItem = () => {
        if (!selectedItemType || !newSKU.trim() || !newQuantity.trim()) {
            Alert.alert('Error', 'Please fill in all line item fields');
            return;
        }

        const quantity = parseInt(newQuantity);
        if (isNaN(quantity) || quantity <= 0) {
            Alert.alert('Error', 'Please enter a valid quantity');
            return;
        }

        const itemType = itemTypes.find(it => it.$id === selectedItemType);
        if (!itemType) return;

        const newLineItem: LineItem = {
            id: Date.now().toString(),
            item_type_id: selectedItemType,
            item_type_name: itemType.item_name,
            sku: newSKU.trim(),
            quantity: newQuantity,
        };

        setLineItems([...lineItems, newLineItem]);
        setShowAddLineItem(false);
        setSelectedItemType('');
        setNewSKU('');
        setNewQuantity('');
        setItemTypeSearch('');
    };

    const handleRemoveLineItem = (id: string) => {
        setLineItems(lineItems.filter(item => item.id !== id));
    };

    const handleSubmit = async () => {
        if (!vendor.trim()) {
            Alert.alert('Error', 'Please enter a vendor name');
            return;
        }

        if (lineItems.length === 0) {
            Alert.alert('Error', 'Please add at least one line item');
            return;
        }

        setSubmitting(true);

        try {
            // Generate SH number
            const year = new Date().getFullYear();
            const SHNumber = `SH-${year}-${Date.now().toString().slice(-6)}`;

            // Calculate totals
            const totalItems = lineItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);

            // Create SH
            const newSH = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.PURCHASE_ORDERS,
                ID.unique(),
                {
                    po_number: SHNumber,
                    vendor: vendor.trim(),
                    order_date: orderDate,
                    expected_delivery: expectedDelivery || undefined,
                    order_status: 'ordered',
                    created_by: user?.name || 'Unknown',
                    total_items: totalItems,
                    received_items: 0,
                }
            );

            // Create line items
            await Promise.all(
                lineItems.map(item =>
                    databases.createDocument(
                        DATABASE_ID,
                        COLLECTIONS.po_LINE_ITEMS,
                        ID.unique(),
                        {
                            purchase_order_id: newSH.$id,
                            item_type_id: item.item_type_id,
                            sku: item.sku,
                            quantity_ordered: parseInt(item.quantity),
                            quantity_received: 0,
                        }
                    )
                )
            );

            Alert.alert('Success', `Incoming Shipment ${SHNumber} created successfully!`, [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error) {
            console.error('Error creating Incoming Shipment:', error);
            Alert.alert('Error', 'Failed to create Incoming Shipment. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getSelectedItemTypeName = () => {
        const itemType = itemTypes.find(it => it.$id === selectedItemType);
        return itemType ? itemType.item_name : 'Select item type...';
    };

    // Camera Scanner Modal for SKU
    if (scanningSKU) {
        return (
            <Modal visible={true} transparent={false} animationType="slide">
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
                                    onPress={() => setScanningSKU(false)}
                                >
                                    <Text style={styles.cameraCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={CommonStyles.camera.scanFrame} />
                            <Text style={CommonStyles.camera.instructions}>
                                Position the barcode within the frame
                            </Text>
                        </View>
                    </CameraView>
                </View>
            </Modal>
        );
    }

    if (loading) {
        return (
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[CommonStyles.containers.flex, { backgroundColor: colors.background.secondary }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView
                style={CommonStyles.containers.flex}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
            >
                {/* SH Details Section */}
                <View style={[CommonStyles.sections.container, { backgroundColor: colors.background.primary }]}>
                    <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                        Incoming Shipment Details
                    </Text>

                    <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                        Vendor *
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
                        value={vendor}
                        onChangeText={setVendor}
                        placeholder="e.g., Amazon, Lenovo, B&H Photo"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                        Order Date *
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
                        value={orderDate}
                        onChangeText={setOrderDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                        Expected Delivery (Optional)
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
                        value={expectedDelivery}
                        onChangeText={setExpectedDelivery}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                        Notes (Optional)
                    </Text>
                    <TextInput
                        style={[
                            CommonStyles.inputs.textArea,
                            {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                                color: colors.text.primary,
                            },
                        ]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Additional notes about this order..."
                        placeholderTextColor={colors.text.secondary}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Line Items Section */}
                <View style={[CommonStyles.sections.container, { backgroundColor: colors.background.primary }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                            Line Items ({lineItems.length})
                        </Text>
                        <TouchableOpacity
                            style={[CommonStyles.buttons.primary, { backgroundColor: colors.primary.cyan }]}
                            onPress={() => setShowAddLineItem(true)}
                        >
                            <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>+ Add Item</Text>
                        </TouchableOpacity>
                    </View>

                    {lineItems.length === 0 ? (
                        <Text style={[CommonStyles.empty.subtext, { color: colors.text.secondary }]}>
                            No line items added yet
                        </Text>
                    ) : (
                        lineItems.map((item, index) => (
                            <View
                                key={item.id}
                                style={[
                                    CommonStyles.cards.compact,
                                    { backgroundColor: colors.background.secondary, marginBottom: Spacing.sm },
                                ]}
                            >
                                <View style={CommonStyles.rows.base}>
                                    <Text style={[styles.lineItemNumber, { color: colors.text.secondary }]}>
                                        #{index + 1}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveLineItem(item.id)}
                                        style={{ padding: Spacing.xs }}
                                    >
                                        <Text style={[styles.removeButtonText, { color: colors.secondary.red }]}>
                                            Remove
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.lineItemName, { color: colors.text.primary }]}>
                                    {item.item_type_name}
                                </Text>
                                <Text style={[styles.lineItemSKU, { color: colors.text.secondary }]}>
                                    SKU: {item.sku}
                                </Text>
                                <Text style={[styles.lineItemQuantity, { color: colors.primary.cyan }]}>
                                    Quantity: {item.quantity}
                                </Text>
                            </View>
                        ))
                    )}

                    {/* Add Line Item Form */}
                    {showAddLineItem && (
                        <View
                            style={[
                                CommonStyles.cards.compact,
                                { backgroundColor: colors.background.secondary, marginTop: Spacing.md },
                            ]}
                        >
                            <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                                Add Line Item
                            </Text>

                            <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                                Item Type *
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.pickerButton,
                                    {
                                        backgroundColor: colors.background.primary,
                                        borderColor: colors.ui.border,
                                    },
                                ]}
                                onPress={() => setShowItemTypePicker(true)}
                            >
                                <Text
                                    style={[
                                        styles.pickerButtonText,
                                        {
                                            color: selectedItemType
                                                ? colors.text.primary
                                                : colors.text.secondary,
                                        },
                                    ]}
                                >
                                    {getSelectedItemTypeName()}
                                </Text>
                                <Text style={[styles.pickerArrow, { color: colors.text.secondary }]}>›</Text>
                            </TouchableOpacity>

                            <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                                SKU *
                            </Text>
                            <View style={styles.inputWithIcon}>
                                <TextInput
                                    style={[
                                        styles.inputWithButton,
                                        {
                                            backgroundColor: colors.background.primary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    value={newSKU}
                                    onChangeText={setNewSKU}
                                    placeholder="Enter vendor SKU"
                                    placeholderTextColor={colors.text.secondary}
                                />
                                <TouchableOpacity
                                    style={[styles.scanButton, { backgroundColor: colors.primary.cyan }]}
                                    onPress={handleScanSKU}
                                >
                                    <Text style={styles.scanButtonText}>📷</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                                Quantity *
                            </Text>
                            <TextInput
                                style={[
                                    CommonStyles.inputs.base,
                                    {
                                        backgroundColor: colors.background.primary,
                                        borderColor: colors.ui.border,
                                        color: colors.text.primary,
                                    },
                                ]}
                                value={newQuantity}
                                onChangeText={setNewQuantity}
                                placeholder="0"
                                placeholderTextColor={colors.text.secondary}
                                keyboardType="number-pad"
                            />

                            <View style={styles.formButtons}>
                                <TouchableOpacity
                                    style={[
                                        CommonStyles.buttons.secondary,
                                        {
                                            backgroundColor: colors.background.primary,
                                            borderColor: colors.ui.border,
                                            flex: 1,
                                        },
                                    ]}
                                    onPress={() => {
                                        setShowAddLineItem(false);
                                        setSelectedItemType('');
                                        setNewSKU('');
                                        setNewQuantity('');
                                        setItemTypeSearch('');
                                    }}
                                >
                                    <Text style={[CommonStyles.buttons.text, { color: colors.text.primary }]}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        CommonStyles.buttons.primary,
                                        { backgroundColor: colors.primary.cyan, flex: 1 },
                                    ]}
                                    onPress={handleAddLineItem}
                                >
                                    <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>
                                        Add Item
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Summary */}
                {lineItems.length > 0 && (
                    <View style={[styles.summary, { backgroundColor: colors.primary.cyan }]}>
                        <Text style={styles.summaryText}>
                            Total Items: {lineItems.reduce((sum, item) => sum + parseInt(item.quantity), 0)}
                        </Text>
                    </View>
                )}

                {/* Extra padding for keyboard */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Item Type Picker Modal */}
            <Modal visible={showItemTypePicker} transparent animationType="slide">
                <Pressable
                    style={CommonStyles.modals.overlay}
                    onPress={() => setShowItemTypePicker(false)}
                >
                    <Pressable
                        style={[styles.modalContainerFixed, { backgroundColor: colors.background.primary }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[CommonStyles.modals.header, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[CommonStyles.modals.title, { color: colors.primary.coolGray }]}>
                                Select Item Type
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setShowItemTypePicker(false);
                                setItemTypeSearch('');
                            }}>
                                <Text style={[styles.closeButton, { color: colors.text.secondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search box */}
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={[CommonStyles.inputs.search, {
                                    backgroundColor: colors.background.secondary,
                                    color: colors.text.primary,
                                    borderColor: colors.ui.border
                                }]}
                                placeholder="Search item types..."
                                placeholderTextColor={colors.text.secondary}
                                value={itemTypeSearch}
                                onChangeText={setItemTypeSearch}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Scrollable list */}
                        <ScrollView
                            style={styles.modalScrollView}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                        >
                            {filteredItemTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.$id}
                                    style={[CommonStyles.lists.item, { borderBottomColor: colors.ui.divider }]}
                                    onPress={() => {
                                        setSelectedItemType(type.$id);
                                        // Auto-fill SKU if available
                                        if (type.default_sku) {
                                            setNewSKU(type.default_sku);
                                        }
                                        setShowItemTypePicker(false);
                                        setItemTypeSearch('');
                                    }}
                                >
                                    <View style={CommonStyles.containers.flex}>
                                        <Text style={[styles.itemTypeName, { color: colors.text.primary }]}>
                                            {type.item_name}
                                        </Text>
                                        <Text style={[styles.itemTypeCategory, { color: colors.text.secondary }]}>
                                            {type.category} {type.manufacturer && `• ${type.manufacturer}`}
                                        </Text>
                                    </View>
                                    {selectedItemType === type.$id && (
                                        <Text style={[styles.checkmark, { color: colors.primary.cyan }]}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Submit Button */}
            <View style={[styles.footer, { backgroundColor: colors.background.primary, borderTopColor: colors.ui.border }]}>
                <TouchableOpacity
                    style={[
                        CommonStyles.buttons.primary,
                        { backgroundColor: colors.primary.cyan },
                        submitting && styles.disabledButton,
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>Create Incoming Shipment</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    // Custom styles that don't have CommonStyles equivalents
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    lineItemNumber: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
    },
    removeButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    lineItemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
    },
    lineItemSKU: {
        fontSize: Typography.sizes.sm,
        fontFamily: 'monospace',
        marginBottom: Spacing.xs / 2,
    },
    lineItemQuantity: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
    },
    pickerButtonText: {
        fontSize: Typography.sizes.md,
        flex: 1,
    },
    pickerArrow: {
        fontSize: 24,
    },
    inputWithIcon: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    inputWithButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    scanButton: {
        width: 50,
        height: 50,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanButtonText: {
        fontSize: 24,
    },
    formButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    summary: {
        margin: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    summaryText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    footer: {
        padding: Spacing.md,
        borderTopWidth: 1,
    },
    disabledButton: {
        opacity: 0.5,
    },
    // Modal styles - fixed for mobile
    modalContainerFixed: {
        height: '80%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        ...Shadows.lg,
        overflow: 'hidden',
    },
    modalScrollView: {
        flex: 1,
    },
    closeButton: {
        fontSize: 24,
    },
    searchContainer: {
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    itemTypeName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    itemTypeCategory: {
        fontSize: Typography.sizes.sm,
    },
    checkmark: {
        fontSize: 24,
        marginLeft: Spacing.md,
    },
    cameraCancelText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
});