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
    const [selectedItemType, setSelectedItemType] = useState('');
    const [newSKU, setNewSKU] = useState('');
    const [newQuantity, setNewQuantity] = useState('');

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
                    status: 'ordered',
                    created_by: user?.name || 'Unknown',
                    notes: notes.trim() || undefined,
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
                            <ScrollView
                                style={[
                                    styles.itemTypePicker,
                                    { backgroundColor: colors.background.primary, borderColor: colors.ui.border },
                                ]}
                            >
                                {itemTypes.map(itemType => (
                                    <TouchableOpacity
                                        key={itemType.$id}
                                        style={[
                                            styles.itemTypeOption,
                                            selectedItemType === itemType.$id && {
                                                backgroundColor: `${colors.primary.cyan}20`,
                                            },
                                            { borderBottomColor: colors.ui.divider },
                                        ]}
                                        onPress={() => {
                                            setSelectedItemType(itemType.$id);
                                            // Auto-fill SKU with barcode if available
                                            if (itemType.barcode) {
                                                setNewSKU(itemType.barcode);
                                            }
                                        }}
                                    >
                                        <Text style={[styles.itemTypeName, { color: colors.text.primary }]}>
                                            {itemType.item_name}
                                        </Text>
                                        <Text style={[styles.itemTypeCategory, { color: colors.text.secondary }]}>
                                            {itemType.category}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

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
    itemTypePicker: {
        maxHeight: 150,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
    },
    itemTypeOption: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    itemTypeName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    itemTypeCategory: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
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
});