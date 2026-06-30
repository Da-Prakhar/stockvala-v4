// components/layout/Footer.tsx
// ✅ Server Component (no "use client" needed)

import Footer1 from "./footer/Footer1";
import Footer2 from "./footer/Footer2";
import Footer3 from "./footer/Footer3";
import Footer4 from "./footer/Footer4";

interface FooterProps {
  style?: 1 | 2 | 3 | 4;
}

/**
 * Footer Component
 * 
 * This component dynamically renders a footer style based on the "style" prop.
 * It runs on the server by default (no client-side JS needed).
 */
export default function Footer({ style = 1 }: FooterProps) {
  switch (style) {
    case 4:
      return <Footer4 />;
    case 3:
      return <Footer3 />;
    case 2:
      return <Footer2 />;
    default:
      return <Footer1 />;
  }
}
