'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

export function D3WorldTourBg() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    // Set SVG dimensions
    svg.attr('width', width).attr('height', height);

    const projection = d3.geoOrthographic()
      .scale(Math.min(width, height) / 2.5)
      .translate([width / 2, height / 2])
      .precision(0.1);

    const path = d3.geoPath(projection);

    // Create globe sphere
    svg.append('path')
      .datum({ type: 'Sphere' })
      .attr('class', 'sphere')
      .attr('d', path as any)
      .style('fill', '#f8f9fa')
      .style('stroke', '#e0e0e0')
      .style('stroke-width', '1.5px');

    // Graticule (grid lines)
    const graticule = d3.geoGraticule10();
    svg.append('path')
      .datum(graticule)
      .attr('class', 'graticule')
      .attr('d', path as any)
      .style('fill', 'none')
      .style('stroke', '#e5e5e5')
      .style('stroke-width', '0.5px')
      .style('opacity', '0.5');

    // Load world topology data
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(response => response.json())
      .then((world: any) => {
        // Extract individual countries
        const countriesFeature = topojson.feature(world, world.objects.countries) as any;
        const countries = countriesFeature.features;
        
        // Country codes to highlight: USA (840), Ghana (288), Russia (643)
        const highlightCountries = ['840', '288', '643'];
        
        // Draw countries
        svg.append('g')
          .attr('class', 'countries')
          .selectAll('path')
          .data(countries)
          .enter()
          .append('path')
          .attr('d', path as any)
          .attr('class', (d: any) => {
            return highlightCountries.includes(d.id) ? 'country-highlight' : 'country';
          })
          .style('fill', (d: any) => {
            // Highlight specific countries
            if (d.id === '840') return '#fecaca'; // USA - light red
            if (d.id === '288') return '#bfdbfe'; // Ghana - light blue
            if (d.id === '643') return '#ddd6fe'; // Russia - light purple
            return '#e5e7eb'; // Default light gray
          })
          .style('stroke', '#999')
          .style('stroke-width', '0.5px');

        // Define tour locations with connections and country IDs
        const locations = [
          { name: 'Virginia, USA', coordinates: [-77.4360, 37.5407], countryId: '840' },
          { name: 'Ghana, Africa', coordinates: [-1.2164, 7.9465], countryId: '288' },
          { name: 'Moscow, Russia', coordinates: [37.6173, 55.7558], countryId: '643' },
        ];

        // Create arcs layer
        const arcsGroup = svg.append('g').attr('class', 'arcs');

        let currentLocation = 0;
        
        // Get country paths for highlighting
        const countryPaths = svg.selectAll('path.country, path.country-highlight');

        function transition() {
          const from = locations[currentLocation];
          const to = locations[(currentLocation + 1) % locations.length];
          
          // Highlight active countries with pulsing effect
          countryPaths.each(function(d: any) {
            const element = d3.select(this as SVGPathElement);
            if (d.id === from.countryId || d.id === to.countryId) {
              // Pulse the active countries
              element
                .transition()
                .duration(800)
                .style('fill', d.id === '840' ? '#ef4444' : d.id === '288' ? '#3b82f6' : '#8b5cf6')
                .style('stroke-width', '2px')
                .transition()
                .duration(2000)
                .style('fill', d.id === '840' ? '#fecaca' : d.id === '288' ? '#bfdbfe' : '#ddd6fe')
                .style('stroke-width', '0.5px');
            }
          });
          
          // Create arc between current and next location
          const arcGenerator = d3.geoInterpolate(
            from.coordinates as [number, number],
            to.coordinates as [number, number]
          );
          
          // Generate points along the arc
          const arcPoints = d3.range(0, 1.01, 0.05).map(arcGenerator);
          
          // Create line generator for the arc
          const lineGenerator = d3.geoPath(projection);
          const arcLine = {
            type: 'LineString' as const,
            coordinates: arcPoints
          };

          // Add the arc path (initially invisible, will be drawn progressively)
          const arcPath = arcsGroup
            .append('path')
            .datum(arcLine)
            .attr('class', 'arc')
            .attr('d', lineGenerator as any)
            .style('fill', 'none')
            .style('stroke', '#ec4899')
            .style('stroke-width', '3px')
            .style('stroke-opacity', 0.9)
            .style('stroke-linecap', 'round');

          // Get the total length of the path for animation
          const totalLength = (arcPath.node() as SVGPathElement).getTotalLength();
          
          // Set up the initial state: line is hidden
          arcPath
            .style('stroke-dasharray', `${totalLength} ${totalLength}`)
            .style('stroke-dashoffset', totalLength);

          // Add animated dots at start and end points
          const startDot = svg.append('circle')
            .attr('class', 'location-dot')
            .style('fill', '#ec4899')
            .style('opacity', 0)
            .attr('r', 6);

          const endDot = svg.append('circle')
            .attr('class', 'location-dot')
            .style('fill', '#a855f7')
            .style('opacity', 0)
            .attr('r', 6);

          // Add traveling particle that moves along the arc
          const travelingDot = svg.append('circle')
            .attr('class', 'traveling-dot')
            .style('fill', '#fbbf24')
            .style('opacity', 0)
            .attr('r', 4)
            .style('filter', 'drop-shadow(0 0 4px #fbbf24)');

          // Calculate midpoint for rotation
          const midpoint = arcGenerator(0.5);
          
          // Rotate globe to show the arc
          d3.transition()
            .duration(1500)
            .tween('rotate', function () {
              const currentRotate = projection.rotate();
              const targetRotate: [number, number, number] = [-midpoint[0], -midpoint[1], 0];
              const r = d3.interpolate(currentRotate, targetRotate);
              return function (t) {
                const interpolated = r(t);
                projection.rotate(interpolated);
                svg.selectAll('path').attr('d', path as any);
                
                // Update arc path
                arcPath.attr('d', lineGenerator as any);
                
                // Update dot positions
                const startProj = projection(from.coordinates as [number, number]);
                const endProj = projection(to.coordinates as [number, number]);
                
                if (startProj) {
                  startDot.attr('cx', startProj[0]).attr('cy', startProj[1]);
                }
                if (endProj) {
                  endDot.attr('cx', endProj[0]).attr('cy', endProj[1]);
                }
              };
            })
            .on('end', function () {
              // Show start dot
              startDot.transition().duration(300).style('opacity', 1);
              
              // Show traveling dot and animate it along the arc
              travelingDot.style('opacity', 1);
              
              // Animate the line being drawn from start to end
              arcPath
                .transition()
                .duration(1500)
                .ease(d3.easeCubicInOut)
                .styleTween('stroke-dashoffset', function() {
                  const interpolate = d3.interpolate(totalLength, 0);
                  return function(t) {
                    // Update arc path position as we animate
                    arcPath.attr('d', lineGenerator as any);
                    
                    // Update dot positions
                    const startProj = projection(from.coordinates as [number, number]);
                    const endProj = projection(to.coordinates as [number, number]);
                    
                    if (startProj) {
                      startDot.attr('cx', startProj[0]).attr('cy', startProj[1]);
                    }
                    if (endProj) {
                      endDot.attr('cx', endProj[0]).attr('cy', endProj[1]);
                    }
                    
                    // Move traveling dot along the arc
                    const point = arcGenerator(t);
                    const projected = projection(point as [number, number]);
                    if (projected) {
                      travelingDot
                        .attr('cx', projected[0])
                        .attr('cy', projected[1]);
                    }
                    
                    return interpolate(t).toString();
                  };
                })
                .on('end', function () {
                  // Show end dot when line reaches destination
                  endDot.transition().duration(300).style('opacity', 1);
                  // Hide traveling dot
                  travelingDot.transition().duration(300).style('opacity', 0);
                });
            })
            .transition()
            .delay(2200)
            .on('start', function () {
              // Fade out the arc and dots
              arcPath.transition().duration(600).style('stroke-opacity', 0).remove();
              startDot.transition().duration(600).style('opacity', 0).remove();
              endDot.transition().duration(600).style('opacity', 0).remove();
              travelingDot.remove();
            })
            .on('end', () => {
              currentLocation = (currentLocation + 1) % locations.length;
              transition();
            });
        }

        // Start animation
        transition();
      })
      .catch(error => {
        console.error('Error loading world data:', error);
      });

    // Handle window resize
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

    return () => {
      window.removeEventListener('resize', handleResize);
    };
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

