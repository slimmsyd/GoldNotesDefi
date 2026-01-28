#!/usr/bin/env node

/**
 * Favicon Generator Script
 * 
 * Converts WebFavIcon.png to proper favicon.ico format using to-ico
 */

const sharp = require('sharp');
const toIco = require('to-ico');
const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC_DIR, 'WebFavIcon.png');

async function generateFavicon() {
  console.log('🎨 Generating favicon.ico from WebFavIcon.png\n');
  
  if (!fs.existsSync(SOURCE)) {
    console.error('❌ Source not found:', SOURCE);
    process.exit(1);
  }
  
  try {
    // Generate PNG buffers for different sizes
    const sizes = [16, 32, 48];
    const pngBuffers = await Promise.all(
      sizes.map(size =>
        sharp(SOURCE)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
      )
    );
    
    // Create proper ICO file with multiple sizes
    const icoBuffer = await toIco(pngBuffers);
    fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
    console.log('✅ Generated favicon.ico (16x16, 32x32, 48x48)');
    
    // Also generate standard PNG sizes for better compatibility
    await sharp(SOURCE)
      .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'favicon-16x16.png'));
    console.log('✅ Generated favicon-16x16.png');
    
    await sharp(SOURCE)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'favicon-32x32.png'));
    console.log('✅ Generated favicon-32x32.png');
    
    await sharp(SOURCE)
      .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
    console.log('✅ Generated apple-touch-icon.png (180x180)');
    
    console.log('\n✨ All favicons generated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateFavicon();
