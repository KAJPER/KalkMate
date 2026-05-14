import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Specs from "@/components/Specs";
import ExamBenefits from "@/components/ExamBenefits";
import Gallery from "@/components/Gallery";
import FAQ from "@/components/FAQ";
import BuyNow from "@/components/BuyNow";
import Footer from "@/components/Footer";
import VisitTracker from "@/components/VisitTracker";

export default function Home() {
  return (
    <>
      <VisitTracker />
      <Navigation />
      <main className="relative overflow-x-clip">
        <Hero />
        <HowItWorks />
        <ExamBenefits />
        <Specs />
        <Gallery />
        <FAQ />
        <BuyNow />
      </main>
      <Footer />
    </>
  );
}
