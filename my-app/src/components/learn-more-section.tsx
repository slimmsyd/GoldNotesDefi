'use client';

import Image from "next/image";
import { useState } from "react";
import { LearnMoreModal } from "./learn-more-modal";
import { PDFPreviewModal } from "./pdf-preview-modal";

export function LearnMoreSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPDFOpen, setIsPDFOpen] = useState(false);

  return (
    <>
      <section id="whitepaper" className="relative py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto px-[60px]">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900">
              Learn more about BlackW3B
            </h2>
          </div>

          {/* Document Cards Grid */}
          <div className="flex items-center justify-center">
            {/* White Paper Card */}
            <div className="group relative max-w-md w-full">
              {/* Document Preview */}
              <div
                onClick={() => setIsPDFOpen(true)}
                className="relative h-96 w-full mx-auto bg-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-4 transition-all duration-300 group-hover:border-gray-300 group-hover:shadow-md cursor-pointer"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <iframe
                    src="/GoldBackWhitePaper.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH"
                    className="w-full h-full pointer-events-none border-none"
                    tabIndex={-1}
                    title="White Paper Preview"
                  />
                </div>
                <div className="absolute inset-0 bg-transparent" />
              </div>

              {/* Card Content */}
              <div className="space-y-3 text-center">
                <h3 className="text-xl font-medium text-gray-900 flex items-center justify-center gap-2">
                  BlackW3B White Paper
                  <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Being Updated
                  </span>
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
                  Our comprehensive white paper is currently being updated to reflect the latest 2026 architectural innovations.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex cursor-pointer items-center px-6 py-2.5 bg-white border border-gray-300 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    Contact Us
                  </button>
                  <button
                    onClick={() => setIsPDFOpen(true)}
                    className="inline-flex cursor-pointer items-center px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LearnMoreModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <PDFPreviewModal
        isOpen={isPDFOpen}
        onClose={() => setIsPDFOpen(false)}
        pdfUrl="/GoldBackWhitePaper.pdf"
      />
    </>
  );
}

