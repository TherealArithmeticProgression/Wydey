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

  createInstrument() {
    const synth = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 1 }
    });
    synth.connect(this.masterVolume);
    return synth;
  }

  setupTracks(functions) {
    // Clear old synths
    Object.values(this.synths).forEach(s => s.dispose());
    this.synths = {};

    functions.forEach(func => {
      this.synths[func.id] = this.createInstrument();
    });
  }

  playIntersection() {
    if (!this.isInitialized) return;
    this.intersectionSynth.triggerAttackRelease("C6", "16n");
  }

  playFrame(frameData, duration = "8n") {
    if (!this.isInitialized) return;

    Object.keys(frameData).forEach(id => {
      const { y, frequency } = frameData[id];
      const synth = this.synths[id];

      if (synth && !isNaN(y) && isFinite(y)) {
        if (frequency >= 200 && frequency <= 20000) {
          synth.triggerAttackRelease(frequency, duration);
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
