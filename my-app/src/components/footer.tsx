import Image from 'next/image';

export function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="container mx-auto px-4 pt-8 pb-24 md:pb-32">
        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Left Column - Brand and Social */}
          <div className="lg:col-span-2">
            <div className="flex items-baseline gap-1.5 mb-4">
              <Image
                src="/logos/BlackWebLogoBlack.png"
                alt="BlackW3B"
                width={200}
                height={32}
                className="object-contain"
              />
            </div>

            {/* <p className="text-gray-400 mb-6 max-w-xs">
              <span className="text-gray-300">income engine</span> where people and AI agents come together to chat, play, and earn.
            </p> */}

            <div className="flex gap-3">
              <a
                href="https://farcaster.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 text-gray-200 rounded-xl hover:bg-white hover:text-blue-600 flex items-center justify-center transition-all"
                aria-label="Farcaster"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" role="img" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.24.24H5.76C2.5789.24 0 2.8188 0 6v12c0 3.1811 2.5789 5.76 5.76 5.76h12.48c3.1812 0 5.76-2.5789 5.76-5.76V6C24 2.8188 21.4212.24 18.24.24m.8155 17.1662v.504c.2868-.0256.5458.1905.5439.479v.5688h-5.1437v-.5688c-.0019-.2885.2576-.5047.5443-.479v-.504c0-.22.1525-.402.358-.458l-.0095-4.3645c-.1589-1.7366-1.6402-3.0979-3.4435-3.0979-1.8038 0-3.2846 1.3613-3.4435 3.0979l-.0096 4.3578c.2276.0424.5318.2083.5395.4648v.504c.2863-.0256.5457.1905.5438.479v.5688H4.3915v-.5688c-.0019-.2885.2575-.5047.5438-.479v-.504c0-.2529.2011-.4548.4536-.4724v-7.895h-.4905L4.2898 7.008l2.6405-.0005V5.0419h9.9495v1.9656h2.8219l-.6091 2.0314h-.4901v7.8949c.2519.0177.453.2195.453.4724" />
                </svg>
              </a>

              <a
                href="https://x.com/blkw3_b?s=21"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 text-gray-200 rounded-xl hover:bg-white hover:text-black flex items-center justify-center transition-all"
                aria-label="X"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z" />
                </svg>
              </a>

              <a
                href="https://www.youtube.com/@BlackW3B"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 text-gray-200 rounded-xl hover:bg-white hover:text-red-600 flex items-center justify-center transition-all"
                aria-label="YouTube"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h4 className="font-bold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="/shop-gold-backs"
                  className="text-gray-400 hover:text-white hover:underline hover:decoration-2 hover:underline-offset-4 transition-all text-left"
                >
                  Buy Goldbacks
                </a>
              </li>

            </ul>
          </div>

          {/* Learn Column */}
          <div>
            <h4 className="font-bold text-white mb-4">Learn</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="/#hero"
                  className="text-gray-400 hover:text-white hover:underline hover:decoration-2 hover:underline-offset-4 transition-all"
                >
                  What is BlackW3B?
                </a>
              </li>
              <li>
                <a
                  href="/#features"
                  className="text-gray-400 hover:text-white hover:underline hover:decoration-2 hover:underline-offset-4 transition-all"
                >
                  BlackW3B Coins
                </a>
              </li>
              <li>
                <a
                  href="/#how-it-works"
                  className="text-gray-400 hover:text-white hover:underline hover:decoration-2 hover:underline-offset-4 transition-all"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="/#learn-more"
                  className="text-gray-400 hover:text-white hover:underline hover:decoration-2 hover:underline-offset-4 transition-all"
                >
                  Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Community Column */}
          <div>
            <h4 className="font-bold text-white mb-4">Community</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://zora.co/@brazylord"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white hover:underline transition-all"
                >
                  Zora
                </a>
              </li>

              <li>
                <a
                  href="https://www.youtube.com/@BlackW3B"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white hover:underline transition-all"
                >
                  YouTube
                </a>
              </li>
              <li>
                <a
                  href="/#faq"
                  className="text-gray-400 hover:text-white hover:underline transition-all"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="https://discord.gg/MvZkyQzC"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white hover:underline transition-all"
                >
                  Join Discord
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Border line */}
        <div className="border-t border-gray-800 mb-8" />

        {/* Bottom section - Copyright and branding */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-400 text-sm">
            © 2025{' '}
            <a
              href="#"
              className="hover:underline hover:decoration-2 hover:underline-offset-4 hover:text-white transition-all"
            >
              BlackW3B
            </a>
            . All rights reserved.
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://solana.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Built on Solona"
            >
              <span className="text-gray-400 hover:text-white transition-all text-sm">
                Built on Solona
              </span>
            </a>
            <span className="text-gray-600">•</span>
            <a
              href="https://www.0ncode.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Built by 0ncode"
            >
              <span className="text-gray-400 hover:text-white transition-all text-sm">
                Built by 0ncode
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

