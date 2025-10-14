// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme';
import { Image, Text } from 'react-native'; // Add Text import

// Import screens
import HomeScreen from '../screens/HomeScreen';
import PurchaseOrdersScreen from '../screens/PurchaseOrdersScreen';
import ReceivingScreen from '../screens/ReceivingScreen';
import InventoryListScreen from '../screens/InventoryListScreen';
import SchoolOrdersScreen from '../screens/SchoolOrdersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreatePurchaseOrderScreen from '../screens/CreatePurchaseOrderScreen';
import CreateSchoolOrderScreen from '../screens/CreateSchoolOrderScreen';
import CheckOutScreen from '../screens/CheckOutScreen';


export type RootStackParamList = {
    MainTabs: undefined;
    CreatePurchaseOrder: undefined;
    CreateSchoolOrder: undefined;
};

export type TabParamList = {
    Dashboard: undefined;
    PurchaseOrders: undefined;
    Receiving: undefined;
    Inventory: undefined;
    CheckOut: undefined;
    Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
    return (
        <Tab.Navigator
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
                tabBarActiveTintColor: Colors.primary.cyan,
                tabBarInactiveTintColor: Colors.text.secondary,
                tabBarStyle: {
                    backgroundColor: Colors.background.primary,
                    borderTopWidth: 1,
                    borderTopColor: Colors.ui.border,
                    paddingBottom: 5,
                    height: 60,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={HomeScreen}
                options={{
                    title: 'Dashboard',
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <TabIcon icon="🏠" color={color} />,
                }}
            />
            <Tab.Screen
                name="PurchaseOrders"
                component={PurchaseOrdersScreen}
                options={{
                    title: 'Purchase Orders',
                    tabBarLabel: 'Orders',
                    tabBarIcon: ({ color, size }) => <TabIcon icon="📦" color={color} />,
                }}
            />
            <Tab.Screen
                name="Receiving"
                component={ReceivingScreen}
                options={{
                    title: 'Receive Items',
                    tabBarLabel: 'Receive',
                    tabBarIcon: ({ color, size }) => <TabIcon icon="📷" color={color} />,
                }}
            />
            <Tab.Screen
                name="Inventory"
                component={InventoryListScreen}
                options={{
                    title: 'Inventory',
                    tabBarLabel: 'Inventory',
                    tabBarIcon: ({ color, size }) => <TabIcon icon="📋" color={color} />,
                }}
            />
            <Tab.Screen
                name="CheckOut"
                component={CheckOutScreen}
                options={{
                    title: 'Check Out',
                    tabBarLabel: 'Check Out',
                    tabBarIcon: ({ color, size }) => <TabIcon icon="📤" color={color} />,
                }}
            />

            <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                    title: 'Settings',
                    tabBarLabel: 'Settings',
                    tabBarIcon: ({ color, size }) => <TabIcon icon="⚙️" color={color} />,
                }}
            />
        </Tab.Navigator>
    );
}

// Fixed TabIcon component - use Text instead of span
function TabIcon({ icon, color }: { icon: string; color: string }) {
    return (
        <Text style={{ fontSize: 24, opacity: color === Colors.primary.cyan ? 1 : 0.5 }}>
            {icon}
        </Text>
    );
}

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: Colors.primary.cyan,
                    },
                    headerTintColor: Colors.text.white,
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            >
                <Stack.Screen
                    name="MainTabs"
                    component={MainTabs}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="CreatePurchaseOrder"
                    component={CreatePurchaseOrderScreen}
                    options={{ title: 'New Purchase Order' }}
                />
                <Stack.Screen
                    name="CreateSchoolOrder"
                    component={CreateSchoolOrderScreen}
                    options={{ title: 'New School Order' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}