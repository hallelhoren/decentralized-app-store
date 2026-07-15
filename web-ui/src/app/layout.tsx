import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import "@mantine/core/styles.css";
import "./globals.css";
import { theme } from "../theme";
import { WalletProvider } from "../lib/wallet-context";
import TopNav from "../components/TopNav";

export const metadata: Metadata = {
  title: "Decentralized App Store",
  description: "A censorship-resistant app store backed by a blockchain and BitTorrent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <WalletProvider>
            <TopNav />
            <main>{children}</main>
          </WalletProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
