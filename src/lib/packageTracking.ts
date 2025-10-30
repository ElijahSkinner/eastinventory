// src/lib/packageTracking.ts
import { Models } from 'appwrite';

export interface PackageRecipient extends Models.Document {
    name: string;
    email: string;
    department?: string;
    user_id?: string;
    active: boolean;
    notification_preference: 'email' | 'app' | 'both';
}

export interface Package extends Models.Document {
    forwarded_from?: string; // Previous recipient
    forwarding_chain?: string[]; // Array of previous recipients
    current_handler: string; // Who has it now
    final_recipient?: string; // Who it's ultimately for
    tracking_number: string;
    sender: 'Drawdown' | 'Admin' | 'Custom';
    sender_custom?: string; // If sender is 'Custom'
    carrier?: string;
    number_of_packages: number;
    received_date: string; // ISO datetime
    addressed_to: string; // Display name
    addressed_to_type: 'staff' | 'custom';
    addressed_to_id?: string; // ID from package_recipients if staff
    location: 'Reception' | 'Receiving Office' | 'With Addressee';
    status: 'pending_confirmation' | 'confirmed' | 'completed';
    received_by: string; // Name of front desk person
    contents_confirmed_by?: string;
    contents_confirmed_date?: string;
    completion_notes?: string;
    notification_sent: boolean;
    reminder_sent: boolean;
    reminder_count: number;
}

export interface PackageNotification extends Models.Document {
    package_id: string;
    recipient_id: string;
    notification_type: 'initial' | 'reminder' | 'completed';
    sent_date: string;
    read: boolean;
    read_date?: string;
}

// Helper types
export type PackageSender = 'Drawdown' | 'Admin' | 'Custom';
export type PackageLocation = 'Reception' | 'Receiving Office' | 'With Addressee';
export type PackageStatus = 'pending_confirmation' | 'confirmed' | 'completed';
export type NotificationType = 'initial' | 'reminder' | 'completed';

// Constants
export const PACKAGE_SENDERS: PackageSender[] = ['Drawdown', 'Admin', 'Custom'];
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
    return daysSince >= 1 && pkg.reminder_count < 3; // Send up to 3 reminders
}