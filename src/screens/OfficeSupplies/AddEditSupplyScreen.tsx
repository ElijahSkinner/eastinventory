// src/screens/OfficeSupplies/AddEditSupplyScreen.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    OfficeSupplyItem,
    SUPPLY_CATEGORIES,
    SUPPLY_UNITS,
} from '../../lib/appwrite';
import { ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function AddEditSupplyScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();
    const route = useRoute();

    const existingItem = (route.params as any)?.item as OfficeSupplyItem | undefined;
    const isEditing = !!existingItem;

    const [itemName, setItemName] = useState(existingItem?.item_name || '');
    const [category, setCategory] = useState(existingItem?.category || '');
    const [unit, setUnit] = useState(existingItem?.unit || '');
    const [currentQuantity, setCurrentQuantity] = useState(
        existingItem?.current_quantity?.toString() || '0'
    );
    const [reorderPoint, setReorderPoint] = useState(
        existingItem?.reorder_point?.toString() || ''
    );
    const [reorderQuantity, setReorderQuantity] = useState(
        existingItem?.reorder_quantity?.toString() || ''
    );
    const [unitCost, setUnitCost] = useState(existingItem?.unit_cost?.toString() || '');
    const [supplier, setSupplier] = useState(existingItem?.supplier || '');
    const [supplierSKU, setSupplierSKU] = useState(existingItem?.supplier_sku || '');
    const [location, setLocation] = useState(existingItem?.location || '');
    const [notes, setNotes] = useState(existingItem?.notes || '');

    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        // Validation
        if (!itemName.trim()) {
            Alert.alert('Required Field', 'Please enter an item name');
            return;
        }
        if (!category) {
            Alert.alert('Required Field', 'Please select a category');
            return;
        }
        if (!unit) {
            Alert.alert('Required Field', 'Please select a unit');
            return;
        }
        if (!reorderPoint.trim()) {
            Alert.alert('Required Field', 'Please enter a reorder point');
            return;
        }
        if (!reorderQuantity.trim()) {
            Alert.alert('Required Field', 'Please enter a reorder quantity');
            return;
        }

        const reorderPointNum = parseInt(reorderPoint);
        const reorderQuantityNum = parseInt(reorderQuantity);
        const currentQuantityNum = parseInt(currentQuantity) || 0;

        if (isNaN(reorderPointNum) || reorderPointNum < 0) {
            Alert.alert('Invalid Input', 'Reorder point must be a positive number');
            return;
        }
        if (isNaN(reorderQuantityNum) || reorderQuantityNum <= 0) {
            Alert.alert('Invalid Input', 'Reorder quantity must be greater than 0');
            return;
        }

        setSubmitting(true);

        try {
            const data = {
                item_name: itemName.trim(),
                category,
                unit,
                current_quantity: currentQuantityNum,
                reorder_point: reorderPointNum,
                reorder_quantity: reorderQuantityNum,
                unit_cost: unitCost ? parseFloat(unitCost) : undefined,
                supplier: supplier.trim() || undefined,
                supplier_sku: supplierSKU.trim() || undefined,
                location: location.trim() || undefined,
                notes: notes.trim() || undefined,
            };

            if (isEditing && existingItem) {
                await databases.updateDocument(
                    DATABASE_ID,
                    COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                    existingItem.$id,
                    data
                );
                Alert.alert('Success', 'Supply item updated successfully!');
            } else {
                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                    ID.unique(),
                    data
                );
                Alert.alert('Success', 'Supply item added successfully!');
            }

            navigation.goBack();
        } catch (error) {
            console.error('Error saving supply:', error);
            Alert.alert('Error', 'Failed to save supply item. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            <ScrollView style={styles.content}>
                {/* Basic Info Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Basic Information
                    </Text>

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Item Name *
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={itemName}
                        onChangeText={setItemName}
                        placeholder="e.g., Printer Paper"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Category *
                    </Text>
                    <TouchableOpacity
                        style={[styles.pickerButton, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border
                        }]}
                        onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                    >
                        <Text style={[styles.pickerText, {
                            color: category ? colors.text.primary : colors.text.secondary
                        }]}>
                            {category || 'Select category...'}
                        </Text>
                        <Text style={[styles.pickerArrow, { color: colors.text.secondary }]}>›</Text>
                    </TouchableOpacity>

                    {showCategoryPicker && (
                        <View style={[styles.pickerList, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border
                        }]}>
                            {SUPPLY_CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.pickerItem, { borderBottomColor: colors.ui.divider }]}
                                    onPress={() => {
                                        setCategory(cat);
                                        setShowCategoryPicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, { color: colors.text.primary }]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Unit *
                    </Text>
                    <TouchableOpacity
                        style={[styles.pickerButton, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border
                        }]}
                        onPress={() => setShowUnitPicker(!showUnitPicker)}
                    >
                        <Text style={[styles.pickerText, {
                            color: unit ? colors.text.primary : colors.text.secondary
                        }]}>
                            {unit || 'Select unit...'}
                        </Text>
                        <Text style={[styles.pickerArrow, { color: colors.text.secondary }]}>›</Text>
                    </TouchableOpacity>

                    {showUnitPicker && (
                        <View style={[styles.pickerList, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border
                        }]}>
                            {SUPPLY_UNITS.map(u => (
                                <TouchableOpacity
                                    key={u}
                                    style={[styles.pickerItem, { borderBottomColor: colors.ui.divider }]}
                                    onPress={() => {
                                        setUnit(u);
                                        setShowUnitPicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, { color: colors.text.primary }]}>
                                        {u}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Inventory Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Inventory Settings
                    </Text>

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Current Quantity
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={currentQuantity}
                        onChangeText={setCurrentQuantity}
                        placeholder="0"
                        placeholderTextColor={colors.text.secondary}
                        keyboardType="number-pad"
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Reorder Point * (Alert when below this)
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={reorderPoint}
                        onChangeText={setReorderPoint}
                        placeholder="e.g., 5"
                        placeholderTextColor={colors.text.secondary}
                        keyboardType="number-pad"
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Reorder Quantity * (How many to order)
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={reorderQuantity}
                        onChangeText={setReorderQuantity}
                        placeholder="e.g., 10"
                        placeholderTextColor={colors.text.secondary}
                        keyboardType="number-pad"
                    />
                </View>

                {/* Supplier Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Supplier Information (Optional)
                    </Text>

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Unit Cost
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={unitCost}
                        onChangeText={setUnitCost}
                        placeholder="0.00"
                        placeholderTextColor={colors.text.secondary}
                        keyboardType="decimal-pad"
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Supplier
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={supplier}
                        onChangeText={setSupplier}
                        placeholder="e.g., Office Depot"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Supplier SKU
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={supplierSKU}
                        onChangeText={setSupplierSKU}
                        placeholder="Supplier's product code"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Storage Location
                    </Text>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={location}
                        onChangeText={setLocation}
                        placeholder="e.g., Supply Closet, Shelf B"
                        placeholderTextColor={colors.text.secondary}
                    />

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Notes
                    </Text>
                    <TextInput
                        style={[styles.input, styles.textArea, {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.ui.border,
                            color: colors.text.primary
                        }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Additional notes..."
                        placeholderTextColor={colors.text.secondary}
                        multiline
                        numberOfLines={3}
                    />
                </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.footer, {
                backgroundColor: colors.background.primary,
                borderTopColor: colors.ui.border
            }]}>
                <TouchableOpacity
                    style={[styles.button, styles.cancelButton, {
                        backgroundColor: colors.background.secondary,
                        borderColor: colors.ui.border
                    }]}
                    onPress={() => navigation.goBack()}
                    disabled={submitting}
                >
                    <Text style={[styles.buttonText, { color: colors.text.primary }]}>
                        Cancel
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.submitButton, {
                        backgroundColor: colors.secondary.orange
                    }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={[styles.buttonText, { color: '#fff' }]}>
                            {isEditing ? 'Update Supply' : 'Add Supply'}
                        </Text>
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
        margin: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
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
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
    },
    pickerText: {
        fontSize: Typography.sizes.md,
        flex: 1,
    },
    pickerArrow: {
        fontSize: 24,
    },
    pickerList: {
        marginTop: Spacing.xs,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        maxHeight: 200,
    },
    pickerItem: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    pickerItemText: {
        fontSize: Typography.sizes.md,
    },
    footer: {
        flexDirection: 'row',
        padding: Spacing.md,
        gap: Spacing.md,
        borderTopWidth: 1,
    },
    button: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.sm,
    },
    cancelButton: {
        borderWidth: 1,
    },
    submitButton: {},
    buttonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
});