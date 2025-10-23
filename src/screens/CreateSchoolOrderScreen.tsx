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
    Modal,
    Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { databases, DATABASE_ID, COLLECTIONS, School, ItemType } from '../lib/appwrite';
import { ID, Query } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows, CommonStyles } from '../theme';

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
    const [showSchoolPicker, setShowSchoolPicker] = useState(false);
    const [showItemTypePicker, setShowItemTypePicker] = useState(false);
    const [selectedItemType, setSelectedItemType] = useState('');
    const [newQuantity, setNewQuantity] = useState('');
    const [schoolSearch, setSchoolSearch] = useState('');
    const [itemTypeSearch, setItemTypeSearch] = useState('');

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

    // Filter schools based on search
    const filteredSchools = schools.filter(school =>
        school.school_name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
        school.school_code.toLowerCase().includes(schoolSearch.toLowerCase())
    );

    // Filter item types based on search
    const filteredItemTypes = itemTypes.filter(type =>
        type.item_name.toLowerCase().includes(itemTypeSearch.toLowerCase()) ||
        type.category.toLowerCase().includes(itemTypeSearch.toLowerCase())
    );

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
        setItemTypeSearch('');
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
                    order_status: 'planning',
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

    const getSelectedSchoolName = () => {
        const school = schools.find(s => s.$id === selectedSchoolId);
        return school ? school.school_name : 'Select school...';
    };

    const getSelectedItemTypeName = () => {
        const itemType = itemTypes.find(it => it.$id === selectedItemType);
        return itemType ? itemType.item_name : 'Select item type...';
    };

    if (loading) {
        return (
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <View style={[CommonStyles.containers.flex, { backgroundColor: colors.background.secondary }]}>
            <ScrollView style={CommonStyles.containers.flex}>
                {/* Order Details Section */}
                <View style={[CommonStyles.sections.container, { backgroundColor: colors.background.primary }]}>
                    <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                        School Order Details
                    </Text>

                    <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                        School *
                    </Text>
                    <TouchableOpacity
                        style={[
                            styles.pickerButton,
                            {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                            },
                        ]}
                        onPress={() => setShowSchoolPicker(true)}
                    >
                        <Text
                            style={[
                                styles.pickerButtonText,
                                {
                                    color: selectedSchoolId
                                        ? colors.text.primary
                                        : colors.text.secondary,
                                },
                            ]}
                        >
                            {getSelectedSchoolName()}
                        </Text>
                        <Text style={[styles.pickerArrow, { color: colors.text.secondary }]}>›</Text>
                    </TouchableOpacity>

                    <Text style={[CommonStyles.forms.label, { color: colors.text.primary }]}>
                        Install Date *
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
                        value={installDate}
                        onChangeText={setInstallDate}
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
                        placeholder="Special instructions, install notes, etc..."
                        placeholderTextColor={colors.text.secondary}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Items Section */}
                <View style={[CommonStyles.sections.container, { backgroundColor: colors.background.primary }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                            Items Needed ({orderItems.length})
                        </Text>
                        <TouchableOpacity
                            style={[CommonStyles.buttons.primary, { backgroundColor: colors.primary.cyan }]}
                            onPress={() => setShowAddItem(true)}
                        >
                            <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>+ Add Item</Text>
                        </TouchableOpacity>
                    </View>

                    {orderItems.length === 0 ? (
                        <Text style={[CommonStyles.empty.subtext, { color: colors.text.secondary, textAlign: 'center', padding: Spacing.lg }]}>
                            No items added yet
                        </Text>
                    ) : (
                        orderItems.map((item, index) => (
                            <View
                                key={item.id}
                                style={[
                                    CommonStyles.cards.compact,
                                    { backgroundColor: colors.background.secondary, marginBottom: Spacing.sm },
                                ]}
                            >
                                <View style={CommonStyles.rows.base}>
                                    <Text style={[styles.orderItemNumber, { color: colors.text.secondary }]}>
                                        #{index + 1}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveOrderItem(item.id)}
                                        style={{ padding: Spacing.xs }}
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
                                CommonStyles.cards.compact,
                                { backgroundColor: colors.background.secondary, marginTop: Spacing.md },
                            ]}
                        >
                            <Text style={[CommonStyles.sections.title, { color: colors.primary.coolGray }]}>
                                Add Item
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
                                Quantity Needed *
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
                                        setShowAddItem(false);
                                        setSelectedItemType('');
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
                                    onPress={handleAddOrderItem}
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

            {/* School Picker Modal */}
            <Modal visible={showSchoolPicker} transparent animationType="slide">
                <Pressable
                    style={CommonStyles.modals.overlay}
                    onPress={() => setShowSchoolPicker(false)}
                >
                    <Pressable
                        style={[styles.modalContainerFixed, { backgroundColor: colors.background.primary }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[CommonStyles.modals.header, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[CommonStyles.modals.title, { color: colors.primary.coolGray }]}>
                                Select School
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setShowSchoolPicker(false);
                                setSchoolSearch('');
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
                                placeholder="Search schools..."
                                placeholderTextColor={colors.text.secondary}
                                value={schoolSearch}
                                onChangeText={setSchoolSearch}
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Scrollable list */}
                        <ScrollView
                            style={styles.modalScrollView}
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                        >
                            {filteredSchools.map((school) => (
                                <TouchableOpacity
                                    key={school.$id}
                                    style={[CommonStyles.lists.item, { borderBottomColor: colors.ui.divider }]}
                                    onPress={() => {
                                        setSelectedSchoolId(school.$id);
                                        setShowSchoolPicker(false);
                                        setSchoolSearch('');
                                    }}
                                >
                                    <View style={CommonStyles.containers.flex}>
                                        <Text style={[styles.schoolName, { color: colors.text.primary }]}>
                                            {school.school_name}
                                        </Text>
                                        <Text style={[styles.schoolCode, { color: colors.text.secondary }]}>
                                            Code: {school.school_code}
                                        </Text>
                                    </View>
                                    {selectedSchoolId === school.$id && (
                                        <Text style={[styles.checkmark, { color: colors.primary.cyan }]}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

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
                                        setShowItemTypePicker(false);
                                        setItemTypeSearch('');
                                    }}
                                >
                                    <View style={CommonStyles.containers.flex}>
                                        <Text style={[styles.itemTypeName, { color: colors.text.primary }]}>
                                            {type.item_name}
                                        </Text>
                                        <Text style={[styles.itemTypeCategory, { color: colors.text.secondary }]}>
                                            {type.category}
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
                        <Text style={[CommonStyles.buttons.text, { color: '#fff' }]}>Create School Order</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
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
    orderItemNumber: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.bold,
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
    formButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
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
    schoolName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    schoolCode: {
        fontSize: Typography.sizes.sm,
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