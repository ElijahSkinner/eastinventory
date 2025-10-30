// src/screens/PackageTracking/ReceivePackageScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { databases, DATABASE_ID, ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import {
    PackageRecipient,
    PackageSender,
    PACKAGE_SENDERS,
    CARRIERS,
    generateTrackingNumber,
} from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function ReceivePackageScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();

    // Form state
    const [sender, setSender] = useState<PackageSender>('Drawdown');
    const [senderCustom, setSenderCustom] = useState('');
    const [carrier, setCarrier] = useState('');
    const [numberOfPackages, setNumberOfPackages] = useState('1');
    const [addressedToType, setAddressedToType] = useState<'staff' | 'custom'>('staff');
    const [selectedRecipient, setSelectedRecipient] = useState<PackageRecipient | null>(null);
    const [customRecipientName, setCustomRecipientName] = useState('');

    // Data
    const [recipients, setRecipients] = useState<PackageRecipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadRecipients();
    }, []);

    const loadRecipients = async () => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                'package_recipients',
                [Query.equal('active', true), Query.orderAsc('name')]
            );
            setRecipients(response.documents as unknown as PackageRecipient[]);
        } catch (error) {
            console.error('Error loading recipients:', error);
            Alert.alert('Error', 'Failed to load recipient list');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (sender === 'Custom' && !senderCustom.trim()) {
            Alert.alert('Validation Error', 'Please enter the custom sender name');
            return;
        }

        if (addressedToType === 'staff' && !selectedRecipient) {
            Alert.alert('Validation Error', 'Please select a recipient');
            return;
        }

        if (addressedToType === 'custom' && !customRecipientName.trim()) {
            Alert.alert('Validation Error', 'Please enter the recipient name');
            return;
        }

        const numPackages = parseInt(numberOfPackages);
        if (isNaN(numPackages) || numPackages < 1) {
            Alert.alert('Validation Error', 'Please enter a valid number of packages');
            return;
        }

        setSubmitting(true);

        try {
            const trackingNumber = generateTrackingNumber();
            const addressedTo =
                addressedToType === 'staff'
                    ? selectedRecipient!.name
                    : customRecipientName.trim();

            const packageData = {
                tracking_number: trackingNumber,
                sender: sender === 'Custom' ? senderCustom.trim() : sender,
                carrier: carrier || null,
                number_of_packages: numPackages,
                received_date: new Date().toISOString(),
                addressed_to: addressedTo,
                addressed_to_type: addressedToType,
                addressed_to_id: addressedToType === 'staff' ? selectedRecipient!.$id : null,
                location: 'Reception',
                status: 'pending_confirmation',
                received_by: user?.name || user?.email || 'Unknown',
                notification_sent: false,
                reminder_sent: false,
                reminder_count: 0,
            };

            await databases.createDocument(
                DATABASE_ID,
                'packages',
                ID.unique(),
                packageData
            );

            // TODO: Send notification to recipient

            Alert.alert(
                'Success',
                `Package ${trackingNumber} received successfully!`,
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            navigation.goBack();
                        },
                    },
                ]
            );
        } catch (error: any) {
            console.error('Error creating package:', error);
            Alert.alert('Error', 'Failed to create package record: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background.primary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background.primary }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.primary.coolGray }]}>
                        📥 Receive Package
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                        Date/Time: Auto-filled ({new Date().toLocaleString()})
                    </Text>
                </View>

                {/* Sender Section */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Delivered By (Sender) *
                    </Text>
                    <View style={[styles.pickerContainer, { borderColor: colors.ui.border }]}>
                        <Picker
                            selectedValue={sender}
                            onValueChange={(value) => setSender(value as PackageSender)}
                            style={{ color: colors.text.primary }}
                        >
                            {PACKAGE_SENDERS.map((s) => (
                                <Picker.Item key={s} label={s} value={s} />
                            ))}
                        </Picker>
                    </View>

                    {sender === 'Custom' && (
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                    color: colors.text.primary,
                                },
                            ]}
                            placeholder="Enter custom sender name"
                            placeholderTextColor={colors.text.secondary}
                            value={senderCustom}
                            onChangeText={setSenderCustom}
                        />
                    )}
                </View>

                {/* Number of Packages */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Number of Packages *
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
                        placeholder="Enter number"
                        placeholderTextColor={colors.text.secondary}
                        keyboardType="number-pad"
                        value={numberOfPackages}
                        onChangeText={setNumberOfPackages}
                    />
                </View>

                {/* Carrier (Optional) */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Carrier (Optional)
                    </Text>
                    <View style={[styles.pickerContainer, { borderColor: colors.ui.border }]}>
                        <Picker
                            selectedValue={carrier}
                            onValueChange={(value) => setCarrier(value)}
                            style={{ color: colors.text.primary }}
                        >
                            <Picker.Item label="Select carrier..." value="" />
                            {CARRIERS.map((c) => (
                                <Picker.Item key={c} label={c} value={c} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* Addressed To Section */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Addressed To *
                    </Text>

                    {/* Toggle: Staff vs Custom */}
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                addressedToType === 'staff' && {
                                    backgroundColor: colors.primary.cyan,
                                },
                                {
                                    borderColor: colors.ui.border,
                                },
                            ]}
                            onPress={() => setAddressedToType('staff')}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    {
                                        color:
                                            addressedToType === 'staff'
                                                ? '#fff'
                                                : colors.text.primary,
                                    },
                                ]}
                            >
                                Select Staff
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                addressedToType === 'custom' && {
                                    backgroundColor: colors.primary.cyan,
                                },
                                {
                                    borderColor: colors.ui.border,
                                },
                            ]}
                            onPress={() => setAddressedToType('custom')}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    {
                                        color:
                                            addressedToType === 'custom'
                                                ? '#fff'
                                                : colors.text.primary,
                                    },
                                ]}
                            >
                                Custom Name
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {addressedToType === 'staff' ? (
                        <View style={[styles.pickerContainer, { borderColor: colors.ui.border }]}>
                            <Picker
                                selectedValue={selectedRecipient?.$id}
                                onValueChange={(value) => {
                                    const recipient = recipients.find((r) => r.$id === value);
                                    setSelectedRecipient(recipient || null);
                                }}
                                style={{ color: colors.text.primary }}
                            >
                                <Picker.Item label="Select recipient..." value="" />
                                {recipients.map((r) => (
                                    <Picker.Item
                                        key={r.$id}
                                        label={`${r.name} ${r.department ? `(${r.department})` : ''}`}
                                        value={r.$id}
                                    />
                                ))}
                            </Picker>
                        </View>
                    ) : (
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                    color: colors.text.primary,
                                },
                            ]}
                            placeholder="Enter recipient name"
                            placeholderTextColor={colors.text.secondary}
                            value={customRecipientName}
                            onChangeText={setCustomRecipientName}
                        />
                    )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        {
                            backgroundColor: submitting ? colors.ui.border : colors.primary.cyan,
                        },
                    ]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>✓ Confirm & Enter Package</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: Spacing.lg,
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: Typography.weights.bold,
    },
    subtitle: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    section: {
        padding: Spacing.lg,
    },
    label: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
        marginTop: Spacing.sm,
    },
    pickerContainer: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    toggleContainer: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    toggleButton: {
        flex: 1,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        alignItems: 'center',
    },
    toggleText: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    submitButton: {
        margin: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.md,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
});