'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ActiveArc, ArcFocus } from '@/hooks/useSolanaTransactions';

const Globe = dynamic(() => import('react-globe.gl').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#c9a84c]/30 border-t-[#c9a84c] animate-spin" />
    </div>
  ),
});

/* ─── Constants ─── */
const ATMOSPHERE_COLOR = '#c9a84c';
const BG_COLOR = 'rgba(0,0,0,0)';
const COUNTRIES_URL = 'https://unpkg.com/world-atlas@2/countries-110m.json';
const GLOBE_ALTITUDE = 2.2;
const SWING_DURATION_MS = 1400; // Matches SWING_LEAD_MS in the hook — globe settles just as arc appears

interface BlockchainGlobeProps {
  activeArc: ActiveArc[];
  arcFocus: ArcFocus | null;
}

export function BlockchainGlobe({ activeArc, arcFocus }: BlockchainGlobeProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [globeMaterial, setGlobeMaterial] = useState<any>(null);
  const [countries, setCountries] = useState<object[]>([]);
  const isReadyRef = useRef(false);

  /** Dark globe material */
  useEffect(() => {
    import('three').then((THREE) => {
      setGlobeMaterial(
        new THREE.MeshPhongMaterial({
          color: new THREE.Color('#060806'),
          emissive: new THREE.Color('#020302'),
          shininess: 2,
          transparent: true,
          opacity: 0.94,
        })
      );
    });
  }, []);

  /** Load country outlines */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const topojson = await import('topojson-client');
        const res = await fetch(COUNTRIES_URL);
        const world = await res.json();
        const land = topojson.feature(world, world.objects.countries);
        if (!cancelled) setCountries((land as any).features);
      } catch (err) {
        console.warn('[Globe] country polygons failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Measure container */
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /** Configure globe once ready — recolor grid, set controls (no auto-rotate) */
  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    isReadyRef.current = true;

    // Initial position
    globe.pointOfView({ lat: 20, lng: -30, altitude: GLOBE_ALTITUDE }, 0);

    // Recolor graticule grid to gold
    try {
      const scene = globe.scene();
      scene.traverse((child: any) => {
        if (
          child.type === 'LineSegments' &&
          child.material?.type === 'LineBasicMaterial'
        ) {
          child.material.color.set('#c9a84c');
          child.material.opacity = 0.15;
          child.material.transparent = true;
          child.material.needsUpdate = true;
        }
      });
    } catch { /* noop */ }

    const controls = globe.controls();
    if (controls) {
      // No auto-rotate — globe swings intentionally to each arc
      controls.autoRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.minPolarAngle = Math.PI / 4;
      controls.maxPolarAngle = (3 * Math.PI) / 4;
    }
  }, []);

  /** Swing globe to face the arc midpoint when it changes */
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !isReadyRef.current || !arcFocus) return;

    globe.pointOfView(
      { lat: arcFocus.lat, lng: arcFocus.lng, altitude: GLOBE_ALTITUDE },
      SWING_DURATION_MS
    );
  }, [arcFocus]);

  return (
    <div ref={containerRef} className="w-full h-full pointer-events-none">
      {dimensions.width > 0 && globeMaterial && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor={BG_COLOR}
          globeImageUrl={null}
          globeMaterial={globeMaterial}
          showAtmosphere={true}
          atmosphereColor={ATMOSPHERE_COLOR}
          atmosphereAltitude={0.25}
          showGraticules={true}
          enablePointerInteraction={false}
          onGlobeReady={handleGlobeReady}
          animateIn={true}
          /* ── Country outlines ── */
          polygonsData={countries}
          polygonCapColor={() => 'rgba(201, 168, 76, 0.03)'}
          polygonSideColor={() => 'rgba(201, 168, 76, 0.06)'}
          polygonStrokeColor={() => 'rgba(201, 168, 76, 0.25)'}
          polygonAltitude={0.006}
          polygonsTransitionDuration={1000}
          /* ── Single active arc — pops in cleanly after globe swings, no morphing ── */
          arcsData={activeArc}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcStroke={1.2}
          arcDashLength={0.9}
          arcDashGap={0.15}
          arcDashAnimateTime={2000}
          arcAltitudeAutoScale={0.45}
          arcsTransitionDuration={0}
        />
      )}
    </div>
  );
}
