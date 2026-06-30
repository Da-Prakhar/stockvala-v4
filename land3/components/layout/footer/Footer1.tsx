'use client';
import Link from "next/link"
import CompanyLogo from "@/components/CompanyLogo";
import { useCompanyStore } from "@/store/companyStore";

export default function Footer1() {
  const { companyName, footerText, email, phone, facebook, twitter, linkedin, instagram } = useCompanyStore();
    return (
        <>
        
            <footer className="footer-style1">
                
                <div className="footer-main">
                    <div className="footer-main-top">
                        <div className="container">
                            <div className="row">
                                
                                <div className="col-xl-4 col-sm-6 single-widget">
                                    <div className="single-footer-widget wow fadeInUp" data-wow-duration="1200ms"
                                        data-wow-delay="000ms">
                                        <div className="single-footer-widget-contact">
                                            <div className="footer-logo-style1">
                                                <Link href="/">
                                                    <CompanyLogo fallbackSrc="/assets/images/logo.png" width={188} height={27} />
                                                </Link>
                                            </div>
                                            <div className="text-box">
                                                <p>{footerText || `${companyName} — Trade Smarter. Trade Faster. Access 150+ markets with tight spreads and professional support.`}</p>
                                            </div>
                                            <div className="your-trading">
                                                <div className="title1">
                                                    <h3>Begin Your Trading,</h3>
                                                </div>
                                                <div className="btn-box">
                                                    <Link href="/register" className="btn-one">
                                                        <span className="txt">
                                                            New Account
                                                            <i className="icon-right-arrow"></i>
                                                        </span>
                                                    </Link>
                                                    <Link href="/login" className="btn-one">
                                                        <span className="txt">
                                                            Sign In
                                                            <i className="icon-right-arrow"></i>
                                                        </span>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="col-xl-3 col-6 single-widget">
                                    <div className="single-footer-widget wow fadeInDown" data-wow-duration="1200ms"
                                        data-wow-delay="100ms">
                                        <div className="title">
                                            <h3>Trading</h3>
                                        </div>
                                        <div className="footer-widget-links">
                                            <ul>
                                                <li>
                                                    <Link href="#">
                                                        Forex Trading
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Commodities
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Indices
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Stocks
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Cryptocurrencies
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        ETFs
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Futures
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Bonds
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="col-xl-3 col-6 col-md-6 single-widget">
                                    <div className="single-footer-widget wow fadeInDown" data-wow-duration="1200ms"
                                        data-wow-delay="200ms">
                                        <div className="title">
                                            <h3>Platform</h3>
                                        </div>
                                        <div className="footer-widget-links">
                                            <ul>
                                                <li>
                                                    <Link href="#">
                                                        Web Trader
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Meta Trader 4
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Meta Trader 5
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                               
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="single-footer-widget mt28 wow fadeInUp" data-wow-duration="1500ms"
                                        data-wow-delay="300ms">
                                        <div className="title">
                                            <h3>Support</h3>
                                        </div>
                                        <div className="footer-widget-links">
                                            <ul>
                                                <li>
                                                    <Link href="#">
                                                        FAQ
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Get in Touch
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                </div>
                                
                                <div className="col-xl-2 col-6 col-md-6 single-widget">
                                    <div className="single-footer-widget wow fadeInDown" data-wow-duration="1200ms"
                                        data-wow-delay="400ms">
                                        <div className="title">
                                            <h3>Company</h3>
                                        </div>
                                        <div className="footer-widget-links">
                                            <ul>
                                                <li>
                                                    <Link href="#">
                                                        About Us
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Leadership Team
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Press & Media
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Benefits
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Recognition
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Responsibility
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                                <li>
                                                    <Link href="#">
                                                        Careers
                                                        <i className="icon-right-arrow"></i>
                                                    </Link>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* <div className="col-xl-3 col-lg-6 col-md-6 single-widget">
                                    <div className="single-footer-widget ml30 wow fadeInDown" data-wow-duration="1200ms"
                                        data-wow-delay="500ms">
                                        <div className="title">
                                            <h3>Trading Guides</h3>
                                        </div>
                                        <div className="footer-widget-trading-guides">
                                            <div className="img-box">
                                                <Image src="/assets/images/home/footer-v1-img1.webp" alt="Image" width={190} height={233} priority />
                                            </div>
                                            <div className="courses">
                                                <h6>10+ Courses</h6>
                                            </div>
                                            <div className="btn-box">
                                                <Link
                                                    href="https://fp-markets.net/stv/row-en/?fpm-affiliate-utm-source=Google/Paid&fpm-affiliate-pcode=G2536-NonBrCPA-for-ex-0924-S-D-gk-IN-125&gad_source=1&gclid=CjwKCAjw9p24BhB_EiwA8ID5BiRUgHYPV2Le75djkWSP6ohtUe198k-iN34r_tkfqMOUovCgNmP2ABoCGRgQAvD_BwE">
                                                    <i className="icon-download"></i>
                                                </Link>
                                            </div>
                                            <div className="title2">
                                                <h2>Free Ebook</h2>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                 */}

                            </div>
                        </div>
                    </div>

                    <div className="footer-main-bottom">
                        <div className="container">
                            <div className="footer-main-bottom__inner">
                                <div className="left-box">
                                    <div className="icon-box">
                                        <Link href="https://apps.apple.com/us/app/apple-store/id375380948">
                                            <span className="icon-app-store"></span>
                                        </Link>
                                        <Link href="https://play.google.com/store/games?hl=es_419">
                                            <span className="icon-google-play"><span className="path1"></span><span
                                                    className="path2"></span><span className="path3"></span><span
                                                    className="path4"></span></span>
                                        </Link>
                                    </div>
                                    <div className="text">
                                        <p>Join with 2.5m <br />Traders.</p>
                                    </div>
                                </div>
                                <ul className="middle-box clearfix">
                                    <li>
                                        <Link href="https://www.facebook.com/">
                                            <div className="icon">
                                                <i className="icon-facebook"></i>
                                            </div>
                                            <div className="text d-none d-sm-block">
                                                <p>Facebook</p>
                                            </div>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="https://www.linkedin.com/login">
                                            <div className="icon">
                                                <i className="icon-linkedin"></i>
                                            </div>
                                            <div className="text d-none d-sm-block">
                                                <p>Linkedin</p>
                                            </div>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="https://www.youtube.com/">
                                            <div className="icon">
                                                <i className="icon-youtube"></i>
                                            </div>
                                            <div className="text d-none d-sm-block">
                                                <p>Youtube</p>
                                            </div>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="https://www.instagram.com/">
                                            <div className="icon">
                                                <i className="icon-social"></i>
                                            </div>
                                            <div className="text d-none d-sm-block">
                                                <p>Instagram</p>
                                            </div>
                                        </Link>
                                    </li>
                                </ul>
                                <div className="right-box d-none d-sm-flex">
                                    <div className="text">
                                        <p>Instant Support via <br />Telegram</p>
                                    </div>
                                    <div className="icon">
                                        <Link href="https://telegram.org/">
                                            <i className="icon-telegram-1"></i>
                                        </Link>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="footer-bottom">
                    <div className="container">
                        <div className="bottom-inner">
                            <div className="copyright-text wow fadeInLeft" data-wow-duration="1500ms" data-wow-delay="000ms">
                                <p className="fs-6 fs-sm-2">
                                    Copyrights © {new Date().getFullYear()} <Link href="/">Swfx. </Link> All rights reserved.
                                </p>
                            </div>
                            <div className="footer-menu wow fadeInRight" data-wow-duration="1500ms" data-wow-delay="200ms">
                                <ul className="clearfix">
                                    <li>
                                        <Link href="#">Privacy Policy</Link>
                                    </li>
                                    <li>
                                        <Link href="#">Terms of Service</Link>
                                    </li>
                                    <li>
                                        <Link href="#">Risk Disclosure</Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                

            </footer>

        </>
    )
}
