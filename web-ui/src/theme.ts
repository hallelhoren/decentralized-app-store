import { createTheme, type MantineColorsTuple } from "@mantine/core";

// The site's existing brand blue (#3b82f6, Tailwind's blue-500) as a full Mantine shade
// ramp, so every component just inherits primaryColor instead of hardcoding hex values.
const brand: MantineColorsTuple = [
  "#eff6ff",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#1e40af",
  "#1e3a8a",
];

export const theme = createTheme({
  primaryColor: "brand",
  colors: { brand },
  defaultRadius: "md",
  fontFamily: "system-ui, -apple-system, sans-serif",
});
