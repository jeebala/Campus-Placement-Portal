import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Placement Portal",
  description: "Campus placement and internship recruitment for students, companies, and placement administrators.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
