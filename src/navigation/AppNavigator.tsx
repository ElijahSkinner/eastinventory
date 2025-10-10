// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme';
import { Image } from 'react-native';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import ScanInScreen from '../screens/ScanInScreen';
import CheckOutScreen from '../screens/CheckOutScreen';
import InventoryListScreen from '../screens/InventoryListScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
    Home: undefined;
    ScanIn: undefined;
    CheckOut: undefined;
    InventoryList: undefined;
    Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Home"
                screenOptions={{
                    headerStyle: {
                        backgroundColor: Colors.primary.cyan,
                    },
                    headerTintColor: Colors.text.white,
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                    headerTitle: () => (
                        <Image
                            source={require('../../assets/logos/EAST_Logo_White_Horz.png')}
                            style={{ width: 140, height: 35 }}
                            resizeMode="contain"
                        />
                    ),
                }}
            >
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ title: 'EAST Inventory' }}
                />
                <Stack.Screen
                    name="ScanIn"
                    component={ScanInScreen}
                    options={{ title: 'Scan In Items' }}
                />
                <Stack.Screen
                    name="CheckOut"
                    component={CheckOutScreen}
                    options={{ title: 'Check Out to School' }}
                />
                <Stack.Screen
                    name="InventoryList"
                    component={InventoryListScreen}
                    options={{ title: 'View Inventory' }}
                />
                <Stack.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ title: 'Settings' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}