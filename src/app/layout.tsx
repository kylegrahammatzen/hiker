import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { CSPProvider } from "@base-ui/react/csp-provider";
import "./globals.css";
import { AppPanelProvider, AppPanelInset } from "@/components/ui/app-panel";
import { AppSidebar } from "@/components/app-sidebar";
import { TrailProvider } from "@/lib/trail-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTrails } from "@/lib/trails";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hiker",
  description: "Interactive hiking trail explorer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const trails = getTrails();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <CSPProvider disableStyleElements>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TrailProvider>
              <TooltipProvider delay={400} closeDelay={0}>
                <AppPanelProvider defaultOpen={true}>
                  <AppSidebar trails={trails} />
                  <AppPanelInset className="h-svh overflow-hidden">
                    {children}
                  </AppPanelInset>
                </AppPanelProvider>
              </TooltipProvider>
            </TrailProvider>
          </ThemeProvider>
        </CSPProvider>
      </body>
    </html>
  );
}
