
import Layout from "@/components/layout/Layout";
import "../../public/assets/css/color-2.css";
import Banner from "@/components/sections/home3/Banner";
import Awards from "@/components/sections/home3/Awards";
import Welcome from "@/components/sections/home3/Welcome";
import About from "@/components/sections/home3/About";
import Slogan from "@/components/sections/home3/Slogan";
import Instrument from "@/components/sections/home3/Instrument";
import Market from "@/components/sections/home3/Market";
import Trading from "@/components/sections/home3/Trading";
import Account from "@/components/sections/home3/Account";
import Video from "@/components/sections/home3/Video";
import Choose from "@/components/sections/home3/Choose";
import Ebook from "@/components/sections/home3/Ebook";
import Blog from "@/components/sections/home3/Blog";
import Slogan_Two from "@/components/sections/home3/Slogan_Two";

export default function Home_Three() {

    return (
        <div className="body-bg-2">
            <Layout headerStyle={3} footerStyle={3}>
                <Banner/>
                <Awards/>
                <Welcome/>
                <About/>
                <Slogan/>
                <Instrument/>
                <Market/>
                <Trading/>
                <Account/>
                <Video/>
                <Choose/>
                <Ebook/>
                <Blog/>
                <Slogan_Two/>
            </Layout>
        </div>
    )
}
