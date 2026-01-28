import Image from 'next/image';
import Link from 'next/link';

export function BackedBy() {
  return (
    <section className="relative py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <h2 className="text-xs font-medium tracking-[0.4em] text-gray-400 uppercase">
            Our Trusted Partners
          </h2>
        </div>

        {/* Logo */}
        <div className="flex flex-row items-center justify-center">
          <div className="relative flex flex-row items-center justify-center gap-8">
            {/* SE Logo */}
            <Link
              href="https://discord.gg/cGQEYGh9"
              target="_blank"
              rel="noopener noreferrer"
              className="group transition-all duration-300 opacity-30 hover:opacity-60 hover:scale-105"
            >
              <Image
                src="/logos/SEGRAY.png"
                alt="SE Discord Community"
                width={160}
                height={40}
                className="object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </Link>

            {/* Preeminent Professional Services Logo */}
            <Link
              href="https://www.prmntpro.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group transition-all duration-300 opacity-30 hover:opacity-60 hover:scale-105"
            >
              <Image
                src="/logos/PreLogo.jpg"
                alt="Preeminent Professional Services"
                width={160}
                height={40}
                className="object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </Link>
            {/* GoldBack Logo */}
            <Link
              href="#"
              className="group transition-all duration-300 opacity-30 hover:opacity-60 hover:scale-105"
            >
              <Image
                src="/logos/GoldBack.PNG"
                alt="GoldBack"
                width={160}
                height={40}
                className="object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </Link>

            {/* BarCode Logo */}
            <Link
              href="https://www.instagram.com/p/DQUwPHhD5I6/?img_index=1"
              target="_blank"
              rel="noopener noreferrer"
              className="group transition-all duration-300 opacity-30 hover:opacity-60 hover:scale-105"
            >
              <Image
                src="/logos/BarCodeLogo.jpg"
                alt="BarCode Instagram"
                width={160}
                height={40}
                className="object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
              />
            </Link>



            {/* Sp3nd Logo */}
            <Link
              href="#"
              className="group transition-all duration-300 opacity-30 hover:opacity-100 hover:scale-105"
            >
              <Image
                src="/logos/Sp3ndLogo.png"
                alt="Sp3nd"
                width={160}
                height={40}
                className="object-contain invert transition-all duration-300"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

