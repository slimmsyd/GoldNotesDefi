'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchMerkleRootHistory } from '@/lib/supabase-protocol';
import { MerkleRootRecord } from '@/lib/protocol-constants';

interface DataPoint {
  date: Date;
  totalSerials: number;
  rootHash: string;
}

export function ReserveGrowthChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  // Fetch data
  useEffect(() => {
    async function loadData() {
      try {
        const roots = await fetchMerkleRootHistory(20);

        // Transform to cumulative data points
        const points: DataPoint[] = roots
          .reverse() // Oldest first
          .map((root) => ({
            date: new Date(root.anchored_at),
            totalSerials: root.total_serials,
            rootHash: root.root_hash,
          }));

        // Add genesis point if we have data
        if (points.length > 0) {
          const genesis = new Date(points[0].date);
          genesis.setHours(genesis.getHours() - 1);
          points.unshift({ date: genesis, totalSerials: 0, rootHash: 'genesis' });
        }

        setData(points);
      } catch (error) {
        console.error('Failed to load reserve data', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // D3 Rendering
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 40, bottom: 60, left: 70 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom; // Increased height

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.date) as [Date, Date])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.totalSerials) || 100])
      .nice()
      .range([height, 0]);

    // Gradient for area fill
    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'areaGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#c9a84c') // Changed to standard gold
      .attr('stop-opacity', 0.5); // Increased top opacity

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#c9a84c')
      .attr('stop-opacity', 0.01); // Fade to almost clear

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-height)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#374151')
      .attr('stroke-opacity', 0.3);

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#374151')
      .attr('stroke-opacity', 0.3);

    // Area generator
    const area = d3
      .area<DataPoint>()
      .x((d) => xScale(d.date))
      .y0(height)
      .y1((d) => yScale(d.totalSerials))
      .curve(d3.curveMonotoneX);

    // Line generator
    const line = d3
      .line<DataPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.totalSerials))
      .curve(d3.curveMonotoneX);

    // Draw area with animation
    const areaPath = g
      .append('path')
      .datum(data)
      .attr('fill', 'url(#areaGradient)')
      .attr('d', area);

    // Animate area
    const totalLength = areaPath.node()?.getTotalLength() || 0;
    areaPath
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeQuadOut)
      .attr('stroke-dashoffset', 0);

    // Draw line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#e8d48b') // Bright gold
      .attr('stroke-width', 4) // Slightly thicker
      .attr('d', line)
      .attr('stroke-dasharray', function () {
        return this.getTotalLength();
      })
      .attr('stroke-dashoffset', function () {
        return this.getTotalLength();
      })
      .transition()
      .duration(1500)
      .ease(d3.easeQuadOut)
      .attr('stroke-dashoffset', 0);

    // Data points (circles)
    const circles = g
      .selectAll('.data-point')
      .data(data.filter((d) => d.rootHash !== 'genesis'))
      .enter()
      .append('circle')
      .attr('class', 'data-point')
      .attr('cx', (d) => xScale(d.date))
      .attr('cy', (d) => yScale(d.totalSerials))
      .attr('r', 0)
      .attr('fill', '#000000') // Black center
      .attr('stroke', '#e8d48b') // Gold ring
      .attr('stroke-width', 3)
      .style('cursor', 'pointer');

    circles
      .transition()
      .delay((_, i) => 1500 + i * 100)
      .duration(300)
      .attr('r', 8);

    // Hover interactions
    circles
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 10)
          .attr('stroke-width', 4)
          .attr('fill', '#c9a84c');
        setHoveredPoint(d);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 8)
          .attr('stroke-width', 3)
          .attr('fill', '#000000');
        setHoveredPoint(null);
      });

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(6)
          .tickFormat((d) => d3.timeFormat('%b %d, %H:%M')(d as Date))
      )
      .selectAll('text')
      .attr('fill', '#9ca3af')
      .attr('font-size', '11px');

    g.selectAll('.domain').attr('stroke', '#374151');
    g.selectAll('.tick line').attr('stroke', '#374151');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .selectAll('text')
      .attr('fill', '#9ca3af')
      .attr('font-size', '11px');

    // Axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -55)
      .attr('x', -height / 2)
      .attr('fill', '#6b7280')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text('Verified Goldbacks');

    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 50)
      .attr('fill', '#6b7280')
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text('Time');

  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 h-[500px] animate-pulse flex items-center justify-center rounded-[32px]">
        <div className="text-gray-500 font-bold tracking-widest uppercase">Loading reserve data...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 h-[500px] flex flex-col items-center justify-center rounded-[32px]">
        <svg className="w-16 h-16 text-white/20 mb-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
        </svg>
        <p className="text-gray-400 font-bold tracking-widest uppercase">No reserve data yet</p>
        <p className="text-gray-500 text-[10px] mt-2 font-mono">Run the pipeline to see growth over time</p>
      </div>
    );
  }

  const latestPoint = data[data.length - 1];

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden rounded-[32px]">
      {/* Header */}
      <div className="p-8 border-b border-white/5 flex justify-between items-start">
        <div>
          <h3 className="text-white font-medium text-lg flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-[12px] border border-white/10">
              <img src="/AppAssets/PNG Renders/scale_black.png" alt="Vault" className="w-6 h-6 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
            </div>
            Reserve Growth Since Inception
          </h3>
          <p className="text-gray-500 text-sm mt-2 font-medium">
            Cumulative verified Goldbacks anchored on-chain
          </p>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className="text-[40px] font-bold text-[#c9a84c] tracking-tighter leading-none mb-1 drop-shadow-lg">
            {latestPoint?.totalSerials.toLocaleString()}
          </div>
          <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">
            Total Verified
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div className="absolute z-20 bg-white/10 backdrop-blur-2xl border border-white/20 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-none rounded-[24px]">
          <div className="text-[#c9a84c] font-bold text-lg tracking-tight mb-1">{hoveredPoint.totalSerials.toLocaleString()} Physical Assets</div>
          <div className="text-gray-300 text-[10px] font-bold tracking-widest uppercase mb-2">{hoveredPoint.date.toLocaleString()}</div>
          <div className="text-gray-500 text-[10px] font-mono mt-1 truncate max-w-[200px] bg-black/40 px-2 py-1 rounded-md border border-white/5">
            {hoveredPoint.rootHash}
          </div>
        </div>
      )}

      {/* Chart */}
      <div ref={containerRef} className="p-4">
        <svg ref={svgRef} className="w-full" />
      </div>

      {/* Legend */}
      <div className="px-6 pb-4 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#c9a84c]" />
          <span>ZK Proof Anchor</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-[#c9a84c]" />
          <span>Cumulative Supply</span>
        </div>
      </div>
    </div>
  );
}
