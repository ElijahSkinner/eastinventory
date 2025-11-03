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
import { databases, DATABASE_ID, ID, COLLECTIONS } from '../../lib/appwrite';
import { Query } from 'appwrite';
import {
    CARRIERS,
    generateTrackingNumber,
    loadAllUsers,
    loadAllTeams,
} from '../../lib/packageTracking';
import { Typography, Spacing, BorderRadius, Shadows } from '../../theme';

// Common vendors list
const COMMON_VENDORS = [
    'Amazon',
    'B&H Photo',
    'CDW',
    'Lenovo',
    'Dell',
    'HP',
    'Apple',
    'Best Buy',
    'Newegg',
    'Adorama',
    'Walmart',
    'Target',
    'Office Depot',
    'Staples',
    'Other',
] as const;

export default function ReceivePackageScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const navigation = useNavigation();

    // Form state
    const [sender, setSender] = useState('Amazon');
    const [senderCustom, setSenderCustom] = useState('');
    const [carrier, setCarrier] = useState('');
    const [numberOfPackages, setNumberOfPackages] = useState('1');
    const [customRecipientName, setCustomRecipientName] = useState('');

    // Data
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [allTeams, setAllTeams] = useState<any[]>([]);
    const [selectedRecipientValue, setSelectedRecipientValue] = useState('');
    const [customVendors, setCustomVendors] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [users, teams, vendors] = await Promise.all([
                loadAllUsers(),
                loadAllTeams(),
                loadCustomVendors(),
            ]);

            setAllUsers(users);
            setAllTeams(teams);
            setCustomVendors(vendors);
        } catch (error) {
            console.error('Error loading data:', error);
            Alert.alert('Error', 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const loadCustomVendors = async (): Promise<string[]> => {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.PACKAGES,
                [Query.limit(1000), Query.orderDesc('received_date')]
            );

            const allSenders = response.documents.map((doc: any) => doc.sender);
            const uniqueCustom = [...new Set(allSenders)]
                .filter(sender => !COMMON_VENDORS.includes(sender as any))
                .sort();

            return uniqueCustom;
        } catch (error) {
            console.error('Error loading custom vendors:', error);
            return [];
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (sender === 'Other' && !senderCustom.trim()) {
            Alert.alert('Validation Error', 'Please enter the sender name');
            return;
        }

        if (!selectedRecipientValue) {
            Alert.alert('Validation Error', 'Please select a recipient');
            return;
        }

        const numPackages = parseInt(numberOfPackages);
        if (isNaN(numPackages) || numPackages < 1) {
            Alert.alert('Validation Error', 'Please enter a valid number of packages');
            return;
        }

        setSubmitting(true);

        try {
            const [type, id] = selectedRecipientValue.split(':');

            let addressedTo = '';
            let addressedToType: 'user' | 'team' | 'custom' | 'unclaimed' = 'user';
            let addressedToId: string | null = null;

            if (type === 'user') {
                const selectedUser = allUsers.find(u => u.$id === id);
                addressedTo = selectedUser?.display_name || selectedUser?.email || 'Unknown';
                addressedToType = 'user';
                addressedToId = selectedUser?.user_id || id;
            } else if (type === 'team') {
                const selectedTeam = allTeams.find((t: any) => t.$id === id);
                addressedTo = selectedTeam?.name || 'Unknown Team';
                addressedToType = 'team';
                addressedToId = id;
            } else if (type === 'unclaimed') {
                addressedTo = 'EAST Initiative / Unclaimed';
                addressedToType = 'unclaimed';
                addressedToId = null;
            } else if (type === 'custom') {
                if (!customRecipientName.trim()) {
                    Alert.alert('Error', 'Please enter a custom recipient name');
                    setSubmitting(false);
                    return;
                }
                addressedTo = customRecipientName.trim();
                addressedToType = 'custom';
                addressedToId = null;
            }

            const trackingNumber = generateTrackingNumber();
            const finalSender = sender === 'Other' ? senderCustom.trim() : sender;

            const packageData = {
                tracking_number: trackingNumber,
                sender: finalSender,
                carrier: carrier || null,
                number_of_packages: numPackages,
                received_date: new Date().toISOString(),
                addressed_to: addressedTo,
                addressed_to_type: addressedToType,
                addressed_to_id: addressedToId,
                location: 'Reception',
                status: addressedToType === 'unclaimed' ? 'pending_claim' : 'pending_confirmation',
                received_by: user?.name || user?.email || 'Unknown',
                notification_sent: false,
                reminder_sent: false,
                reminder_count: 0,
                needs_claim: addressedToType === 'unclaimed',
                current_handler: addressedTo,
            };

            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.PACKAGES,
                ID.unique(),
                packageData
            );

            Alert.alert(
                'Success',
                `Package ${trackingNumber} received successfully!`,
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.goBack(),
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

    const allVendors = [...COMMON_VENDORS, ...customVendors];

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
                            onValueChange={(value) => setSender(value)}
                            style={{ color: colors.text.primary }}
                        >
                            {/* Common Vendors */}
                            <Picker.Item label="─── COMMON VENDORS ───" value="" enabled={false} />
                            {COMMON_VENDORS.map((vendor) => (
                                <Picker.Item key={vendor} label={vendor} value={vendor} />
                            ))}

                            {/* Previously Used Custom Vendors */}
                            {customVendors.length > 0 && (
                                <>
                                    <Picker.Item label="─── PREVIOUSLY USED ───" value="" enabled={false} />
                                    {customVendors.map((vendor) => (
                                        <Picker.Item key={vendor} label={vendor} value={vendor} />
                                    ))}
                                </>
                            )}
                        </Picker>
                    </View>

                    {sender === 'Other' && (
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                    color: colors.text.primary,
                                },
                            ]}
                            placeholder="Enter sender name (will be saved for future)"
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

                    <View style={[styles.pickerContainer, { borderColor: colors.ui.border }]}>
                        <Picker
                            selectedValue={selectedRecipientValue}
                            onValueChange={setSelectedRecipientValue}
                            style={{ color: colors.text.primary }}
                        >
                            <Picker.Item label="-- Select Recipient --" value="" />

                            {/* Staff Members */}
                            <Picker.Item label="─── STAFF MEMBERS ───" value="" enabled={false} />
                            {allUsers.map((userDoc: any) => (
                                <Picker.Item
                                    key={userDoc.$id}
                                    label={userDoc.display_name || userDoc.email}
                                    value={`user:${userDoc.$id}`}
                                />
                            ))}

                            {/* Teams */}
                            {allTeams.length > 0 && (
                                <>
                                    <Picker.Item label="─── TEAMS/DEPARTMENTS ───" value="" enabled={false} />
                                    {allTeams.map((team: any) => (
                                        <Picker.Item
                                            key={team.$id}
                                            label={`${team.name} (Team)`}
                                            value={`team:${team.$id}`}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Special */}
                            <Picker.Item label="─── SPECIAL ───" value="" enabled={false} />
                            <Picker.Item label="🏢 EAST Initiative / Unclaimed" value="unclaimed:" />
                            <Picker.Item label="✏️ Custom Name..." value="custom:" />
                        </Picker>
                    </View>

                    {selectedRecipientValue === 'custom:' && (
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.background.secondary,
                                    borderColor: colors.ui.border,
                                    color: colors.text.primary,
                                    marginTop: Spacing.sm,
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