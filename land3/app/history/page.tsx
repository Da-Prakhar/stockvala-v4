import Layout from "@/components/layout/Layout";
import Image from "next/image";
import Link from "next/link";


export default function History_Page() {

    return (
        <div className="body-bg-1">
            <Layout headerStyle={1} footerStyle={1} breadcrumbTitle="Our History" breadcrumbTitleTwo="About">
                <section className="history-style1">
                    <div className="container">
                        <i className="border-line1"></i>
                        <ul className="history-style1__inner">


                            <li className="single-history-style1">
                                <div className="img-box">
                                    <Image src="/assets/images/history/history-v1-img1.webp" alt="History" width={370} height={295} priority />
                                </div>
                                <div className="year-box">
                                    <h3>2000</h3>
                                    <div className="border-line"></div>
                                </div>
                                <div className="content-box">
                                    <div className="title">
                                        <h6>Early Stage</h6>
                                        <h3><Link href="#">The Establishment</Link></h3>
                                    </div>
                                    <div className="text">
                                        <p>Star Wave Holding  was founded with a vision to deliver trusted trading solutions, helping clients navigate markets with confidence and long-term success.</p>
                                    </div>
                                    <div className="btn-box">
                                        <Link href="#">
                                            Read More
                                            <i className="icon-right-arrow"></i>
                                        </Link>
                                    </div>
                                </div>
                            </li>
                            
                            
                            <li className="single-history-style1 instyle2">
                                <div className="img-box">
                                    <Image src="/assets/images/history/history-v1-img2.webp" alt="History" width={370} height={295} priority />
                                </div>
                                <div className="year-box">
                                    <h3>2004</h3>
                                    <div className="border-line"></div>
                                </div>
                                <div className="content-box">
                                    <div className="title">
                                        <h6>First Achievement</h6>
                                        <h3><Link href="#">Trusted Trading Partner</Link></h3>
                                    </div>
                                    <div className="text">
                                        <p>Recognized for delivering reliable services, maintaining transparency, and building strong client relationships across evolving market conditions.</p>
                                    </div>
                                    <div className="btn-box">
                                        <Link href="#">
                                            Read More
                                            <i className="icon-right-arrow"></i>
                                        </Link>
                                    </div>
                                </div>
                            </li>
                            

                            <li className="single-history-style1">
                                <div className="img-box">
                                    <Image src="/assets/images/history/history-v1-img3.webp" alt="History" width={370} height={295} priority />
                                </div>
                                <div className="year-box">
                                    <h3>2010</h3>
                                    <div className="border-line"></div>
                                </div>
                                <div className="content-box">
                                    <div className="title">
                                        <h6>New Milestone</h6>
                                        <h3><Link href="#">Business Expansion</Link></h3>
                                    </div>
                                    <div className="text">
                                        <p>Expanded operations to serve a broader client base, strengthening market presence and creating new growth opportunities.</p>
                                    </div>
                                    <div className="btn-box">
                                        <Link href="#">
                                            Read More
                                            <i className="icon-right-arrow"></i>
                                        </Link>
                                    </div>
                                </div>
                            </li>
                            

                            <li className="single-history-style1 instyle2">
                                <div className="img-box">
                                    <Image src="/assets/images/history/history-v1-img4.webp" alt="History" width={370} height={295} priority />
                                </div>
                                <div className="year-box">
                                    <h3>2012</h3>
                                    <div className="border-line"></div>
                                </div>
                                <div className="content-box">
                                    <div className="title">
                                        <h6>Milestone</h6>
                                        <h3><Link href="#">Growing Client Network</Link></h3>
                                    </div>
                                    <div className="text">
                                        <p>Achieved a significant growth milestone by earning the trust of clients through reliable services and market expertise.</p>
                                    </div>
                                    <div className="btn-box">
                                        <Link href="#">
                                            Read More
                                            <i className="icon-right-arrow"></i>
                                        </Link>
                                    </div>
                                </div>
                            </li>

                        </ul>
                    </div>
                </section>
            </Layout>
        </div>
    )
}
