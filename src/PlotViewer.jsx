import React from 'react';
import Plot from 'react-plotly.js';

const PlotViewer = ({ data, layout, is3D }) => {
  const mergedLayout = {
    ...layout,
    autosize: true,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: '#FFFFFF'
    },
    ...(!is3D && {
      xaxis: {
        gridcolor: 'rgba(255,255,255,0.1)',
        zerolinecolor: 'rgba(255,255,255,0.3)',
      },
      yaxis: {
        gridcolor: 'rgba(255,255,255,0.1)',
        zerolinecolor: 'rgba(255,255,255,0.3)',
      }
    }),
    ...(is3D && {
      scene: {
        xaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
        zaxis: { gridcolor: 'rgba(255,255,255,0.1)' },
        bgcolor: 'transparent'
      }
    }),
    margin: { t: 40, b: 40, l: 40, r: 40 },
    showlegend: true,
  };

  return (
    <div className="w-full h-full" style={{ width: '100%', height: '100%' }}>
      <Plot
        data={data}
        layout={mergedLayout}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: true, responsive: true }}
      />
    </div>
  );
};

export default PlotViewer;
