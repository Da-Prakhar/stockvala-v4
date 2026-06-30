"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Menu() {
  const pathname = usePathname();

  // Checks if a path is active
  const isActive = (path: string) => pathname === path;

  // Checks if a parent dropdown should be active
  const isDropdownActive = (paths: string[]) => paths.some((path) => pathname.startsWith(path));

  return (
    <ul className="main-menu__list">

        {/* Home */}
        <li className={` ${isDropdownActive([
            "/index-2",
            "/index-3",
            "/index-4",
            ]) || isActive("/")
            ? "current"
            : ""
        }`}>
            <Link href="/">Home</Link>
            {/* <ul className="megamenu clearfix">
            <li className={isActive("/") ? "current" : ""}><Link href="/">Home Page 01</Link></li>
            <li className={isActive("/index-2") ? "current" : ""}><Link href="/index-2">Home Page 02</Link></li>
            <li className={isActive("/index-3") ? "current" : ""}><Link href="/index-3">Home Page 03</Link></li>
            <li className={isActive("/index-4") ? "current" : ""}><Link href="/index-4">Home Page 04</Link></li>
            </ul> */}
      </li>

      {/* Markets Dropdown */}
      <li className={` ${isDropdownActive(["/ś", "/markets1-trade-forex", "/markets2-stock-market", "/markets3-commodities-market", "/markets4-crypto-market", "/markets5-futures-market", "/markets6-options-market"]) ? "current" : ""}`}>
        <Link href="markets">Markets</Link>
        {/* <ul>
          <li className={isActive("/markets") ? "current" : ""}><Link href="/markets">All Markets</Link></li>
          <li className={isActive("/markets1-trade-forex") ? "current" : ""}><Link href="/markets1-trade-forex">Trade Forex</Link></li>
          <li className={isActive("/markets2-stock-market") ? "current" : ""}><Link href="/markets2-stock-market">Stock Market</Link></li>
          <li className={isActive("/markets3-commodities-market") ? "current" : ""}><Link href="/markets3-commodities-market">Commodities Market</Link></li>
          <li className={isActive("/markets4-crypto-market") ? "current" : ""}><Link href="/markets4-crypto-market">Crypto Market</Link></li>
          <li className={isActive("/markets5-futures-market") ? "current" : ""}><Link href="/markets5-futures-market">Futures Market</Link></li>
          <li className={isActive("/markets6-options-market") ? "current" : ""}><Link href="/markets6-options-market">Options Market</Link></li>
        </ul> */}
            
      </li>

      {/* Trading Page */}
      <li className={`dropdown ${isDropdownActive(["/platform", "/accounts", "/accounts1-standard-account", "/accounts2-mini-account", "/accounts3-stp-account", "/accounts4-demo-account", "/accounts5-islamic-account", "/accounts6-corporate-account"]) ? "current" : ""}`}>
        <Link href="#">Trading</Link>
            <ul>
              <li className={`dropdown ${isDropdownActive(["/accounts", "/accounts1-standard-account", "/accounts2-mini-account", "/accounts3-stp-account", "/accounts4-demo-account", "/accounts5-islamic-account", "/accounts6-corporate-account"]) ? "current" : ""}`}>
                  <Link href="#">Our Accounts</Link>
                  <ul>
                    <li className={isActive("/accounts") ? "current" : ""}><Link href="/accounts">All Accounts</Link></li>
                    <li className={isActive("/accounts1-standard-account") ? "current" : ""}><Link href="/accounts1-standard-account">Standard Account</Link></li>
                    <li className={isActive("/accounts2-mini-account") ? "current" : ""}><Link href="/accounts2-mini-account">Cent Account</Link></li>
                    <li className={isActive("/accounts3-stp-account") ? "current" : ""}><Link href="/accounts3-stp-account">STP Account</Link></li>
                    <li className={isActive("/accounts4-demo-account") ? "current" : ""}><Link href="/accounts4-demo-account">Demo Account</Link></li>
                    <li className={isActive("/accounts5-islamic-account") ? "current" : ""}><Link href="/accounts5-islamic-account">Islamic Account</Link></li>
                    <li className={isActive("/accounts6-corporate-account") ? "current" : ""}><Link href="/accounts6-corporate-account">Corporate Account</Link></li>
                  </ul>
                </li>
              <li className={isActive("/platform") ? "current" : ""}><Link href="/platform">Platform</Link></li>
            </ul>
      </li>

      {/* Education Page */}
      {/* <li className={`dropdown ${isDropdownActive(["/courses", "/courses-details"]) ? "current" : ""}`}>
        <Link href="#">Education</Link>
        <ul>
          <li className={isActive("/courses") ? "current" : ""}><Link href="/courses">Courses</Link></li>
          <li className={isActive("/courses-details") ? "current" : ""}><Link href="/courses-details">Course Details</Link></li>
        </ul>
      </li> */}

      {/* About */}
      <li className={`dropdown ${isDropdownActive(["/about", "/history", "/team", "/testimonials", "/faq", "/error", "/coming-soon", "/blog-1", "/blog-2", "/blog-3", "/blog-4", "/blog-single"]) ? "current" : ""}`}>
        <Link href="#">About</Link>
        <ul>
          <li className={isActive("/about") ? "current" : ""}><Link href="/about">About Us</Link></li>
          {/* <li className={isActive("/history") ? "current" : ""}><Link href="/history">History</Link></li> */}
          {/* <li className={isActive("/team") ? "current" : ""}><Link href="/team">Team Members</Link></li> */}
          {/* <li className={`dropdown ${isDropdownActive(["/blog-1", "/blog-2", "/blog-3", "/blog-4", "/blog-single"]) ? "current" : ""}`}>
            <Link href="#">Blog</Link>
            <ul>
              <li className={isActive("/blog-1") ? "current" : ""}><Link href="/blog-1">3 Columns Grid</Link></li>
              <li className={isActive("/blog-2") ? "current" : ""}><Link href="/blog-2">4 Columns Grid</Link></li>
              <li className={isActive("/blog-3") ? "current" : ""}><Link href="/blog-3">List View 01</Link></li>
              <li className={isActive("/blog-4") ? "current" : ""}><Link href="/blog-4">List View 02</Link></li>
              <li className={isActive("/blog-single") ? "current" : ""}><Link href="/blog-single">Blog Details</Link></li>
            </ul>
          </li> */}
          <li className={isActive("/testimonials") ? "current" : ""}><Link href="/testimonials">Testimonials</Link></li>
          {/* <li className={isActive("/faq") ? "current" : ""}><Link href="/faq">Faq&apos;s</Link></li>
          <li className={isActive("/error") ? "current" : ""}><Link href="/error">404</Link></li>
          <li className={isActive("/coming-soon") ? "current" : ""}><Link href="/coming-soon">Coming Soon</Link></li> */}
        </ul>
      </li>

      {/* Contact */}
      <li className={isActive("/contact") ? "current" : ""}><Link href="/contact">Contact</Link></li>

    </ul>
  );
}
