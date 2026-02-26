"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

interface Partner {
  href: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  external?: boolean;
  invert?: boolean;
  bgSrc?: string;
  bgWidth?: number;
  bgHeight?: number;
  bgClassName?: string;
}

const partners: Partner[] = [
  {
    href: "https://discord.gg/cGQEYGh9",
    src: "/logos/SEGRAY.png",
    alt: "SE Discord Community",
    width: 120,
    height: 30,
    external: true,
  },
  {
    href: "#",
    src: "/logos/GoldBack.PNG",
    alt: "GoldBack",
    width: 120,
    height: 30,
  },
  {
    href: "https://www.instagram.com/p/DQUwPHhD5I6/?img_index=1",
    src: "/logos/BarCodeLogo.jpg",
    alt: "BarCode Instagram",
    width: 120,
    height: 30,
    external: true,



  },
  {
    href: "#",
    src: "/logos/Sp3ndLogo.png",
    alt: "Sp3nd",
    width: 120,
    height: 30,
    invert: true,
  },
  {
    href: "#",
    src: "/logos/mtndao wordmark.svg",
    bgSrc: "/logos/Artboard 3.svg",
    alt: "mtndao",
    width: 120,
    height: 30,
    bgWidth: 80,
    bgHeight: 80,
    bgClassName: "translate-x-4 space-x-2",
  },
];

function LogoItem({ partner }: { partner: Partner }) {
  return (
    <Link
      href={partner.href}
      {...(partner.external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className="group shrink-0 transition-all duration-300 opacity-60 hover:opacity-100 hover:scale-105 relative flex items-center justify-center p-2"
    >
      {partner.bgSrc && (
        <div className={`absolute inset-0 flex items-center justify-center -z-10 group-hover:scale-110 transition-transform duration-300 ${partner.bgClassName || ""}`}>
          <Image
            src={partner.bgSrc}
            alt={`${partner.alt} background`}
            width={partner.bgWidth || partner.width}
            height={partner.bgHeight || partner.height}
            className="object-contain opacity-40 group-hover:opacity-80 transition-opacity duration-300"
          />
        </div>
      )}
      <Image
        src={partner.src}
        alt={partner.alt}
        width={partner.width}
        height={partner.height}
        className={`object-contain max-h-8 w-auto grayscale group-hover:grayscale-0 transition-all duration-300 relative z-10 ${partner.invert ? "invert" : ""
          }`}
      />
    </Link>
  );
}

export function BackedBy() {
  return (
    <section className="relative py-6 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-5">
          <h2 className="text-[11px] font-medium tracking-[0.3em] text-black/40 uppercase font-mono">
            Powered By
          </h2>
        </div>

        {/* Infinite scrolling logo carousel */}
        <div
          className="relative overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
          }}
        >
          <motion.div
            className="flex items-center"
            style={{ gap: "80px" }}
            animate={{ x: ["0%", "-25%"] }}
            transition={{
              x: {
                duration: 15,
                repeat: Infinity,
                ease: "linear",
              },
            }}
          >
            {/* Render 4 copies so logos always fill the viewport on both edges */}
            {Array.from({ length: 4 }).map((_, setIndex) =>
              partners.map((partner, i) => (
                <LogoItem key={`set-${setIndex}-${i}`} partner={partner} />
              ))
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
