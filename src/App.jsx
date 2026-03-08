import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Plus, Trash2, Hexagon } from 'lucide-react';
import { evaluate } from 'mathjs';
import PlotViewer from './PlotViewer';
import engine from './AudioEngine';

const COLORS = [
  '#D4FF00', // Lime Yellow
  '#FF4D85', // Neon Pink
  '#00F0FF', // Cyan
  '#B44DFF', // Purple
  '#FF9F1C', // Orange
];

const INSTRUMENTS = ['electric', 'bass', 'brass', 'xylophone', 'organ', 'kalimba', 'synth'];

const KEYBOARD_KEYS = [
  '7', '8', '9', '/', 'C', '⌫',
  '4', '5', '6', '*', 'sin(', 'cos(',
  '1', '2', '3', '-', 'tan(', 'log(',
  '0', '.', '=', '+', 'abs(', 'sqrt(',
  'x', 'y', 'z', '^', 'pi', 'e',
  '(', ')', '<', '>', '<=', '>='
];

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const [functions, setFunctions] = useState([
    { id: 1, expr: 'y = sin(x)', color: COLORS[0], instrument: 'electric' },
    { id: 2, expr: 'y = cos(x)', color: COLORS[1], instrument: 'bass' }
  ]);
  const [is3D, setIs3D] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [activeFuncId, setActiveFuncId] = useState(1);
  const [volume, setVolume] = useState(80);
  const [plotData, setPlotData] = useState([]);

  const animationRef = useRef(null);
  const progressRef = useRef(0);
  const timeoutRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const functionsRef = useRef(functions);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    functionsRef.current = functions;
  }, [functions]);

  // Generate plot data whenever functions or 3D mode changes
  useEffect(() => {
    try {
      if (is3D) {
        // Generate surface data
        const newPlotData = functions.map(f => {
          let lhs = 'z';
          let rhs = f.expr;
          if (f.expr.includes('=')) {
            const parts = f.expr.split('=');
            lhs = parts[0].trim().toLowerCase();
            rhs = parts[1].trim();
          }

          const xValues = [];
          const yValues = [];
          const zValues = [];
          // wider grid from -30 to 30
          for (let x = -30; x <= 30; x += 1) {
            xValues.push(x);
          }
          for (let y = -30; y <= 30; y += 1) {
            yValues.push(y);
          }
          for (let y = -30; y <= 30; y += 1) {
            const zRow = [];
            for (let x = -30; x <= 30; x += 1) {
               try {
                let scope = {x, y, z: 0};
                const val = evaluate(rhs, scope);
                zRow.push(Number.isFinite(val) ? val : null);
              } catch (e) {
                zRow.push(null);
              }
            }
            zValues.push(zRow);
          }
          return {
            x: xValues,
            y: yValues,
            z: zValues,
            type: 'surface',
            name: f.expr,
            colorscale: [[0, f.color], [1, f.color]], // simple tinting
            showscale: false,
            opacity: 0.8
          };
        });
        setPlotData(newPlotData);
      } else {
        // Generate line data with larger range
        const tValues = [];
        for (let t = -100; t <= 100; t += 0.2) {
          tValues.push(t);
        }

        const newPlotData = functions.map(f => {
          let lhs = 'y';
          let rhs = f.expr;
          if (f.expr.includes('=')) {
            const parts = f.expr.split('=');
            lhs = parts[0].trim().toLowerCase();
            rhs = parts[1].trim();
          }
          let xVals = [];
          let yVals = [];

          if (lhs === 'x') {
            yVals = tValues;
            xVals = tValues.map(val => {
              try {
                const xVal = evaluate(rhs, { y: val });
                return Number.isFinite(xVal) ? xVal : null;
              } catch (e) {
                return null;
              }
            });
          } else {
            // default to y = f(x)
            xVals = tValues;
            yVals = tValues.map(val => {
              try {
                const yVal = evaluate(rhs, { x: val });
                return Number.isFinite(yVal) ? yVal : null;
              } catch (e) {
                return null;
              }
            });
          }
          return {
            x: xVals,
            y: yVals,
            type: 'scatter',
            mode: 'lines',
            name: f.expr,
            line: { color: f.color, width: 3 }
          };
        });
        setPlotData(newPlotData);
      }
    } catch (err) {
      console.error("Plot generation error", err);
    }
  }, [functions, is3D]);

  // Audio synths Setup
  useEffect(() => {
    engine.setupTracks(functions);
  }, [functions]);

  useEffect(() => {
    engine.setVolume(volume);
  }, [volume]);

  // Playback loop
  const stepAudio = useCallback(() => {
    if (!isPlayingRef.current) return;

    // sweep t from -100 to 100 to match the extended graph range
    // progress is 0 to 100 -> t is -100 + (200 * progress / 100)
    const t = -100 + (200 * progressRef.current / 100);

    // Get current Y values for audio
    const yVals = {};
    functionsRef.current.forEach(f => {
      let lhs = 'y';
      let rhs = f.expr;
      if (f.expr.includes('=')) {
        const parts = f.expr.split('=');
        lhs = parts[0].trim().toLowerCase();
        rhs = parts[1].trim();
      }

      try {
        let val;
        if (lhs === 'x') {
          val = evaluate(rhs, { y: t });
        } else {
          val = evaluate(rhs, { x: t, y: 0 });
        }
        if (Number.isFinite(val)) {
          yVals[f.id] = val;
        }
      } catch (e) { }
    });

    if (Object.keys(yVals).length > 1) {
      const ids = Object.keys(yVals);
      let hitIntersection = false;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          if (Math.abs(yVals[ids[i]] - yVals[ids[j]]) < 0.3) {
            hitIntersection = true;
            break;
          }
        }
        if (hitIntersection) break;
      }
      if (hitIntersection) {
        engine.playIntersection();
      }
    }

    engine.playFrame(yVals, "16n");

    progressRef.current += 1; // speed
    if (progressRef.current > 100) {
      progressRef.current = 0; // loop
    }
    setProgress(progressRef.current);

    timeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current) {
        stepAudio();
      }
    }, 100); // tempo

  }, []);

  useEffect(() => {
    if (isPlaying) {
      engine.init().then(() => {
        stepAudio();
      });
    } else {
      engine.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPlaying, stepAudio]);

  const addFunction = () => {
    const nextId = functions.length > 0 ? Math.max(...functions.map(f => f.id)) + 1 : 1;
    setFunctions([...functions, {
      id: nextId,
      expr: 'y = x^2',
      color: COLORS[functions.length % COLORS.length],
      instrument: 'synth'
    }]);
  };

  const removeFunction = (id) => {
    setFunctions(functions.filter(f => f.id !== id));
  };

  const updateFunction = (id, key, value) => {
    setFunctions(functions.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const handleKeyClick = (key) => {
    if (!activeFuncId) return;
    const func = functions.find(f => f.id === activeFuncId);
    if (!func) return;

    let newExpr = func.expr;
    if (key === 'C') {
      newExpr = '';
    } else if (key === '⌫') {
      newExpr = newExpr.slice(0, -1);
    } else {
      newExpr += key;
    }
    updateFunction(activeFuncId, 'expr', newExpr);
  };

  if (isLoading) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
        <div className="logo" style={{ fontSize: '3rem', transform: 'scale(1.5)' }}>
          <Hexagon size={64} style={{ animation: 'spin 2s linear infinite' }} />
          Wydey
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <div className="logo">
          <Hexagon /> Wydey
        </div>
        <div>

          <button 
            className={`btn ${is3D ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIs3D(!is3D)}
          >
            {is3D ? '2D View' : '3D View'}
          </button>
        </div>
      </header>
      
      <main className="main-content">
        <aside className="sidebar">
          <div className="panel">
            <h3 style={{ marginBottom: '1rem', color: 'var(--lime-yellow)' }}>Equations</h3>
            {functions.map(f => (
              <div 
                key={f.id} 
                className={`func-item ${activeFuncId === f.id ? 'active' : ''}`}
                onClick={() => setActiveFuncId(f.id)}
              >
                <div className="func-color" style={{ backgroundColor: f.color }} />
                <div className="func-details">
                  <input 
                    type="text" 
                    value={f.expr} 
                    onChange={e => updateFunction(f.id, 'expr', e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'white', fontFamily: 'monospace', fontSize: '1.1rem', outline: 'none', width: '100%' }}
                  />
                  <select 
                    value={f.instrument} 
                    onChange={e => updateFunction(f.id, 'instrument', e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--lime-yellow)', fontSize: '0.8rem', padding: '0', cursor: 'pointer', outline: 'none' }}
                  >
                    {INSTRUMENTS.map(inst => (
                      <option key={inst} value={inst} style={{ background: 'var(--indigo-dark)' }}>
                        {inst.charAt(0).toUpperCase() + inst.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-danger" onClick={(e) => {
                  e.stopPropagation();
                  removeFunction(f.id);
                }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button className="btn btn-secondary w-full" style={{ width: '100%', marginTop: '1rem' }} onClick={addFunction}>
              <Plus size={16} /> Add Function
            </button>
          </div>

          <div className="panel" style={{ marginTop: '0.5rem' }}>
            <div className="keyboard-grid">
              {KEYBOARD_KEYS.map((key, i) => (
                <button 
                  key={i} 
                  className={`keyboard-btn ${['C', '⌫'].includes(key) ? 'action-btn' : ''}`}
                  onClick={() => handleKeyClick(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--lime-yellow)' }}>Master Volume</h3>
            <div className="input-group">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume} 
                onChange={(e) => setVolume(Number(e.target.value))} 
              />
            </div>
          </div>
        </aside>

        <section className="viewport">
          <div className="graph-container">
            {plotData.length === 0 ? (
              <div className="empty-state">
                <Hexagon size={48} />
                <p>Add a function to see the plot.</p>
              </div>
            ) : (
              <>
                <PlotViewer 
                  data={plotData} 
                  is3D={is3D}
                  layout={{ title: '' }} 
                />
                {!is3D && isPlaying && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: 40,
                      bottom: 40,
                      left: `calc(40px + (100% - 80px) * (${progress} / 100))`,
                      width: '2px',
                      backgroundColor: 'rgba(212, 255, 0, 0.8)',
                      boxShadow: '0 0 10px rgba(212, 255, 0, 0.8)',
                      zIndex: 10,
                      pointerEvents: 'none',
                      transition: 'left 0.1s linear'
                    }}
                  />
                )}
              </>
            )}
          </div>

          <div className="playback-controls">
            <button className="play-btn" onClick={() => {
              if (!isPlaying && !engine.isInitialized) {
                engine.init().then(() => setIsPlaying(true));
              } else {
                setIsPlaying(!isPlaying);
              }
            }}>
              {isPlaying ? <Square /> : <Play />}
            </button>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={progress} 
                onChange={(e) => {
                  setProgress(Number(e.target.value));
                  progressRef.current = Number(e.target.value);
                }}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
