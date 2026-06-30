'use client'
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function Statement() {

    // tab
    const [activeTab, setActiveTab] = useState("mission");

  return (
    <>
        <section className="statement-style1">
            <div className="container">
                <div className="statement-style1__inner">
                    <div className="statement-style1__tab">

                        <div className="statement-style1__tab-btn">
                            <ul className="tabs-button-box clearfix">
                                <li className={`tab-btn-item ${activeTab === "mission" ? "active-btn-item" : ""}`} onClick={() => setActiveTab("mission")}>
                                    <h3>Mission Statement</h3>
                                </li>
                                <li className={`tab-btn-item ${activeTab === "vision" ? "active-btn-item" : ""}`} onClick={() => setActiveTab("vision")}>
                                    <h3>Vision Statement</h3>
                                </li>
                                <li className={`tab-btn-item ${activeTab === "value" ? "active-btn-item" : ""}`} onClick={() => setActiveTab("value")}>
                                    <h3>Our Value</h3>
                                </li>
                            </ul>
                        </div>

                        <div className="tabs-content-box">

                            {activeTab === "mission" && (
                            <div className="tab-content-box-item tab-content-box-item-active fadeIn" id="mission">
                                <div className="statement-style1-tab-content-box-item">

                                    <div className="single-statement-style1">
                                        <div className="single-statement-style1__pattern"
                                            style={{ backgroundImage: "url(/assets/images/pattern/statement-v1-pattern.jpg)" }}>
                                        </div>
                                        <div className="row">
                                            <div className="col-xl-6 col-lg-6">
                                                <div className="single-statement-style1__content">
                                                    <div className="title">
                                                        <h6>Statements</h6>
                                                        <h2>Our Mission</h2>
                                                    </div>
                                                    <div className="text">
                                                        <p>Empowering businesses and investors through innovative trading solutions, delivering reliable market insights, and creating sustainable growth opportunities.</p>
                                                    </div>
                                                    <ul className="list-item">
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Committed to market excellence.</p>
                                                            </div>
                                                        </li>
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Building trust through transparency.</p>
                                                            </div>
                                                        </li>
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Driving sustainable growth.</p>
                                                            </div>
                                                        </li>
                                                    </ul>
                                                    <div className="btn-box">
                                                        <Link href="#">
                                                            Start Your Journey
                                                            <i className="icon-right-arrow"></i>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-xl-6 col-lg-6">
                                                <div className="single-statement-style1__img">
                                                    <Image src="/assets/images/about/imgi_53_image.webp" alt="Image" width={470} height={345} priority />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            )}
                            
                            {activeTab === "vision" && (
                            <div className="tab-content-box-item tab-content-box-item-active fadeIn" id="vision">
                                <div className="statement-style1-tab-content-box-item">
                                    <div className="single-statement-style1">
                                        <div className="single-statement-style1__pattern"
                                            style={{ backgroundImage: "url(/assets/images/pattern/statement-v1-pattern.jpg)" }}>
                                        </div>
                                        <div className="row">
                                            <div className="col-xl-6 col-lg-6">
                                                <div className="single-statement-style1__content">
                                                    <div className="title">
                                                        <h6>Statements</h6>
                                                        <h2>Vision Statement</h2>
                                                    </div>
                                                    <div className="text">
                                                        <p>To become a leading name in global commodity trading by delivering exceptional value, fostering innovation, and building lasting client relationships.</p>
                                                    </div>
                                                    <ul className="list-item">
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Striving to set new standards in market excellence.</p>
                                                            </div>
                                                        </li>
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Expanding opportunities through strategic growth and expertise.</p>
                                                            </div>
                                                        </li>
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Shaping a future driven by trust, performance, and success.</p>
                                                            </div>
                                                        </li>
                                                    </ul>
                                                    <div className="btn-box">
                                                        <Link href="#">
                                                            Start Your Journey
                                                            <i className="icon-right-arrow"></i>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-xl-6 col-lg-6">
                                                <div className="single-statement-style1__img">
                                                    <Image src="/assets/images/about/imgi_53_image.webp" alt="Image" width={470} height={345} priority />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}
                            
                            {activeTab === "value" && (
                            <div className="tab-content-box-item tab-content-box-item-active fadeIn" id="value">
                                <div className="statement-style1-tab-content-box-item">
                                    <div className="single-statement-style1">
                                        <div className="single-statement-style1__pattern"
                                            style={{ backgroundImage: "url(/assets/images/pattern/statement-v1-pattern.jpg)" }}>
                                        </div>
                                        <div className="row">
                                            <div className="col-xl-6 col-lg-6">
                                                <div className="single-statement-style1__content">
                                                    <div className="title">
                                                        <h6>Statements</h6>
                                                        <h2>Our Value</h2>
                                                    </div>
                                                    <div className="text">
                                                        <p>We are committed to integrity, transparency, and excellence, ensuring trusted partnerships and sustainable growth for our clients.</p>
                                                    </div>
                                                    <ul className="list-item">
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Acting with honesty and responsibility.</p>
                                                            </div>
                                                        </li>
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Delivering quality through expertise.</p>
                                                            </div>
                                                        </li>
                                                        <li>
                                                            <div className="icon">
                                                                <span className="icon-right-arrow-3"><span
                                                                        className="path1"></span><span className="path2"></span>
                                                                </span>
                                                            </div>
                                                            <div className="text1">
                                                                <p>Creating value through long-term relationships.</p>
                                                            </div>
                                                        </li>
                                                    </ul>
                                                    <div className="btn-box">
                                                        <Link href="#">
                                                            Start Your Journey
                                                            <i className="icon-right-arrow"></i>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-xl-6 col-lg-6">
                                                <div className="single-statement-style1__img">
                                                    <Image src="/assets/images/about/imgi_53_image.webp" alt="Image" width={470} height={345} priority />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}

                        </div>

                    </div>
                </div>
            </div>
        </section>
    </>
  )
}