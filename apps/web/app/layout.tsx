import type { Metadata } from "next";
import "./globals.css";
import "./live.css";
export const metadata: Metadata = { title: "Debt Optimiser", description: "Discrete cash-flow cleanup engine" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
