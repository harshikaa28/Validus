import "./globals.css";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata = {
  title: "Validus AI Agent",
  description: "Verify tickets and check resale prices with an AI agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(
        "dark font-sans antialiased",
        outfit.variable,
        inter.variable,
        jetBrainsMono.variable
      )}
    >
      <body>{children}</body>
    </html>
  );
}
