"use client";

import * as React from "react";
import {
  createDarkTheme,
  createLightTheme,
  FluentProvider,
  type BrandVariants,
} from "@fluentui/react-components";
import { useTheme } from "@/components/theme-provider";

// Keep Fluent controls on the same indigo brand scale as the Tailwind tokens
// in globals.css.  Leaving Fluent on its default blue palette made controls
// from the two systems look like separate products.
const hrmsBrand: BrandVariants = {
  10: "#02031a",
  20: "#07072e",
  30: "#0d0d47",
  40: "#151566",
  50: "#1d1d7e",
  60: "#252882",
  70: "#303194",
  80: "#4546a5",
  90: "#5c5db5",
  100: "#7374c4",
  110: "#8a8bd1",
  120: "#a2a3dc",
  130: "#babbE6",
  140: "#d1d2ee",
  150: "#e9e9f7",
  160: "#f5f5fc",
};

export function AppFluentThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const theme = React.useMemo(
    () => ({
      ...(resolvedTheme === "dark"
        ? createDarkTheme(hrmsBrand)
        : createLightTheme(hrmsBrand)),
      fontFamilyBase: "var(--font-comfortaa), Comfortaa, sans-serif",
    }),
    [resolvedTheme],
  );

  return <FluentProvider theme={theme}>{children}</FluentProvider>;
}
