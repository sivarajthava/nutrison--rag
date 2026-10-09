import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dietary Guidance RAG Chatbot & Diagnostic Explorer",
  description:
    "Evidence-grounded conversational service and diagnostic explorer translating authoritative dietary and food safety guidelines from WHO, FAO, FDA, and USDA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
