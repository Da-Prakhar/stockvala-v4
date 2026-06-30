import type { Metadata } from "next";
import { Hanken_Grotesk, Moderustic } from "next/font/google";
import CompanyProvider from "@/components/CompanyProvider";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/autoplay";
import 'swiper/css/effect-fade'

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken-grotesk",
});

const moderustic = Moderustic({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-moderustic",
});

export const metadata: Metadata = {
  title: "Trading Platform",
  description: "Professional Trading Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Serve CSS directly so url('../images/...') paths stay relative and resolve correctly */}
        <link rel="stylesheet" href="/assets/css/bootstrap.min.css" />
        <link rel="stylesheet" href="/assets/css/style.css" />
        <link rel="stylesheet" href="/assets/css/responsive.css" />
      </head>
      <body className={`${hankenGrotesk.variable} ${moderustic.variable}`}>
        <CompanyProvider>
          {children}
        </CompanyProvider>
      </body>
    </html>
  );
}
