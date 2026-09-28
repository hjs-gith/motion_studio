// Loads the theme's Google Fonts. Works both inside Remotion renders and in the HTML player.
import { loadFont as inter } from "@remotion/google-fonts/Inter";
import { loadFont as spaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as outfit } from "@remotion/google-fonts/Outfit";
import { loadFont as playfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as dmSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as jetbrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as geist } from "@remotion/google-fonts/Geist";
import { loadFont as geistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as manrope } from "@remotion/google-fonts/Manrope";
import { loadFont as dmSans } from "@remotion/google-fonts/DMSans";
import type { Theme } from "../themes";

const LOADERS: Record<string, () => void> = {
  Inter: () => inter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }),
  "Space Grotesk": () => spaceGrotesk("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] }),
  Outfit: () => outfit("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }),
  "Playfair Display": () => playfair("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin", "latin-ext"] }),
  "DM Serif Display": () => dmSerif("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] }),
  "JetBrains Mono": () => jetbrains("normal", { weights: ["400", "500", "700"], subsets: ["latin", "latin-ext"] }),
  Geist: () => geist("normal", { weights: ["300", "400", "500", "600", "700"], subsets: ["latin", "latin-ext"] }),
  "Geist Mono": () => geistMono("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] }),
  Manrope: () => manrope("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] }),
  "DM Sans": () => dmSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] }),
};

const loaded = new Set<string>();

export function ensureFonts(theme: Theme) {
  for (const f of [theme.fonts.heading, theme.fonts.body, theme.fonts.mono]) {
    if (loaded.has(f) || !LOADERS[f]) continue;
    loaded.add(f);
    LOADERS[f]();
  }
}
