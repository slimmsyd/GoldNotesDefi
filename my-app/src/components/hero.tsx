'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { D3WorldTourBg } from './d3-world-tour-bg';
import { LearnMoreModal } from './learn-more-modal';
import { Button } from '@/components/ui/button';

function ComingSoonModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#FFE860] to-[#FEFDD6] flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h3>
              <p className="text-gray-600">
                Our white paper is currently being developed. Stay tuned for updates!
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors duration-200"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isLearnMoreModalOpen, setIsLearnMoreModalOpen] = useState(false);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const words = ['Everyone', 'Investors', 'Traders', 'Builders', 'Innovators', 'Visionaries'];
  const loadingTexts = ['Securing', 'Innovating', 'Building', 'Loading'];
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  // Loading animation with cache logic
  useEffect(() => {
    const VISIT_KEY = 'goldback_visit_count';
    const storedCount = localStorage.getItem(VISIT_KEY);
    const count = storedCount ? parseInt(storedCount, 10) : 0;

    // Increment count for next time
    localStorage.setItem(VISIT_KEY, (count + 1).toString());

    // Show loader if it's the first visit or every 10th visit
    const shouldShowLoader = count === 0 || count % 10 === 0;

    if (!shouldShowLoader) {
      setIsLoading(false);
      return;
    }

    const loadingInterval = setInterval(() => {
      setLoadingTextIndex((prevIndex) => (prevIndex + 1) % loadingTexts.length);
    }, 500);

    const loadingTimer = setTimeout(() => {
      setIsLoading(false);
      clearInterval(loadingInterval);
    }, 2500);

    return () => {
      clearInterval(loadingInterval);
      clearTimeout(loadingTimer);
    };
  }, []);

  // Word rotation animation
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      setCurrentWordIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading]);

  return (
    <>
      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
          >
            <div className="text-center">
              {/* Logo Animation */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="mb-8"
              >
                <Image
                  src="/logos/BlackWebLogo.png"
                  alt="GoldBack Logo"
                  width={150}
                  height={150}
                  className="object-contain mx-auto"
                  priority
                />
              </motion.div>

              {/* Loading Text Animation */}
              <div className="relative h-12 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={loadingTextIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute"
                  >
                    <h2
                      className="text-3xl font-bold bg-clip-text text-transparent"
                      style={{
                        backgroundImage: 'linear-gradient(to right, #6B6550, #9B9683)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      {loadingTexts[loadingTextIndex]}...
                    </h2>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress Bar */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.5, ease: 'easeInOut' }}
                className="mt-8 h-1 bg-gradient-to-r from-[#6B6550] to-[#9B9683] rounded-full mx-auto"
                style={{ maxWidth: '200px' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section
        ref={sectionRef}
        className="relative min-h-screen flex items-start justify-center px-6 pt-32 pb-20 text-base overflow-hidden"
      >
        {/* Static Video Background Layer - Deep Background */}
        {/* <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute w-full h-full object-cover"
            style={{
              zIndex: -100,
              backgroundPosition: '50%',
              backgroundSize: 'cover',
              margin: 'auto',
              inset: '-100%',
            }}
          >
            <source src="/hero/Hero_Image.mp4" type="video/mp4" />
          </video>
        </div> */}

        {/* D3.js World Tour Background - Middle Layer */}
        <D3WorldTourBg />

        {/* Hero Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 max-w-4xl mx-auto text-center space-y-8"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 30 : 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            className="flex justify-center mb-8"
          >
            <Image
              src="/logos/BlackWebLogo.png"
              alt="Black W3B Logo"
              width={200}
              height={200}
              className="object-contain"
              priority
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 30 : 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
            className="text-[60px] font-medium mb-0"
          >
            <span
              className="bg-clip-text text-transparent inline-block"
              style={{
                backgroundImage: 'linear-gradient(to right, #6B6550, #9B9683)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Gold For
            </span>
            <span className="inline-block relative ml-4" style={{ minWidth: '300px', height: '80px', verticalAlign: 'top' }}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentWordIndex}
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.9 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  className="absolute left-0 top-0 text-[60px] font-medium bg-clip-text text-transparent inline-block"
                  style={{
                    backgroundImage: 'linear-gradient(to right, #6B6550, #9B9683)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {words[currentWordIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
            <span
              className="bg-clip-text text-transparent inline-block"
              style={{
                backgroundImage: 'linear-gradient(to right, #6B6550, #9B9683)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              .
            </span>
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 30 : 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: 'easeOut' }}
            className="text-[40px] font-semibold text-gray-900 mb-2"
          >
            Gold Backed Directly In Your Pocket.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 30 : 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease: 'easeOut' }}
            className="text-gray-700 text-16px max-w-2xl mb-0 mx-auto leading-relaxed"
          >
            In the heart of blockchain innovation, we're building
            tomorrow's digital gold standard today
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoading ? 0 : 1, y: isLoading ? 30 : 0 }}
            transition={{ duration: 0.8, delay: 1.1, ease: 'easeOut' }}
            className="pt-8 mb-20 gap-3 sm:gap-6 flex flex-row justify-center items-center"
          >
            <Button
              asChild
              variant="primary"
              size="lg"
              shape="pill"
            >
              <a href="#whitepaper">Read Our White Paper</a>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              shape="pill"
              onClick={() => setIsLearnMoreModalOpen(true)}
            >
              Learn More
            </Button>
          </motion.div>

          {/* <div className="relative mt-20 rounded-3xl overflow-hidden min-h-[500px] flex items-center justify-center -mx-[3.5rem] md:-mx-[7.2rem] lg:-mx-[12.4rem] max-w-none w-[calc(100%+7rem)] md:w-[calc(100%+14.4rem)] lg:w-[calc(100%+24.8rem)]">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/Hero_Video.mp4" type="video/mp4" />
            </video>
            
        
            <div className="relative z-10 text-center px-8 py-20">
              <div className="flex items-center justify-center gap-4 mb-12">
           
              </div>

              <h3 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-8 max-w-4xl mx-auto leading-tight">
                Gold-Backs meets digital innovation on the blockchain
              </h3>

        
              <p className="text-lg md:text-xl text-gray-300 flex items-center justify-center gap-3">
                <span className="text-pink-400">▶</span>
                <span className="text-16px text-black">Each token backed by real gold-backs, secured on Solana blockchain</span>
              </p>
            </div>
          </div> */}
        </motion.div>

        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse z-[1] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl animate-pulse delay-1000 z-[1] pointer-events-none" />
      </section>

      <LearnMoreModal isOpen={isLearnMoreModalOpen} onClose={() => setIsLearnMoreModalOpen(false)} />
      <ComingSoonModal isOpen={isComingSoonModalOpen} onClose={() => setIsComingSoonModalOpen(false)} />
    </>
  );
}

