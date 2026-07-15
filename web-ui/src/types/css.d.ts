// Next's own global.d.ts only declares "*.module.css" (CSS Modules) - plain side-effect CSS
// imports like "@mantine/core/styles.css" or "./globals.css" have no ambient type declaration
// at all, which `next dev` tolerates but `next build`'s strict type-check does not.
declare module "*.css";
