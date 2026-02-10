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
    const height = 400 - margin.top - margin.bottom;

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
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.4);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.05);

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
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 3)
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
      .attr('fill', '#f59e0b')
      .attr('stroke', '#1f2937')
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
          .attr('r', 12)
          .attr('fill', '#fbbf24');
        setHoveredPoint(d);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 8)
          .attr('fill', '#f59e0b');
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
      <div className="bg-gray-900/50 border border-gray-800 p-6 h-[500px] animate-pulse flex items-center justify-center">
        <div className="text-gray-500">Loading reserve data...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 p-6 h-[500px] flex flex-col items-center justify-center">
        <svg className="w-16 h-16 text-gray-700 mb-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
        </svg>
        <p className="text-gray-500">No reserve data yet</p>
        <p className="text-gray-600 text-sm mt-1">Run the pipeline to see growth over time</p>
      </div>
    );
  }

  const latestPoint = data[data.length - 1];

  return (
    <div className="bg-gray-900/50 border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-800 flex justify-between items-start">
        <div>
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-[#c9a84c]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
            </svg>
            Reserve Growth Since Inception
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            Cumulative verified Goldbacks anchored on-chain
          </p>
        </div>
        
        <div className="text-right">
          <div className="text-3xl font-bold text-[#c9a84c]">
            {latestPoint?.totalSerials.toLocaleString()}
          </div>
          <div className="text-gray-500 text-xs uppercase tracking-wider">
            Total Verified
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div className="absolute z-20 bg-gray-800 border border-gray-700 p-3 shadow-xl pointer-events-none">
          <div className="text-[#c9a84c] font-bold">{hoveredPoint.totalSerials.toLocaleString()} Goldbacks</div>
          <div className="text-gray-400 text-xs mt-1">{hoveredPoint.date.toLocaleString()}</div>
          <div className="text-gray-600 text-[10px] font-mono mt-1 truncate max-w-[200px]">
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
