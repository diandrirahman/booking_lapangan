import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/ThemeProvider";

// Inspired by the animated theme toggle pattern on 21st.dev, simplified to
// CSS transforms so it stays lightweight and respects reduced motion.
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === "light" ? "gelap" : "terang";

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      aria-label={`Aktifkan mode ${nextThemeLabel}`}
      title={`Aktifkan mode ${nextThemeLabel}`}
      onClick={toggleTheme}
    >
      <Sun className="theme-icon theme-icon-sun" aria-hidden="true" />
      <Moon className="theme-icon theme-icon-moon" aria-hidden="true" />
    </button>
  );
}
