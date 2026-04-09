import React, { useMemo, useState, useRef, useEffect } from 'react';
import PlotlyPlot from 'react-plotly.js';
import { Mafs, Coordinates, Plot, Theme, Point } from 'mafs';
import { compile } from 'mathjs';
import 'mafs/core.css';
// Purposely removed mafs/font.css to enforce sans-serif website theme

const PlotViewer = ({ functions, is3D, data, layout, walkX, isWalking, activeFuncId, progress, isPlaying, rangeMin, rangeMax }) => {
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(500);

  // ResizeObserver to ensure Mafs perfectly fills the height of our graph-container
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const compiledMafsFuncs = useMemo(() => {
    return functions.map(f => {
      let lhs = 'y', rhs = f.expr;
      if (f.expr.includes('=')) {
        const parts = f.expr.split('=');
        lhs = parts[0].trim().toLowerCase();
        rhs = parts[1].trim();
      }
      try {
        const compiled = compile(rhs);
        return {
          ...f,
          lhs,
          evaluate: (val) => {
            // Constrain plot lines exactly to the custom user range
            if (val < rangeMin || val > rangeMax) return NaN;
            
            try {
              const scope = lhs === 'x' ? { y: val } : { x: val };
              const result = compiled.evaluate(scope);
              return Number.isFinite(result) ? result : NaN;
            } catch {
              return NaN;
            }
          }
        };
      } catch {
        return { ...f, lhs, evaluate: () => NaN };
      }
    });
  }, [functions, rangeMin, rangeMax]);

  if (is3D) {
    const mergedLayout = {
      ...layout,
      autosize: true,
      paper_bgcolor: '#FFFFFF',
      plot_bgcolor: '#FFFFFF',
      font: { family: "'Inter', sans-serif", color: '#000000', size: 12 },
      scene: {
        dragmode: 'orbit',
        xaxis: { gridcolor: 'rgba(0,0,0,0.08)', linecolor: '#000' },
        yaxis: { gridcolor: 'rgba(0,0,0,0.08)', linecolor: '#000' },
        zaxis: { gridcolor: 'rgba(0,0,0,0.08)', linecolor: '#000' },
        bgcolor: '#FFFFFF'
      },
      margin: { t: 30, b: 50, l: 50, r: 30 },
      showlegend: true,
      legend: { font: { family: "'Inter', sans-serif", size: 12 }, bgcolor: 'rgba(255,255,255,0.9)', bordercolor: '#000', borderwidth: 1 }
    };

    return (
      <div style={{ width: '100%', height: '100%' }}>
        <PlotlyPlot
          data={data}
          layout={mergedLayout}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ displayModeBar: true, responsive: true, scrollZoom: true }}
        />
      </div>
    );
  }

  const activeCompiledFunc = compiledMafsFuncs.find(f => f.id === activeFuncId);
  const markerY = activeCompiledFunc && isWalking ? activeCompiledFunc.evaluate(walkX) : null;
  const playheadX = rangeMin + ((rangeMax - rangeMin) * (progress || 0) / 100);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Mafs 
        height={containerHeight}
        zoom={{ min: 0.1, max: 20 }} 
        pan={true} 
        viewBox={{ x: [rangeMin, rangeMax], y: [-10, 10] }}
        preserveAspectRatio={false}
      >
        <Coordinates.Cartesian />
        
        {/* Render all math functions mapped cleanly to bounds */}
        {compiledMafsFuncs.map(f => {
          if (f.lhs === 'x') {
            return <Plot.OfY key={f.id} x={f.evaluate} color={f.color} />;
          }
          return <Plot.OfX key={f.id} y={f.evaluate} color={f.color} />;
        })}

        {/* Playback Scrubber Line */}
        {isPlaying && (
          <Plot.OfY x={() => playheadX} weight={2} color={Theme.foreground} opacity={0.4} style="dashed" />
        )}

        {/* Walking Scrubber and Point */}
        {isWalking && (
          <>
            <Plot.OfY x={() => walkX} weight={2} color={Theme.foreground} opacity={0.6} />
            {markerY !== null && !Number.isNaN(markerY) && (
              <Point x={walkX} y={markerY} color={Theme.foreground} />
            )}
          </>
        )}
      </Mafs>
    </div>
  );
};

export default PlotViewer;
