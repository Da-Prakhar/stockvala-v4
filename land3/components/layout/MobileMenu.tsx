
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type MobileMenuProps = {
  isSidebar: boolean;
  handleMobileMenu: () => void;
};

export default function MobileMenu({ handleMobileMenu }: MobileMenuProps) {
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  const toggleDropdown = (key: number) => {
    if (activeDropdown === key) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(key);
    }
  };

  return (
    <>
      {/* Mobile Menu */}
      <div className="mobile-nav__wrapper">
        <div className="mobile-nav__overlay mobile-nav__toggler" onClick={handleMobileMenu}></div>
        <div className="mobile-nav__content">
          <span className="mobile-nav__close mobile-nav__toggler" onClick={handleMobileMenu}>
            <i className="fa fa-times-circle"></i>
          </span>

          <div className="logo-box">
              <Link href="/" aria-label="logo image">
                  <Image src="/assets/images/logo.png" alt="Image" width={189} height={27} priority />
              </Link>
          </div>

          <div className="mobile-nav-search-box">
              <form className="search-form" action="#">
                  <input placeholder="Keyword" type="text" />
                  <button type="submit">
                      <i className="fa fa-search"></i>
                  </button>
              </form>
          </div>

          <div className="mobile-nav__container">
            <ul className="main-menu__list">

              {/* Home */}
              <li className={` ${activeDropdown === 1 ? "current" : ""}`}>
                <Link href="/">Home</Link>
                {/* <ul style={{ display: activeDropdown === 1 ? "block" : "none" }}>
                  <li><Link href="/" onClick={handleMobileMenu}>Home Page 01</Link></li>
                  <li><Link href="/index-2" onClick={handleMobileMenu}>Home Page 02</Link></li>
                  <li><Link href="/index-3" onClick={handleMobileMenu}>Home Page 03</Link></li>
                  <li><Link href="/index-4" onClick={handleMobileMenu}>Home Page 04</Link></li>
                </ul>
                <div className={`dropdown-btn ${activeDropdown === 1 ? "open" : ""}`} onClick={() => toggleDropdown(1)}>
                  <span className="fa fa-angle-right" />
                </div> */}
              </li>

              {/* Markets */}
              <li className={`dropdown ${activeDropdown === 2 ? "current" : ""}`}>
                <Link href="/markets">Markets</Link>
                {/* <ul style={{ display: activeDropdown === 2 ? "block" : "none" }}>
                  <li><Link href="/markets" onClick={handleMobileMenu}>All Markets</Link></li>
                  <li><Link href="/markets1-trade-forex" onClick={handleMobileMenu}>Trade Forex</Link></li>
                  <li><Link href="/markets2-stock-market" onClick={handleMobileMenu}>Stock Market</Link></li>
                  <li><Link href="/markets3-commodities-market" onClick={handleMobileMenu}>Commodities Market</Link></li>
                  <li><Link href="/markets4-crypto-market" onClick={handleMobileMenu}>Crypto Market</Link></li>
                  <li><Link href="/markets5-futures-market" onClick={handleMobileMenu}>Futures Market</Link></li>
                  <li><Link href="/markets6-options-market" onClick={handleMobileMenu}>Options Market</Link></li>
                </ul>
                <div className={`dropdown-btn ${activeDropdown === 2 ? "open" : ""}`} onClick={() => toggleDropdown(2)}>
                  <span className="fa fa-angle-right" />
                </div> */}
              </li>

              {/* Trading */}
              <li className={`dropdown ${activeDropdown === 3 ? "current" : ""}`}>
                <Link href="#">Trading</Link>
                <ul style={{ display: activeDropdown === 3 ? "block" : "none" }}>
                  <li><Link href="/accounts" onClick={handleMobileMenu}>All Accounts</Link></li>
                  <li><Link href="/platform" onClick={handleMobileMenu}>Platform</Link></li>
                  <li><Link href="/accounts1-standard-account" onClick={handleMobileMenu}>Standard Account</Link></li>
                  <li><Link href="/accounts2-mini-account" onClick={handleMobileMenu}>Cent Account</Link></li>
                  <li><Link href="/accounts3-stp-account" onClick={handleMobileMenu}>STP Account</Link></li>
                  <li><Link href="/accounts4-demo-account" onClick={handleMobileMenu}>Demo Account</Link></li>
                  <li><Link href="/accounts5-islamic-account" onClick={handleMobileMenu}>Islamic Account</Link></li>
                  <li><Link href="/accounts6-corporate-account" onClick={handleMobileMenu}>Corporate Account</Link></li>
                </ul>
                <div className={`dropdown-btn ${activeDropdown === 3 ? "open" : ""}`} onClick={() => toggleDropdown(3)}>
                  <span className="fa fa-angle-right" />
                </div>
              </li>

              {/* Education */}
              {/* <li className={`dropdown ${activeDropdown === 4 ? "current" : ""}`}>
                <Link href="#">Education</Link>
                <ul style={{ display: activeDropdown === 4 ? "block" : "none" }}>
                  <li><Link href="/courses" onClick={handleMobileMenu}>Courses</Link></li>
                  <li><Link href="/courses-details" onClick={handleMobileMenu}>Course Details</Link></li>
                </ul>
                <div className={`dropdown-btn ${activeDropdown === 4 ? "open" : ""}`} onClick={() => toggleDropdown(4)}>
                  <span className="fa fa-angle-right" />
                </div>
              </li> */}

              {/* About */}
              <li className={`dropdown ${activeDropdown === 5 ? "current" : ""}`}>
                <Link href="#">About</Link>
                <ul style={{ display: activeDropdown === 5 ? "block" : "none" }}>
                  <li><Link href="/about" onClick={handleMobileMenu}>About Us</Link></li>
                  {/* <li><Link href="/history" onClick={handleMobileMenu}>History</Link></li> */}
                  {/* <li><Link href="/team" onClick={handleMobileMenu}>Team Members</Link></li> */}
                  <li><Link href="/testimonials" onClick={handleMobileMenu}>Testimonials</Link></li>
                  {/* <li><Link href="/faq" onClick={handleMobileMenu}>Faq&apos;s</Link></li>
                  <li><Link href="/error" onClick={handleMobileMenu}>404</Link></li>
                  <li><Link href="/coming-soon" onClick={handleMobileMenu}>Coming Soon</Link></li> */}
                </ul>
                <div className={`dropdown-btn ${activeDropdown === 5 ? "open" : ""}`} onClick={() => toggleDropdown(5)}>
                  <span className="fa fa-angle-right" />
                </div>
              </li>

              {/* Blog */}
              {/* <li className={`dropdown ${activeDropdown === 6 ? "current" : ""}`}>
                <Link href="#">Blog</Link>
                <ul style={{ display: activeDropdown === 6 ? "block" : "none" }}>
                  <li><Link href="/blog-1" onClick={handleMobileMenu}>3 Columns Grid</Link></li>
                  <li><Link href="/blog-2" onClick={handleMobileMenu}>4 Columns Grid</Link></li>
                  <li><Link href="/blog-3" onClick={handleMobileMenu}>List View 01</Link></li>
                  <li><Link href="/blog-4" onClick={handleMobileMenu}>List View 02</Link></li>
                  <li><Link href="/blog-single" onClick={handleMobileMenu}>Blog Details</Link></li>
                </ul>
                <div className={`dropdown-btn ${activeDropdown === 6 ? "open" : ""}`} onClick={() => toggleDropdown(6)}>
                  <span className="fa fa-angle-right" />
                </div>
              </li> */}

              {/* Contact */}
              <li><Link href="/contact">Contact</Link></li>

            </ul>
          </div>

          <ul className="mobile-nav__contact list-unstyled">
              <li>
                  <i className="fa fa-envelope"></i>
                  <Link href="mailto:info@example.com">info@example.com</Link>
              </li>
              <li>
                  <i className="fa fa-phone-alt"></i>
                  <a href="tel:123456789">444 000 777 66</a>
              </li>
          </ul>
          <div className="mobile-nav__social">
              <Link href="#" className="fab fa-twitter"></Link>
              <Link href="#" className="fab fa-facebook-square"></Link>
              <Link href="#" className="fab fa-pinterest-p"></Link>
              <Link href="#" className="fab fa-instagram"></Link>
          </div>
        </div>

      </div>

      {/* Overlay */}
      <div
        className="nav-overlay"
      />
    </>
  );
}
