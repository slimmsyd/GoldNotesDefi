import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { BackedBy } from "@/components/backed-by";
import { DigitalTokenFeatures } from "@/components/digital-token-features";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { AuditedSection } from "@/components/audited-section";
import { SwapSection } from "@/components/swap-section";
import { LearnMoreSection } from "@/components/learn-more-section";
import { FAQSection } from "@/components/faq-section";
import { Footer } from "@/components/footer";
import { ChatbotInput } from "@/components/chatbot-input";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
    
      <main>
        <section id="hero">
          <Hero />
        </section>
        <section id="backed-by">
          <BackedBy />
        </section>
        <section id="features">
          <DigitalTokenFeatures />
        </section>
        <section id="how-it-works">
          <HowItWorksSection />
        </section>
        <section id="audited">
          <AuditedSection />
        </section>
        <section id="swap">
          <SwapSection />
        </section>
        <section id="learn-more">
          <LearnMoreSection />
        </section>
        <section id="faq">
          <FAQSection />
        </section>
      </main>
      <Footer />

      {/* Global Chatbot Input */}
      {/* <ChatbotInput /> */}
    </div>
  );
}
