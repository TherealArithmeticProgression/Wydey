import React, { useState } from 'react';
import Plot from 'react-plotly.js';

const PlotViewer = ({ data, layout, is3D }) => {
  const [dragMode, setDragMode] = useState('zoom');
  const [sceneDragMode, setSceneDragMode] = useState('orbit');

  const handleDoubleClick = () => {
    if (is3D) {
      setSceneDragMode(prev => prev === 'pan' ? 'orbit' : 'pan');
    } else {
      setDragMode(prev => prev === 'pan' ? 'zoom' : 'pan');
    }
  };

  const mergedLayout = {
    ...layout,
    autosize: true,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: '#FFFFFF'
    },
    ...(!is3D && {
      dragmode: dragMode,
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
        dragmode: sceneDragMode,
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
        onDoubleClick={handleDoubleClick}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: true, responsive: true, scrollZoom: true, doubleClick: false }}
      />
    </div>
  );
};

export default PlotViewer;
