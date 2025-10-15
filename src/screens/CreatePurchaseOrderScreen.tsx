// src/screens/CreatePurchaseOrderScreen.tsx
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { databases, DATABASE_ID, COLLECTIONS, ItemType } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';

interface LineItem {
    id: string;
    item_type_id: string;
    item_type_name: string;
    sku: string;
    quantity: string;
}

export default function CreatePurchaseOrderScreen() {
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
            // Generate PO number
            const year = new Date().getFullYear();
            const poNumber = `PO-${year}-${Date.now().toString().slice(-6)}`;

            // Calculate totals
            const totalItems = lineItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);

            // Create PO
            const newPO = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.PURCHASE_ORDERS,
                ID.unique(),
                {
                    po_number: poNumber,
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
                        COLLECTIONS.PO_LINE_ITEMS,
                        ID.unique(),
                        {
                            purchase_order_id: newPO.$id,
                            item_type_id: item.item_type_id,
                            sku: item.sku,
                            quantity_ordered: parseInt(item.quantity),
                            quantity_received: 0,
                        }
                    )
                )
            );

            Alert.alert('Success', `Purchase Order ${poNumber} created successfully!`, [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error) {
            console.error('Error creating purchase order:', error);
            Alert.alert('Error', 'Failed to create purchase order. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getSelectedItemTypeName = () => {
        const itemType = itemTypes.find(it => it.$id === selectedItemType);
        return itemType ? itemType.item_name : 'Select item type...';
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            <ScrollView style={styles.content}>
                {/* PO Details Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Purchase Order Details
                    </Text>

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Vendor *
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
                        value={vendor}
                        onChangeText={setVendor}
                        placeholder="e.g., Amazon, Lenovo, B&H Photo"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Order Date *
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
                        value={orderDate}
                        onChangeText={setOrderDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Expected Delivery (Optional)
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
                        value={expectedDelivery}
                        onChangeText={setExpectedDelivery}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Notes (Optional)
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            styles.textArea,
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
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            Line Items ({lineItems.length})
                        </Text>
                        <TouchableOpacity
                            style={[styles.addButton, { backgroundColor: colors.primary.cyan }]}
                            onPress={() => setShowAddLineItem(true)}
                        >
                            <Text style={styles.addButtonText}>+ Add Item</Text>
                        </TouchableOpacity>
                    </View>

                    {lineItems.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            No line items added yet
                        </Text>
                    ) : (
                        lineItems.map((item, index) => (
                            <View
                                key={item.id}
                                style={[
                                    styles.lineItemCard,
                                    { backgroundColor: colors.background.secondary },
                                ]}
                            >
                                <View style={styles.lineItemHeader}>
                                    <Text style={[styles.lineItemNumber, { color: colors.text.secondary }]}>
                                        #{index + 1}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveLineItem(item.id)}
                                        style={styles.removeButton}
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
                                styles.addLineItemForm,
                                { backgroundColor: colors.background.secondary },
                            ]}
                        >
                            <Text style={[styles.formTitle, { color: colors.primary.coolGray }]}>
                                Add Line Item
                            </Text>

                            <Text style={[styles.label, { color: colors.text.primary }]}>
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

                            <Text style={[styles.label, { color: colors.text.primary }]}>
                                SKU *
                            </Text>
                            <TextInput
                                style={[
                                    styles.input,
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

                            <Text style={[styles.label, { color: colors.text.primary }]}>
                                Quantity *
                            </Text>
                            <TextInput
                                style={[
                                    styles.input,
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
                                        styles.formButton,
                                        { backgroundColor: colors.background.primary, borderColor: colors.ui.border },
                                    ]}
                                    onPress={() => {
                                        setShowAddLineItem(false);
                                        setSelectedItemType('');
                                        setNewSKU('');
                                        setNewQuantity('');
                                        setItemTypeSearch('');
                                    }}
                                >
                                    <Text style={[styles.formButtonText, { color: colors.text.primary }]}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.formButton,
                                        { backgroundColor: colors.primary.cyan },
                                    ]}
                                    onPress={handleAddLineItem}
                                >
                                    <Text style={[styles.formButtonText, { color: '#fff' }]}>
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
            </ScrollView>

            {/* Item Type Picker Modal */}
            <Modal visible={showItemTypePicker} transparent animationType="slide">
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowItemTypePicker(false)}
                >
                    <Pressable
                        style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.modalHeader, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.primary.coolGray }]}>
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
                                style={[styles.searchInput, {
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
                            style={styles.modalContent}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                        >
                            {filteredItemTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.$id}
                                    style={[styles.itemTypeOption, { borderBottomColor: colors.ui.divider }]}
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
                                    <View style={styles.itemTypeInfo}>
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
                        styles.submitButton,
                        { backgroundColor: colors.primary.cyan },
                        submitting && styles.disabledButton,
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Create Purchase Order</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    section: {
        padding: Spacing.lg,
        margin: Spacing.md,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
    },
    label: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    addButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    addButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
    },
    emptyText: {
        padding: Spacing.lg,
        textAlign: 'center',
        fontSize: Typography.sizes.md,
    },
    lineItemCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    lineItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    lineItemNumber: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
    },
    removeButton: {
        padding: Spacing.xs,
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
    addLineItemForm: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
    },
    formTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
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
    formButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    formButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        borderWidth: 1,
    },
    formButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
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
    submitButton: {
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.md,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
    },
    disabledButton: {
        opacity: 0.5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        height: '80%',
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
    searchContainer: {
        padding: Spacing.md,
        paddingBottom: 0,
    },
    searchInput: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        fontSize: Typography.sizes.md,
    },
    modalContent: {
        flex: 1,
    },
    itemTypeOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    itemTypeInfo: {
        flex: 1,
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
});