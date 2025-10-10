// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);

    const { login, register } = useAuth();
    const { colors } = useTheme();

    const handleSubmit = async () => {
        if (!email || !password || (isRegister && !name)) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            if (isRegister) {
                await register(email, password, name);
            } else {
                await login(email, password);
            }
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.message || `Failed to ${isRegister ? 'register' : 'login'}`
            );
        } finally {
            setLoading(false);
        }
    };

    const styles = createStyles(colors);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                {/* Logo */}
                <Image
                    source={require('../../assets/logos/EAST_Logo_2c_vertical.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />

                <Text style={styles.title}>EAST Inventory</Text>
                <Text style={styles.subtitle}>
                    Education Accelerated by Service and Technology
                </Text>

                {/* Form */}
                <View style={styles.form}>
                    {isRegister && (
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            placeholderTextColor={colors.text.secondary}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    )}

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={colors.text.secondary}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={colors.text.secondary}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.text.white} />
                        ) : (
                            <Text style={styles.buttonText}>
                                {isRegister ? 'Register' : 'Login'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setIsRegister(!isRegister)}
                        style={styles.switchButton}
                    >
                        <Text style={styles.switchText}>
                            {isRegister
                                ? 'Already have an account? Login'
                                : "Don't have an account? Register"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
        justifyContent: 'center',
    },
    logo: {
        width: 120,
        height: 120,
        alignSelf: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: Typography.weights.bold,
        color: colors.primary.coolGray,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: Typography.sizes.sm,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        fontStyle: 'italic',
    },
    form: {
        gap: Spacing.md,
    },
    input: {
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.ui.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: Typography.sizes.md,
        color: colors.text.primary,
    },
    button: {
        backgroundColor: colors.primary.cyan,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        ...Shadows.sm,
        marginTop: Spacing.sm,
    },
    buttonText: {
        color: colors.text.white,
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    switchButton: {
        padding: Spacing.sm,
        alignItems: 'center',
    },
    switchText: {
        color: colors.primary.cyan,
        fontSize: Typography.sizes.sm,
    },
});