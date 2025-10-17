import { Client, Databases, Account, Models, Query, ID } from 'appwrite';

const client = new Client();

client
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '')
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '');

export const databases = new Databases(client);
export const account = new Account(client);
export const DATABASE_ID = 'inventory_db';

export const COLLECTIONS = {
    ITEM_TYPES: 'item_types',
    INVENTORY_ITEMS: 'inventory_items',
    SCHOOLS: 'schools',
    TRANSACTIONS: 'transactions',
    USER_SETTINGS: 'user_settings',
    PURCHASE_ORDERS: 'purchase_orders',
    po_LINE_ITEMS: 'po_LINE_ITEMS',
    SCHOOL_ORDERS: 'school_orders',
    SCHOOL_ORDER_ITEMS: 'school_order_items',
    STANDARD_PACKAGE: 'standard_package',
    SCHOOL_CHECKOUTS: 'school_checkouts',
    OFFICE_SUPPLY_ITEMS: 'office_supply_items',
    OFFICE_SUPPLY_TRANSACTIONS: 'office_supply_transactions',
} as const;

// Existing Type definitions
export interface ItemType extends Models.Document {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    barcode: string;
    item_name: string;
    category: string;
    description?: string;
    manufacturer?: string;
    model?: string;
    default_sku?: string; // Add this line
}


export interface InventoryItem extends Models.Document {
    barcode: string;
    item_type_id: string;
    serial_number?: string;
    status?: 'available' | 'assigned' | 'staged' | 'installed' | 'maintenance';
    location?: string;
    school_id?: string;
    notes?: string;
    is_school_specific?: boolean;
    received_date?: string;
    staged_date?: string;
    installed_date?: string;
    // New field for school orders
    school_order_id?: string;
}

export interface School extends Models.Document {
    school_name: string;
    school_code: string;
    district?: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    active?: boolean;
    install_date?: string;
}

export interface Transaction extends Models.Document {
    transaction_type: string;
    inventory_item_id: string;
    school_id?: string;
    performed_by: string;
    notes?: string;
    transaction_date: string;
    installation_location?: string;
}

export interface UserSettings extends Models.Document {
    user_id: string;
    email: string;
    display_name: string;
    theme?: 'light' | 'dark';
    role?: string;
    notifications_enabled?: boolean;
    last_login?: string;
    last_section: string;
}

// New Type definitions for Procurement System
export interface IncomingShipment extends Models.Document {
    po_number: string;
    vendor: string;
    order_date: string;
    expected_delivery?: string;
    order_status: 'ordered' | 'partially_received' | 'fully_received' | 'cancelled';
    created_by: string;
    notes?: string;
    total_items: number;
    received_items: number;
}

export interface SHLineItem extends Models.Document {
    purchase_order_id: string;
    item_type_id: string;
    sku: string;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost?: number;
    notes?: string;
}

export interface SchoolOrder extends Models.Document {
    school_id: string;
    order_number: string;
    install_date: string;
    order_status: 'planning' | 'ordered' | 'receiving' | 'ready' | 'installed' | 'cancelled';
    created_by: string;
    created_date: string;
    notes?: string;
    total_items: number;
    allocated_items: number;
}

export interface SchoolOrderItem extends Models.Document {
    school_order_id: string;
    item_type_id: string;
    quantity_needed: number;
    quantity_allocated: number;
    notes?: string;
}

// Helper function to calculate SH completion percentage
export function calculateSHProgress(SH: IncomingShipment): number {
    if (SH.total_items === 0) return 0;
    return Math.round((SH.received_items / SH.total_items) * 100);
}

// Helper function to calculate School Order completion percentage
export function calculateSchoolOrderProgress(order: SchoolOrder): number {
    if (order.total_items === 0) return 0;
    return Math.round((order.allocated_items / order.total_items) * 100);
}

// Helper function to get status color
export function getStatusColor(order_status: string): string {
    switch (order_status) {
        case 'ordered':
        case 'planning':
            return '#005587'; // blue
        case 'partially_received':
        case 'receiving':
            return '#E6A65D'; // orange
        case 'fully_received':
        case 'ready':
        case 'installed':
            return '#27ae60'; // green
        case 'cancelled':
            return '#76232F'; // red
        default:
            return '#53565A'; // gray
    }
}

// Helper function to get status icon
export function getStatusIcon(order_status: string): string {
    switch (order_status) {
        case 'ordered':
        case 'planning':
            return '📋';
        case 'partially_received':
        case 'receiving':
            return '📦';
        case 'fully_received':
        case 'ready':
            return '✅';
        case 'installed':
            return '🏫';
        case 'cancelled':
            return '❌';
        default:
            return '⚪';
    }
}

// Helper function to get days until install
export function getDaysUntilInstall(installDate: string): number {
    const install = new Date(installDate);
    const today = new Date();
    const diffTime = install.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Helper function to format date
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export { client, Query, ID };

export interface OfficeSupplyItem extends Models.Document {
    item_name: string;
    category: string;
    unit: string;
    current_quantity: number;
    reorder_point: number;
    reorder_quantity: number;
    unit_cost?: number;
    charge_price?: number;
    is_for_sale?: boolean;
    supplier?: string;
    supplier_sku?: string;
    location?: string;
    notes?: string;
}

export interface OfficeSupplyTransaction extends Models.Document {
    supply_item_id: string;
    transaction_type: 'received' | 'dispensed' | 'adjustment' | 'shrinkage' | 'returned' | 'inventory_count' | 'cash_count';  // Add the new types
    quantity: number;
    previous_quantity: number;
    new_quantity: number;
    performed_by: string;
    transaction_date: string;
    recipient?: string;
    notes?: string;
    unit_cost_at_transaction?: number;
    charge_price_at_transaction?: number;
    expected_cash?: number;
    actual_cash?: number;
    cash_variance?: number;
}

export function calculateInventoryVariance(
    previousQty: number,
    received: number,
    actualQty: number
): { expectedQty: number; variance: number; itemsSold: number } {
    const expectedQty = previousQty + received;
    const itemsSold = expectedQty - actualQty;
    const variance = actualQty - expectedQty;

    return { expectedQty, variance, itemsSold };
}

// Helper function to check if item needs reorder
export function needsReorder(item: OfficeSupplyItem): boolean {
    return item.current_quantity <= item.reorder_point;
}

// Helper function to calculate reorder priority (how urgent)
export function getReorderPriority(item: OfficeSupplyItem): 'critical' | 'urgent' | 'low' {
    const percentRemaining = (item.current_quantity / item.reorder_point) * 100;

    if (item.current_quantity === 0) return 'critical';
    if (percentRemaining <= 50) return 'urgent';
    return 'low';
}

// Helper function to format quantity with unit
export function formatQuantity(quantity: number, unit: string): string {
    return `${quantity} ${quantity === 1 ? unit : unit + 's'}`;
}

// Constants
export const SUPPLY_CATEGORIES = [
    'Paper Products',
    'Snacks',
    'Drinks',
    'Writing Supplies',
    'Adhesives & Tape',
    'Filing & Storage',
    'Cleaning Supplies',
    'Breakroom Supplies',
    'Technology Accessories',
    'Packaging Materials',
    'Office Furniture Accessories',
    'Printing Supplies',
    'Other',
] as const;

export const SUPPLY_UNITS = [
    'box',
    'ream',
    'pack',
    'roll',
    'bottle',
    'each',
    'case',
    'set',
] as const;

export const TRANSACTION_TYPES = [
    'received',
    'dispensed',
    'adjustment',
    'shrinkage',
    'returned',
] as const;