import React from 'react';
import Plot from 'react-plotly.js';

const PlotViewer = ({ data, layout, is3D }) => {
  const mergedLayout = {
    ...layout,
    autosize: true,
    paper_bgcolor: '#FFFFFF',
    plot_bgcolor: '#FFFFFF',
    font: {
      family: "'Inter', sans-serif",
      color: '#000000',
      size: 12
    },
    ...(!is3D && {
      dragmode: 'zoom',
      xaxis: {
        gridcolor: 'rgba(0,0,0,0.08)',
        zerolinecolor: 'rgba(0,0,0,0.3)',
        zerolinewidth: 2,
        linecolor: '#000000',
        linewidth: 2,
        tickfont: { family: "'Space Mono', monospace", size: 11 },
      },
      yaxis: {
        gridcolor: 'rgba(0,0,0,0.08)',
        zerolinecolor: 'rgba(0,0,0,0.3)',
        zerolinewidth: 2,
        linecolor: '#000000',
        linewidth: 2,
        tickfont: { family: "'Space Mono', monospace", size: 11 },
      }
    }),
    ...(is3D && {
      scene: {
        dragmode: 'orbit',
        xaxis: { gridcolor: 'rgba(0,0,0,0.08)', linecolor: '#000' },
        yaxis: { gridcolor: 'rgba(0,0,0,0.08)', linecolor: '#000' },
        zaxis: { gridcolor: 'rgba(0,0,0,0.08)', linecolor: '#000' },
        bgcolor: '#FFFFFF'
      }
    }),
    margin: { t: 30, b: 50, l: 50, r: 30 },
    showlegend: true,
    legend: {
      font: { family: "'Inter', sans-serif", size: 12 },
      bgcolor: 'rgba(255,255,255,0.9)',
      bordercolor: '#000',
      borderwidth: 1
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Plot
        data={data}
        layout={mergedLayout}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: true, responsive: true, scrollZoom: true, doubleClick: 'reset' }}
      />
    </div>
  );
};

export default PlotViewer;
