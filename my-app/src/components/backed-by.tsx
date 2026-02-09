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
];

function LogoItem({ partner }: { partner: Partner }) {
  return (
    <Link
      href={partner.href}
      {...(partner.external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className="group shrink-0 transition-all duration-300 opacity-30 hover:opacity-70 hover:scale-105"
    >
      <Image
        src={partner.src}
        alt={partner.alt}
        width={partner.width}
        height={partner.height}
        className={`object-contain max-h-8 w-auto grayscale group-hover:grayscale-0 transition-all duration-300 ${
          partner.invert ? "invert" : ""
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
