// src/components/modals/NewItemModal.tsx
import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    FlatList,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { databases, DATABASE_ID, COLLECTIONS, School } from '../../lib/appwrite';

interface NewItemModalProps {
    visible: boolean;
    barcode: string;
    onConfirm: (itemData: NewItemData) => void;
    onCancel: () => void;
}

export interface NewItemData {
    item_name: string;
    category: string;
    manufacturer?: string;
    model?: string;
    description?: string;
    serial_number?: string;
    location?: string;
    is_school_specific: boolean;
    school_id?: string;
}

const CATEGORIES = [
    'Camera',
    'NAS',
    'Microphone',
    'Tripod',
    'Lighting',
    'Computer',
    'Monitor',
    'Audio Equipment',
    'Cables & Adapters',
    'Other',
];

export default function NewItemModal({
                                         visible,
                                         barcode,
                                         onConfirm,
                                         onCancel,
                                     }: NewItemModalProps) {
    const { colors } = useTheme();

    const [itemName, setItemName] = useState('');
    const [category, setCategory] = useState('');
    const [manufacturer, setManufacturer] = useState('');
    const [model, setModel] = useState('');
    const [description, setDescription] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [location, setLocation] = useState('');
    const [isSchoolSpecific, setIsSchoolSpecific] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [showSchoolPicker, setShowSchoolPicker] = useState(false);
    const [loadingSchools, setLoadingSchools] = useState(false);

    // Load schools when modal opens and isSchoolSpecific is true
    useEffect(() => {
        if (visible && isSchoolSpecific && schools.length === 0) {
            loadSchools();
        }
    }, [visible, isSchoolSpecific]);

    const loadSchools = async () => {
        setLoadingSchools(true);
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.SCHOOLS
            );
            setSchools(response.documents as unknown as School[]);
        } catch (error) {
            console.error('Error loading schools:', error);
        } finally {
            setLoadingSchools(false);
        }
    };

    const handleSubmit = () => {
        if (!itemName.trim() || !category.trim()) {
            alert('Please fill in Item Name and Category');
            return;
        }

        const itemData: NewItemData = {
            item_name: itemName.trim(),
            category: category.trim(),
            manufacturer: manufacturer.trim() || undefined,
            model: model.trim() || undefined,
            description: description.trim() || undefined,
            serial_number: serialNumber.trim() || undefined,
            location: location.trim() || undefined,
            is_school_specific: isSchoolSpecific,
        };

        onConfirm(itemData);
        resetForm();
    };

    const handleCancel = () => {
        resetForm();
        onCancel();
    };

    const resetForm = () => {
        setItemName('');
        setCategory('');
        setManufacturer('');
        setModel('');
        setDescription('');
        setSerialNumber('');
        setLocation('');
        setIsSchoolSpecific(false);
        setShowCategoryPicker(false);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleCancel}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
            >
                <Pressable style={styles.overlay} onPress={handleCancel}>
                    <Pressable
                        style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <View style={[styles.header, { borderBottomColor: colors.ui.border }]}>
                            <Text style={[styles.title, { color: colors.primary.coolGray }]}>
                                New Item Detected
                            </Text>
                            <Text style={[styles.barcodeText, { color: colors.text.secondary }]}>
                                Barcode: {barcode}
                            </Text>
                        </View>

                        {/* Form */}
                        <ScrollView style={styles.formContainer}>
                            {/* Item Name - Required */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>
                                    Item Name <Text style={[styles.required, { color: colors.secondary.red }]}>*</Text>
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
                                    placeholder="e.g., Canon XA60 Camera"
                                    placeholderTextColor={colors.text.secondary}
                                    value={itemName}
                                    onChangeText={setItemName}
                                />
                            </View>

                            {/* Category - Required */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>
                                    Category <Text style={[styles.required, { color: colors.secondary.red }]}>*</Text>
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.input,
                                        styles.pickerButton,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                        },
                                    ]}
                                    onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                                >
                                    <Text style={[styles.pickerText, { color: category ? colors.text.primary : colors.text.secondary }]}>
                                        {category || 'Select category...'}
                                    </Text>
                                </TouchableOpacity>

                                {showCategoryPicker && (
                                    <View style={[styles.categoryList, { backgroundColor: colors.background.secondary, borderColor: colors.ui.border }]}>
                                        {CATEGORIES.map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                style={[styles.categoryItem, { borderBottomColor: colors.ui.divider }]}
                                                onPress={() => {
                                                    setCategory(cat);
                                                    setShowCategoryPicker(false);
                                                }}
                                            >
                                                <Text style={[styles.categoryText, { color: colors.text.primary }]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Manufacturer */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>Manufacturer</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="e.g., Canon"
                                    placeholderTextColor={colors.text.secondary}
                                    value={manufacturer}
                                    onChangeText={setManufacturer}
                                />
                            </View>

                            {/* Model */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>Model</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="e.g., XA60"
                                    placeholderTextColor={colors.text.secondary}
                                    value={model}
                                    onChangeText={setModel}
                                />
                            </View>

                            {/* Serial Number */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>Serial Number</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="Optional"
                                    placeholderTextColor={colors.text.secondary}
                                    value={serialNumber}
                                    onChangeText={setSerialNumber}
                                />
                            </View>

                            {/* Location */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>Storage Location</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.background.secondary,
                                            borderColor: colors.ui.border,
                                            color: colors.text.primary,
                                        },
                                    ]}
                                    placeholder="e.g., Shelf A-3"
                                    placeholderTextColor={colors.text.secondary}
                                    value={location}
                                    onChangeText={setLocation}
                                />
                            </View>

                            {/* Description */}
                            <View style={styles.fieldContainer}>
                                <Text style={[styles.label, { color: colors.text.primary }]}>Description</Text>
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
                                    placeholder="Additional notes..."
                                    placeholderTextColor={colors.text.secondary}
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            {/* School Specific Toggle */}
                            <TouchableOpacity
                                style={styles.toggleContainer}
                                onPress={() => setIsSchoolSpecific(!isSchoolSpecific)}
                            >
                                <View style={styles.toggleTextContainer}>
                                    <Text style={[styles.label, { color: colors.text.primary }]}>
                                        School-Specific Item (NAS)
                                    </Text>
                                    <Text style={[styles.helperText, { color: colors.text.secondary }]}>
                                        Check if this item is tied to a specific school
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.checkbox,
                                        {
                                            backgroundColor: isSchoolSpecific ? colors.primary.cyan : colors.background.secondary,
                                            borderColor: colors.ui.border,
                                        },
                                    ]}
                                >
                                    {isSchoolSpecific && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Buttons */}
                        <View style={[styles.buttonContainer, { borderTopColor: colors.ui.border }]}>
                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    styles.cancelButton,
                                    { backgroundColor: colors.background.secondary, borderColor: colors.ui.border },
                                ]}
                                onPress={handleCancel}
                            >
                                <Text style={[styles.buttonText, { color: colors.text.primary }]}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.confirmButton, { backgroundColor: colors.primary.cyan }]}
                                onPress={handleSubmit}
                            >
                                <Text style={[styles.buttonText, { color: colors.text.white }]}>Add Item</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    keyboardAvoid: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '90%',
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        ...Shadows.lg,
    },
    header: {
        padding: Spacing.lg,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    barcodeText: {
        fontSize: Typography.sizes.sm,
        fontFamily: 'monospace',
    },
    formContainer: {
        padding: Spacing.lg,
        maxHeight: 500,
    },
    fieldContainer: {
        marginBottom: Spacing.md,
    },
    label: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.medium,
        marginBottom: Spacing.xs,
    },
    required: {
        fontSize: Typography.sizes.md,
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
        justifyContent: 'center',
    },
    pickerText: {
        fontSize: Typography.sizes.md,
    },
    categoryList: {
        marginTop: Spacing.xs,
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        maxHeight: 200,
    },
    categoryItem: {
        padding: Spacing.md,
        borderBottomWidth: 1,
    },
    categoryText: {
        fontSize: Typography.sizes.md,
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        marginBottom: Spacing.md,
    },
    toggleTextContainer: {
        flex: 1,
    },
    helperText: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.md,
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonContainer: {
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
    confirmButton: {},
    buttonText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
});