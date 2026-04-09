import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Square, Plus, Trash2, Hexagon, Eye, EyeOff,
  Mic, Volume2, HelpCircle, X, ArrowLeft, ArrowRight,
  MessageSquare, Footprints, ChevronLeft, ChevronRight,
  Music, Bell, Zap, Activity
} from 'lucide-react';
import { evaluate, compile } from 'mathjs';
import PlotViewer from './PlotViewer';
import engine from './AudioEngine';
import { analyzeFunction, classifyPoint, describeGraph, evalAt, getRHS } from './GraphAnalyzer';

const COLORS = ['#00A3FF', '#FF0055', '#00D859', '#AA00FF', '#FF6A00', '#FFD000'];

const WydeyLogo = ({ size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="4" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="50,5 93,25 93,75 50,95 7,75 7,25" />
    <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" strokeDasharray="5 5" />
    <circle cx="50" cy="50" r="8" />
    <line x1="50" y1="5" x2="50" y2="95" />
    <line x1="7" y1="25" x2="93" y2="75" />
    <line x1="7" y1="75" x2="93" y2="25" />
  </svg>
);

const INSTRUMENTS = ['piano', 'electric', 'bass', 'brass', 'xylophone', 'organ', 'kalimba', 'synth'];

const INSTRUMENT_ICONS = {
  piano: <Music size={16} />,
  electric: <Zap size={16} />,
  bass: <Activity size={16} />,
  brass: <Bell size={16} />,
  xylophone: <Bell size={16} />,
  organ: <Music size={16} />,
  kalimba: <Music size={16} />,
  synth: <Zap size={16} />
};

const KEYBOARD_KEYS = [
  '7', '8', '9', '/', 'C', '⌫',
  '4', '5', '6', '*', 'sin(', 'cos(',
  '1', '2', '3', '-', 'tan(', 'log(',
  '0', '.', '=', '+', 'abs(', 'sqrt(',
  'x', 'y', 'z', '^', 'pi', 'e',
  '(', ')', '<', '>', '<=', '>='
];

const DEFAULT_RANGE = { min: -10, max: 10, step: 0.2 };

const SHORTCUTS = [
  { key: 'Space', action: 'Play / Pause sonification' },
  { key: '← →', action: 'Walk graph point-by-point' },
  { key: 'Shift + ← →', action: 'Walk fast (skip 5 points)' },
  { key: '↑ ↓', action: 'Switch between functions' },
  { key: 'V', action: 'Toggle voice input' },
  { key: 'D', action: 'Describe current graph' },
  { key: 'R', action: 'Read current function aloud' },
  { key: 'I', action: 'Announce current instrument' },
  { key: 'N', action: 'Add new function' },
  { key: '?', action: 'Show/hide help' },
  { key: 'Esc', action: 'Close overlays / stop walking' },
];

// ======================== TTS ========================
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.05;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  window.speechSynthesis.speak(utter);
}

// ======================== Voice Recognition Hook ========================
function useVoiceRecognition(onResult) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      onResult(e.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [onResult]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, startListening, stopListening };
}

// ======================== Spoken Expression Parser ========================
function parseSpokenExpression(spoken) {
  let expr = spoken.toLowerCase().trim();
  expr = expr.replace(/\bsign\b/g, 'sin');
  expr = expr.replace(/\bsine\b/g, 'sin');
  expr = expr.replace(/\bcosine\b/g, 'cos');
  expr = expr.replace(/\btangent\b/g, 'tan');
  expr = expr.replace(/\blogarithm\b/g, 'log');
  expr = expr.replace(/\bsquare root\b/g, 'sqrt');
  expr = expr.replace(/\bsquare root of\b/g, 'sqrt');
  expr = expr.replace(/\babs(?:olute)?\s*(?:value)?\s*(?:of)?\b/g, 'abs');
  expr = expr.replace(/\bof\b/g, '');
  expr = expr.replace(/\bsquared\b/g, '^2');
  expr = expr.replace(/\bcubed\b/g, '^3');
  expr = expr.replace(/\bto the power of\b/g, '^');
  expr = expr.replace(/\bto the power\b/g, '^');
  expr = expr.replace(/\bpower\b/g, '^');
  expr = expr.replace(/\bplus\b/g, '+');
  expr = expr.replace(/\bminus\b/g, '-');
  expr = expr.replace(/\btimes\b/g, '*');
  expr = expr.replace(/\bdivided by\b/g, '/');
  expr = expr.replace(/\bover\b/g, '/');
  expr = expr.replace(/\bpi\b/g, 'pi');
  expr = expr.replace(/\bequals?\b/g, '=');
  expr = expr.replace(/\bex\b/g, 'x');
  expr = expr.replace(/\bwhy\b/g, 'y');
  expr = expr.replace(/\b(sin|cos|tan|log|sqrt|abs)\s+(\w)/g, '$1($2');
  expr = expr.replace(/\s+/g, ' ').trim();
  if (!expr.includes('=') && expr.includes('x')) {
    expr = 'y = ' + expr;
  }
  return expr;
}

// ======================== App ========================
function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [eyesClosed, setEyesClosed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [functions, setFunctions] = useState([
    { id: 1, expr: 'y = sin(x)', color: COLORS[0], instrument: 'piano' },
    { id: 2, expr: 'y = cos(x)', color: COLORS[1], instrument: 'electric' }
  ]);

  const [is3D, setIs3D] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeFuncId, setActiveFuncId] = useState(1);
  const [volume, setVolume] = useState(80);
  const [plotData, setPlotData] = useState([]);

  // Range
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');

  // Graph walking
  const [isWalking, setIsWalking] = useState(false);
  const [walkX, setWalkX] = useState(0);
  const walkStepSize = 0.2;

  // Playback speed
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Toast
  const [toastText, setToastText] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimeoutRef = useRef(null);

  // Refs
  const progressRef = useRef(0);
  const timeoutRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const functionsRef = useRef(functions);
  const eyesClosedRef = useRef(eyesClosed);
  const walkXRef = useRef(walkX);
  const isWalkingRef = useRef(isWalking);
  const isRecordingRef = useRef(false);

  // Effective range
  const effectiveRange = {
    min: rangeMin !== '' ? parseFloat(rangeMin) : DEFAULT_RANGE.min,
    max: rangeMax !== '' ? parseFloat(rangeMax) : DEFAULT_RANGE.max,
    step: DEFAULT_RANGE.step
  };
  const effectiveRangeRef = useRef(effectiveRange);

  useEffect(() => {
    effectiveRangeRef.current = effectiveRange;
  });

  // ======================== Toast ========================
  function showToast(text) {
    setToastText(text);
    setToastVisible(true);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), 3500);
  }

  function speakButton(text) {
    if (eyesClosedRef.current) {
      speak(text);
    }
    showToast(text);
  }

  // ======================== Loading & Onboarding ========================
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      // First visit onboarding
      const hasVisited = localStorage.getItem('wydey_visited');
      if (!hasVisited) {
        setShowOnboarding(true);
        localStorage.setItem('wydey_visited', 'true');
        // Auto-speak welcome
        setTimeout(() => {
          speak(
            'Welcome to Wydey, the sound-first graphing calculator. ' +
            'Press question mark for keyboard shortcuts, or press the left and right arrow keys to walk along the graph and hear each point. ' +
            'Press D to hear a description of the current graph. ' +
            'Toggle Eyes Closed mode for full voice control.'
          );
        }, 300);
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Sync refs
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { functionsRef.current = functions; }, [functions]);
  useEffect(() => { eyesClosedRef.current = eyesClosed; }, [eyesClosed]);
  useEffect(() => { walkXRef.current = walkX; }, [walkX]);
  useEffect(() => { isWalkingRef.current = isWalking; }, [isWalking]);

  // ======================== Voice ========================
  const handleVoiceResult = useCallback((transcript) => {
    const parsed = parseSpokenExpression(transcript);
    showToast(`Heard: "${transcript}" → ${parsed}`);
    if (eyesClosedRef.current) speak(`Plotting: ${parsed}`);

    const activeFunc = functionsRef.current.find(f => f.id === activeFuncId);
    if (activeFunc) {
      setFunctions(prev => prev.map(f =>
        f.id === activeFuncId ? { ...f, expr: parsed } : f
      ));
    } else {
      const nextId = functionsRef.current.length > 0
        ? Math.max(...functionsRef.current.map(f => f.id)) + 1 : 1;
      setFunctions(prev => [...prev, {
        id: nextId, expr: parsed,
        color: COLORS[prev.length % COLORS.length], instrument: 'piano'
      }]);
    }
  }, [activeFuncId]);

  const { isListening, startListening, stopListening } = useVoiceRecognition(handleVoiceResult);

  // ======================== Plot Data ========================
  useEffect(() => {
    try {
      const rMin = effectiveRange.min;
      const rMax = effectiveRange.max;
      const rStep = effectiveRange.step;

      if (is3D) {
        const newPlotData = functions.map(f => {
          let rhs = f.expr;
          if (f.expr.includes('=')) rhs = f.expr.split('=')[1].trim();
          const xValues = [], yValues = [], zValues = [];
          for (let x = rMin; x <= rMax; x += 1) xValues.push(x);
          for (let y = rMin; y <= rMax; y += 1) yValues.push(y);
          for (let y = rMin; y <= rMax; y += 1) {
            const zRow = [];
            for (let x = rMin; x <= rMax; x += 1) {
              try {
                const val = evaluate(rhs, { x, y, z: 0 });
                zRow.push(Number.isFinite(val) ? val : null);
              } catch { zRow.push(null); }
            }
            zValues.push(zRow);
          }
          return {
            x: xValues, y: yValues, z: zValues,
            type: 'surface', name: f.expr,
            colorscale: [[0, '#000000'], [1, f.color]],
            showscale: false, opacity: 0.85
          };
        });
        setPlotData(newPlotData);
      } else {
        const tValues = [];
        for (let t = rMin; t <= rMax; t += rStep) tValues.push(t);

        const newPlotData = functions.map(f => {
          let lhs = 'y', rhs = f.expr;
          if (f.expr.includes('=')) {
            const parts = f.expr.split('=');
            lhs = parts[0].trim().toLowerCase();
            rhs = parts[1].trim();
          }
          let xVals = [], yVals = [];
          if (lhs === 'x') {
            yVals = tValues;
            xVals = tValues.map(val => {
              try {
                const v = evaluate(rhs, { y: val });
                return Number.isFinite(v) ? v : null;
              } catch { return null; }
            });
          } else {
            xVals = tValues;
            yVals = tValues.map(val => {
              try {
                const v = evaluate(rhs, { x: val });
                return Number.isFinite(v) ? v : null;
              } catch { return null; }
            });
          }
          return {
            x: xVals, y: yVals,
            type: 'scatter', mode: 'lines',
            name: f.expr, line: { color: f.color, width: 3 }
          };
        });
        setPlotData(newPlotData);
      }
    } catch (err) {
      console.error("Plot generation error", err);
    }
  }, [functions, is3D, rangeMin, rangeMax]);

  // ======================== Audio Setup ========================
  useEffect(() => { engine.setupTracks(functions); }, [functions]);
  useEffect(() => { engine.setVolume(volume); }, [volume]);

  // ======================== Graph Walking ========================
  function walkToPoint(newX) {
    const r = effectiveRangeRef.current;
    const clamped = Math.max(r.min, Math.min(r.max, newX));
    setWalkX(clamped);

    const activeFunc = functionsRef.current.find(f => f.id === activeFuncId);
    if (!activeFunc) return;

    const rhs = getRHS(activeFunc.expr);
    const y = evalAt(activeFunc.expr, clamped);

    if (y !== null && isFinite(y)) {
      // Play the note at this point
      engine.playPoint(y, clamped, r.min, r.max, activeFunc.id, "8n");

      // Classify the point and play landmark sound
      const pointType = classifyPoint(rhs, clamped, walkStepSize);
      if (pointType !== 'regular') {
        setTimeout(() => engine.playLandmark(pointType), 150);
      }

      // Speak coordinates
      const xRounded = Math.round(clamped * 100) / 100;
      const yRounded = Math.round(y * 100) / 100;
      let announcement = `x ${xRounded}, y ${yRounded}`;

      if (pointType === 'zero') announcement += '. Zero crossing.';
      else if (pointType === 'maximum') announcement += '. Local maximum.';
      else if (pointType === 'minimum') announcement += '. Local minimum.';
      else if (pointType === 'inflection') announcement += '. Inflection point.';
      else if (pointType === 'asymptote') announcement += '. Near asymptote.';

      if (eyesClosedRef.current) {
        speak(announcement);
      }
      showToast(announcement);
    } else {
      if (eyesClosedRef.current) speak('Undefined at this point.');
      showToast('Undefined at this point');
      engine.playAsymptote();
    }
  }

  // ======================== Describe Graph ========================
  function handleDescribeGraph() {
    const activeFunc = functionsRef.current.find(f => f.id === activeFuncId);
    if (!activeFunc) {
      speakButton('No function selected.');
      return;
    }
    const r = effectiveRangeRef.current;
    const description = describeGraph(activeFunc.expr, r.min, r.max);
    speak(description);
    showToast(description);
  }

  // ======================== Keyboard Shortcuts ========================
  useEffect(() => {
    function handleKeyDown(e) {
      // Don't capture when typing in an input
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key;

      switch (key) {
        case ' ':
          e.preventDefault();
          if (!isPlayingRef.current && !engine.isInitialized) {
            engine.init().then(() => setIsPlaying(true));
          } else {
            setIsPlaying(prev => !prev);
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (!isWalkingRef.current) {
            setIsWalking(true);
            engine.init();
          }
          {
            const step = e.shiftKey ? walkStepSize * 5 : walkStepSize;
            const newX = walkXRef.current - step;
            walkToPoint(newX);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (!isWalkingRef.current) {
            setIsWalking(true);
            engine.init();
          }
          {
            const step = e.shiftKey ? walkStepSize * 5 : walkStepSize;
            const newX = walkXRef.current + step;
            walkToPoint(newX);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          setActiveFuncId(prev => {
            const fns = functionsRef.current;
            const idx = fns.findIndex(f => f.id === prev);
            const newIdx = (idx - 1 + fns.length) % fns.length;
            const newFunc = fns[newIdx];
            if (eyesClosedRef.current) speak(`Selected: ${newFunc.expr}`);
            showToast(`Selected: ${newFunc.expr}`);
            return newFunc.id;
          });
          break;

        case 'ArrowDown':
          e.preventDefault();
          setActiveFuncId(prev => {
            const fns = functionsRef.current;
            const idx = fns.findIndex(f => f.id === prev);
            const newIdx = (idx + 1) % fns.length;
            const newFunc = fns[newIdx];
            if (eyesClosedRef.current) speak(`Selected: ${newFunc.expr}`);
            showToast(`Selected: ${newFunc.expr}`);
            return newFunc.id;
          });
          break;

        case 'v':
        case 'V':
          if (eyesClosedRef.current) {
            if (isListening) stopListening();
            else startListening();
          }
          break;

        case 'd':
        case 'D':
          handleDescribeGraph();
          break;

        case 'r':
        case 'R':
          {
            const fn = functionsRef.current.find(f => f.id === activeFuncId);
            if (fn) speakButton(`Current function: ${fn.expr}`);
          }
          break;

        case 'i':
        case 'I':
          {
            const fn = functionsRef.current.find(f => f.id === activeFuncId);
            if (fn) speakButton(`Instrument: ${fn.instrument}`);
          }
          break;

        case 'n':
        case 'N':
          addFunction();
          break;

        case '?':
          setShowHelp(prev => !prev);
          break;

        case 'Escape':
          setShowHelp(false);
          setShowOnboarding(false);
          if (isWalkingRef.current) {
            setIsWalking(false);
            speakButton('Stopped walking');
          }
          break;

        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFuncId, isListening]);

  // ======================== Playback Loop ========================
  const compiledFunctionsRef = useRef([]);

  useEffect(() => {
    compiledFunctionsRef.current = functions.map(f => {
      let lhs = 'y', rhs = f.expr;
      if (f.expr.includes('=')) {
        const parts = f.expr.split('=');
        lhs = parts[0].trim().toLowerCase();
        rhs = parts[1].trim();
      }
      try {
        const compiled = compile(rhs);
        return {
          id: f.id,
          lhs,
          rhs, // store for classification
          evaluate: (val) => {
            try {
              const scope = lhs === 'x' ? { y: val } : { x: val };
              const result = compiled.evaluate(scope);
              return typeof result === 'number' && Number.isFinite(result) ? result : NaN;
            } catch {
              return NaN;
            }
          }
        };
      } catch {
        return { id: f.id, lhs, rhs, evaluate: () => NaN };
      }
    });
  }, [functions]);

  useEffect(() => {
    if (isPlaying) {
      engine.init().then(() => {
        engine.startPlayback((time) => {
          // This callback fires tightly on the AudioContext clock (every 0.1s usually)
          // 10 seconds default sweep duration for normal speed
          const tickDelta = 0.1;
          const sweepDuration = 10; 
          progressRef.current += (tickDelta / sweepDuration) * playbackSpeed * 100;
          if (progressRef.current >= 100) {
            progressRef.current = 0;
            if (isRecordingRef.current) {
              // Auto-stop and download at the end of the pass
              setTimeout(async () => {
                setIsPlaying(false);
                isRecordingRef.current = false;
                const url = await engine.stopRecording();
                const a = document.createElement("a");
                a.download = "wydey-graph.webm";
                a.href = url;
                a.click();
                showToast("Audio saved successfully.");
              }, 50);
            }
          }

          // Defer the React UI render to match the exact moment the sound hits
          engine.Tone?.Draw?.schedule?.(() => {
            setProgress(progressRef.current);
          }, time);

          const r = effectiveRangeRef.current;
          const range = r.max - r.min;
          const t = r.min + (range * progressRef.current / 100);

          const yVals = {}, derivVals = {};
          compiledFunctionsRef.current.forEach(cf => {
            const val = cf.evaluate(t);
            if (Number.isFinite(val)) {
              yVals[cf.id] = val;
              // manual derivative estimation
              const valP = cf.evaluate(t + 0.01);
              const valM = cf.evaluate(t - 0.01);
              if (Number.isFinite(valP) && Number.isFinite(valM)) {
                derivVals[cf.id] = (valP - valM) / 0.02;
              }
            }
          });

          // Intersection detection
          const ids = Object.keys(yVals);
          if (ids.length > 1) {
            for (let i = 0; i < ids.length; i++) {
              for (let j = i + 1; j < ids.length; j++) {
                if (Math.abs(yVals[ids[i]] - yVals[ids[j]]) < 0.3) {
                  engine.playIntersection();
                  break;
                }
              }
            }
          }

          compiledFunctionsRef.current.forEach(cf => {
            const pt = classifyPoint(cf.rhs, t, 0.2);
            if (pt !== 'regular') {
               engine.playLandmark(pt);
            }
          });

          // Send exact scheduling target time to trigger
          engine.playFrame(yVals, derivVals, "16n", t, r.min, r.max, time);
        });
      });
    } else {
      engine.stopPlayback();
    }
  }, [isPlaying, playbackSpeed]);

  const handleSaveAudio = async () => {
    if (!engine.isInitialized) await engine.init();
    if (isRecordingRef.current) return;
    
    isRecordingRef.current = true;
    progressRef.current = 0;
    setProgress(0);
    
    engine.startRecording();
    setIsPlaying(true);
    speakButton("Recording audio pass... please wait.");
  };

  // ======================== Function CRUD ========================
  const addFunction = () => {
    const nextId = functions.length > 0 ? Math.max(...functions.map(f => f.id)) + 1 : 1;
    setFunctions([...functions, {
      id: nextId, expr: 'y = x^2',
      color: COLORS[functions.length % COLORS.length], instrument: 'piano'
    }]);
    setActiveFuncId(nextId);
    speakButton('Added new function: y equals x squared');
  };

  const removeFunction = (id) => {
    const func = functions.find(f => f.id === id);
    setFunctions(functions.filter(f => f.id !== id));
    if (func) speakButton(`Removed function: ${func.expr}`);
  };

  const updateFunction = (id, key, value) => {
    setFunctions(functions.map(f => f.id === id ? { ...f, [key]: value } : f));
    if (key === 'instrument' && eyesClosed) {
      speak(`Instrument chosen: ${value}`);
      showToast(`Instrument chosen: ${value}`);
    }
  };

  const handleKeyClick = (key) => {
    if (!activeFuncId) return;
    const func = functions.find(f => f.id === activeFuncId);
    if (!func) return;
    let newExpr = func.expr;
    if (key === 'C') { newExpr = ''; speakButton('Cleared'); }
    else if (key === '⌫') { newExpr = newExpr.slice(0, -1); speakButton('Backspace'); }
    else { newExpr += key; speakButton(key); }
    updateFunction(activeFuncId, 'expr', newExpr);
  };

  const toggleEyesClosed = () => {
    const newVal = !eyesClosed;
    setEyesClosed(newVal);
    if (newVal) {
      speak('Eyes closed mode activated. All buttons will speak. Press left and right arrows to walk the graph. Press D to describe. Press question mark for help.');
    } else {
      window.speechSynthesis.cancel();
      if (isListening) stopListening();
    }
  };

  // ======================== Walking marker for PlotViewer ========================
  const walkingMarkerData = isWalking && !is3D ? (() => {
    const activeFunc = functions.find(f => f.id === activeFuncId);
    if (!activeFunc) return [];
    const y = evalAt(activeFunc.expr, walkX);
    if (y === null || !isFinite(y)) return [];
    return [{
      x: [walkX],
      y: [y],
      type: 'scatter',
      mode: 'markers',
      name: '◉ Walker',
      marker: {
        size: 14,
        color: '#000000',
        symbol: 'circle',
        line: { width: 3, color: '#FFFFFF' }
      },
      showlegend: false
    }];
  })() : [];

  // ======================== Render ========================
  if (isLoading) {
    return (
      <div className="loading-screen" role="status" aria-label="Loading Wydey">
        <div className="logo-large">
          <WydeyLogo size={56} />
          Wydey
        </div>
        <p className="tagline">See Sound · Hear Math</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Eyes Closed Banner */}
      {eyesClosed && (
        <div className="eyes-closed-banner" role="status" aria-live="assertive">
          <span className="pulse-dot" />
          Eyes Closed Mode — Voice &amp; Audio Enabled — Press ? for shortcuts
          <span className="pulse-dot" />
        </div>
      )}

      {/* Header */}
      <header>
        <div className="header-left">
          <div
            className="logo"
            onClick={() => speakButton('Wydey')}
            role="button" aria-label="Wydey home" tabIndex={0}
          >
            <WydeyLogo size={24} /> Wydey
          </div>
          <button
            className={`btn ${is3D ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setIs3D(!is3D);
              speakButton(is3D ? 'Switched to 2D view' : 'Switched to 3D view');
            }}
            aria-label={is3D ? 'Switch to 2D' : 'Switch to 3D'}
          >
            {is3D ? '2D View' : '3D View'}
          </button>
        </div>

        <div className="header-right">
          {/* Walk indicator */}
          {isWalking && !is3D && (
            <div className="walk-indicator" role="status" aria-live="polite">
              <Footprints size={14} />
              Walking: x = {Math.round(walkX * 100) / 100}
            </div>
          )}

          {/* Describe button */}
          <button
            className="btn btn-secondary"
            onClick={handleDescribeGraph}
            aria-label="Describe current graph"
            title="Describe graph (D)"
          >
            <MessageSquare size={16} /> Describe
          </button>

          {/* Voice button (eyes closed only) */}
          {eyesClosed && (
            <button
              className={`btn ${isListening ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                if (isListening) { stopListening(); speakButton('Stopped listening'); }
                else { startListening(); speakButton('Listening. Speak your function.'); }
              }}
              aria-label={isListening ? 'Stop voice' : 'Start voice'}
            >
              <Mic size={16} /> {isListening ? 'Listening...' : 'Speak'}
            </button>
          )}

          {/* Help */}
          <button
            className="btn btn-secondary"
            onClick={() => setShowHelp(!showHelp)}
            aria-label="Toggle keyboard shortcuts help"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle size={16} />
          </button>

          {/* Mode Toggle */}
          <button
            className={`mode-toggle ${eyesClosed ? 'active' : ''}`}
            onClick={toggleEyesClosed}
            aria-label={eyesClosed ? 'Switch to Eyes Open' : 'Switch to Eyes Closed'}
            aria-pressed={eyesClosed}
          >
            {eyesClosed ? <EyeOff size={16} /> : <Eye size={16} />}
            {eyesClosed ? 'Eyes Closed' : 'Eyes Open'}
            <div className="toggle-indicator" />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="main-content">
        <aside className="sidebar" aria-label="Controls sidebar">
          {/* Equations */}
          <div className="panel">
            <div className="panel-title">Equations</div>
            {functions.map(f => (
              <div
                key={f.id}
                className={`func-item ${activeFuncId === f.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveFuncId(f.id);
                  speakButton(`Selected: ${f.expr}`);
                }}
                role="button" aria-label={`Select: ${f.expr}`} tabIndex={0}
              >
                <input 
                  type="color" 
                  className="func-color-input" 
                  value={f.color} 
                  onChange={e => updateFunction(f.id, 'color', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  aria-label={`Choose color for ${f.expr}`}
                />
                <div className="func-details">
                  <input
                    className="func-expr-input"
                    type="text" value={f.expr}
                    onChange={e => updateFunction(f.id, 'expr', e.target.value)}
                    aria-label={`Expression: ${f.expr}`}
                    placeholder="y = ..."
                  />
                  <div className="func-instrument-row">
                    <span className="instrument-emoji" aria-hidden="true">
                      {INSTRUMENT_ICONS[f.instrument] || <Music size={16} />}
                    </span>
                    <select
                      className="instrument-select" value={f.instrument}
                      onChange={e => updateFunction(f.id, 'instrument', e.target.value)}
                      aria-label={`Instrument for ${f.expr}`}
                    >
                      {INSTRUMENTS.map(inst => (
                        <option key={inst} value={inst}>
                          {inst.charAt(0).toUpperCase() + inst.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={e => { e.stopPropagation(); removeFunction(f.id); }}
                  aria-label={`Remove: ${f.expr}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '0.75rem' }}
              onClick={addFunction} aria-label="Add function"
            >
              <Plus size={16} /> Add Function
            </button>
          </div>

          {/* Range */}
          <div className="panel">
            <div className="panel-title">Plot Range</div>
            <div className="range-panel">
              <div className="range-row">
                <span className="range-label">From</span>
                <input className="range-input" type="number" value={rangeMin}
                  onChange={e => setRangeMin(e.target.value)}
                  placeholder={`${DEFAULT_RANGE.min}`} aria-label="Range minimum" />
              </div>
              <div className="range-row">
                <span className="range-label">To</span>
                <input className="range-input" type="number" value={rangeMax}
                  onChange={e => setRangeMax(e.target.value)}
                  placeholder={`${DEFAULT_RANGE.max}`} aria-label="Range maximum" />
              </div>
              <p style={{ fontSize: '0.7rem', color: '#737373', marginTop: '0.25rem' }}>
                Leave empty for default ({DEFAULT_RANGE.min} to {DEFAULT_RANGE.max})
              </p>
            </div>
          </div>

          {/* Keyboard */}
          <div className="panel">
            <div className="panel-title">Calculator</div>
            <div className="keyboard-grid">
              {KEYBOARD_KEYS.map((key, i) => (
                <button key={i}
                  className={`keyboard-btn ${['C', '⌫'].includes(key) ? 'action-btn' : ''}`}
                  onClick={() => handleKeyClick(key)}
                  aria-label={
                    key === 'C' ? 'Clear' : key === '⌫' ? 'Backspace' :
                    key === 'sin(' ? 'Sine' : key === 'cos(' ? 'Cosine' :
                    key === 'tan(' ? 'Tangent' : key === 'log(' ? 'Logarithm' :
                    key === 'abs(' ? 'Absolute value' : key === 'sqrt(' ? 'Square root' : key
                  }
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Playback Speed */}
          <div className="panel">
            <div className="panel-title">Playback Speed</div>
            <div className="speed-controls">
              <button className={`speed-btn ${playbackSpeed === 0.25 ? 'active' : ''}`}
                onClick={() => { setPlaybackSpeed(0.25); speakButton('Speed: quarter'); }}>0.25×</button>
              <button className={`speed-btn ${playbackSpeed === 0.5 ? 'active' : ''}`}
                onClick={() => { setPlaybackSpeed(0.5); speakButton('Speed: half'); }}>0.5×</button>
              <button className={`speed-btn ${playbackSpeed === 1 ? 'active' : ''}`}
                onClick={() => { setPlaybackSpeed(1); speakButton('Speed: normal'); }}>1×</button>
              <button className={`speed-btn ${playbackSpeed === 2 ? 'active' : ''}`}
                onClick={() => { setPlaybackSpeed(2); speakButton('Speed: double'); }}>2×</button>
              <button className={`speed-btn ${playbackSpeed === 4 ? 'active' : ''}`}
                onClick={() => { setPlaybackSpeed(4); speakButton('Speed: four times'); }}>4×</button>
            </div>
          </div>

          {/* Volume */}
          <div className="panel" style={{ marginTop: 'auto' }}>
            <div className="panel-title"><Volume2 size={14} /> Volume</div>
            <div className="volume-panel">
              <input type="range" min="0" max="100" value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                aria-label={`Volume: ${volume}%`} />
              <span className="volume-label">{volume}%</span>
            </div>
          </div>

          {/* Export Audio */}
          <div className="panel" style={{ marginTop: '0.5rem' }}>
            <button 
              className={`btn ${isRecordingRef.current ? 'btn-danger' : 'btn-primary'}`} 
              style={{ width: '100%' }}
              onClick={handleSaveAudio}
              disabled={isRecordingRef.current}
            >
              {isRecordingRef.current ? 'Recording...' : 'Save Audio to Device'}
            </button>
          </div>
        </aside>

        {/* Viewport */}
        <section className="viewport" aria-label="Graph viewport">
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
                  functions={functions}
                  walkX={walkX}
                  isWalking={isWalking}
                  activeFuncId={activeFuncId}
                  progress={progress}
                  isPlaying={isPlaying}
                  rangeMin={effectiveRange.min}
                  rangeMax={effectiveRange.max}
                />
              </>
            )}
          </div>

          {/* Playback Controls */}
          <div className="playback-controls">
            <button className="play-btn"
              onClick={() => {
                if (!isPlaying && !engine.isInitialized) {
                  engine.init().then(() => setIsPlaying(true));
                } else { setIsPlaying(!isPlaying); }
                speakButton(isPlaying ? 'Stopped' : 'Playing');
              }}
              aria-label={isPlaying ? 'Stop' : 'Play'}
            >
              {isPlaying ? <Square size={20} /> : <Play size={20} />}
            </button>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <input type="range" min="0" max="100" value={progress}
                onChange={e => { setProgress(Number(e.target.value)); progressRef.current = Number(e.target.value); }}
                aria-label={`Progress: ${progress}%`} />
            </div>

            {/* Walk controls in playback bar */}
            <div className="walk-controls">
              <button className="walk-btn"
                onClick={() => {
                  if (!isWalking) { setIsWalking(true); engine.init(); }
                  walkToPoint(walkX - walkStepSize);
                }}
                aria-label="Walk left"
                title="Walk left (←)"
              >
                <ChevronLeft size={18} />
              </button>
              <button className="walk-btn"
                onClick={() => {
                  if (!isWalking) { setIsWalking(true); engine.init(); }
                  walkToPoint(walkX + walkStepSize);
                }}
                aria-label="Walk right"
                title="Walk right (→)"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Help Overlay */}
      {showHelp && (
        <div className="overlay-backdrop" onClick={() => setShowHelp(false)}>
          <div className="overlay-panel help-panel" onClick={e => e.stopPropagation()}>
            <div className="overlay-header">
              <h2>Keyboard Shortcuts</h2>
              <button className="btn btn-danger" onClick={() => setShowHelp(false)} aria-label="Close help">
                <X size={18} />
              </button>
            </div>
            <div className="shortcuts-list">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="shortcut-row">
                  <kbd className="shortcut-key">{s.key}</kbd>
                  <span className="shortcut-action">{s.action}</span>
                </div>
              ))}
            </div>
            <div className="help-section">
              <h3>Graph Walking</h3>
              <p>Use <kbd>←</kbd> <kbd>→</kbd> arrow keys to step along the graph and hear each point. At critical points (zeros, maxima, minima), you'll hear distinct audio cues.</p>
            </div>
            <div className="help-section">
              <h3>Eyes Closed Mode</h3>
              <p>Toggle the Eyes Closed button for full voice control. Every button speaks its purpose. Press <kbd>V</kbd> to speak a function, <kbd>D</kbd> to hear a graph description.</p>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Overlay */}
      {showOnboarding && (
        <div className="overlay-backdrop" onClick={() => setShowOnboarding(false)}>
          <div className="overlay-panel onboarding-panel" onClick={e => e.stopPropagation()}>
            <div className="overlay-header">
              <h2>Welcome to Wydey</h2>
              <button className="btn btn-danger" onClick={() => setShowOnboarding(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="onboarding-subtitle">The Sound-First Graphing Calculator</p>

            <div className="onboarding-features">
              <div className="onboarding-feature">
                <div className="feature-icon"><Music size={24} /></div>
                <div>
                  <strong>Hear Your Graphs</strong>
                  <p>Every function plays as music. Press <kbd>Space</kbd> to start.</p>
                </div>
              </div>
              <div className="onboarding-feature">
                <div className="feature-icon"><Footprints size={24} /></div>
                <div>
                  <strong>Walk the Graph</strong>
                  <p>Press <kbd>← →</kbd> to step point-by-point and hear each value.</p>
                </div>
              </div>
              <div className="onboarding-feature">
                <div className="feature-icon"><Bell size={24} /></div>
                <div>
                  <strong>Audio Landmarks</strong>
                  <p>Distinct sounds at zeros, peaks, and valleys help you understand the shape.</p>
                </div>
              </div>
              <div className="onboarding-feature">
                <div className="feature-icon"><Mic size={24} /></div>
                <div>
                  <strong>Voice Input</strong>
                  <p>Enable Eyes Closed mode, then say "sine of x" to plot it.</p>
                </div>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}
              onClick={() => setShowOnboarding(false)}>
              Start Graphing
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`speak-toast ${toastVisible ? 'visible' : ''}`}
        role="status" aria-live="polite">
        {toastText}
      </div>
    </div>
  );
}

export default App;
