
import Layout from "@/components/layout/Layout";
import "../../public/assets/css/color-3.css";
import Banner from "@/components/sections/home4/Banner";
import Counter from "@/components/sections/home4/Counter";
import Service from "@/components/sections/home4/Service";
import Instruments from "@/components/sections/home4/Instruments";
import Trade from "@/components/sections/home2/Trade";
import Broker from "@/components/sections/home4/Broker";
import Work from "@/components/sections/home1/Work";
import Account from "@/components/sections/home4/Account";
import Ebook from "@/components/sections/home4/Ebook";
import Blog from "@/components/sections/home4/Blog";
import Testimonial from "@/components/sections/home4/Testimonial";

export default function Home_Four() {

    return (
        <div className="body-bg-2">
            <Layout headerStyle={4} footerStyle={4}>
                <Banner/>
                <Counter/>
                <Service/>
                <Instruments/>
                <Trade/>
                <Broker/>
                <Work/>
                <Account/>
                <Ebook/>
                <Blog/>
                <Testimonial/>
            </Layout>
        </div>
    )
}
