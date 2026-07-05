import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FirebaseGate } from "@/components/auth/FirebaseGate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Own It Social — Client Portal",
  description: "Client portal for Own It Social",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <FirebaseGate>
          <AuthProvider>{children}</AuthProvider>
        </FirebaseGate>
      </body>
    </html>
  );
}
