'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

interface FloatingTipProps {
  icon: React.ReactNode;
  text: string;
  initialX: number; // percentage for left position
  initialY: number; // percentage for top position
  animateX: number[]; // pixel values for x animation
  animateY: number[]; // pixel values for y animation
  delay?: number;
}

function FloatingTip({ icon, text, initialX, initialY, animateX, animateY, delay = 0 }: FloatingTipProps) {
  return (
    <motion.div
      className="absolute bg-white rounded-2xl shadow-xl px-3 py-2.5 md:px-4 md:py-3 flex items-center gap-2 md:gap-3 z-10"
      style={{
        left: `${initialX}%`,
        top: `${initialY}%`,
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        x: animateX,
        y: animateY,
        opacity: 1,
        scale: 1,
      }}
      transition={{
        x: {
          duration: 3,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
          delay,
        },
        y: {
          duration: 2.5,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
          delay,
        },
        opacity: {
          duration: 0.5,
          delay,
        },
        scale: {
          duration: 0.5,
          delay,
        },
      }}
    >
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <p className="text-xs md:text-sm lg:text-base font-medium text-gray-700 whitespace-nowrap">
        {text}
      </p>
    </motion.div>
  );
}

export function SwapSection() {
  return (
    <section className="relative py-12 md:py-16 px-6 bg-[#FAFAFA] overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Main Heading */}
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-light text-gray-300 mb-2 tracking-tight">
            Get Gold Backed
          </h2>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column - iPhone Mockup */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-sm">
              <Image
                src="/mockups/IphoneMockups.png"
                alt="Get Gold Backed - Mobile App Interface"
                width={500}
                height={700}
                className="w-full h-auto drop-shadow-2xl"
                priority
              />

              {/* Floating Tip 1 - Top Left */}
              <FloatingTip
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-white md:w-5 md:h-5"
                  >
                    <path
                      d="M5 12L10 7L15 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 7V17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 4L16 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                }
                text="Withdraw funds anytime"
                initialX={5}
                initialY={10}
                animateX={[0, -8, 0]}
                animateY={[0, -12, 0]}
                delay={0}
              />

              {/* Floating Tip 2 - Bottom Right */}
              <FloatingTip
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-white md:w-5 md:h-5"
                  >
                    <rect
                      x="3"
                      y="6"
                      width="14"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <line
                      x1="3"
                      y1="9"
                      x2="17"
                      y2="9"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                }
                text="Self custody credit"
                initialX={75}
                initialY={80}
                animateX={[0, 8, 0]}
                animateY={[0, 12, 0]}
                delay={0.3}
              />
            </div>
          </div>

          {/* Right Column - Text Content */}
          <div className="flex flex-col justify-center space-y-4 px-4 lg:px-0">
            <h3 className="text-2xl md:text-3xl lg:text-4xl font-normal text-gray-700 leading-relaxed">
              Digital tokens minted 1:1 against locked, serialized Goldbacks-transforming physical value into digital velocity.
            </h3>
            <p className="text-base md:text-lg text-gray-500 leading-relaxed">
              Instant, borderless transactions with real-time settlement. Every token is backed by authenticated physical goldbacks in secure custody.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

