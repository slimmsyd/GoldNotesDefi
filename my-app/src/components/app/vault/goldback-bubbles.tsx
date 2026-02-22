'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { fetchBatchStats, BatchStats } from '@/lib/supabase-protocol';

interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  serialCount: number;
  radius: number;
  color: string;
  latestReceived: string;
}

export function GoldbackBubbles() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [batches, setBatches] = useState<BatchStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BubbleNode | null>(null);

  // Fetch data
  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchBatchStats();
        setBatches(data);
      } catch (error) {
        console.error('Failed to load batch data', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // D3 Force Simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || batches.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 400;

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    // Color scale based on age
    const colorScale = d3
      .scaleSequential(d3.interpolateYlOrBr)
      .domain([0, batches.length]);

    // Create nodes from batches
    const nodes: BubbleNode[] = batches.map((batch, i) => ({
      id: batch.batchId,
      serialCount: batch.serialCount,
      radius: Math.max(25, Math.min(60, Math.sqrt(batch.serialCount) * 8)),
      color: colorScale(i),
      latestReceived: batch.latestReceived,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    // Create gradient definitions for 3D effect
    const defs = svg.append('defs');

    nodes.forEach((node, i) => {
      const gradient = defs
        .append('radialGradient')
        .attr('id', `bubble-gradient-${i}`)
        .attr('cx', '30%')
        .attr('cy', '30%')
        .attr('r', '70%');

      gradient
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(node.color)?.brighter(1.5)?.toString() || '#fff');

      gradient
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', node.color);
    });

    // Create center "vault" node
    const vaultRadius = 70;

    // Draw vault in center
    const vaultGroup = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Vault glow
    vaultGroup
      .append('circle')
      .attr('r', vaultRadius + 20)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.2)
      .attr('filter', 'blur(8px)');

    // Vault circle
    vaultGroup
      .append('circle')
      .attr('r', vaultRadius)
      .attr('fill', '#1f2937')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 3);

    // Vault icon
    vaultGroup
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#f59e0b')
      .attr('font-size', '28px')
      .text('🏦');

    vaultGroup
      .append('text')
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('text-transform', 'uppercase')
      .attr('letter-spacing', '1px')
      .text('VAULT');

    // Force simulation
    const simulation = d3
      .forceSimulation<BubbleNode>(nodes)
      .force('charge', d3.forceManyBody().strength(50))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<BubbleNode>().radius((d) => d.radius + 5)
      )
      .force(
        'radial',
        d3.forceRadial<BubbleNode>(vaultRadius + 80, width / 2, height / 2).strength(0.8)
      );

    // Create bubble groups
    const bubbleGroups = svg
      .selectAll<SVGGElement, BubbleNode>('.bubble-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'bubble-group')
      .style('cursor', 'pointer');

    // Draw bubbles
    bubbleGroups
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (_, i) => `url(#bubble-gradient-${i})`)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3)
      .on('mouseenter', function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('stroke-width', 4)
          .attr('stroke-opacity', 0.8);
        setSelectedBatch(d);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.3);
        setSelectedBatch(null);
      });

    // Add serial count labels
    bubbleGroups
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#000')
      .attr('font-size', (d) => Math.max(10, d.radius / 3))
      .attr('font-weight', 'bold')
      .text((d) => d.serialCount);

    // Update positions on tick
    simulation.on('tick', () => {
      bubbleGroups.attr('transform', (d) => `translate(${d.x}, ${d.y})`);
    });

    // Animate bubbles pulsing
    function pulse() {
      bubbleGroups
        .selectAll('circle')
        .transition()
        .duration(2000)
        .attr('r', (d: unknown) => (d as BubbleNode).radius * 1.05)
        .transition()
        .duration(2000)
        .attr('r', (d: unknown) => (d as BubbleNode).radius)
        .on('end', pulse);
    }
    pulse();

    return () => {
      simulation.stop();
    };
  }, [batches]);

  if (isLoading) {
    return (
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 h-[400px] animate-pulse flex items-center justify-center rounded-[32px]">
        <div className="text-gray-500 font-bold tracking-widest uppercase">Loading batch data...</div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 h-[400px] flex flex-col items-center justify-center rounded-[32px]">
        <div className="mb-4 bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-center">
          <img src="/AppAssets/PNG Renders/safe_black.png" alt="Empty Vault" className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] brightness-200" />
        </div>
        <p className="text-gray-400 font-bold tracking-widest uppercase">Vault is empty</p>
        <p className="text-gray-500 text-[10px] mt-2 font-mono">Verified batches will appear as bubbles</p>
      </div >
    );
  }

  const totalSerials = batches.reduce((sum, b) => sum + b.serialCount, 0);

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden relative">
      {/* Header */}
      <div className="p-8 border-b border-white/5 flex justify-between items-start">
        <div>
          <h3 className="text-white font-medium text-lg flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-[12px] border border-white/10">
              <span className="text-xl leading-none">✨</span>
            </div>
            Goldback Constellation
          </h3>
          <p className="text-gray-500 text-sm mt-2 font-medium">
            Each bubble represents a verified batch orbiting the vault
          </p>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className="text-[40px] font-bold text-[#c9a84c] tracking-tighter leading-none mb-1 drop-shadow-lg">{batches.length}</div>
          <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg">Batches</div>
        </div>
      </div>

      {/* Selected Batch Info */}
      {selectedBatch && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-20 bg-white/10 backdrop-blur-2xl border border-white/20 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-none rounded-[24px] min-w-[200px] text-center">
          <div className="text-[#c9a84c] font-bold text-lg tracking-tight mb-1">{selectedBatch.serialCount.toLocaleString()} Physical Assets</div>
          <div className="text-gray-300 text-[10px] font-bold tracking-widest uppercase mb-2">Batch ID: {selectedBatch.id.split('-').pop()}</div>
          <div className="text-gray-500 text-[10px] font-mono mt-1 bg-black/40 px-2 py-1 rounded-md border border-white/5">
            {new Date(selectedBatch.latestReceived).toLocaleString()}
          </div>
        </div>
      )}

      {/* Visualization */}
      <div ref={containerRef} className="relative">
        <svg ref={svgRef} className="w-full" />
      </div>

      {/* Footer Stats */}
      <div className="p-6 border-t border-white/5 flex justify-around text-center bg-white/[0.02]">
        <div>
          <div className="text-2xl font-bold text-white tracking-tighter">{totalSerials.toLocaleString()}</div>
          <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Total Goldbacks</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white tracking-tighter">{batches.length}</div>
          <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Verified Batches</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tighter drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
            ${(totalSerials * 9.18).toLocaleString()}
          </div>
          <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Est. Value (USD)</div>
        </div>
      </div>
    </div>
  );
}
