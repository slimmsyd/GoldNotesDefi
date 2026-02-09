'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { GLOBE_CITIES, randomCityPair } from '@/lib/globe-cities';

/* ─── Tour generator ─── */

interface TourStop {
  from: { name: string; coordinates: [number, number] };
  to: { name: string; coordinates: [number, number] };
}

function generateTour(count: number): TourStop[] {
  const stops: TourStop[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    const [from, to] = randomCityPair();
    const key = `${from.name}-${to.name}`;
    if (used.has(key)) { i--; continue; }
    used.add(key);
    stops.push({
      from: { name: from.name, coordinates: [from.lng, from.lat] },
      to: { name: to.name, coordinates: [to.lng, to.lat] },
    });
  }

  return stops;
}

/* ─── Component ─── */

export function D3WorldTourBg() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height);

    const projection = d3.geoOrthographic()
      .scale(Math.min(width, height) / 2.5)
      .translate([width / 2, height / 2])
      .precision(0.1);

    const path = d3.geoPath(projection);

    /* ── Globe sphere — light fill ── */
    svg.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'sphere')
      .attr('d', path as any)
      .style('fill', '#f8f9fa')
      .style('stroke', '#e0e0e0')
      .style('stroke-width', '1.5px');

    /* ── Graticule — subtle neutral grid ── */
    const graticule = d3.geoGraticule10();
    svg.append('path')
      .datum(graticule)
      .attr('class', 'graticule')
      .attr('d', path as any)
      .style('fill', 'none')
      .style('stroke', '#e5e5e5')
      .style('stroke-width', '0.5px')
      .style('opacity', '0.5');

    /* ── Load world data ── */
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(response => response.json())
      .then((world: any) => {
        const countriesFeature = topojson.feature(world, world.objects.countries) as any;
        const countries = countriesFeature.features;

        /* ── Country fills — neutral gray ── */
        svg.append('g')
          .attr('class', 'countries')
          .selectAll('path')
          .data(countries)
          .enter()
          .append('path')
          .attr('d', path as any)
          .style('fill', '#e8e8e8')
          .style('stroke', '#ccc')
          .style('stroke-width', '0.5px');

        /* ── Arc layer ── */
        const arcsGroup = svg.append('g').attr('class', 'arcs');

        /* ── Generate a tour of 10 random city-to-city routes ── */
        const tour = generateTour(10);
        let currentStop = 0;

        function transition() {
          const stop = tour[currentStop];

          /* Arc interpolator */
          const arcGenerator = d3.geoInterpolate(
            stop.from.coordinates,
            stop.to.coordinates
          );

          const arcPoints = d3.range(0, 1.01, 0.04).map(arcGenerator);
          const lineGenerator = d3.geoPath(projection);
          const arcLine = { type: 'LineString' as const, coordinates: arcPoints };

          /* Draw arc path (initially hidden) */
          const arcPath = arcsGroup
            .append('path')
            .datum(arcLine)
            .attr('class', 'arc')
            .attr('d', lineGenerator as any)
            .style('fill', 'none')
            .style('stroke', '#c9a84c')
            .style('stroke-width', '2.5px')
            .style('stroke-opacity', 0.85)
            .style('stroke-linecap', 'round');

          const totalLength = (arcPath.node() as SVGPathElement).getTotalLength();

          arcPath
            .style('stroke-dasharray', `${totalLength} ${totalLength}`)
            .style('stroke-dashoffset', totalLength);

          /* Start & end dots */
          const startDot = svg.append('circle')
            .attr('class', 'location-dot')
            .style('fill', '#e8d48b')
            .style('opacity', 0)
            .attr('r', 5);

          const endDot = svg.append('circle')
            .attr('class', 'location-dot')
            .style('fill', '#c9a84c')
            .style('opacity', 0)
            .attr('r', 5);

          /* Traveling particle */
          const travelingDot = svg.append('circle')
            .attr('class', 'traveling-dot')
            .style('fill', '#e8d48b')
            .style('opacity', 0)
            .attr('r', 3.5)
            .style('filter', 'drop-shadow(0 0 6px rgba(201, 168, 76, 0.8))');

          /* Glow ring at start */
          const glowRing = svg.append('circle')
            .attr('class', 'glow-ring')
            .style('fill', 'none')
            .style('stroke', '#c9a84c')
            .style('stroke-width', '1.5px')
            .style('opacity', 0)
            .attr('r', 5);

          /* Calculate midpoint & swing globe */
          const midpoint = arcGenerator(0.5);

          d3.transition()
            .duration(1500)
            .tween('rotate', function () {
              const currentRotate = projection.rotate();
              const targetRotate: [number, number, number] = [-midpoint[0], -midpoint[1], 0];
              const r = d3.interpolate(currentRotate, targetRotate);
              return function (t) {
                projection.rotate(r(t));
                svg.selectAll('path').attr('d', path as any);
                arcPath.attr('d', lineGenerator as any);

                const startProj = projection(stop.from.coordinates);
                const endProj = projection(stop.to.coordinates);
                if (startProj) startDot.attr('cx', startProj[0]).attr('cy', startProj[1]);
                if (endProj) endDot.attr('cx', endProj[0]).attr('cy', endProj[1]);
              };
            })
            .on('end', function () {
              /* Show start dot + glow ring */
              const startProj = projection(stop.from.coordinates);
              if (startProj) {
                glowRing
                  .attr('cx', startProj[0])
                  .attr('cy', startProj[1])
                  .style('opacity', 0.7)
                  .transition().duration(800)
                  .attr('r', 14)
                  .style('opacity', 0)
                  .remove();
              }

              startDot.transition().duration(300).style('opacity', 1);
              travelingDot.style('opacity', 1);

              /* Animate arc drawing + traveling particle */
              arcPath
                .transition()
                .duration(1500)
                .ease(d3.easeCubicInOut)
                .styleTween('stroke-dashoffset', function () {
                  const interpolate = d3.interpolate(totalLength, 0);
                  return function (t) {
                    arcPath.attr('d', lineGenerator as any);

                    const sP = projection(stop.from.coordinates);
                    const eP = projection(stop.to.coordinates);
                    if (sP) startDot.attr('cx', sP[0]).attr('cy', sP[1]);
                    if (eP) endDot.attr('cx', eP[0]).attr('cy', eP[1]);

                    const point = arcGenerator(t);
                    const projected = projection(point as [number, number]);
                    if (projected) {
                      travelingDot.attr('cx', projected[0]).attr('cy', projected[1]);
                    }

                    return interpolate(t).toString();
                  };
                })
                .on('end', function () {
                  endDot.transition().duration(300).style('opacity', 1);
                  travelingDot.transition().duration(300).style('opacity', 0);
                });
            })
            .transition()
            .delay(2200)
            .on('start', function () {
              arcPath.transition().duration(600).style('stroke-opacity', 0).remove();
              startDot.transition().duration(600).style('opacity', 0).remove();
              endDot.transition().duration(600).style('opacity', 0).remove();
              travelingDot.remove();
              glowRing.remove();
            })
            .on('end', () => {
              currentStop = (currentStop + 1) % tour.length;
              transition();
            });
        }

        transition();
      })
      .catch(error => {
        console.error('[D3Globe] Error loading world data:', error);
      });

    /* ── Resize ── */
    function handleResize() {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      svg.attr('width', newWidth).attr('height', newHeight);
      projection
        .scale(Math.min(newWidth, newHeight) / 2.5)
        .translate([newWidth / 2, newHeight / 2]);

      svg.selectAll('path').attr('d', path as any);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 1, opacity: 0.6 }}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
}
