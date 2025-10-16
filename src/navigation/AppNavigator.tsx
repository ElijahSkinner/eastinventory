// src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme';
import {Image, View, Text, StyleSheet, TouchableOpacity} from 'react-native';

// Import existing screens
import HomeScreen from '../screens/HomeScreen';
import PurchaseOrdersScreen from '../screens/IncomingShipmentsScreen';
import ReceivingScreen from '../screens/ReceivingScreen';
import InventoryListScreen from '../screens/InventoryListScreen';
import CheckOutScreen from '../screens/CheckOutScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreatePurchaseOrderScreen from '../screens/CreateIncomingShipmentScreen';
import CreateSchoolOrderScreen from '../screens/CreateSchoolOrderScreen';

// New Office Supplies screens
import OfficeSuppliesHomeScreen from '../screens/OfficeSupplies/OfficeSuppliesHomeScreen';
import SupplyInventoryScreen from '../screens/OfficeSupplies/SupplyInventoryScreen';
import ReceiveSuppliesScreen from '../screens/OfficeSupplies/ReceiveSuppliesScreen';
import AddEditSupplyScreen from '../screens/OfficeSupplies/AddEditSupplyScreen';
import { OfficeSupplyItem } from '../lib/appwrite';

export type RootStackParamList = {
    Main: undefined;
    CreatePurchaseOrder: undefined;
    CreateSchoolOrder: undefined;
};

export type DrawerParamList = {
    Dashboard: undefined;
    EquipmentStack: undefined;
    OfficeSuppliesStack: undefined;
    Settings: undefined;
};

export type EquipmentStackParamList = {
    PurchaseOrders: undefined;
    Receiving: { sku?: string } | undefined;
    Inventory: undefined;
    CheckOut: undefined;
};

export type OfficeSuppliesStackParamList = {
    OfficeSuppliesHome: undefined;
    SupplyInventory: undefined;
    ReceiveSupplies: undefined;
    DispenseSupplies: undefined;
    ReorderAlerts: undefined;
    AddEditSupply: { item?: OfficeSupplyItem } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();
const EquipmentStack = createNativeStackNavigator<EquipmentStackParamList>();
const OfficeSuppliesStack = createNativeStackNavigator<OfficeSuppliesStackParamList>();

// Equipment section stack navigator
function EquipmentNavigator() {
    return (
        <EquipmentStack.Navigator
            screenOptions={({navigation}) => ({
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
                        style={{width: 140, height: 35}}
                        resizeMode="contain"
                    />
                ),
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => {
                            (navigation.getParent() as DrawerNavigationProp<DrawerParamList>)?.openDrawer();
                        }}
                        style={{marginLeft: 15}}
                    >
                        <Text style={{color: Colors.text.white, fontSize: 24}}>☰</Text>
                    </TouchableOpacity>
                ),
            })}
        >
            <EquipmentStack.Screen
                name="PurchaseOrders"
                component={PurchaseOrdersScreen}
                options={{title: 'Incoming Shipments'}}
            />
            <EquipmentStack.Screen
                name="Receiving"
                component={ReceivingScreen}
                options={{title: 'Receive Items'}}
            />
            <EquipmentStack.Screen
                name="Inventory"
                component={InventoryListScreen}
                options={{title: 'Equipment Inventory'}}
            />
            <EquipmentStack.Screen
                name="CheckOut"
                component={CheckOutScreen}
                options={{title: 'Check Out'}}
            />
        </EquipmentStack.Navigator>
    );
}
// Office Supplies section stack navigator
function OfficeSuppliesNavigator() {
    return (
        <OfficeSuppliesStack.Navigator
            screenOptions={({ navigation }) => ({
                headerStyle: {
                    backgroundColor: Colors.secondary.orange,
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
                headerLeft: () => (
                    <TouchableOpacity
                        onPress={() => {
                            (navigation.getParent() as DrawerNavigationProp<DrawerParamList>)?.openDrawer();
                        }}
                        style={{ marginLeft: 15 }}
                    >
                        <Text style={{ color: Colors.text.white, fontSize: 24 }}>☰</Text>
                    </TouchableOpacity>
                ),
            })}
        >
            <OfficeSuppliesStack.Screen
                name="OfficeSuppliesHome"
                component={OfficeSuppliesHomeScreen}
                options={{ title: 'Office Supplies' }}
            />
            <OfficeSuppliesStack.Screen
                name="SupplyInventory"
                component={SupplyInventoryScreen}
                options={{ title: 'Supply Inventory' }}
            />
            <OfficeSuppliesStack.Screen
                name="ReceiveSupplies"
                component={ReceiveSuppliesScreen}
                options={{ title: 'Receive Supplies' }}
            />
            <OfficeSuppliesStack.Screen
                name="AddEditSupply"
                component={AddEditSupplyScreen}
                options={{ title: 'Add Supply Item' }}
            />
        </OfficeSuppliesStack.Navigator>
    );
}

// Custom drawer content
function CustomDrawerContent(props: any) {
    return (
        <View style={styles.drawerContainer}>
            {/* Header */}
            <View style={styles.drawerHeader}>
                <Image
                    source={require('../../assets/logos/EAST_Logo_2c_vertical.png')}
                    style={styles.drawerLogo}
                    resizeMode="contain"
                />
                <Text style={styles.drawerTitle}>EAST Inventory</Text>
            </View>

            {/* Menu Items */}
            <View style={styles.drawerItems}>
                {/* Dashboard */}
                <DrawerItem
                    label="Dashboard"
                    icon="🏠"
                    onPress={() => props.navigation.navigate('Dashboard')}
                    active={props.state.index === 0}
                />

                {/* Equipment Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>EQUIPMENT</Text>
                    <DrawerItem
                        label="Incoming Shipments"
                        icon="📦"
                        onPress={() => props.navigation.navigate('EquipmentStack', { screen: 'PurchaseOrders' })}
                        active={props.state.index === 1}
                    />
                    <DrawerItem
                        label="Receive Items"
                        icon="📷"
                        onPress={() => props.navigation.navigate('EquipmentStack', { screen: 'Receiving' })}
                    />
                    <DrawerItem
                        label="Inventory"
                        icon="📋"
                        onPress={() => props.navigation.navigate('EquipmentStack', { screen: 'Inventory' })}
                    />
                    <DrawerItem
                        label="Check Out"
                        icon="📤"
                        onPress={() => props.navigation.navigate('EquipmentStack', { screen: 'CheckOut' })}
                    />
                </View>

                {/* Office Supplies Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>OFFICE SUPPLIES</Text>
                    <DrawerItem
                        label="Supply Inventory"
                        icon="📎"
                        onPress={() => props.navigation.navigate('OfficeSuppliesStack')}
                        active={props.state.index === 2}
                    />
                </View>

                {/* Settings */}
                <DrawerItem
                    label="Settings"
                    icon="⚙️"
                    onPress={() => props.navigation.navigate('Settings')}
                    active={props.state.index === 3}
                />
            </View>

            {/* Footer */}
            <View style={styles.drawerFooter}>
                <Text style={styles.footerText}>v1.0.0</Text>
            </View>
        </View>
    );
}

// Drawer item component
function DrawerItem({ label, icon, onPress, active }: any) {
    return (
        <View
            style={[
                styles.drawerItem,
                active && styles.drawerItemActive,
            ]}
            onTouchEnd={onPress}
        >
            <Text style={styles.drawerItemIcon}>{icon}</Text>
            <Text style={[styles.drawerItemLabel, active && styles.drawerItemLabelActive]}>
                {label}
            </Text>
        </View>
    );
}

// Main drawer navigator
function MainDrawer() {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
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
                drawerStyle: {
                    width: 280,
                },
            }}
        >
            <Drawer.Screen
                name="Dashboard"
                component={HomeScreen}
                options={{ title: 'Dashboard' }}
            />
            <Drawer.Screen
                name="EquipmentStack"
                component={EquipmentNavigator}
                options={{ headerShown: false, title: 'Equipment' }}
            />
            <Drawer.Screen
                name="OfficeSuppliesStack"
                component={OfficeSuppliesNavigator}
                options={{ headerShown: false, title: 'Office Supplies' }}
            />
            <Drawer.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings' }}
            />
        </Drawer.Navigator>
    );
}

// Main app navigator
export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Main" component={MainDrawer} />
                <Stack.Screen
                    name="CreatePurchaseOrder"
                    component={CreatePurchaseOrderScreen}
                    options={{
                        headerShown: true,
                        title: 'New Incoming Shipment',
                        headerStyle: { backgroundColor: Colors.primary.cyan },
                        headerTintColor: Colors.text.white,
                    }}
                />
                <Stack.Screen
                    name="CreateSchoolOrder"
                    component={CreateSchoolOrderScreen}
                    options={{
                        headerShown: true,
                        title: 'New School Order',
                        headerStyle: { backgroundColor: Colors.primary.cyan },
                        headerTintColor: Colors.text.white,
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    drawerContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    drawerHeader: {
        padding: 20,
        backgroundColor: Colors.primary.cyan,
        alignItems: 'center',
        paddingTop: 50,
    },
    drawerLogo: {
        width: 80,
        height: 80,
        marginBottom: 10,
    },
    drawerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    drawerItems: {
        flex: 1,
        paddingTop: 20,
    },
    section: {
        marginTop: 20,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.text.secondary,
        marginBottom: 10,
        letterSpacing: 1,
    },
    drawerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginHorizontal: 10,
        borderRadius: 8,
    },
    drawerItemActive: {
        backgroundColor: Colors.primary.cyan + '20',
    },
    drawerItemIcon: {
        fontSize: 20,
        marginRight: 15,
    },
    drawerItemLabel: {
        fontSize: 16,
        color: Colors.text.primary,
    },
    drawerItemLabelActive: {
        color: Colors.primary.cyan,
        fontWeight: 'bold',
    },
    drawerFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.ui.border,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: Colors.text.secondary,
    },
});