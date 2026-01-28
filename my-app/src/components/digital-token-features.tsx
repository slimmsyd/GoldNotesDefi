export function DigitalTokenFeatures() {
  return (
    <section
      className="relative bg-white py-24 px-[48px]"
    //   style={{ padding: "140px 100px 80px" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Main Heading Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[40px]">
          {/* Left: Main Heading */}
          <div>
            <h2 className="text-[48px]  font-light leading-tight text-gray-900">
              A digital token, <span className="block">backed by physical goldbacks</span>
            </h2>
          </div>

          {/* Right: Description */}
          <div className="flex items-center">
            <p className="text-lg text-gray-600 leading-relaxed">
              The system extends Goldbacks into the digital realm while maintaining their physical 
              integrity and custody standards. Through transparent on-chain verification and robust 
              security measures, it delivers digitization without dilution—ensuring every digital 
              token is backed by authenticated physical goldbacks in secure custody.
            </p>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Feature 1: Strict 1:1 Backing */}
          <div className="border-t border-gray-200 pt-8">
            {/* Icon */}
            <div className="mb-6">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #FFE860, #FEFDD6)' }}
              >
                <svg 
                  className="w-7 h-7 text-gray-900" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-medium text-gray-900 mb-3">
              Strict 1:1 backing
            </h3>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed">
              $W3B is minted exclusively against locked, serialized Goldbacks. The system 
              enforces non-rehypothecation to preserve the peg.
            </p>
          </div>

          {/* Feature 2: Instant Digital Payments */}
          <div className="border-t border-gray-200 pt-8">
            {/* Icon */}
            <div className="mb-6">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #FFE860, #FEFDD6)' }}
              >
                <svg 
                  className="w-7 h-7 text-gray-900" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M13 10V3L4 14h7v7l9-11h-7z" 
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-medium text-gray-900 mb-3">
              Instant digital payments
            </h3>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed">
              $W3B transforms Goldbacks into an instant, private, spend-anywhere digital currency 
              with real-time settlement.
            </p>
          </div>

          {/* Feature 3: Anti-Counterfeit Assurance */}
          <div className="border-t border-gray-200 pt-8">
            {/* Icon */}
            <div className="mb-6">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #FFE860, #FEFDD6)' }}
              >
                <svg 
                  className="w-7 h-7 text-gray-900" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" 
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-medium text-gray-900 mb-3">
              Anti-counterfeit assurance
            </h3>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed">
              Physical notes locked in the vault provide anti-counterfeit protection via 
              serialization and programmatic reserve proofs.
            </p>
          </div>

          {/* Feature 4: Global Reach */}
          <div className="border-t border-gray-200 pt-8">
            {/* Icon */}
            <div className="mb-6">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #FFE860, #FEFDD6)' }}
              >
                <svg 
                  className="w-7 h-7 text-gray-900" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-medium text-gray-900 mb-3">
              Global reach
            </h3>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed">
              Unlocks P2P, POS, and online spend, enabling global real-time payments, 
              remittances, and micro-commerce at scale.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

