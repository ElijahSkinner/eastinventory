// src/screens/InventoryListScreen.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRole } from '../hooks/useRole';
import { databases, DATABASE_ID, COLLECTIONS, ItemType, InventoryItem } from '../lib/appwrite';
import { Query } from 'appwrite';
import { CommonStyles, Typography, Spacing, BorderRadius } from '../theme';
import ItemDetailModal from '../components/modals/ItemDetailModal';

interface ItemTypeWithCounts extends ItemType {
    availableCount: number;
    stagedCount: number;
    assignedCount: number;
    installedCount: number;
    maintenanceCount: number;
    totalCount: number;
    items?: InventoryItem[];
}

type TabType = 'all' | 'in-stock' | 'installed';
type FilterType = 'all' | 'in-stock' | 'installed';

const CACHE_DURATION = 30000; // 30 seconds

interface CacheData {
    itemTypes: ItemTypeWithCounts[];
    allItems: InventoryItem[];
    timestamp: number;
}

// ====== HELPER FUNCTIONS ======
const getStatusColor = (status?: string, colors?: any) => {
    const statusMap: Record<string, string> = {
        available: colors?.status.available || '#0093B2',
        assigned: colors?.secondary.purple || '#7E5475',
        staged: colors?.secondary.orange || '#E6A65D',
        installed: colors?.primary.coolGray || '#53565A',
        maintenance: colors?.status.maintenance || '#76232F',
    };
    return statusMap[status || ''] || colors?.text.secondary || '#83868A';
};

const getStatusIcon = (status?: string) => {
    const iconMap: Record<string, string> = {
        available: '🟢',
        assigned: '🔵',
        staged: '🟠',
        installed: '✓',
        maintenance: '🔴',
    };
    return iconMap[status || ''] || '⚪';
};

const getStatusLabel = (status?: string) => {
    const labelMap: Record<string, string> = {
        available: 'Available',
        assigned: 'Assigned',
        staged: 'Staged',
        installed: 'Installed',
        maintenance: 'Maintenance',
    };
    return labelMap[status || ''] || 'Unknown';
};

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

// ====== SUB-COMPONENTS ======
const StatsBar = React.memo(({ total, inStock, assigned, installed, colors }: {
    total: number;
    inStock: number;
    assigned: number;
    installed: number;
    colors: any;
}) => (
    <View style={[styles.statsBar, { backgroundColor: colors.background.primary }]}>
        <StatItem label="Total" value={total} color={colors.primary.cyan} />
        <StatItem label="In Stock" value={inStock} color={colors.status.available} />
        <StatItem label="Assigned" value={assigned} color={colors.secondary.purple} />
        <StatItem label="Installed" value={installed} color={colors.primary.coolGray} />
    </View>
));
StatsBar.displayName = 'StatsBar';

const StatItem = React.memo(({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={CommonStyles.stats.container}>
        <Text style={[CommonStyles.stats.value, { color }]}>{value}</Text>
        <Text style={[CommonStyles.stats.label, { color: '#83868A' }]}>{label}</Text>
    </View>
));
StatItem.displayName = 'StatItem';

const SearchBar = React.memo(({ value, onChangeText, onSubmit, searching, colors }: {
    value: string;
    onChangeText: (text: string) => void;
    onSubmit: () => void;
    searching: boolean;
    colors: any;
}) => (
    <View style={[styles.searchContainer, { backgroundColor: colors.background.primary }]}>
        <View style={styles.searchInputContainer}>
            <TextInput
                style={[CommonStyles.inputs.search, {
                    color: colors.text.primary,
                    borderColor: colors.ui.border,
                    backgroundColor: colors.background.secondary,
                    flex: 1
                }]}
                placeholder="Search by name, category, manufacturer..."
                placeholderTextColor={colors.text.secondary}
                value={value}
                onChangeText={onChangeText}
                onSubmitEditing={onSubmit}
                returnKeyType="search"
            />
            <TouchableOpacity
                style={[styles.searchButton, { backgroundColor: colors.primary.cyan }]}
                onPress={onSubmit}
            >
                {searching ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.searchIcon}>🔍</Text>
                )}
            </TouchableOpacity>
        </View>
    </View>
));
SearchBar.displayName = 'SearchBar';

const FilterTabs = React.memo(({ activeTab, onTabChange, colors }: {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    colors: any;
}) => (
    <View style={[CommonStyles.tabs.container, { backgroundColor: colors.background.primary }]}>
        {(['in-stock', 'installed', 'all'] as TabType[]).map(tab => (
            <TouchableOpacity
                key={tab}
                style={[
                    CommonStyles.tabs.tab,
                    activeTab === tab && { borderBottomColor: colors.primary.cyan, borderBottomWidth: 3 },
                ]}
                onPress={() => onTabChange(tab)}
            >
                <Text style={[
                    CommonStyles.tabs.tabText,
                    { color: activeTab === tab ? colors.primary.cyan : colors.text.secondary },
                ]}>
                    {tab === 'in-stock' ? 'In Stock' : tab === 'installed' ? 'Installed' : 'All Items'}
                </Text>
            </TouchableOpacity>
        ))}
    </View>
));
FilterTabs.displayName = 'FilterTabs';

const ItemTypeCard = React.memo(({ itemType, expanded, onPress, activeTab, colors }: {
    itemType: ItemTypeWithCounts;
    expanded: boolean;
    onPress: () => void;
    activeTab: TabType;
    colors: any;
}) => (
    <TouchableOpacity
        style={[CommonStyles.cards.interactive, { backgroundColor: colors.background.primary }]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.itemTypeHeader}>
            <View style={styles.itemTypeInfo}>
                <Text style={[styles.itemTypeName, { color: colors.primary.coolGray }]}>
                    {itemType.item_name}
                </Text>
                <Text style={[styles.itemTypeCategory, { color: colors.text.secondary }]}>
                    {itemType.category}
                    {itemType.manufacturer && ` • ${itemType.manufacturer}`}
                </Text>
            </View>
            <Text style={[styles.expandIcon, { color: colors.text.secondary }]}>
                {expanded ? '˅' : '›'}
            </Text>
        </View>

        <View style={styles.countsContainer}>
            {activeTab === 'in-stock' ? (
                <>
                    <CountBadge label="Available" value={itemType.availableCount} color={colors.status.available} />
                    {itemType.stagedCount > 0 && (
                        <CountBadge label="Staged" value={itemType.stagedCount} color={colors.secondary.orange} />
                    )}
                </>
            ) : activeTab === 'installed' ? (
                <>
                    {itemType.assignedCount > 0 && (
                        <CountBadge label="Assigned" value={itemType.assignedCount} color={colors.secondary.purple} />
                    )}
                    {itemType.installedCount > 0 && (
                        <CountBadge label="Installed" value={itemType.installedCount} color={colors.primary.coolGray} />
                    )}
                </>
            ) : (
                <>
                    <CountBadge label="In Stock" value={itemType.availableCount + itemType.stagedCount} color={colors.status.available} />
                    {itemType.assignedCount > 0 && (
                        <CountBadge label="Assigned" value={itemType.assignedCount} color={colors.secondary.purple} />
                    )}
                    <CountBadge label="Installed" value={itemType.installedCount} color={colors.primary.coolGray} />
                    <CountBadge label="Total" value={itemType.totalCount} color={colors.text.primary} />
                </>
            )}
        </View>
    </TouchableOpacity>
));
ItemTypeCard.displayName = 'ItemTypeCard';

const CountBadge = React.memo(({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={CommonStyles.stats.container}>
        <Text style={[styles.countLabel, { color: '#83868A' }]}>{label}</Text>
        <Text style={[styles.countValue, { color }]}>{value}</Text>
    </View>
));
CountBadge.displayName = 'CountBadge';

const InventoryItemCard = React.memo(({ item, itemType, index, onPress, isAdmin, colors }: {
    item: InventoryItem;
    itemType: ItemTypeWithCounts;
    index: number;
    onPress: () => void;
    isAdmin: boolean;
    colors: any;
}) => (
    <TouchableOpacity
        style={[CommonStyles.cards.compact, { backgroundColor: colors.background.primary }]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.inventoryItemHeader}>
            <View style={styles.inventoryItemInfo}>
                <View style={styles.statusRow}>
                    <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
                    <View style={styles.itemNameContainer}>
                        {item.serial_number ? (
                            <>
                                <Text style={[styles.itemDisplayName, { color: colors.text.primary }]}>
                                    {itemType.item_name} #{index + 1}
                                </Text>
                                <Text style={[styles.serialNumberSmall, { color: colors.text.secondary }]}>
                                    SN: {item.serial_number}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.itemDisplayName, { color: colors.text.primary }]}>
                                    {itemType.item_name} #{index + 1}
                                </Text>
                                <Text style={[styles.serialNumberSmall, { color: colors.text.secondary }]}>
                                    ...{item.barcode.slice(-4)}
                                </Text>
                            </>
                        )}
                    </View>
                    <View style={[CommonStyles.badges.base, { backgroundColor: `${getStatusColor(item.status, colors)}20` }]}>
                        <Text style={[CommonStyles.badges.text, { color: getStatusColor(item.status, colors) }]}>
                            {getStatusLabel(item.status)}
                        </Text>
                    </View>
                </View>

                {item.location && (
                    <Text style={[styles.itemLocation, { color: colors.text.secondary }]}>
                        📍 {item.location}
                    </Text>
                )}

                {item.school_id && (
                    <Text style={[styles.itemSchool, { color: colors.secondary.orange }]}>
                        🏫 School assigned
                    </Text>
                )}

                {isAdmin && item.is_school_specific && (
                    <View style={[styles.schoolSpecificBadge, { backgroundColor: colors.secondary.purple + '20' }]}>
                        <Text style={[styles.schoolSpecificText, { color: colors.secondary.purple }]}>
                            🔒 School-Specific (NAS)
                        </Text>
                    </View>
                )}

                <Text style={[styles.itemDate, { color: colors.text.secondary }]}>
                    Added {formatDate(item.received_date)}
                </Text>
            </View>

            <Text style={[styles.itemArrow, { color: colors.text.secondary }]}>›</Text>
        </View>
    </TouchableOpacity>
));
InventoryItemCard.displayName = 'InventoryItemCard';

// ====== MAIN COMPONENT ======
export default function InventoryListScreen() {
    const { colors } = useTheme();
    const { isAdmin, role, loading: roleLoading } = useRole();

    const [activeTab, setActiveTab] = useState<TabType>('in-stock');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [itemTypes, setItemTypes] = useState<ItemTypeWithCounts[]>([]);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<InventoryItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searching, setSearching] = useState(false);

    const cacheRef = useRef<CacheData | null>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadItemTypes();
        }, [activeTab, searchQuery])
    );

    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const loadItemTypes = async (forceRefresh = false) => {
        try {
            setLoading(true);

            const now = Date.now();
            const cachedData = cacheRef.current;
            const isCacheValid = cachedData && !forceRefresh && (now - cachedData.timestamp) < CACHE_DURATION;

            let allItemTypes: ItemType[];
            let allInventoryItems: InventoryItem[];

            if (isCacheValid && cachedData) {
                allItemTypes = cachedData.itemTypes;
                allInventoryItems = cachedData.allItems;
            } else {
                const [typesResponse, itemsResponse] = await Promise.all([
                    databases.listDocuments(DATABASE_ID, COLLECTIONS.ITEM_TYPES, [Query.limit(100)]),
                    databases.listDocuments(DATABASE_ID, COLLECTIONS.INVENTORY_ITEMS, [Query.limit(5000)])
                ]);

                allItemTypes = typesResponse.documents as unknown as ItemType[];
                allInventoryItems = itemsResponse.documents as unknown as InventoryItem[];

                cacheRef.current = {
                    itemTypes: allItemTypes as ItemTypeWithCounts[],
                    allItems: allInventoryItems,
                    timestamp: now
                };
            }

            const typesWithCounts: ItemTypeWithCounts[] = allItemTypes.map((itemType) => {
                const itemsForType = allInventoryItems.filter(item => item.item_type_id === itemType.$id);
                return {
                    ...itemType,
                    availableCount: itemsForType.filter(i => i.status === 'available').length,
                    stagedCount: itemsForType.filter(i => i.status === 'staged').length,
                    assignedCount: itemsForType.filter(i => i.status === 'assigned').length,
                    installedCount: itemsForType.filter(i => i.status === 'installed').length,
                    maintenanceCount: itemsForType.filter(i => i.status === 'maintenance').length,
                    totalCount: itemsForType.length,
                    items: itemsForType,
                };
            });

            let filtered = typesWithCounts;
            if (activeTab === 'in-stock') {
                filtered = typesWithCounts.filter(item => item.availableCount > 0 || item.stagedCount > 0);
            } else if (activeTab === 'installed') {
                filtered = typesWithCounts.filter(item => item.assignedCount > 0 || item.installedCount > 0);
            }

            if (searchQuery) {
                filtered = filtered.filter(item =>
                    item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            setItemTypes(filtered);
        } catch (error) {
            console.error('Error loading item types:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setSearching(false);
        }
    };

    const handleSearchChange = (text: string) => {
        setSearchInput(text);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (text !== searchQuery) setSearching(true);
        searchTimeoutRef.current = setTimeout(() => setSearchQuery(text), 500);
    };

    const handleSearchSubmit = () => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        setSearchQuery(searchInput);
    };

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadItemTypes(true);
    }, [activeTab, searchQuery]);

    const handleExpandItem = (itemTypeId: string) => {
        if (expandedItemId === itemTypeId) {
            setExpandedItemId(null);
            setExpandedItems([]);
            return;
        }

        setExpandedItemId(itemTypeId);
        const itemType = itemTypes.find(it => it.$id === itemTypeId);
        if (!itemType || !itemType.items) {
            setExpandedItems([]);
            return;
        }

        let items = itemType.items;
        if (activeTab === 'in-stock') {
            items = items.filter(item => item.status === 'available' || item.status === 'staged');
        } else if (activeTab === 'installed') {
            items = items.filter(item => item.status === 'assigned' || item.status === 'installed');
        }

        setExpandedItems(items);
    };

    const getTotalStats = () => {
        const allItems = itemTypes.flatMap(it => it.items || []);
        return {
            total: allItems.length,
            inStock: allItems.filter(i => i.status === 'available' || i.status === 'staged').length,
            assigned: allItems.filter(i => i.status === 'assigned').length,
            installed: allItems.filter(i => i.status === 'installed').length,
        };
    };

    if (loading || roleLoading) {
        return (
            <View style={[CommonStyles.containers.centered, { backgroundColor: colors.background.secondary }]}>
                <ActivityIndicator size="large" color={colors.primary.cyan} />
            </View>
        );
    }

    const stats = getTotalStats();

    return (
        <View style={[CommonStyles.containers.flex, { backgroundColor: colors.background.secondary }]}>
            {/* Header */}
            <View style={[CommonStyles.headers.container, { backgroundColor: colors.background.primary }]}>
                <Text style={[CommonStyles.headers.title, { color: colors.primary.coolGray }]}>Inventory</Text>
                <View style={[CommonStyles.badges.pill, { backgroundColor: isAdmin ? '#e74c3c' : colors.primary.cyan }]}>
                    <Text style={[CommonStyles.badges.text, { color: '#fff' }]}>
                        {isAdmin ? '👑 Admin' : '👤 User'}
                    </Text>
                </View>
            </View>

            {/* Stats Bar */}
            <StatsBar {...stats} colors={colors} />

            {/* Search Bar */}
            <SearchBar
                value={searchInput}
                onChangeText={handleSearchChange}
                onSubmit={handleSearchSubmit}
                searching={searching}
                colors={colors}
            />

            {/* Filter Tabs */}
            <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} colors={colors} />

            {/* Item List */}
            <ScrollView
                style={CommonStyles.containers.flex}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {itemTypes.length === 0 ? (
                    <View style={CommonStyles.empty.container}>
                        <Text style={[CommonStyles.empty.text, { color: colors.text.secondary }]}>
                            {searchQuery ? 'No items match your search' : 'No items in this category'}
                        </Text>
                    </View>
                ) : (
                    itemTypes.map((itemType) => (
                        <View key={itemType.$id} style={styles.itemTypeContainer}>
                            <ItemTypeCard
                                itemType={itemType}
                                expanded={expandedItemId === itemType.$id}
                                onPress={() => handleExpandItem(itemType.$id)}
                                activeTab={activeTab}
                                colors={colors}
                            />

                            {expandedItemId === itemType.$id && (
                                <View style={[styles.expandedContainer, { backgroundColor: colors.background.secondary }]}>
                                    {expandedItems.length === 0 ? (
                                        <Text style={[styles.emptyExpandedText, { color: colors.text.secondary }]}>
                                            No items
                                        </Text>
                                    ) : (
                                        expandedItems.map((item, index) => (
                                            <InventoryItemCard
                                                key={item.$id}
                                                item={item}
                                                itemType={itemType}
                                                index={index}
                                                onPress={() => setSelectedItem(item)}
                                                isAdmin={isAdmin}
                                                colors={colors}
                                            />
                                        ))
                                    )}
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Item Detail Modal */}
            {selectedItem && (
                <ItemDetailModal
                    visible={!!selectedItem}
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onRefresh={() => {
                        loadItemTypes(true);
                        if (expandedItemId) handleExpandItem(expandedItemId);
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    statsBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: Spacing.md,
    },
    searchContainer: {
        padding: Spacing.md,
    },
    searchInputContainer: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    searchButton: {
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
    },
    searchIcon: {
        fontSize: 20,
    },
    itemTypeContainer: {
        marginBottom: Spacing.md,
        marginHorizontal: Spacing.md,
    },
    itemTypeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    itemTypeInfo: {
        flex: 1,
    },
    itemTypeName: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
        marginBottom: Spacing.xs,
    },
    itemTypeCategory: {
        fontSize: Typography.sizes.sm,
    },
    expandIcon: {
        fontSize: 24,
        marginLeft: Spacing.sm,
    },
    countsContainer: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    countLabel: {
        fontSize: Typography.sizes.xs,
        marginBottom: Spacing.xs / 2,
    },
    countValue: {
        fontSize: Typography.sizes.lg,
        fontWeight: Typography.weights.bold,
    },
    expandedContainer: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        gap: Spacing.sm,
    },
    emptyExpandedText: {
        padding: Spacing.md,
        textAlign: 'center',
        fontSize: Typography.sizes.sm,
    },
    inventoryItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    inventoryItemInfo: {
        flex: 1,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        gap: Spacing.xs,
    },
    statusIcon: {
        fontSize: 16,
    },
    itemNameContainer: {
        flex: 1,
    },
    itemDisplayName: {
        fontSize: Typography.sizes.md,
        fontWeight: Typography.weights.semibold,
    },
    serialNumberSmall: {
        fontSize: Typography.sizes.xs,
        fontFamily: 'monospace',
        marginTop: 2,
    },
    itemLocation: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    itemSchool: {
        fontSize: Typography.sizes.sm,
        marginTop: Spacing.xs,
    },
    schoolSpecificBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs / 2,
        borderRadius: BorderRadius.sm,
        marginTop: Spacing.xs,
        alignSelf: 'flex-start',
    },
    schoolSpecificText: {
        fontSize: Typography.sizes.xs,
        fontWeight: Typography.weights.semibold,
    },
    itemDate: {
        fontSize: Typography.sizes.xs,
        marginTop: Spacing.xs,
    },
    itemArrow: {
        fontSize: 20,
    },
});