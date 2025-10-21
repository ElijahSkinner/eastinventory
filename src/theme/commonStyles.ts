// src/theme/commonStyles.ts
import { StyleSheet } from 'react-native';
import { Colors } from './colors';
import { Typography } from './typography';
import { Spacing } from './spacing';
import { BorderRadius } from './borderRadius';
import { Shadows } from './shadows';

/**
 * Common reusable style patterns extracted from the codebase
 * Use these instead of recreating styles in every component
 */

export const CommonStyles = {
    // CONTAINER STYLES
    containers: StyleSheet.create({
        flex: {
            flex: 1,
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        page: {
            flex: 1,
            padding: Spacing.lg,
        },
    }),

    // CARD STYLES
    cards: StyleSheet.create({
        base: {
            borderRadius: BorderRadius.lg,
            padding: Spacing.lg,
            ...Shadows.md,
        },
        compact: {
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
            ...Shadows.sm,
        },
        interactive: {
            borderRadius: BorderRadius.lg,
            padding: Spacing.lg,
            ...Shadows.md,
            // Note: backgroundColor should be applied dynamically with colors.background.primary
        },
    }),

    // HEADER STYLES
    headers: StyleSheet.create({
        container: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Spacing.lg,
            ...Shadows.sm,
        },
        title: {
            fontSize: Typography.sizes.xxl,
            fontWeight: Typography.weights.bold,
        },
        subtitle: {
            fontSize: Typography.sizes.md,
            marginTop: Spacing.xs,
        },
    }),

    // BUTTON STYLES
    buttons: StyleSheet.create({
        primary: {
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.lg,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
            ...Shadows.sm,
        },
        secondary: {
            paddingVertical: Spacing.md,
            paddingHorizontal: Spacing.lg,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
            borderWidth: 1,
        },
        text: {
            fontSize: Typography.sizes.md,
            fontWeight: Typography.weights.semibold,
        },
        large: {
            paddingVertical: Spacing.lg,
            paddingHorizontal: Spacing.xl,
            borderRadius: BorderRadius.lg,
        },
        fab: {
            position: 'absolute',
            bottom: Spacing.lg,
            right: Spacing.lg,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            borderRadius: BorderRadius.full,
            ...Shadows.lg,
        },
    }),

    // INPUT STYLES
    inputs: StyleSheet.create({
        base: {
            borderWidth: 1,
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
            fontSize: Typography.sizes.md,
        },
        textArea: {
            borderWidth: 1,
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
            fontSize: Typography.sizes.md,
            minHeight: 80,
            textAlignVertical: 'top',
        },
        search: {
            borderWidth: 1,
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
            fontSize: Typography.sizes.md,
        },
    }),

    // BADGE STYLES
    badges: StyleSheet.create({
        base: {
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.xs,
            borderRadius: BorderRadius.sm,
        },
        pill: {
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
            borderRadius: BorderRadius.full,
        },
        text: {
            fontSize: Typography.sizes.xs,
            fontWeight: Typography.weights.bold,
        },
        textMedium: {
            fontSize: Typography.sizes.sm,
            fontWeight: Typography.weights.semibold,
        },
    }),

    // LIST STYLES
    lists: StyleSheet.create({
        item: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: Spacing.md,
            borderBottomWidth: 1,
        },
        itemCompact: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: Spacing.sm,
            borderBottomWidth: 1,
        },
    }),

    // MODAL STYLES
    modals: StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
        },
        overlayCentered: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: Spacing.lg,
        },
        container: {
            maxHeight: '80%',
            borderTopLeftRadius: BorderRadius.xl,
            borderTopRightRadius: BorderRadius.xl,
            ...Shadows.lg,
        },
        containerCentered: {
            width: '100%',
            maxWidth: 400,
            borderRadius: BorderRadius.lg,
            ...Shadows.lg,
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Spacing.lg,
            borderBottomWidth: 1,
        },
        title: {
            fontSize: Typography.sizes.xl,
            fontWeight: Typography.weights.bold,
        },
        footer: {
            padding: Spacing.lg,
            borderTopWidth: 1,
        },
        closeButton: {
            padding: Spacing.xs,
        },
    }),

    // SECTION STYLES
    sections: StyleSheet.create({
        container: {
            margin: Spacing.md,
            padding: Spacing.lg,
            borderRadius: BorderRadius.lg,
            ...Shadows.md,
        },
        title: {
            fontSize: Typography.sizes.lg,
            fontWeight: Typography.weights.bold,
            marginBottom: Spacing.md,
        },
        subtitle: {
            fontSize: Typography.sizes.sm,
            marginTop: -Spacing.sm,
            marginBottom: Spacing.md,
        },
    }),

    // PROGRESS BAR STYLES
    progress: StyleSheet.create({
        container: {
            marginBottom: Spacing.sm,
        },
        bar: {
            height: 8,
            borderRadius: BorderRadius.sm,
            overflow: 'hidden',
        },
        fill: {
            height: '100%',
            borderRadius: BorderRadius.sm,
        },
        text: {
            fontSize: Typography.sizes.sm,
            marginBottom: Spacing.xs,
        },
    }),

    // STAT/METRIC STYLES
    stats: StyleSheet.create({
        container: {
            alignItems: 'center',
        },
        value: {
            fontSize: Typography.sizes.xxl,
            fontWeight: Typography.weights.bold,
        },
        label: {
            fontSize: Typography.sizes.xs,
            marginTop: Spacing.xs / 2,
        },
        grid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.md,
        },
        item: {
            flex: 1,
            minWidth: '45%',
            alignItems: 'center',
            padding: Spacing.md,
        },
    }),

    // TAB STYLES
    tabs: StyleSheet.create({
        container: {
            flexDirection: 'row',
            ...Shadows.sm,
        },
        tab: {
            flex: 1,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        tabText: {
            fontSize: Typography.sizes.md,
            fontWeight: Typography.weights.semibold,
        },
    }),

    // CAMERA/SCANNER STYLES
    camera: StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#000',
        },
        camera: {
            flex: 1,
        },
        overlay: {
            flex: 1,
            backgroundColor: 'transparent',
            justifyContent: 'space-between',
            padding: Spacing.xl,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: Spacing.xl,
        },
        title: {
            color: '#fff',
            fontSize: Typography.sizes.lg,
            fontWeight: Typography.weights.bold,
        },
        cancelButton: {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            borderRadius: BorderRadius.md,
        },
        scanFrame: {
            width: 280,
            height: 200,
            borderWidth: 2,
            borderRadius: BorderRadius.md,
            alignSelf: 'center',
            backgroundColor: 'transparent',
        },
        instructions: {
            color: '#fff',
            fontSize: Typography.sizes.md,
            textAlign: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: Spacing.md,
            borderRadius: BorderRadius.md,
        },
    }),

    // FILTER STYLES
    filters: StyleSheet.create({
        container: {
            flexDirection: 'row',
            padding: Spacing.sm,
            gap: Spacing.sm,
            ...Shadows.sm,
        },
        tab: {
            flex: 1,
            paddingVertical: Spacing.sm,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
        },
        tabText: {
            fontSize: Typography.sizes.sm,
            fontWeight: Typography.weights.semibold,
        },
    }),

    // EMPTY STATE STYLES
    empty: StyleSheet.create({
        container: {
            padding: Spacing.xl,
            alignItems: 'center',
            marginTop: Spacing.xl,
        },
        emoji: {
            fontSize: 64,
            marginBottom: Spacing.md,
        },
        text: {
            fontSize: Typography.sizes.lg,
            fontWeight: Typography.weights.semibold,
            marginBottom: Spacing.xs,
        },
        subtext: {
            fontSize: Typography.sizes.md,
            textAlign: 'center',
        },
    }),

    // FORM STYLES
    forms: StyleSheet.create({
        fieldContainer: {
            marginBottom: Spacing.md,
        },
        label: {
            fontSize: Typography.sizes.md,
            fontWeight: Typography.weights.medium,
            marginTop: Spacing.md,
            marginBottom: Spacing.xs,
        },
        helperText: {
            fontSize: Typography.sizes.sm,
            marginTop: Spacing.xs,
        },
        required: {
            fontSize: Typography.sizes.md,
        },
    }),

    // CHECKBOX STYLES
    checkbox: StyleSheet.create({
        base: {
            width: 24,
            height: 24,
            borderWidth: 2,
            borderRadius: 4,
            justifyContent: 'center',
            alignItems: 'center',
        },
        large: {
            width: 28,
            height: 28,
            borderWidth: 2,
            borderRadius: BorderRadius.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkmark: {
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: Typography.weights.bold,
        },
    }),

    // ICON STYLES
    icons: StyleSheet.create({
        small: {
            fontSize: 16,
        },
        medium: {
            fontSize: 20,
        },
        large: {
            fontSize: 24,
        },
        xlarge: {
            fontSize: 32,
        },
        xxlarge: {
            fontSize: 48,
        },
    }),

    // ROW STYLES
    rows: StyleSheet.create({
        base: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: Spacing.sm,
        },
        withGap: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
        },
    }),
};

// Export for use in index
export default CommonStyles;