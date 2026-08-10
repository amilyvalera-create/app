// VENEGE design tokens — dark premium base with crimson/orange brand accents.
export const colors = {
  surface: "#0C0C10",
  onSurface: "#F4F4F6",
  surfaceSecondary: "#15161C",
  onSurfaceSecondary: "#D8D8E0",
  surfaceTertiary: "#1E1F29",
  onSurfaceTertiary: "#A0A0B0",
  brand: "#A32A32",
  brandPrimary: "#E11D2A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E0552F",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#451619",
  onBrandTertiary: "#F0B6B9",
  success: "#1E4620",
  onSuccess: "#A3E6A8",
  warning: "#5C3E08",
  onWarning: "#F5C875",
  error: "#5A1116",
  onError: "#F2A2A8",
  info: "#0F3D4D",
  onInfo: "#92DDF5",
  border: "#282933",
  borderStrong: "#424454",
  divider: "#1E1F29",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export const fonts = {
  display: "BebasNeue-Regular",
  body: "Inter",
};

export const type = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 44,
};

export const MAX_WIDTH = 900;
export const CONTENT_WIDTH = 720;

export const brandGradient = [colors.brandPrimary, colors.brandSecondary] as const;

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};
