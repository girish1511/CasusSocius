import type { Metadata } from "next";
import { Lora, JetBrains_Mono } from "next/font/google";
import { config as fontAwesomeConfig } from "@fortawesome/fontawesome-svg-core";
import "./globals.css";

fontAwesomeConfig.autoAddCss = false;

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CasusSocius",
  description: "Chat, summarize, and quiz yourself on your course material.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
