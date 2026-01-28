'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'What is BlackW3B?',
    answer: 'Black W3B: a gold-backed, AI-powered decentralized ecosystem fusing blockchain, culture, and sovereignty through DeFi, NFTs, DAOs, and AI agents. A digital-physical economy where Indigenous Ancient Futurism, creative ownership, and financial freedom shape sovereign wealth.',
  },
  {
    question: 'What is the benefit of having physical Goldbacks on a blockchain?',
    answer: 'Digitizing Goldbacks on the blockchain provides instant liquidity and global accessibility while preserving the physical integrity and custody standards. It enables real-time payments, P2P transfers, and online commerce that physical notes cannot access at scale, all while maintaining verifiable 1:1 backing and anti-counterfeit assurance through serialization.'
  },
  {
    question: 'How much Goldback backing is in the total supply?',
    answer: 'BlackW3B maintains strict 1:1 backing with physical Goldbacks. Every token in circulation is backed by one locked, serialized Goldback note stored in secure vaults. The system enforces non-rehypothecation to preserve the peg, with daily attestations and monthly third-party audits providing transparency.'
  },
  {
    question: 'Can I get a fractional amount of a BlackW3B token?',
    answer: 'Yes, BlackW3B tokens are divisible, allowing you to hold and transfer fractional amounts. This enables micro-transactions and flexible position sizing while maintaining the underlying 1:1 backing with physical Goldbacks.'
  },
  {
    question: 'How does the vault custody system work?',
    answer: 'Physical Goldbacks are stored in secure, audited vaults with serialization for anti-counterfeit protection. The system uses segregated keys and Hardware Security Modules (HSMs) to maintain tamper-evident security. All custody operations are recorded on-chain with transparent events for full auditability.'
  },
  {
    question: 'What are the fees associated with BlackW3B?',
    answer: 'BlackW3B offers a cost-effective structure with low transaction fees and zero storage fees. Detailed fee information including minting, redemption, and transfer costs can be found in our white paper and investor documentation.'
  }
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  function toggleFAQ(index: number) {
    setOpenIndex(openIndex === index ? -1 : index);
  }

  return (
    <section className="relative py-20 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column - Header */}
          <div className="lg:col-span-6">
            <h2 className="text-5xl font-light text-gray-900 mb-6">
              FAQ
            </h2>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Review frequently asked questions about BlackW3B. For more information view our{' '}
              <a href="#" className="text-gray-900 underline hover:text-gray-700 transition-colors">
                documentation
              </a>
              .
            </p>
          </div>

          {/* Right Column - Accordion */}
          <div className="lg:col-span-6">
            <div className="space-y-0 border-t border-gray-200">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className="border-b border-gray-200"
                >
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full py-6 flex items-start justify-between text-left hover:bg-gray-50 transition-colors px-2"
                  >
                    <span className="text-[16px] font-medium text-gray-900 pr-8">
                      {faq.question}
                    </span>
                    <span className="flex-shrink-0 mt-1">
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                          openIndex === index ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </span>
                  </button>
                  
                  {openIndex === index && (
                    <div className="pb-6 px-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[13px] text-gray-600 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

