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
      <div className="bg-gray-900/50 border border-gray-800 p-6 h-[400px] animate-pulse flex items-center justify-center">
        <div className="text-gray-500">Loading batch data...</div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 p-6 h-[400px] flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">🏦</div>
        <p className="text-gray-500">Vault is empty</p>
        <p className="text-gray-600 text-sm mt-1">Verified batches will appear as bubbles</p>
      </div>
    );
  }

  const totalSerials = batches.reduce((sum, b) => sum + b.serialCount, 0);

  // return (
  //   <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
  //     {/* Header */}
  //     <div className="p-6 border-b border-gray-800 flex justify-between items-start">
  //       <div>
  //         <h3 className="text-white font-semibold text-lg flex items-center gap-2">
  //           <span className="text-2xl">✨</span>
  //           Goldback Constellation
  //         </h3>
  //         <p className="text-gray-500 text-sm mt-1">
  //           Each bubble represents a verified batch orbiting the vault
  //         </p>
  //       </div>

  //       <div className="text-right">
  //         <div className="text-3xl font-bold text-amber-500">{batches.length}</div>
  //         <div className="text-gray-500 text-xs uppercase tracking-wider">Batches</div>
  //       </div>
  //     </div>

  //     {/* Selected Batch Info */}
  //     {selectedBatch && (
  //       <div className="absolute top-32 left-1/2 -translate-x-1/2 z-20 bg-gray-800/95 backdrop-blur border border-gray-700 rounded-xl p-4 shadow-2xl min-w-[200px]">
  //         <div className="text-amber-500 font-bold text-lg">{selectedBatch.serialCount} Goldbacks</div>
  //         <div className="text-gray-400 text-xs mt-1">Batch ID: {selectedBatch.id.split('-').pop()}</div>
  //         <div className="text-gray-500 text-[10px] mt-1">
  //           {new Date(selectedBatch.latestReceived).toLocaleString()}
  //         </div>
  //       </div>
  //     )}

  //     {/* Visualization */}
  //     <div ref={containerRef} className="relative">
  //       <svg ref={svgRef} className="w-full" />
  //     </div>

  //     {/* Footer Stats */}
  //     <div className="p-4 border-t border-gray-800 flex justify-around text-center">
  //       <div>
  //         <div className="text-xl font-bold text-white">{totalSerials.toLocaleString()}</div>
  //         <div className="text-gray-500 text-xs">Total Goldbacks</div>
  //       </div>
  //       <div>
  //         <div className="text-xl font-bold text-white">{batches.length}</div>
  //         <div className="text-gray-500 text-xs">Verified Batches</div>
  //       </div>
  //       <div>
  //         <div className="text-xl font-bold text-white">
  //           ${(totalSerials * 9.18).toLocaleString()}
  //         </div>
  //         <div className="text-gray-500 text-xs">Est. Value (USD)</div>
  //       </div>
  //     </div>
  //   </div>
  // );
}
