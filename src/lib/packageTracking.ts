// src/lib/packageTracking.ts
import { Models, Query } from 'appwrite';
import { account, teams, databases, DATABASE_ID, COLLECTIONS } from './appwrite';

export interface Package extends Models.Document {
    forwarded_from?: string;
    forwarding_chain?: string[];
    current_handler: string;
    final_recipient?: string;
    tracking_number: string;
    sender: string;
    sender_custom?: string;
    carrier?: string;
    number_of_packages: number;
    received_date: string;
    location: 'Reception' | 'Receiving Office' | 'With Addressee';
    status: 'pending_confirmation' | 'confirmed' | 'completed' | 'pending_claim';
    received_by: string;
    contents_confirmed_by?: string;
    contents_confirmed_date?: string;
    completion_notes?: string;
    notification_sent: boolean;
    reminder_sent: boolean;
    reminder_count: number;
    addressed_to: string;
    addressed_to_type: 'user' | 'team' | 'custom' | 'unclaimed';
    addressed_to_id?: string;
    needs_claim?: boolean;
    claimed_by?: string;
    claimed_date?: string;
}

export interface PackageNotification extends Models.Document {
    package_id: string;
    recipient_id: string;
    notification_type: 'initial' | 'reminder' | 'completed';
    sent_date: string;
    read: boolean;
    read_date?: string;
}

// Helper functions to load users and teams
export async function loadAllUsers() {
    try {
        // Get all user documents from user_settings collection
        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.USER_SETTINGS,
            [Query.limit(500)]
        );
        return response.documents;
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

export async function loadAllTeams() {
    try {
        const response = await teams.list();
        return response.teams;
    } catch (error) {
        console.error('Error loading teams:', error);
        return [];
    }
}

export async function getUserTeams() {
    try {
        const response = await teams.list();
        return response.teams;
    } catch (error) {
        console.error('Error getting user teams:', error);
        return [];
    }
}

// Helper types
export type PackageLocation = 'Reception' | 'Receiving Office' | 'With Addressee';
export type PackageStatus = 'pending_confirmation' | 'confirmed' | 'completed' | 'pending_claim';
export type NotificationType = 'initial' | 'reminder' | 'completed';

// Constants
export const PACKAGE_LOCATIONS: PackageLocation[] = [
    'Reception',
    'Receiving Office',
    'With Addressee',
];

export const CARRIERS = [
    'FedEx',
    'UPS',
    'USPS',
    'DHL',
    'Amazon',
    'Other',
] as const;

// Helper functions
export function getStatusColor(status: PackageStatus): string {
    switch (status) {
        case 'pending_confirmation':
            return '#E6A65D'; // Orange
        case 'confirmed':
            return '#0093B2'; // Cyan
        case 'completed':
            return '#27ae60'; // Green
        case 'pending_claim':
            return '#7E5475'; // Purple
        default:
            return '#53565A'; // Gray
    }
}

export function getStatusIcon(status: PackageStatus): string {
    switch (status) {
        case 'pending_confirmation':
            return '⏳';
        case 'confirmed':
            return '✅';
        case 'completed':
            return '📦';
        case 'pending_claim':
            return '❓';
        default:
            return '📋';
    }
}

export function getStatusLabel(status: PackageStatus): string {
    switch (status) {
        case 'pending_confirmation':
            return 'Pending Confirmation';
        case 'confirmed':
            return 'Confirmed';
        case 'completed':
            return 'Completed';
        case 'pending_claim':
            return 'Needs Claim';
        default:
            return 'Unknown';
    }
}

export function getLocationIcon(location: PackageLocation): string {
    switch (location) {
        case 'Reception':
            return '🏢';
        case 'Receiving Office':
            return '📬';
        case 'With Addressee':
            return '👤';
        default:
            return '📍';
    }
}

export function generateTrackingNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PKG-${year}${month}${day}-${random}`;
}

export function formatPackageDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function getDaysSinceReceived(receivedDate: string): number {
    const received = new Date(receivedDate);
    const today = new Date();
    const diffTime = today.getTime() - received.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

export function needsReminder(pkg: Package): boolean {
    if (pkg.status === 'completed') return false;
    const daysSince = getDaysSinceReceived(pkg.received_date);
    return daysSince >= 1 && pkg.reminder_count < 3;
}