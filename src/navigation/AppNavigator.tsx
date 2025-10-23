// src/navigation/AppNavigator.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme';
import {Image, View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import { OfficeSupplyItem } from '../lib/appwrite';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../hooks/useRole';

// Import existing screens
import HomeScreen from '../screens/HomeScreen';
import PurchaseOrdersScreen from '../screens/IncomingShipmentsScreen';
import ReceivingScreen from '../screens/ReceivingScreen';
import InventoryListScreen from '../screens/InventoryListScreen';
import CheckOutScreen from '../screens/CheckOutScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreatePurchaseOrderScreen from '../screens/CreateIncomingShipmentScreen';
import CreateSchoolOrderScreen from '../screens/CreateSchoolOrderScreen';

// Office Supplies screens
import OfficeSuppliesHomeScreen from '../screens/OfficeSupplies/OfficeSuppliesHomeScreen';
import SupplyInventoryScreen from '../screens/OfficeSupplies/SupplyInventoryScreen';
import ReceiveSuppliesScreen from '../screens/OfficeSupplies/ReceiveSuppliesScreen';
import AddEditSupplyScreen from '../screens/OfficeSupplies/AddEditSupplyScreen';
import InventoryCountScreen from '../screens/OfficeSupplies/InventoryCountScreen';
import ReorderAlertsScreen from '../screens/OfficeSupplies/ReorderAlertsScreen';
import UsageReportsScreen from '../screens/OfficeSupplies/usageReportsScreen';

export type RootStackParamList = {
    Main: undefined;
    CreatePurchaseOrder: undefined;
    CreateSchoolOrder: undefined;
};

export type DrawerParamList = {
    Dashboard: undefined;
    ProcurementStack: undefined;
    OfficeInventoryStack: undefined;
    Settings: undefined;
};

export type ProcurementStackParamList = {
    PurchaseOrders: undefined;
    Receiving: { sku?: string } | undefined;
    Inventory: undefined;
    CheckOut: undefined;
};

export type OfficeInventoryStackParamList = {
    OfficeSuppliesHome: undefined;
    SupplyInventory: undefined;
    ReceiveSupplies: undefined;
    InventoryCount: undefined;
    ReorderAlerts: undefined;
    UsageReports: undefined;
    AddEditSupply: { item?: OfficeSupplyItem } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();
const ProcurementStack = createNativeStackNavigator<ProcurementStackParamList>();
const OfficeInventoryStack = createNativeStackNavigator<OfficeInventoryStackParamList>();

// Procurement section stack navigator
function ProcurementNavigator() {
    return (
        <ProcurementStack.Navigator
            screenOptions={({ navigation }) => ({
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
            <ProcurementStack.Screen
                name="PurchaseOrders"
                component={PurchaseOrdersScreen}
                options={{ title: 'Incoming Shipments' }}
            />
            <ProcurementStack.Screen
                name="Receiving"
                component={ReceivingScreen}
                options={{ title: 'Receive Items' }}
            />
            <ProcurementStack.Screen
                name="Inventory"
                component={InventoryListScreen}
                options={{ title: 'Equipment Inventory' }}
            />
            <ProcurementStack.Screen
                name="CheckOut"
                component={CheckOutScreen}
                options={{ title: 'Check Out' }}
            />
        </ProcurementStack.Navigator>
    );
}

// Office Inventory section stack navigator
function OfficeInventoryNavigator() {
    return (
        <OfficeInventoryStack.Navigator
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
            <OfficeInventoryStack.Screen
                name="OfficeSuppliesHome"
                component={OfficeSuppliesHomeScreen}
                options={{ title: 'Office Inventory' }}
            />
            <OfficeInventoryStack.Screen
                name="SupplyInventory"
                component={SupplyInventoryScreen}
                options={{ title: 'Supply Inventory' }}
            />
            <OfficeInventoryStack.Screen
                name="ReceiveSupplies"
                component={ReceiveSuppliesScreen}
                options={{ title: 'Receive Supplies' }}
            />
            <OfficeInventoryStack.Screen
                name="InventoryCount"
                component={InventoryCountScreen}
                options={{ title: 'Inventory Count' }}
            />
            <OfficeInventoryStack.Screen
                name="ReorderAlerts"
                component={ReorderAlertsScreen}
                options={{ title: 'Reorder Alerts' }}
            />
            <OfficeInventoryStack.Screen
                name="AddEditSupply"
                component={AddEditSupplyScreen}
                options={{ title: 'Add Supply Item' }}
            />
            <OfficeInventoryStack.Screen
                name="UsageReports"
                component={UsageReportsScreen}
                options={{ title: 'Usage Reports' }}
            />
        </OfficeInventoryStack.Navigator>
    );
}

// Custom drawer content with permission-based navigation
function CustomDrawerContent(props: any) {
    const { updateUserSettings } = useAuth();
    const { isAdmin, labels } = useRole();
    const [procurementExpanded, setProcurementExpanded] = React.useState(true);
    const [inventoryExpanded, setInventoryExpanded] = React.useState(true);

    // Check permissions
    const hasProcurementAccess = isAdmin || labels.includes('procurement');
    const hasInventoryAccess = isAdmin || labels.includes('inventory');

    // Save last section when navigating
    const handleNavigation = async (route: string, section: 'procurement' | 'inventory') => {
        props.navigation.navigate(route);
        try {
            await updateUserSettings({ last_section: section });
        } catch (error) {
            console.error('Failed to save last section:', error);
        }
    };

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
            <ScrollView style={styles.drawerItems} showsVerticalScrollIndicator={false}>
                {/* Procurement Section - Only show if user has access */}
                {hasProcurementAccess && (
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setProcurementExpanded(!procurementExpanded)}
                        >
                            <Text style={styles.sectionTitle}>PROCUREMENT</Text>
                            <Text style={styles.expandIcon}>{procurementExpanded ? '−' : '+'}</Text>
                        </TouchableOpacity>

                        {procurementExpanded && (
                            <>
                                <DrawerItem
                                    label="Dashboard"
                                    icon="🏠"
                                    onPress={() => {
                                        props.navigation.navigate('Dashboard');
                                        updateUserSettings({ last_section: 'procurement' }).catch(console.error);
                                    }}
                                    active={props.state.routes[props.state.index]?.name === 'Dashboard'}
                                />
                                <DrawerItem
                                    label="Incoming Shipments"
                                    icon="📦"
                                    onPress={() => {
                                        props.navigation.navigate('ProcurementStack', { screen: 'PurchaseOrders' });
                                        updateUserSettings({ last_section: 'procurement' }).catch(console.error);
                                    }}
                                />
                                <DrawerItem
                                    label="Receive Items"
                                    icon="📷"
                                    onPress={() => {
                                        props.navigation.navigate('ProcurementStack', { screen: 'Receiving' });
                                        updateUserSettings({ last_section: 'procurement' }).catch(console.error);
                                    }}
                                />
                                <DrawerItem
                                    label="Equipment Inventory"
                                    icon="📋"
                                    onPress={() => {
                                        props.navigation.navigate('ProcurementStack', { screen: 'Inventory' });
                                        updateUserSettings({ last_section: 'procurement' }).catch(console.error);
                                    }}
                                />
                                <DrawerItem
                                    label="Check Out"
                                    icon="📤"
                                    onPress={() => {
                                        props.navigation.navigate('ProcurementStack', { screen: 'CheckOut' });
                                        updateUserSettings({ last_section: 'procurement' }).catch(console.error);
                                    }}
                                />
                            </>
                        )}
                    </View>
                )}

                {/* Office Inventory Section - Only show if user has access */}
                {hasInventoryAccess && (
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setInventoryExpanded(!inventoryExpanded)}
                        >
                            <Text style={styles.sectionTitle}>OFFICE INVENTORY</Text>
                            <Text style={styles.expandIcon}>{inventoryExpanded ? '−' : '+'}</Text>
                        </TouchableOpacity>

                        {inventoryExpanded && (
                            <>
                                <DrawerItem
                                    label="Dashboard"
                                    icon="🏠"
                                    onPress={() => {
                                        props.navigation.navigate('OfficeInventoryStack', { screen: 'OfficeSuppliesHome' });
                                        updateUserSettings({ last_section: 'inventory' }).catch(console.error);
                                    }}
                                    active={props.state.routes[props.state.index]?.name === 'OfficeInventoryStack' &&
                                        props.state.routes[props.state.index]?.state?.routes?.[
                                            props.state.routes[props.state.index]?.state?.index
                                            ]?.name === 'OfficeSuppliesHome'}
                                />
                                <DrawerItem
                                    label="Supply Inventory"
                                    icon="📎"
                                    onPress={() => {
                                        props.navigation.navigate('OfficeInventoryStack', { screen: 'SupplyInventory' });
                                        updateUserSettings({ last_section: 'inventory' }).catch(console.error);
                                    }}
                                />
                                <DrawerItem
                                    label="Receive Supplies"
                                    icon="📥"
                                    onPress={() => {
                                        props.navigation.navigate('OfficeInventoryStack', { screen: 'ReceiveSupplies' });
                                        updateUserSettings({ last_section: 'inventory' }).catch(console.error);
                                    }}
                                />
                                <DrawerItem
                                    label="Inventory Count"
                                    icon="🔢"
                                    onPress={() => {
                                        props.navigation.navigate('OfficeInventoryStack', { screen: 'InventoryCount' });
                                        updateUserSettings({ last_section: 'inventory' }).catch(console.error);
                                    }}
                                />
                                <DrawerItem
                                    label="Reorder Alerts"
                                    icon="🔔"
                                    onPress={() => {
                                        props.navigation.navigate('OfficeInventoryStack', { screen: 'ReorderAlerts' });
                                        updateUserSettings({ last_section: 'inventory' }).catch(console.error);
                                    }}
                                />
                                <DrawerItem
                                    label="Usage Reports"
                                    icon="📈"
                                    onPress={() => {
                                        props.navigation.navigate('OfficeInventoryStack', { screen: 'UsageReports' });
                                        updateUserSettings({ last_section: 'inventory' }).catch(console.error);
                                    }}
                                />
                            </>
                        )}
                    </View>
                )}

                {/* Settings */}
                <DrawerItem
                    label="Settings"
                    icon="⚙️"
                    onPress={() => props.navigation.navigate('Settings')}
                    active={props.state.index === (hasInventoryAccess && hasProcurementAccess ? 3 : 2)}
                />
            </ScrollView>

            {/* Footer */}
            <View style={styles.drawerFooter}>
                <Text style={styles.footerText}>v1.0.0</Text>
                {isAdmin && (
                    <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>👑 Admin Access</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

// Drawer item component
function DrawerItem({ label, icon, onPress, active }: any) {
    return (
        <TouchableOpacity
            style={[
                styles.drawerItem,
                active && styles.drawerItemActive,
            ]}
            onPress={onPress}
        >
            <Text style={styles.drawerItemIcon}>{icon}</Text>
            <Text style={[styles.drawerItemLabel, active && styles.drawerItemLabelActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

// Main drawer navigator
function MainDrawer() {
    const { userSettings } = useAuth();
    const { isAdmin, labels } = useRole();

    // Determine initial route based on last section and permissions
    const getInitialRouteName = () => {
        const lastSection = userSettings?.last_section;
        const hasProcurementAccess = isAdmin || labels.includes('procurement');
        const hasInventoryAccess = isAdmin || labels.includes('inventory');

        // If user has a saved preference and has access to that section, use it
        if (lastSection === 'procurement' && hasProcurementAccess) {
            return 'Dashboard'; // HomeScreen - Procurement Dashboard
        } else if (lastSection === 'inventory' && hasInventoryAccess) {
            return 'OfficeInventoryStack'; // Opens to OfficeSuppliesHome
        }

        // If no saved preference, default based on what they have access to
        if (hasProcurementAccess) {
            return 'Dashboard'; // Default to Procurement Dashboard
        } else if (hasInventoryAccess) {
            return 'OfficeInventoryStack'; // Default to Office Inventory Dashboard
        }

        // Fallback (shouldn't reach here if permissions are set correctly)
        return 'Dashboard';
    };

    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            initialRouteName={getInitialRouteName()}
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
                name="ProcurementStack"
                component={ProcurementNavigator}
                options={{ headerShown: false, title: 'Procurement' }}
            />
            <Drawer.Screen
                name="OfficeInventoryStack"
                component={OfficeInventoryNavigator}
                options={{ headerShown: false, title: 'Office Inventory' }}
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.text.secondary,
        letterSpacing: 1,
    },
    expandIcon: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text.secondary,
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
        marginBottom: 8,
    },
    adminBadge: {
        backgroundColor: '#e74c3c',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    adminBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
});