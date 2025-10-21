// src/theme/index.ts
import { Colors } from './colors';
import { Typography } from './typography';
import { Spacing } from './spacing';
import { BorderRadius } from './borderRadius';
import { Shadows } from './shadows';
import CommonStyles from "@/src/theme/commonStyles";
export { Colors, Typography, Spacing, BorderRadius, Shadows, CommonStyles };

export const Theme = {
    colors: Colors,
    typography: Typography,
    spacing: Spacing,
    borderRadius: BorderRadius,
    shadows: Shadows,
} as const;

export type ThemeType = typeof Theme;