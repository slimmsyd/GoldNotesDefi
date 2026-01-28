'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { LearnMoreModal } from './learn-more-modal';
import { WaitlistModal } from './waitlist-modal';

interface TravelingNode {
  id: number;
  pathIndex: number;
  progress: number;
  x: number;
  y: number;
}

export function AuditedSection() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isLearnMoreModalOpen, setIsLearnMoreModalOpen] = useState(false);
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !buttonRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    const button = buttonRef.current;

    // Clear previous content
    svg.selectAll('*').remove();

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr('width', width).attr('height', height);

    // Get button's actual position relative to the container
    const buttonRect = button.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const centerX = buttonRect.left - containerRect.left + buttonRect.width / 2;
    const centerY = buttonRect.top - containerRect.top + buttonRect.height / 2;

    // Define 6 paths - 3 from left side, 3 from right side
    const paths = [
      // Left side - top
      {
        start: { x: 0, y: height * 0.2 },
        control: { x: width * 0.25, y: height * 0.3 },
        end: { x: centerX, y: centerY }
      },
      // Left side - middle
      {
        start: { x: 0, y: height * 0.5 },
        control: { x: width * 0.25, y: height * 0.5 },
        end: { x: centerX, y: centerY }
      },
      // Left side - bottom
      {
        start: { x: 0, y: height * 0.8 },
        control: { x: width * 0.25, y: height * 0.7 },
        end: { x: centerX, y: centerY }
      },
      // Right side - top
      {
        start: { x: width, y: height * 0.2 },
        control: { x: width * 0.75, y: height * 0.3 },
        end: { x: centerX, y: centerY }
      },
      // Right side - middle
      {
        start: { x: width, y: height * 0.5 },
        control: { x: width * 0.75, y: height * 0.5 },
        end: { x: centerX, y: centerY }
      },
      // Right side - bottom
      {
        start: { x: width, y: height * 0.8 },
        control: { x: width * 0.75, y: height * 0.7 },
        end: { x: centerX, y: centerY }
      }
    ];

    // Create curved path generator
    const lineGenerator = d3.line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveBasis);

    // Draw the paths
    paths.forEach((path) => {
      // Generate smooth curve points
      const points: Array<{ x: number; y: number }> = [];
      for (let t = 0; t <= 1; t += 0.1) {
        const x = (1 - t) * (1 - t) * path.start.x +
          2 * (1 - t) * t * path.control.x +
          t * t * path.end.x;
        const y = (1 - t) * (1 - t) * path.start.y +
          2 * (1 - t) * t * path.control.y +
          t * t * path.end.y;
        points.push({ x, y });
      }

      svg.append('path')
        .datum(points)
        .attr('d', lineGenerator)
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('fill', 'none')
        .attr('opacity', 0.6);
    });

    // Function to get point on quadratic bezier curve
    function getPointOnCurve(path: typeof paths[0], t: number) {
      const x = (1 - t) * (1 - t) * path.start.x +
        2 * (1 - t) * t * path.control.x +
        t * t * path.end.x;
      const y = (1 - t) * (1 - t) * path.start.y +
        2 * (1 - t) * t * path.control.y +
        t * t * path.end.y;
      return { x, y };
    }

    // Create traveling nodes
    const travelingNodes: TravelingNode[] = [];
    let nodeIdCounter = 0;

    // Spawn initial nodes on each path
    paths.forEach((_, pathIndex) => {
      travelingNodes.push({
        id: nodeIdCounter++,
        pathIndex,
        progress: Math.random() * 0.5, // Start at random positions
        x: 0,
        y: 0
      });
    });

    // Create node elements
    const nodeGroup = svg.append('g');

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      // Update node positions and progress
      travelingNodes.forEach(node => {
        node.progress += 0.0015; // Speed of travel - slower for smooth flow

        // If node reaches the end, reset it
        if (node.progress >= 1) {
          node.progress = 0;
        }

        const point = getPointOnCurve(paths[node.pathIndex], node.progress);
        node.x = point.x;
        node.y = point.y;
      });

      // Calculate opacity for fade in/out
      const getOpacity = (progress: number) => {
        if (progress < 0.1) return progress * 10;
        if (progress > 0.9) return (1 - progress) * 10;
        return 1;
      };

      // Update square borders
      const squares = nodeGroup
        .selectAll<SVGRectElement, TravelingNode>('rect')
        .data(travelingNodes, d => d.id);

      squares.enter()
        .append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', 'none')
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 2)
        .attr('opacity', 0)
        .merge(squares)
        .attr('x', d => d.x - 6)
        .attr('y', d => d.y - 6)
        .attr('opacity', d => getOpacity(d.progress));

      squares.exit().remove();

      // Update gold dots (circles)
      const circles = nodeGroup
        .selectAll<SVGCircleElement, TravelingNode>('circle')
        .data(travelingNodes, d => d.id);

      circles.enter()
        .append('circle')
        .attr('r', 4)
        .attr('fill', '#d97706')
        .attr('opacity', 0)
        .merge(circles)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('opacity', d => getOpacity(d.progress));

      circles.exit().remove();

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <section className="relative bg-gradient-to-b from-white to-gray-50 overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full min-h-screen flex flex-col items-center justify-center px-6"
      >
        {/* Background SVG Animation */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 0 }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-12">
          {/* Main Heading */}
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-light leading-tight">
            <button
              onClick={() => setIsLearnMoreModalOpen(true)}
              className="text-gray-900 hover:text-gray-700 transition-colors duration-200 cursor-pointer"
            >
              Learn more about
            </button>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(to right, #FFE860, #FEFDD6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              BlackW3B.
            </span>
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(to right, #FFE860, #FEFDD6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Goldbacks.
            </span>
            {' '}
            <span className="text-gray-900">Benefits.</span>
            <br />
            <span className="text-gray-900">And </span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(to right, #FFE860, #FEFDD6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              innovation.
            </span>
          </h2>

          {/* Join Waitlist Button */}
          <div className="flex justify-center">
            <button
              ref={buttonRef}
              onClick={() => setIsWaitlistModalOpen(true)}
              className="group relative cursor-pointer px-12 py-5 bg-gray-900 text-white text-sm font-medium tracking-wider uppercase rounded-lg hover:bg-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <span className="relative z-10 cursor-pointer">Join Waitlist</span>

              {/* Button glow effect */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
            </button>
          </div>
        </div>
      </div>

      <LearnMoreModal isOpen={isLearnMoreModalOpen} onClose={() => setIsLearnMoreModalOpen(false)} />
      <WaitlistModal isOpen={isWaitlistModalOpen} onClose={() => setIsWaitlistModalOpen(false)} />
    </section>
  );
}


