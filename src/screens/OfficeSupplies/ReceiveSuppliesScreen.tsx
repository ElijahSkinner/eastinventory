// src/screens/OfficeSupplies/ReceiveSuppliesScreen.tsx
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
    Pressable,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
    databases,
    DATABASE_ID,
    COLLECTIONS,
    OfficeSupplyItem,
} from '../../lib/appwrite';
import { Query, ID } from 'appwrite';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function ReceiveSuppliesScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();

    const [supplies, setSupplies] = useState<OfficeSupplyItem[]>([]);
    const [selectedSupply, setSelectedSupply] = useState<OfficeSupplyItem | null>(null);
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [vendor, setVendor] = useState('');
    const [notes, setNotes] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSupplyPicker, setShowSupplyPicker] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadSupplies();
        }, [])
    );

    const loadSupplies = async () => {
        try {
            setLoading(true);
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                [Query.limit(1000), Query.orderAsc('item_name')]
            );
            setSupplies(response.documents as unknown as OfficeSupplyItem[]);
        } catch (error) {
            console.error('Error loading supplies:', error);
            Alert.alert('Error', 'Failed to load supplies');
        } finally {
            setLoading(false);
        }
    };

    const filteredSupplies = supplies.filter(supply =>
        supply.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supply.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supply.supplier?.toLowerCase().includes(searchQuery.toLowerCase())
    );


    const handleSubmit = async () => {
        if (!selectedSupply) {
            Alert.alert('Required', 'Please select a supply item');
            return;
        }
        if (!quantity.trim()) {
            Alert.alert('Required', 'Please enter a quantity');
            return;
        }

        const quantityNum = parseInt(quantity);
        if (isNaN(quantityNum) || quantityNum <= 0) {
            Alert.alert('Invalid', 'Please enter a valid quantity greater than 0');
            return;
        }

        setSubmitting(true);

        try {
            const previousQty = selectedSupply.current_quantity;
            const newQty = previousQty + quantityNum;
            const costNum = unitCost ? parseFloat(unitCost) : undefined;

            console.log('📦 Receiving supplies:');
            console.log('  - Item:', selectedSupply.item_name);
            console.log('  - Item ID:', selectedSupply.$id);  // ✅ This is what we'll use for supply_item_id
            console.log('  - Previous qty:', previousQty);
            console.log('  - New qty:', newQty);

            // Update supply item quantity
            await databases.updateDocument(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_ITEMS,
                selectedSupply.$id,
                {
                    current_quantity: newQty,
                    // Optionally update unit cost if provided
                    ...(costNum && { unit_cost: costNum }),
                    // Optionally update vendor if provided
                    ...(vendor.trim() && { supplier: vendor.trim() }),
                }
            );

            console.log('✅ Updated item quantity');

            // Log transaction
            // ✅ FIX: Use selectedSupply.$id for supply_item_id
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.OFFICE_SUPPLY_TRANSACTIONS,
                ID.unique(),
                {
                    supply_item_id: selectedSupply.$id,  // ✅ This is the document ID from office_supply_items
                    transaction_type: 'received',
                    quantity: quantityNum,
                    previous_quantity: previousQty,
                    new_quantity: newQty,
                    performed_by: user?.name || 'Unknown',
                    transaction_date: new Date().toISOString(),
                    unit_cost_at_transaction: costNum || undefined,
                    notes: notes.trim() || `Received ${quantityNum} ${selectedSupply.unit}(s) from ${vendor.trim() || 'vendor'}`,
                }
            );

            console.log('✅ Created transaction');

            Alert.alert(
                'Success!',
                `Received ${quantityNum} ${selectedSupply.unit}(s) of ${selectedSupply.item_name}\n\nNew quantity: ${newQty}`
            );

            // Reset form
            setSelectedSupply(null);
            setQuantity('');
            setUnitCost('');
            setVendor('');
            setNotes('');
            setSearchQuery('');
            loadSupplies();
        } catch (error: any) {
            console.error('❌ Error receiving supplies:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            Alert.alert('Error', `Failed to receive supplies: ${error.message || 'Unknown error'}\n\nPlease check the console for details.`);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.secondary.orange} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
            <ScrollView style={styles.content}>
                {/* Instructions */}
                <View style={[styles.infoCard, { backgroundColor: colors.secondary.orange + '20' }]}>
                    <Text style={[styles.infoText, { color: colors.text.primary }]}>
                        📦 Log incoming supplies from vendors or deliveries
                    </Text>
                </View>

                {/* Select Supply */}
                <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Select Supply Item
                    </Text>

                    {selectedSupply ? (
                        <View style={[styles.selectedSupplyCard, {
                            backgroundColor: colors.secondary.orange + '10',
                            borderColor: colors.secondary.orange
                        }]}>
                            <View style={styles.selectedSupplyHeader}>
                                <View style={styles.selectedSupplyInfo}>
                                    <Text style={[styles.selectedSupplyName, { color: colors.text.primary }]}>
                                        {selectedSupply.item_name}
                                    </Text>
                                    <Text style={[styles.selectedSupplyCategory, { color: colors.text.secondary }]}>
                                        {selectedSupply.category}
                                    </Text>
                                    <Text style={[styles.selectedSupplyQuantity, { color: colors.secondary.orange }]}>
                                        Current: {selectedSupply.current_quantity} {selectedSupply.unit}s
                                    </Text>
                                    {selectedSupply.supplier && (
                                        <Text style={[styles.selectedSupplyVendor, { color: colors.text.secondary }]}>
                                            Supplier: {selectedSupply.supplier}
                                        </Text>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={[styles.changeButton, { backgroundColor: colors.secondary.orange }]}
                                    onPress={() => {
                                        setSelectedSupply(null);
                                        setShowSupplyPicker(true);
                                    }}
                                >
                                    <Text style={styles.changeButtonText}>Change</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.selectButton, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border
                            }]}
                            onPress={() => setShowSupplyPicker(true)}
                        >
                            <Text style={[styles.selectButtonText, { color: colors.text.secondary }]}>
                                Tap to select supply item...
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Receiving Form */}
                {selectedSupply && (
                    <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
                        <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                            Receiving Details
                        </Text>

                        <Text style={[styles.label, { color: colors.text.primary }]}>
                            Quantity Received *
                        </Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                                color: colors.text.primary
                            }]}
                            value={quantity}
                            onChangeText={setQuantity}
                            placeholder={`Enter number of ${selectedSupply.unit}s`}
                            placeholderTextColor={colors.text.secondary}
                            keyboardType="number-pad"
                        />

                        <Text style={[styles.label, { color: colors.text.primary }]}>
                            Unit Cost (Optional)
                        </Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                                color: colors.text.primary
                            }]}
                            value={unitCost}
                            onChangeText={setUnitCost}
                            placeholder={selectedSupply.unit_cost ? `$${selectedSupply.unit_cost.toFixed(2)}` : '0.00'}
                            placeholderTextColor={colors.text.secondary}
                            keyboardType="decimal-pad"
                        />

                        <Text style={[styles.label, { color: colors.text.primary }]}>
                            Vendor (Optional)
                        </Text>
                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                                color: colors.text.primary
                            }]}
                            value={vendor}
                            onChangeText={setVendor}
                            placeholder={selectedSupply.supplier || 'Enter vendor name'}
                            placeholderTextColor={colors.text.secondary}
                        />

                        <Text style={[styles.label, { color: colors.text.primary }]}>
                            Notes (Optional)
                        </Text>
                        <TextInput
                            style={[styles.input, styles.textArea, {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                                color: colors.text.primary
                            }]}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="e.g., Invoice #12345, Order from Amazon"
                            placeholderTextColor={colors.text.secondary}
                            multiline
                            numberOfLines={3}
                        />

                        {/* Preview */}
                        {quantity && parseInt(quantity) > 0 && (
                            <View style={[styles.previewCard, {
                                backgroundColor: colors.primary.cyan + '10',
                                borderColor: colors.primary.cyan
                            }]}>
                                <Text style={[styles.previewLabel, { color: colors.text.secondary }]}>
                                    New quantity will be:
                                </Text>
                                <Text style={[styles.previewValue, { color: colors.primary.cyan }]}>
                                    {selectedSupply.current_quantity + parseInt(quantity)} {selectedSupply.unit}s
                                </Text>
                                <Text style={[styles.previewIncrease, { color: colors.status.available }]}>
                                    ↑ +{quantity} from receiving
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Supply Picker Modal */}
            <Modal
                visible={showSupplyPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowSupplyPicker(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowSupplyPicker(false)}
                >
                    <Pressable
                        style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={[styles.modalHeader, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[styles.modalTitle, { color: colors.primary.coolGray }]}>
                                Select Supply Item
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowSupplyPicker(false)}
                                style={styles.closeButton}
                            >
                                <Text style={[styles.closeButtonText, { color: colors.text.secondary }]}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <TextInput
                                style={[styles.searchInput, {
                                    backgroundColor: colors.background.secondary,
                                    color: colors.text.primary,
                                    borderColor: colors.ui.border
                                }]}
                                placeholder="Search supplies..."
                                placeholderTextColor={colors.text.secondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <ScrollView style={styles.modalContent}>
                            {filteredSupplies.map(supply => (
                                <TouchableOpacity
                                    key={supply.$id}
                                    style={[styles.supplyOption, { borderBottomColor: colors.ui.divider }]}
                                    onPress={() => {
                                        setSelectedSupply(supply);
                                        setVendor(supply.supplier || '');
                                        setShowSupplyPicker(false);
                                        setSearchQuery('');
                                    }}
                                >
                                    <View style={styles.supplyOptionInfo}>
                                        <Text style={[styles.supplyOptionName, { color: colors.text.primary }]}>
                                            {supply.item_name}
                                        </Text>
                                        <Text style={[styles.supplyOptionCategory, { color: colors.text.secondary }]}>
                                            {supply.category} • {supply.current_quantity} {supply.unit}s in stock
                                        </Text>
                                        {supply.supplier && (
                                            <Text style={[styles.supplyOptionVendor, { color: colors.text.secondary }]}>
                                                Supplier: {supply.supplier}
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Submit Button */}
            {selectedSupply && (
                <View style={[styles.footer, {
                    backgroundColor: colors.background.primary,
                    borderTopColor: colors.ui.border
                }]}>
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.secondary.orange }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>
                                📦 Receive Supplies
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
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
    infoCard: {
        margin: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    infoText: {
        fontSize: Typography.sizes.md,
        textAlign: 'center',
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
    selectButton: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        alignItems: 'center',
    },
    selectButtonText: {
        fontSize: Typography.sizes.md,
    },
    selectedSupplyCard: {
        borderWidth: 2,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
    },
    selectedSupplyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    selectedSupplyInfo: {
        flex: 1,
    },
    selectedSupplyName: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
    },
    selectedSupplyCategory: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs,
    },
    selectedSupplyQuantity: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    selectedSupplyVendor: {
        fontSize: Typography.sizes.sm,
    },
    changeButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        marginLeft: Spacing.md,
    },
    changeButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
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
    previewCard: {
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        alignItems: 'center',
    },
    previewLabel: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs,
    },
    previewValue: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs / 2,
    },
    previewIncrease: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '80%',
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
        padding: Spacing.xs,
    },
    closeButtonText: {
        fontSize: 24,
    },
    searchContainer: {
        padding: Spacing.md,
    },
    searchInput: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    modalContent: {
        maxHeight: 400,
    },
    supplyOption: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    supplyOptionInfo: {
        flex: 1,
    },
    supplyOptionName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs / 2,
    },
    supplyOptionCategory: {
        fontSize: Typography.sizes.sm,
        marginBottom: Spacing.xs / 2,
    },
    supplyOptionVendor: {
        fontSize: Typography.sizes.sm,
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
});