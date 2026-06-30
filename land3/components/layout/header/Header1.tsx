import Link from "next/link";
import Image from "next/image";
import MobileMenu from "../MobileMenu";
import Menu from "../Menu";
import Language from "../Language";
import CompanyLogo from "@/components/CompanyLogo";

// ✅ Define props type
type Header1Props = {
  scroll: boolean;
  handleMobileMenu: () => void;
  handlePopup: () => void;
};

export default function Header1({ scroll, handleMobileMenu, handlePopup }: Header1Props) {
  return (
    <>
      {/* main header */}
      <header className={`main-header main-header-style1 ${scroll ? "fixed-header" : ""}`}>
        
        <div className="main-header-style1__content">
            <div className="container">
                <div className="main-header-style1__content-inner">
                    <div className="main-header-style1__content-top row justify-content-between align-items-center">
                        <div className="main-header-style1__content-top-left col-6">
                            <div className="header-logo-box-style1">
                                <Link href="/">
                                    <CompanyLogo fallbackSrc="/assets/images/logo.png" width={189} height={27} />
                                </Link>
                            </div>
                            <div className="header-trading-time-style1 d-none d-lg-flex">
                                <div className="icon">
                                    <i className="icon-hour"></i>
                                </div>
                                <div className="text">
                                    <p><span>Forex:</span> 24/5</p>
                                    {/* <ul className="clearfix">
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/arrow-right.png" alt="Icon" width={22} height={14} priority />
                                            </div>
                                            <div className="text1">
                                                <h4>Stock</h4>
                                                <p>9.30 am to 4.00 pm</p>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/arrow-right.png" alt="Icon" width={22} height={14} priority />
                                            </div>
                                            <div className="text1">
                                                <h4>Forex</h4>
                                                <p>Open 24/5</p>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/arrow-right.png" alt="Icon" width={22} height={14} priority />
                                            </div>
                                            <div className="text1">
                                                <h4>Commodity Market</h4>
                                                <p>8.00 am to 5.00 pm</p>
                                            </div>
                                        </li>
                                    </ul> */}
                                </div>
                            </div>
                        </div> 

                        <div className="main-header-style1__content-top-right col-6 justify-content-end d-flex align-items-center">
                            <div className="header-login-register-style1">
                                <div className="icon">
                                    <span className="icon-lock"><span className="path1"></span><span
                                            className="path2"></span><span className="path3"></span><span
                                            className="path4"></span><span className="path5"></span><span
                                            className="path6"></span><span className="path7"></span><span
                                            className="path8"></span>
                                    </span>
                                </div>
                                <div className="title">
                                    <h3>My Portal</h3>
                                    <p className="d-none d-lg-block"><Link href="/login">Login - or - Register</Link></p>
                                    <ul className="clearfix">
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/icon-login.png" alt="Icon" width={26} height={26} priority />
                                            </div>
                                            <div className="text1">
                                                <h4><Link href="/login">Login</Link></h4>
                                                <p className="d-none d-lg-block">Enter to Trade</p>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/icon-register.png" alt="Icon" width={26} height={26} priority />
                                            </div>
                                            <div className="text1">
                                                <h4><Link href="/register">Register</Link></h4>
                                                <p className="d-none d-lg-block">Start Your Journey</p>
                                            </div>
                                        </li>
                                        {/* <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/icon-logout.png" alt="Icon" width={26} height={26} priority />
                                            </div>
                                            <div className="text1">
                                                <h4><Link href="#">Logout</Link></h4>
                                                <p>Goodbye, See You</p>
                                            </div>
                                        </li> */}
                                    </ul>
                                </div>
                            </div>

                            <div className="header-help-center-style1 d-none d-lg-block">
                                <div className="text">
                                    <i className="icon-link"></i>
                                    <p>Help Center</p>
                                    <ul className="clearfix">
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/icon-faq.png" alt="Icon" width={26} height={26} priority />
                                            </div>
                                            <div className="text1">
                                                <h4><Link href="#">Faq&apos;s</Link></h4>
                                                <p>Get 100+ answers.</p>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/icon-live-chat.png" alt="Icon" width={26} height={26} priority />
                                            </div>
                                            <div className="text1">
                                                <h4><Link href="#">Live Chat</Link></h4>
                                                <p>Anytime, Anywhere.</p>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="icon1">
                                                <Image src="/assets/images/icon/icon-community-forums.png" alt="Icon" width={26} height={23} priority />
                                            </div>
                                            <div className="text1">
                                                <h4><Link href="#">Community Forums</Link></h4>
                                                <p>Unite & Discuss.</p>
                                            </div>
                                        </li> 
                                    </ul>
                                </div>
                            </div>

                        </div>

                    </div>

                    <div className="main-header-style1__content-bottom">
                        <div className="main-header-style1__content-bottom-left">


                            <nav className="main-menu main-menu-style1">
                                <div className="main-menu__wrapper clearfix">
                                    <div className="main-menu__wrapper-inner">
                                        <div className="sticky-logo-box-style1">
                                            <Link href="/">
                                                <CompanyLogo fallbackSrc="/assets/images/logo.png" width={189} height={27} />
                                            </Link>
                                        </div>
                                        <div className="main-menu-style1__left">
                                            <div className="main-menu-box">
                                                <Link href="#" className="mobile-nav__toggler" onClick={handleMobileMenu}>
                                                    <i className="fa fa-bars"></i>
                                                </Link>

                                                <Menu/>

                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </nav>
                            
                        </div>

                        <div className="main-header-style1__content-bottom-right">
                            <div className="language-switcher-style1">
                                <div className="icon">
                                    <i className="icon-language"></i>
                                </div>
                                <Language/>
                            </div>
                            <div className="header-btn-box-style1">
                                <div className="icon">
                                    <i className="icon-candle"></i>
                                </div>
                                <div className="text">
                                    <Link href="/register">
                                        Start <br />Trading
                                        <i className="icon-right-arrow"></i>
                                    </Link>
                                </div>
                            </div>
                            <div className="box-search-style1">
                                <Link href="#" className="search-toggler" onClick={handlePopup}>
                                    <span className="icon-search"></span>
                                </Link>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>

        {/* sticky header */}
        <div className={`stricky-header stricky-header--style1 stricked-menu main-menu ${scroll ? "animated slideInDown" : ""}`}>
          <div className="sticky-header__content">
                <div className="main-menu__wrapper clearfix">
                    <div className="main-menu__wrapper-inner">
                        <div className="sticky-logo-box-style1">
                            <Link href="/">
                                <CompanyLogo fallbackSrc="/assets/images/logo.png" width={189} height={27} />
                            </Link>
                        </div>
                        <div className="main-menu-style1__left">
                            <div className="main-menu-box">
                                <Link href="#" className="mobile-nav__toggler" onClick={handleMobileMenu}>
                                    <i className="fa fa-bars"></i>
                                </Link>

                                <Menu/>

                            </div>
                        </div>
                        
                    </div>

                </div>
            </div>
        </div>

        {/* ✅ Fixed MobileMenu props */}
        <MobileMenu
          isSidebar={false}
          handleMobileMenu={handleMobileMenu}
        />
      </header>
    </>
  );
}
