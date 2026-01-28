export function HowItWorksSection() {
  return (
    <section className="relative bg-[#F8F9FA] py-24 px-[48px]">
      <div className="max-w-7xl mx-auto">
        {/* Main Heading */}
        <div className="text-center mb-16">
          <h2 className="text-[48px] font-light leading-tight text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 uppercase tracking-wide">
            HOW VALUE FLOWS FROM PHYSICAL TO DIGITAL
          </p>
        </div>

        {/* Three Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {/* Step 1: The Anchor */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200">
            <div className="mb-6">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #FFE860, #FEFDD6)' }}
              >
                <svg
                  className="w-8 h-8 text-gray-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                  />
                </svg>
              </div>
            </div>

            <h3 className="text-2xl font-medium text-gray-900 mb-4">
              The Anchor
            </h3>

            <p className="text-gray-600 leading-relaxed">
              Physical Goldbacks are deposited and locked in secure custody. Each note is
              serialized and verified for authenticity, creating an immutable foundation of
              real-world value that anchors the digital token.
            </p>
          </div>

          {/* Step 2: The Speed */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200">
            <div className="mb-6">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #FFE860, #FEFDD6)' }}
              >
                <svg
                  className="w-8 h-8 text-gray-900"
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

            <h3 className="text-2xl font-medium text-gray-900 mb-4">
              The Speed
            </h3>

            <p className="text-gray-600 leading-relaxed">
              Digital tokens are minted 1:1 against locked Goldbacks and deployed on-chain.
              This enables instant, borderless transactions with real-time settlement—transforming
              physical value into digital velocity.
            </p>
          </div>

          {/* Step 3: The Assurance */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200">
            <div className="mb-6">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #FFE860, #FEFDD6)' }}
              >
                <svg
                  className="w-8 h-8 text-gray-900"
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

            <h3 className="text-2xl font-medium text-gray-900 mb-4">
              The Assurance
            </h3>

            <p className="text-gray-600 leading-relaxed">
              Transparent on-chain verification, third-party audits, and programmatic reserve
              proofs ensure complete accountability. Every token holder can verify their claim
              on physical reserves at any time.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="flex justify-center mb-20">
          <div className="h-1 w-24 bg-gradient-to-r from-[#FFE860] to-[#FEFDD6] rounded-full"></div>
        </div>

        {/* Core Components Section */}
        <div className="text-center mb-12">
          <h3 className="text-[40px] font-light leading-tight text-gray-900 mb-6">
            Core Components
          </h3>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            The ecosystem comprises key elements that work together to bridge physical and
            digital value, ensuring seamless integration of Goldback-backed tokens into the
            global financial system.
          </p>
        </div>

        {/* Core Components Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* $W3B Token */}
          <div className="bg-white rounded-2xl p-10 border border-gray-200">
            <div className="mb-6">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #10B981, #6EE7B7)' }}
              >
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            <h4 className="text-2xl font-medium text-gray-900 mb-4">
              $W3B Token
            </h4>

            <p className="text-gray-600 leading-relaxed mb-6">
              $W3B is the primary digital currency representing physical Goldbacks. Think of it
              as digitized gold—instantly transferable, globally accessible, and backed 1:1 by
              authenticated physical notes in secure custody.
            </p>

            {/* <button className="w-full py-4 px-6 rounded-xl text-white font-medium transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #10B981, #059669)' }}
            >
              Learn About $W3B
            </button> */}
          </div>

          {/* Verification System */}
          <div className="bg-white rounded-2xl p-10 border border-gray-200">
            <div className="mb-6">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, #3B82F6, #93C5FD)' }}
              >
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>

            <h4 className="text-2xl font-medium text-gray-900 mb-4">
              Verification System
            </h4>

            <p className="text-gray-600 leading-relaxed mb-6">
              An on-chain proof system that provides real-time transparency. Token holders can
              independently verify reserve backing through cryptographic proofs, third-party audits,
              and serialization records.
            </p>

            {/* <button className="w-full py-4 px-6 rounded-xl text-white font-medium transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
            >
            
            </button> */}
          </div>
        </div>
      </div>
    </section>
  );
}

