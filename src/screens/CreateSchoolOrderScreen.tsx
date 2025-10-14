// src/screens/CreateSchoolOrderScreen.tsx
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
import { databases, DATABASE_ID, COLLECTIONS, School, ItemType } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';

interface OrderItem {
    id: string;
    item_type_id: string;
    item_type_name: string;
    quantity: string;
}

export default function CreateSchoolOrderScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();

    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [installDate, setInstallDate] = useState('');
    const [notes, setNotes] = useState('');
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // For adding new order item
    const [showAddItem, setShowAddItem] = useState(false);
    const [selectedItemType, setSelectedItemType] = useState('');
    const [newQuantity, setNewQuantity] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [schoolsResponse, itemTypesResponse] = await Promise.all([
                databases.listDocuments(DATABASE_ID, COLLECTIONS.SCHOOLS, [
                    Query.equal('active', true),
                    Query.limit(500),
                ]),
                databases.listDocuments(DATABASE_ID, COLLECTIONS.ITEM_TYPES, [Query.limit(500)]),
            ]);

            setSchools(schoolsResponse.documents as unknown as School[]);
            setItemTypes(itemTypesResponse.documents as unknown as ItemType[]);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddOrderItem = () => {
        if (!selectedItemType || !newQuantity.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const quantity = parseInt(newQuantity);
        if (isNaN(quantity) || quantity <= 0) {
            Alert.alert('Error', 'Please enter a valid quantity');
            return;
        }

        const itemType = itemTypes.find(it => it.$id === selectedItemType);
        if (!itemType) return;

        const newOrderItem: OrderItem = {
            id: Date.now().toString(),
            item_type_id: selectedItemType,
            item_type_name: itemType.item_name,
            quantity: newQuantity,
        };

        setOrderItems([...orderItems, newOrderItem]);
        setShowAddItem(false);
        setSelectedItemType('');
        setNewQuantity('');
    };

    const handleRemoveOrderItem = (id: string) => {
        setOrderItems(orderItems.filter(item => item.id !== id));
    };

    const handleSubmit = async () => {
        if (!selectedSchoolId) {
            Alert.alert('Error', 'Please select a school');
            return;
        }

        if (!installDate) {
            Alert.alert('Error', 'Please enter an install date');
            return;
        }

        if (orderItems.length === 0) {
            Alert.alert('Error', 'Please add at least one item');
            return;
        }

        setSubmitting(true);

        try {
            const school = schools.find(s => s.$id === selectedSchoolId);
            if (!school) return;

            // Generate order number
            const year = new Date().getFullYear();
            const orderNumber = `SO-${school.school_code}-${year}-${Date.now().toString().slice(-6)}`;

            // Calculate totals
            const totalItems = orderItems.reduce((sum, item) => sum + parseInt(item.quantity), 0);

            // Create school order
            const newOrder = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.SCHOOL_ORDERS,
                ID.unique(),
                {
                    school_id: selectedSchoolId,
                    order_number: orderNumber,
                    install_date: installDate,
                    status: 'planning',
                    created_by: user?.name || 'Unknown',
                    created_date: new Date().toISOString(),
                    notes: notes.trim() || undefined,
                    total_items: totalItems,
                    allocated_items: 0,
                }
            );

            // Create order items
            await Promise.all(
                orderItems.map(item =>
                    databases.createDocument(
                        DATABASE_ID,
                        COLLECTIONS.SCHOOL_ORDER_ITEMS,
                        ID.unique(),
                        {
                            school_order_id: newOrder.$id,
                            item_type_id: item.item_type_id,
                            quantity_needed: parseInt(item.quantity),
                            quantity_allocated: 0,
                        }
                    )
                )
            );

            Alert.alert('Success', `School Order ${orderNumber} created successfully!`, [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error) {
            console.error('Error creating school order:', error);
            Alert.alert('Error', 'Failed to create school order. Please try again.');
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
                {/* Order Details Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        School Order Details
                    </Text>

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        School *
                    </Text>
                    <ScrollView
                        style={[
                            styles.schoolPicker,
                            { backgroundColor: colors.background.secondary, borderColor: colors.ui.border },
                        ]}
                    >
                        {schools.map(school => (
                            <TouchableOpacity
                                key={school.$id}
                                style={[
                                    styles.schoolOption,
                                    selectedSchoolId === school.$id && {
                                        backgroundColor: `${colors.primary.cyan}20`,
                                    },
                                    { borderBottomColor: colors.ui.divider },
                                ]}
                                onPress={() => setSelectedSchoolId(school.$id)}
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

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Install Date *
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
                        value={installDate}
                        onChangeText={setInstallDate}
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
                        placeholder="Special instructions, install notes, etc..."
                        placeholderTextColor={colors.text.secondary}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Items Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            Items Needed ({orderItems.length})
                        </Text>
                        <TouchableOpacity
                            style={[styles.addButton, { backgroundColor: colors.primary.cyan }]}
                            onPress={() => setShowAddItem(true)}
                        >
                            <Text style={styles.addButtonText}>+ Add Item</Text>
                        </TouchableOpacity>
                    </View>

                    {orderItems.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                            No items added yet
                        </Text>
                    ) : (
                        orderItems.map((item, index) => (
                            <View
                                key={item.id}
                                style={[
                                    styles.orderItemCard,
                                    { backgroundColor: colors.background.secondary },
                                ]}
                            >
                                <View style={styles.orderItemHeader}>
                                    <Text style={[styles.orderItemNumber, { color: colors.text.secondary }]}>
                                        #{index + 1}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveOrderItem(item.id)}
                                        style={styles.removeButton}
                                    >
                                        <Text style={[styles.removeButtonText, { color: colors.secondary.red }]}>
                                            Remove
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.orderItemName, { color: colors.text.primary }]}>
                                    {item.item_type_name}
                                </Text>
                                <Text style={[styles.orderItemQuantity, { color: colors.primary.cyan }]}>
                                    Quantity Needed: {item.quantity}
                                </Text>
                            </View>
                        ))
                    )}

                    {/* Add Item Form */}
                    {showAddItem && (
                        <View
                            style={[
                                styles.addItemForm,
                                { backgroundColor: colors.background.secondary },
                            ]}
                        >
                            <Text style={[styles.formTitle, { color: colors.primary.coolGray }]}>
                                Add Item
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
                                        onPress={() => setSelectedItemType(itemType.$id)}
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
                                Quantity Needed *
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
                                        setShowAddItem(false);
                                        setSelectedItemType('');
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
                                    onPress={handleAddOrderItem}
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
                {orderItems.length > 0 && selectedSchoolId && (
                    <View style={[styles.summary, { backgroundColor: colors.secondary.purple }]}>
                        <Text style={styles.summaryTitle}>
                            {schools.find(s => s.$id === selectedSchoolId)?.school_name}
                        </Text>
                        <Text style={styles.summaryText}>
                            Total Items: {orderItems.reduce((sum, item) => sum + parseInt(item.quantity), 0)}
                        </Text>
                        {installDate && (
                            <Text style={styles.summaryText}>
                                Install Date: {new Date(installDate).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                            })}
                            </Text>
                        )}
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
                        <Text style={styles.submitButtonText}>Create School Order</Text>
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
    schoolPicker: {
        maxHeight: 200,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
    },
    schoolOption: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    schoolName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    schoolCode: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs / 2,
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
    orderItemCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    orderItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    orderItemNumber: {
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
    orderItemName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
    },
    orderItemQuantity: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    addItemForm: {
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
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    summaryTitle: {
        color: '#fff',
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    summaryText: {
        color: '#fff',
        fontSize: Typography.sizes.md,
        marginTop: Spacing.xs / 2,
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