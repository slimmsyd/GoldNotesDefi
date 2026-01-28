'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/header';

interface FlywheelSegmentProps {
  color: string;
  rotation: string;
  text: string;
  arcPath: string;
  isActive: boolean;
}

function FlywheelSegment({ color, rotation, text, arcPath, isActive }: FlywheelSegmentProps) {
  return (
    <g 
      transform={rotation} 
      style={{ transition: 'transform 0.5s ease-in-out', transformOrigin: '0 0' }} 
      className={isActive ? 'scale-105' : ''}
    >
      <path 
        d={arcPath} 
        fill={color} 
        stroke="#fff" 
        strokeWidth="4" 
        filter={isActive ? 'url(#glow)' : 'none'} 
      />
      <text 
        x="145" 
        y="-5" 
        dy=".35em" 
        transform="rotate(90 150 0)" 
        textAnchor="middle" 
        fill="#000000" 
        className="text-sm font-bold tracking-wider uppercase"
      >
        {text}
      </text>
    </g>
  );
}

interface ArrowProps {
  rotation: string;
  color: string;
}

function Arrow({ rotation, color }: ArrowProps) {
  return (
    <g transform={rotation}>
      <path d="M 195 -10 L 205 0 L 195 10" fill={color} />
    </g>
  );
}

export default function VisualPage() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prevStep => (prevStep + 1) % 3);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const arcPath = "M180 0 A 180 180 0 0 1 90 155.88 L 0 0 Z";

  return (
    <div className="min-h-screen">
      {/* <Header /> */}
      
      <div className="bg-white min-h-screen flex flex-col items-center justify-center font-sans p-4 overflow-hidden pt-24">
     
        <div className="relative w-full max-w-4xl aspect-square flex items-center justify-center">
          {/* Outer Ring - Business Outcomes */}
          <div className="absolute w-full h-full border-2 border-dashed border-gray-400 rounded-full animate-spin-slow"></div>
          
          {/* Static Outcomes for context */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-6 bg-white/95 px-4 py-2 rounded-full shadow-sm border border-gray-200">
            <p className="text-sm font-bold text-black">Increased Productivity</p>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -mb-6 bg-white/95 px-4 py-2 rounded-full shadow-sm border border-gray-200">
            <p className="text-sm font-bold text-black">Revenue Growth</p>
          </div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-8 bg-white/95 px-4 py-2 rounded-full shadow-sm border border-gray-200 transform -rotate-15">
            <p className="text-sm font-bold text-black">Enhanced Customer Loyalty</p>
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-8 bg-white/95 px-4 py-2 rounded-full shadow-sm border border-gray-200 transform rotate-15">
            <p className="text-sm font-bold text-black">Reduced Operational Costs</p>
          </div>

          {/* Flywheel SVG */}
          <svg viewBox="-220 -220 440 440" className="w-full h-full">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="7.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Segments */}
            <FlywheelSegment 
              color="#14b8a6" 
              rotation="rotate(0)" 
              text="Employee Lens" 
              arcPath={arcPath} 
              isActive={activeStep === 0} 
            />
            <FlywheelSegment 
              color="#0ea5e9" 
              rotation="rotate(120)" 
              text="Customer Lens" 
              arcPath={arcPath} 
              isActive={activeStep === 1} 
            />
            <FlywheelSegment 
              color="#6366f1" 
              rotation="rotate(240)" 
              text="Admin Lens" 
              arcPath={arcPath} 
              isActive={activeStep === 2} 
            />
            
            {/* Arrows indicating flow */}
            <Arrow rotation="rotate(110)" color="#fff"/>
            <Arrow rotation="rotate(230)" color="#fff"/>
            <Arrow rotation="rotate(350)" color="#fff"/>

            {/* Central Hub */}
            <circle cx="0" cy="0" r="80" fill="#ffffff" />
            <circle 
              cx="0" 
              cy="0" 
              r="75" 
              fill="#ffffff" 
              stroke="#000000" 
              strokeWidth="3" 
              className={`transition-all duration-500 ${activeStep === 2 ? 'shadow-2xl' : ''}`} 
            />
            <g className={`transition-transform duration-500 ${activeStep === 2 ? 'scale-110' : ''}`}>
              <text x="0" y="-10" textAnchor="middle" className="text-2xl font-extrabold" fill="#000000">
                Alona AI
              </text>
              <text x="0" y="20" textAnchor="middle" className="text-xs font-semibold" fill="#000000">
                Unified Knowledge Core
              </text>
            </g>
          </svg>

          {/* Lens Details */}
          <div className="absolute w-full h-full">
            {/* Employee Lens */}
            <div className={`absolute top-[10%] left-1/2 -translate-x-1/2 w-48 text-center p-4 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border-2 transition-all duration-500 ease-in-out ${activeStep === 0 ? 'scale-110 shadow-2xl border-teal-400' : 'opacity-70 border-gray-200'}`}>
              <h3 className="font-bold text-black text-base">1. Ask & Act</h3>
              <p className="text-xs text-black mt-2 leading-relaxed">
                Employees get instant, verified answers, reducing task time and boosting confidence.
              </p>
            </div>

            {/* Customer Lens */}
            <div className={`absolute bottom-[18%] left-[10%] w-48 text-center p-4 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border-2 transform -rotate-45 transition-all duration-500 ease-in-out ${activeStep === 1 ? 'scale-110 shadow-2xl border-sky-400' : 'opacity-70 border-gray-200'}`}>
              <h3 className="font-bold text-black text-base">2. Interact & Inform</h3>
              <p className="text-xs text-black mt-2 leading-relaxed">
                Customers receive 24/7 consistent support, improving satisfaction and revealing common questions.
              </p>
            </div>

            {/* Admin Lens */}
            <div className={`absolute bottom-[18%] right-[10%] w-48 text-center p-4 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border-2 transform rotate-45 transition-all duration-500 ease-in-out ${activeStep === 2 ? 'scale-110 shadow-2xl border-indigo-400' : 'opacity-70 border-gray-200'}`}>
              <h3 className="font-bold text-black text-base">3. Analyze & Improve</h3>
              <p className="text-xs text-black mt-2 leading-relaxed">
                Admins see what users ask, identify knowledge gaps, and refine training & SOPs.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center max-w-3xl mx-auto pb-12">
          <p className="text-lg text-black font-semibold leading-relaxed">
            This continuous loop means better training leads to better employees. Better employees deliver better customer service, which creates happier customers and drives more revenue. The entire system gets smarter and more efficient with every question asked.
          </p>
        </div>
      </div>
    </div>
  );
}

