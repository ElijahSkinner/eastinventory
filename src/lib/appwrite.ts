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
} as const;

// Type definitions for your collections
export interface ItemType extends Models.Document {
    barcode: string;
    item_name: string;
    category: string;
    description?: string;
    manufacturer?: string;
    model?: string;
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
    staged_date?: string;      // ← ADD THIS
    installed_date?: string;   // ← ADD THIS
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
}

export { client, Query, ID };
