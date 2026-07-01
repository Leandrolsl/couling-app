// Couling Design System Tokens
export const colors = {
  bg: "#0D0D0D",
  surface1: "#1A1A1A",
  surface2: "#262626",
  gold: "#D4A437",
  goldHover: "#B8860B",
  goldDim: "rgba(212, 164, 55, 0.15)",
  goldGlow: "rgba(212, 164, 55, 0.35)",
  text: "#F2F2F2",
  textMuted: "#A3A3A3",
  textDim: "#737373",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.15)",
  error: "#FF4D4D",
  success: "#32CD32",
  overlay: "rgba(13, 13, 13, 0.85)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 9999,
};

export const fonts = {
  serif: "CormorantGaramond_600SemiBold",
  serifBold: "CormorantGaramond_700Bold",
  body: "Outfit_400Regular",
  bodyMed: "Outfit_500Medium",
  bodyBold: "Outfit_600SemiBold",
};

export const type = {
  h1: { fontFamily: fonts.serifBold, fontSize: 40, letterSpacing: -1, color: colors.text },
  h2: { fontFamily: fonts.serif, fontSize: 32, letterSpacing: -0.5, color: colors.text },
  h3: { fontFamily: fonts.bodyMed, fontSize: 22, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  bodyMuted: { fontFamily: fonts.body, fontSize: 16, color: colors.textMuted },
  caption: {
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
};

export const ASSETS = {
  splashHero:
    "https://static.prod-images.emergentagent.com/jobs/96804931-6e3f-456d-8cf3-b32199e2b2c9/images/2731719e73b62861a24a9f7edaf57a9474421ef4e642ed0ecac9aff3751f2126.png",
  emptyContacts:
    "https://static.prod-images.emergentagent.com/jobs/96804931-6e3f-456d-8cf3-b32199e2b2c9/images/d8a6c131bb855e45fbeedf337b4422b172dd45b478a51e08b046c9e449500b6f.png",
  emptyChats:
    "https://static.prod-images.emergentagent.com/jobs/96804931-6e3f-456d-8cf3-b32199e2b2c9/images/b569a4c67d97c14b03b333427a1b95d7f85340d3b0c8c59c7301c34ee96d95d2.png",
  emptyMeetings:
    "https://static.prod-images.emergentagent.com/jobs/96804931-6e3f-456d-8cf3-b32199e2b2c9/images/8c48370d864c98a7ac65ebcac9a5adaf653ceaf302a28370324e82da450d528d.png",
};
