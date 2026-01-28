import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ShopGoldBacksContent } from "@/components/shop-gold-backs-content";
import { AmazonGoldBacksSection } from "@/components/amazon-goldbacks-section";
import { getGoldPackages } from "./actions";
import { getSiteSettings } from "./settings-actions";
import { getGoldPriceInfo } from "@/lib/gold-price";

export const dynamic = 'force-dynamic'; // Ensure we always fetch fresh data

export default async function ShopGoldBacksPage() {
    // Fetch all data in parallel
    const [packages, goldPriceInfo, siteSettings] = await Promise.all([
        getGoldPackages(),
        getGoldPriceInfo(),
        getSiteSettings(),
    ]);



    return (
        <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-neutral-200 selection:text-neutral-900">
            <Header />
            <ShopGoldBacksContent
                initialPackages={packages}
                goldPriceInfo={goldPriceInfo}
                goldbackRate={siteSettings.goldbackRatePer1GB + 0.23}
            />
            <AmazonGoldBacksSection />
            <Footer />
        </div>
    );
}
