// src/screens/PackageTracking/ForwardPackageScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { databases, DATABASE_ID, ID } from '../../lib/appwrite';
import { Query } from 'appwrite';
import { Package, PackageRecipient, formatPackageDate } from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

export default function ForwardPackageScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();
    const route = useRoute();
    const packageToForward = (route.params as any)?.package as Package;

    const [recipients, setRecipients] = useState<PackageRecipient[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState<PackageRecipient | null>(null);
    const [customRecipientName, setCustomRecipientName] = useState('');
    const [forwardingReason, setForwardingReason] = useState('');
    const [recipientType, setRecipientType] = useState<'staff' | 'custom'>('staff');
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
        } finally {
            setLoading(false);
        }
    };

    const handleForward = async () => {
        // Validation
        if (recipientType === 'staff' && !selectedRecipient) {
            Alert.alert('Validation Error', 'Please select a recipient');
            return;
        }

        if (recipientType === 'custom' && !customRecipientName.trim()) {
            Alert.alert('Validation Error', 'Please enter the recipient name');
            return;
        }

        if (!forwardingReason.trim()) {
            Alert.alert(
                'Forwarding Reason',
                'Please provide a reason for forwarding (e.g., "Package is for Matt, not me")',
            );
            return;
        }

        setSubmitting(true);

        try {
            const newRecipient =
                recipientType === 'staff' ? selectedRecipient!.name : customRecipientName.trim();

            // Build forwarding chain
            const currentChain = packageToForward.forwarding_chain || [];
            const updatedChain = [
                ...currentChain,
                `${packageToForward.addressed_to} → ${newRecipient}`,
            ];

            await databases.updateDocument(
                DATABASE_ID,
                'packages',
                packageToForward.$id,
                {
                    addressed_to: newRecipient,
                    addressed_to_type: recipientType,
                    addressed_to_id: recipientType === 'staff' ? selectedRecipient!.$id : null,
                    forwarded_from: packageToForward.addressed_to,
                    forwarding_chain: updatedChain,
                    current_handler: newRecipient,
                    status: 'pending_confirmation',
                    location: 'In Transit',
                }
            );

            // Create transaction record
            await databases.createDocument(
                DATABASE_ID,
                'transactions',
                ID.unique(),
                {
                    transaction_type: 'note',
                    inventory_item_id: packageToForward.$id,
                    performed_by: user?.name || 'Unknown',
                    transaction_date: new Date().toISOString(),
                    notes: `Package forwarded from ${packageToForward.addressed_to} to ${newRecipient}. Reason: ${forwardingReason}`,
                }
            );

            Alert.alert(
                'Success',
                `Package forwarded to ${newRecipient} successfully!`,
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack(),
                    },
                ]
            );
        } catch (error: any) {
            console.error('Error forwarding package:', error);
            Alert.alert('Error', 'Failed to forward package: ' + error.message);
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
        <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
            <ScrollView style={styles.scrollView}>
                {/* Package Info */}
                <View style={[styles.packageCard, { backgroundColor: colors.background.secondary }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Package Details
                    </Text>
                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            Tracking:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {packageToForward.tracking_number}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            From:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {packageToForward.sender}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            Received:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {formatPackageDate(packageToForward.received_date)}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.text.secondary }]}>
                            Currently With:
                        </Text>
                        <Text style={[styles.detailValue, { color: colors.text.primary }]}>
                            {packageToForward.addressed_to}
                        </Text>
                    </View>

                    {packageToForward.forwarding_chain &&
                        packageToForward.forwarding_chain.length > 0 && (
                            <View style={styles.chainContainer}>
                                <Text style={[styles.chainTitle, { color: colors.text.secondary }]}>
                                    Previous Forwards:
                                </Text>
                                {packageToForward.forwarding_chain.map((entry, i) => (
                                    <Text key={i} style={[styles.chainEntry, { color: colors.text.primary }]}>
                                        {entry}
                                    </Text>
                                ))}
                            </View>
                        )}
                </View>

                {/* Forward To Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.primary.coolGray }]}>
                        Forward To
                    </Text>

                    {/* Toggle: Staff vs Custom */}
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                recipientType === 'staff' && { backgroundColor: colors.primary.cyan },
                                { borderColor: colors.ui.border },
                            ]}
                            onPress={() => setRecipientType('staff')}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    {
                                        color:
                                            recipientType === 'staff' ? '#fff' : colors.text.primary,
                                    },
                                ]}
                            >
                                Select Staff
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.toggleButton,
                                recipientType === 'custom' && { backgroundColor: colors.primary.cyan },
                                { borderColor: colors.ui.border },
                            ]}
                            onPress={() => setRecipientType('custom')}
                        >
                            <Text
                                style={[
                                    styles.toggleText,
                                    {
                                        color:
                                            recipientType === 'custom' ? '#fff' : colors.text.primary,
                                    },
                                ]}
                            >
                                Custom Name
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {recipientType === 'staff' ? (
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
                                        label={`${r.name}${r.department ? ` (${r.department})` : ''}`}
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

                {/* Reason */}
                <View style={styles.section}>
                    <Text style={[styles.label, { color: colors.text.primary }]}>
                        Reason for Forwarding *
                    </Text>
                    <TextInput
                        style={[
                            styles.textArea,
                            {
                                backgroundColor: colors.background.secondary,
                                borderColor: colors.ui.border,
                                color: colors.text.primary,
                            },
                        ]}
                        placeholder='e.g., "Package is actually for Matt"'
                        placeholderTextColor={colors.text.secondary}
                        value={forwardingReason}
                        onChangeText={setForwardingReason}
                        multiline
                        numberOfLines={4}
                    />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        {
                            backgroundColor: submitting ? colors.ui.border : colors.primary.cyan,
                        },
                    ]}
                    onPress={handleForward}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>📤 Forward Package</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
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
    packageCard: {
        margin: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    section: {
        padding: Spacing.lg,
    },
    sectionTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    detailLabel: {
        fontSize: Typography.sizes.sm,
    },
    detailValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    chainContainer: {
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    chainTitle: {
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs,
    },
    chainEntry: {
        fontSize: Typography.sizes.sm,
        marginLeft: Spacing.sm,
        marginBottom: Spacing.xs / 2,
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
    pickerContainer: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    input: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
    },
    label: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
        marginBottom: Spacing.xs,
    },
    textArea: {
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
        minHeight: 100,
        textAlignVertical: 'top',
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