export const colors = {
  primary: "#087A9B",
  primaryDark: "#07526F",
  primarySoft: "#E2F8FA",
  background: "#F4FAFC",
  surface: "#FFFFFF",
  text: "#102C3D",
  muted: "#627985",
  border: "#D6E8EC",
  success: "#1e912fff",
  successSoft: "#E4F6EF",
  warning: "#E28A2B",
  warningSoft: "#FFF1DD",
  danger: "#D94A5A",
  dangerSoft: "#FFE8EB",
};

export function resolveDeckColor(color?: string | null) {
  if (!color || color.toUpperCase() === "#6558D3") return colors.primary;
  return color;
}

export const shadows = {
  card: {
    shadowColor: "#063449",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
};
