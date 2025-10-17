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
    const [chargePrice, setChargePrice] = useState(existingItem?.charge_price?.toString() || '');
    const [isForSale, setIsForSale] = useState(existingItem?.is_for_sale || false);
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
        if (isForSale && !chargePrice.trim()) {
            Alert.alert('Required Field', 'Please enter a charge price for items marked for sale');
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
                charge_price: chargePrice ? parseFloat(chargePrice) : undefined,
                is_for_sale: isForSale,
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

    const calculateProfit = () => {
        if (!unitCost || !chargePrice) return 0;
        const cost = parseFloat(unitCost);
        const price = parseFloat(chargePrice);
        if (isNaN(cost) || isNaN(price)) return 0;
        return price - cost;
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
                        <ScrollView
                            style={[styles.pickerList, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border
                            }]}
                            nestedScrollEnabled={true}
                        >
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
                        </ScrollView>
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
                        <ScrollView
                            style={[styles.pickerList, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border
                            }]}
                            nestedScrollEnabled={true}
                        >
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
                        </ScrollView>
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

                {/* Pricing Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Pricing & Sales
                    </Text>

                    {/* For Sale Toggle */}
                    <TouchableOpacity
                        style={[styles.toggleContainer, {
                            backgroundColor: isForSale ? `${colors.primary.cyan}10` : colors.background.secondary
                        }]}
                        onPress={() => setIsForSale(!isForSale)}
                    >
                        <View style={styles.toggleTextContainer}>
                            <Text style={[styles.toggleLabel, { color: colors.text.primary }]}>
                                For Sale (Snacks/Drinks)
                            </Text>
                            <Text style={[styles.helperText, { color: colors.text.secondary }]}>
                                Enable if this item is sold to staff/students
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.checkbox,
                                {
                                    backgroundColor: isForSale ? colors.primary.cyan : colors.background.secondary,
                                    borderColor: colors.ui.border,
                                },
                            ]}
                        >
                            {isForSale && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                    </TouchableOpacity>

                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Unit Cost (What we pay)
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

                    {isForSale && (
                        <>
                            <Text style={[styles.label, { color: colors.text.primary }]}>
                                Charge Price * (What we sell for)
                            </Text>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                    color: colors.text.primary
                                }]}
                                value={chargePrice}
                                onChangeText={setChargePrice}
                                placeholder="0.00"
                                placeholderTextColor={colors.text.secondary}
                                keyboardType="decimal-pad"
                            />
                            {unitCost && chargePrice && calculateProfit() > 0 && (
                                <View style={[styles.profitBadge, { backgroundColor: '#27ae6020', borderColor: '#27ae60' }]}>
                                    <Text style={[styles.profitText, { color: '#27ae60' }]}>
                                        💰 ${calculateProfit().toFixed(2)} profit per {unit}
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Supplier Section */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Supplier Information (Optional)
                    </Text>

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
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        marginBottom: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 147, 178, 0.2)',
    },
    toggleTextContainer: {
        flex: 1,
        marginRight: Spacing.md,
    },
    toggleLabel: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    helperText: {
        fontSize: Typography.sizes.sm,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: BorderRadius.sm,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmark: {
        color: '#fff',
        fontSize: 18,
        fontWeight: Typography.weights.bold,
    },
    profitBadge: {
        marginTop: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
    },
    profitText: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        textAlign: 'center',
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