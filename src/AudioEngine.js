import * as Tone from 'tone';

/**
 * AudioEngine — Redesigned for warmth, clarity, and multi-track separation.
 *
 * Key improvements over the previous version:
 * 1. Master reverb for organic, non-mechanical feel
 * 2. Per-track octave offsets so multiple functions are distinguishable
 * 3. Portamento (pitch glide) for smooth transitions
 * 4. Gentler, more musical landmark sounds
 * 5. Softer envelopes across all instruments
 */

// Octave offsets per track index — keeps functions in separate pitch lanes
const OCTAVE_OFFSETS = [0, 12, -12, 7, -7, 5, -5, 3];

class AudioEngine {
  constructor() {
    this.Tone = Tone;
    this.synths = {};
    this.trackIndex = {};  // maps function id -> track number for octave separation
    this.isInitialized = false;

    // Signal chain: synths -> trackGain -> trackPanner -> masterReverb -> masterVolume -> destination
    this.masterVolume = new Tone.Volume(-10).toDestination();

    // Warm reverb to remove mechanical harshness
    this.masterReverb = new Tone.Reverb({
      decay: 1.8,
      wet: 0.25,
      preDelay: 0.01
    }).connect(this.masterVolume);

    // Soft compressor to glue multi-track audio together
    this.masterCompressor = new Tone.Compressor({
      threshold: -20,
      ratio: 3,
      attack: 0.05,
      release: 0.2
    }).connect(this.masterReverb);

    // === Landmark Synths (gentler, more musical) ===

    // Intersection: soft bell chord
    this.intersectionSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.8, sustain: 0, release: 1.0 },
      volume: -12
    }).connect(this.masterReverb);

    // Zero crossing: gentle "ping" (sine with fast decay)
    this.zeroSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.15 },
      volume: -14
    }).connect(this.masterReverb);

    // Maximum: warm ascending bell (soft FM with low modulation)
    this.maximaSynth = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.03, decay: 0.5, sustain: 0, release: 0.6 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.02, decay: 0.3, sustain: 0, release: 0.3 },
      volume: -10
    }).connect(this.masterReverb);

    // Minimum: soft low hum (gentle triangle wave)
    this.minimaSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.04, decay: 0.4, sustain: 0, release: 0.5 },
      volume: -12
    }).connect(this.masterReverb);

    // Inflection: gentle two-note grace (like a bird chirp)
    this.inflectionSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.15 },
      volume: -14
    }).connect(this.masterReverb);

    // Asymptote: filtered noise sweep (whoosh, not harsh burst)
    this.asymptoteFilter = new Tone.Filter({
      frequency: 2000,
      type: "bandpass",
      Q: 2
    }).connect(this.masterReverb);
    this.asymptoteNoise = new Tone.NoiseSynth({
      noise: { type: "pink" },  // pink noise is softer than white
      envelope: { attack: 0.02, decay: 0.25, sustain: 0, release: 0.1 },
      volume: -18
    }).connect(this.asymptoteFilter);
  }

  async init() {
    if (this.isInitialized) return;
    await Tone.start();
    this.isInitialized = true;
  }

  now() {
    return Tone.now();
  }

  startPlayback(callback) {
    Tone.Transport.cancel();
    this.playbackEventId = Tone.Transport.scheduleRepeat((time) => {
      callback(time);
    }, "0.1"); // Lookahead schedules every 100ms
    Tone.Transport.start();
  }

  stopPlayback() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    this.stop();
  }

  createInstrument(type) {
    let synth;
    switch (type) {
      case 'electric':
        synth = new Tone.FMSynth({
          harmonicity: 1.5,
          modulationIndex: 2,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.08, decay: 0.3, sustain: 0.3, release: 0.8 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 0.5 },
          portamento: 0.05
        });
        break;
      case 'bass':
        synth = new Tone.MonoSynth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.08, decay: 0.3, sustain: 0.5, release: 1.0 },
          filterEnvelope: {
            attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.8,
            baseFrequency: 150, octaves: 2
          },
          portamento: 0.06
        });
        break;
      case 'brass':
        synth = new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.15, decay: 0.3, sustain: 0.7, release: 0.4 },
          filterEnvelope: {
            attack: 0.08, decay: 0.4, sustain: 0.4, release: 0.6,
            baseFrequency: 250, octaves: 3
          },
          portamento: 0.08
        });
        break;
      case 'xylophone':
        synth = new Tone.FMSynth({
          harmonicity: 5.07,
          modulationIndex: 8,
          oscillator: { type: "sine" },
          envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.3 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }
        });
        break;
      case 'organ':
        synth = new Tone.Synth({
          oscillator: {
            type: "fatsine",
            count: 3,
            spread: 15
          },
          envelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.4 },
          portamento: 0.04
        });
        break;
      case 'kalimba':
        synth = new Tone.FMSynth({
          harmonicity: 8,
          modulationIndex: 1.5,
          oscillator: { type: "sine" },
          envelope: { attack: 0.003, decay: 1.5, sustain: 0.05, release: 1.5 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }
        });
        break;
      case 'piano':
        synth = new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.015, decay: 0.6, sustain: 0.2, release: 1.0 },
          portamento: 0.03
        });
        break;
      case 'synth':
      default:
        synth = new Tone.Synth({
          oscillator: { type: "fatsawtooth", count: 2, spread: 20 },
          envelope: { attack: 0.06, decay: 0.25, sustain: 0.4, release: 0.8 },
          portamento: 0.05
        });
        break;
    }

    // Chain: synth -> gain (intensity) -> panner (stereo) -> compressor -> reverb -> master
    const gain = new Tone.Gain(1).connect(this.masterCompressor);
    const panner = new Tone.Panner(0).connect(gain);
    synth.connect(panner);

    return { synth, gain, panner };
  }

  setupTracks(functions) {
    // Dispose old synths
    Object.values(this.synths).forEach(entry => {
      if (entry.synth) entry.synth.dispose();
      if (entry.gain) entry.gain.dispose();
      if (entry.panner) entry.panner.dispose();
    });
    this.synths = {};
    this.trackIndex = {};

    functions.forEach((func, idx) => {
      const { synth, gain, panner } = this.createInstrument(func.instrument);
      this.synths[func.id] = { synth, gain, panner };
      this.trackIndex[func.id] = idx;
    });
  }

  /**
   * Get the octave offset for a given function track.
   * This separates multiple functions into different pitch ranges.
   */
  getOctaveOffset(funcId) {
    const idx = this.trackIndex[funcId] || 0;
    return OCTAVE_OFFSETS[idx % OCTAVE_OFFSETS.length];
  }

  /**
   * Map a y-value to a MIDI note with per-track octave separation.
   */
  yToMidi(y, funcId) {
    const offset = this.getOctaveOffset(funcId);
    // Center at C4 (60), y range [-10, 10] maps to ±12 semitones
    let midiNote = Math.round(60 + offset + y * 1.2);
    return Math.max(36, Math.min(midiNote, 96));
  }

  // === Landmark sounds (musical, gentle) ===

  playZeroCrossing() {
    if (!this.isInitialized) return;
    try { this.zeroSynth.triggerAttackRelease("G5", "32n"); } catch (e) {}
  }

  playMaximum() {
    if (!this.isInitialized) return;
    try {
      // Ascending two-note figure: D5 → A5 (warm, recognizable)
      this.maximaSynth.triggerAttackRelease("D5", "16n");
      setTimeout(() => {
        try { this.maximaSynth.triggerAttackRelease("A5", "16n"); } catch (e) {}
      }, 120);
    } catch (e) {}
  }

  playMinimum() {
    if (!this.isInitialized) return;
    try {
      // Descending: A3 → D3 (inverse of maximum — intuitively "down")
      this.minimaSynth.triggerAttackRelease("A3", "8n");
      setTimeout(() => {
        try { this.minimaSynth.triggerAttackRelease("D3", "8n"); } catch (e) {}
      }, 150);
    } catch (e) {}
  }

  playInflection() {
    if (!this.isInitialized) return;
    try {
      // Quick grace note pair: E5-F5 (subtle, like a turn)
      this.inflectionSynth.triggerAttackRelease("E5", "64n");
      setTimeout(() => {
        try { this.inflectionSynth.triggerAttackRelease("F5", "64n"); } catch (e) {}
      }, 50);
    } catch (e) {}
  }

  playAsymptote() {
    if (!this.isInitialized) return;
    try { this.asymptoteNoise.triggerAttackRelease("8n"); } catch (e) {}
  }

  playIntersection() {
    if (!this.isInitialized) return;
    try {
      // Gentle chord: C5 + E5 (consonant, "meeting" sound)
      this.intersectionSynth.triggerAttackRelease(["C5", "E5"], "8n");
    } catch (e) {}
  }

  playLandmark(type) {
    switch (type) {
      case 'zero': this.playZeroCrossing(); break;
      case 'maximum': this.playMaximum(); break;
      case 'minimum': this.playMinimum(); break;
      case 'inflection': this.playInflection(); break;
      case 'asymptote': this.playAsymptote(); break;
      default: break;
    }
  }

  /**
   * Play a single point for graph walking.
   */
  playPoint(y, x, xMin, xMax, funcId, duration = "8n") {
    if (!this.isInitialized) return;
    const entry = this.synths[funcId];
    if (!entry || !entry.synth || !isFinite(y)) return;

    // Stereo pan
    const pan = ((x - xMin) / (xMax - xMin)) * 2 - 1;
    if (entry.panner) entry.panner.pan.rampTo(Math.max(-1, Math.min(1, pan)), 0.05);

    const midiNote = this.yToMidi(y, funcId);
    const freq = Tone.mtof(midiNote);

    try {
      if (entry.synth.triggerAttackRelease) {
        entry.synth.triggerAttackRelease(freq, duration);
      }
    } catch (e) {}
  }

  /**
   * Play a frame during continuous playback.
   */
  playFrame(yValues, derivativeValues = {}, duration = "8n", x = 0, xMin = -10, xMax = 10, scheduleTime = undefined) {
    if (!this.isInitialized) return;

    Object.keys(yValues).forEach(id => {
      const y = yValues[id];
      const entry = this.synths[id];

      if (entry && entry.synth && !isNaN(y) && isFinite(y)) {
        // Smooth stereo panning
        const pan = ((x - xMin) / (xMax - xMin)) * 2 - 1;
        if (entry.panner) entry.panner.pan.rampTo(Math.max(-1, Math.min(1, pan)), 0.08);

        // Per-track pitch with octave separation
        const midiNote = this.yToMidi(y, id);
        const freq = Tone.mtof(midiNote);

        // Intensity: higher |y| = louder (maxima loud, minima quiet)
        const normalizedY = Math.max(-10, Math.min(10, y)) / 10;  // -1 to 1
        const intensityDb = (normalizedY + 1) / 2 * 16 - 16;      // -16 to 0 dB
        if (entry.gain) {
          entry.gain.gain.rampTo(Math.pow(10, intensityDb / 20), 0.08);
        }

        try {
          if (entry.synth.triggerAttackRelease) {
            entry.synth.triggerAttackRelease(freq, duration, scheduleTime);
          }
        } catch (e) {}
      }
    });
  }

  setVolume(vol) {
    if (vol === 0) {
      this.masterVolume.volume.value = -100;
    } else {
      const db = 20 * Math.log10(vol / 100);
      this.masterVolume.volume.value = db;
    }
  }

  stop() {
    Object.values(this.synths).forEach(entry => {
      const s = entry.synth || entry;
      try {
        if (s.releaseAll) s.releaseAll();
        else if (s.triggerRelease) s.triggerRelease();
      } catch (e) {}
    });
  }
}

export default new AudioEngine();
