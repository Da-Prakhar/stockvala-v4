
import Layout from "@/components/layout/Layout";
import About from "@/components/sections/home1/About";
import Account from "@/components/sections/home1/Account";
import Banner from "@/components/sections/home1/Banner";
import Blog from "@/components/sections/home1/Blog";
import Choose from "@/components/sections/home1/Choose";
import Counter from "@/components/sections/home1/Counter";
import Global from "@/components/sections/home1/Global";
import Instruments from "@/components/sections/home1/Instruments";
import Platforms from "@/components/sections/home1/Platforms";
import Testimonial from "@/components/sections/home1/Testimonial";
import Work from "@/components/sections/home1/Work";
export default function Home_One() {

    return (
        <div className="body-bg-1">
            <Layout headerStyle={1} footerStyle={1}>
                <Banner/>
                <Instruments/>
                <About/>
                <Counter/>
                <Account/>
                <Platforms/>
                <Choose/>
                <Work/>
                <Blog/>
                <Testimonial/>
                <Global/>
            </Layout>
        </div>
    )
}
