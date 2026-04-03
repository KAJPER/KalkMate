import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import CameraReveal from "@/components/CameraReveal";
import HowItWorks from "@/components/HowItWorks";
import Specs from "@/components/Specs";
import Prototype from "@/components/Prototype";
import AIModel from "@/components/AIModel";
import Gallery from "@/components/Gallery";
import WhyKalkmate from "@/components/WhyKalkmate";
import ExamBenefits from "@/components/ExamBenefits";
import PriceComparison from "@/components/PriceComparison";
import FAQ from "@/components/FAQ";
import BuyNow from "@/components/BuyNow";
import Footer from "@/components/Footer";
import VisitTracker from "@/components/VisitTracker";
import SocialProof from "@/components/SocialProof";
import StickyBanner from "@/components/StickyBanner";
import StickyCountdown from "@/components/StickyCountdown";
import FlashSale from "@/components/FlashSale";
import UrgencyBanner from "@/components/UrgencyBanner";

export default function Home() {
  return (
    <>
      <VisitTracker />
      <StickyCountdown />
      <StickyBanner />
      <SocialProof />
      <Navigation />
      <main>
        <Hero />
        <UrgencyBanner />
        <Features />
        <CameraReveal />
        <FlashSale />
        <HowItWorks />
        <Specs />
        <Prototype />
        <AIModel />
        <Gallery />
        <WhyKalkmate />
        <ExamBenefits />
        <UrgencyBanner />
        <PriceComparison />
        <FAQ />
        <BuyNow />
      </main>
      <Footer />
    </>
  );
}
