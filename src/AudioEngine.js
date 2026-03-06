import * as Tone from 'tone';

class AudioEngine {
  constructor() {
    this.synths = {};
    this.masterVolume = new Tone.Volume(-10).toDestination();
    this.isInitialized = false;

    // A specific high-pitched ping for intersections
    this.intersectionSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.3 }
    }).connect(this.masterVolume);
  }

  async init() {
    if (this.isInitialized) return;
    await Tone.start();
    this.isInitialized = true;
  }

  createInstrument(type) {
    let synth;
    switch (type) {
      case 'piano':
        synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 1.5 }
        });
        break;
      case 'violin':
        synth = new Tone.Synth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.8, decay: 0.3, sustain: 0.8, release: 1.5 }
        });
        // add vibrato
        const vibrato = new Tone.Vibrato(5, 0.1).connect(this.masterVolume);
        synth.connect(vibrato);
        return synth;
      case 'flute':
        synth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.9, release: 0.5 }
        });
        break;
      case 'marimba':
        synth = new Tone.FMSynth({
          harmonicity: 3.01,
          modulationIndex: 14,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }
        });
        break;
      case 'guitar':
        synth = new Tone.PluckSynth({
          attackNoise: 1,
          dampening: 4000,
          resonance: 0.98
        });
        break;
      case 'cello':
        synth = new Tone.Synth({
          oscillator: { type: 'pwm', modulationFrequency: 0.2 },
          envelope: { attack: 0.5, decay: 0.1, sustain: 0.8, release: 2 }
        });
        const celloVibrato = new Tone.Vibrato(4, 0.05).connect(this.masterVolume);
        synth.connect(celloVibrato);
        return synth;
      case 'synth':
      default:
        synth = new Tone.Synth({
          oscillator: { type: 'square' },
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 1 }
        });
        break;
    }
    synth.connect(this.masterVolume);
    return synth;
  }

  setupTracks(functions) {
    // Clear old synths
    Object.values(this.synths).forEach(s => s.dispose());
    this.synths = {};

    functions.forEach(func => {
      this.synths[func.id] = this.createInstrument(func.instrument);
    });
  }

  playIntersection() {
    if (!this.isInitialized) return;
    this.intersectionSynth.triggerAttackRelease("C6", "16n");
  }

  // Play a combination of notes based on the current Y values of functions
  // We'll map Y values to frequencies or MIDI notes.
  // Typical range: Y=-10 to 10 -> map to MIDI note 48 (C3) to 84 (C6)
  playFrame(yValues, duration = "8n") {
    if (!this.isInitialized) return;

    Object.keys(yValues).forEach(id => {
      const y = yValues[id];
      const synth = this.synths[id];

      if (synth && !isNaN(y) && isFinite(y)) {
        // Map Y to a musical note (e.g. C major pentatonic, or just chromatic)
        // Let's do a simple mapping: center is C4 (60)
        // Y range [-10, 10] -> Note diff [-20, 20]
        let midiNote = Math.round(60 + y * 2);
        
        // Clamp to avoid extreme high/lows
        midiNote = Math.max(36, Math.min(midiNote, 96));
        
        const freq = Tone.mtof(midiNote);
        
        // Trigger purely if the attack is short, or continuous for strings
        // For simplicity we just trigger attack release
        if (synth instanceof Tone.PolySynth) {
          synth.triggerAttackRelease(freq, duration);
        } else {
          synth.triggerAttackRelease(freq, duration);
        }
      }
    });
  }

  setVolume(vol) {
    // map 0-100 to decibels (-60 to 0)
    if (vol === 0) {
      this.masterVolume.volume.value = -100;
    } else {
      const db = 20 * Math.log10(vol / 100);
      this.masterVolume.volume.value = db;
    }
  }

  stop() {
    Object.values(this.synths).forEach(s => {
      if (s.releaseAll) s.releaseAll();
      else s.triggerRelease();
    });
  }
}

export default new AudioEngine();
