/**
 * The Lantern Room — tiny WebAudio synthesiser.
 *
 * No audio files, no external assets, no network: every sound in the room is
 * generated from oscillators and filtered noise at runtime. Cues are spatialised
 * with a stereo panner plus distance attenuation based on the listener (the
 * player's head) and the source position, which is enough for a table-scale
 * scene while staying cheap enough for 72–90 fps on Quest.
 *
 * Browsers require a user gesture before audio can start, so the engine exposes
 * `unlock()`, which the room calls from the first pointer/keyboard interaction
 * or when an XR session begins.
 */

export type CueKind =
  | 'chime'
  | 'click'
  | 'thunk'
  | 'error'
  | 'success'
  | 'finale'
  | 'assist';

export interface CueOptions {
  /** World position of the source, used for pan + attenuation. */
  x?: number;
  y?: number;
  z?: number;
  /** Base frequency override in Hz. */
  frequency?: number;
  /** Linear volume multiplier (0–1.5). */
  gain?: number;
}

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

const MAX_DISTANCE = 6;

export class AudioEngine {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private padGain: GainNode | undefined;
  private padStarted = false;
  private lastPadFilter: BiquadFilterNode | undefined;
  private muted = false;
  private readonly listener: Vec3Like = { x: 0, y: 1.25, z: 0 };

  /** True once an AudioContext exists and is running. */
  get ready(): boolean {
    return this.context?.state === 'running';
  }

  /** Create/resume the AudioContext. Safe to call repeatedly. */
  unlock(): void {
    if (this.muted) {
      return;
    }
    const context = this.ensureContext();
    if (context == null) {
      return;
    }
    if (context.state === 'suspended') {
      void context.resume();
    }
    this.startPad();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master != null) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Update the listener position from the player head each frame. */
  updateListener(x: number, y: number, z: number): void {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.z = z;
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context != null) {
      return this.context;
    }
    const AudioContextCtor =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (AudioContextCtor == null) {
      return undefined;
    }
    try {
      const context = new AudioContextCtor({ latencyHint: 'interactive' });
      const master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      this.context = context;
      this.master = master;
      return context;
    } catch {
      return undefined;
    }
  }

  /** A slow, warm drone that swells as the lantern wakes. */
  private startPad(): void {
    if (this.padStarted || this.context == null || this.master == null) {
      return;
    }
    const context = this.context;
    const pad = context.createGain();
    pad.gain.value = 0.0001;
    pad.connect(this.master);
    this.padGain = pad;
    this.padStarted = true;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.6;
    filter.connect(pad);

    const frequencies = [55, 82.5, 110, 164.8];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      const voice = context.createGain();
      voice.gain.value = 0.09 / (index + 1);
      // Slow detune drift keeps the pad from sounding static.
      const lfo = context.createOscillator();
      lfo.frequency.value = 0.03 + index * 0.017;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 1.5 + index;
      lfo.connect(lfoGain).connect(oscillator.detune);
      oscillator.connect(voice).connect(filter);
      oscillator.start();
      lfo.start();
    });

    this.lastPadFilter = filter;
    const now = context.currentTime;
    pad.gain.setValueAtTime(0.0001, now);
    pad.gain.exponentialRampToValueAtTime(0.16, now + 6);
  }

  /** Raise the pad with puzzle progress (0–1). */
  setProgress(progress: number): void {
    if (this.context == null || this.padGain == null) {
      return;
    }
    const target = 0.12 + progress * 0.2;
    const now = this.context.currentTime;
    this.padGain.gain.cancelScheduledValues(now);
    this.padGain.gain.setTargetAtTime(target, now, 0.8);
    this.padGain.gain.value = target;
    // Open the pad filter as the lantern brightens.
    const filterFrequency = 420 + progress * 820;
    if (this.lastPadFilter != null) {
      this.lastPadFilter.frequency.setTargetAtTime(filterFrequency, now, 0.9);
    }
  }

  /** Play one of the room's synthesised cues. */
  play(kind: CueKind, options: CueOptions = {}): void {
    const context = this.ensureContext();
    if (context == null || this.master == null || this.muted) {
      return;
    }
    if (context.state === 'suspended') {
      void context.resume();
    }
    const gain = options.gain ?? 1;
    const panner = context.createStereoPanner();
    panner.pan.value = this.panFor(options);
    const envelope = context.createGain();
    envelope.gain.value = 0;
    panner.connect(envelope).connect(this.master);
    const level = gain * this.attenuationFor(options);
    const now = context.currentTime;

    switch (kind) {
      case 'chime': {
        const frequency = options.frequency ?? 880;
        this.bell(context, panner, now, frequency, level, 2.4);
        break;
      }
      case 'success': {
        const root = options.frequency ?? 523.25;
        [0, 4, 7, 12].forEach((semitones, index) => {
          const frequency = root * Math.pow(2, semitones / 12);
          this.bell(context, panner, now + index * 0.085, frequency, level * 0.7, 2.8);
        });
        break;
      }
      case 'finale': {
        const root = options.frequency ?? 392;
        [0, 7, 12, 16, 19, 24].forEach((semitones, index) => {
          const frequency = root * Math.pow(2, semitones / 12);
          this.bell(context, panner, now + index * 0.12, frequency, level * 0.6, 4.5);
        });
        this.shimmer(context, panner, now, level);
        break;
      }
      case 'click': {
        this.noiseBurst(context, panner, now, 900, level * 0.5, 0.05);
        break;
      }
      case 'thunk': {
        this.noiseBurst(context, panner, now, 220, level * 0.8, 0.22);
        this.bell(context, panner, now, 96, level * 0.6, 0.5);
        break;
      }
      case 'error': {
        this.bell(context, panner, now, 164.8, level * 0.5, 0.35);
        this.bell(context, panner, now + 0.09, 146.8, level * 0.45, 0.4);
        break;
      }
      case 'assist': {
        this.bell(context, panner, now, 1046.5, level * 0.5, 1.2);
        break;
      }
    }
  }

  private panFor(options: CueOptions): number {
    const x = options.x ?? this.listener.x;
    const dx = x - this.listener.x;
    return Math.max(-1, Math.min(1, dx / 1.4));
  }

  private attenuationFor(options: CueOptions): number {
    if (options.x == null && options.y == null && options.z == null) {
      return 1;
    }
    const dx = (options.x ?? 0) - this.listener.x;
    const dy = (options.y ?? 0) - this.listener.y;
    const dz = (options.z ?? 0) - this.listener.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.max(0.25, 1 / (1 + distance / MAX_DISTANCE));
  }

  private bell(
    context: AudioContext,
    destination: AudioNode,
    start: number,
    frequency: number,
    level: number,
    duration: number,
  ): void {
    const partials = [
      { ratio: 1, amount: 1 },
      { ratio: 2.01, amount: 0.35 },
      { ratio: 3.02, amount: 0.16 },
    ];
    for (const partial of partials) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * partial.ratio;
      const gain = context.createGain();
      const peak = Math.max(0.0001, level * 0.22 * partial.amount);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    }
  }

  private noiseBurst(
    context: AudioContext,
    destination: AudioNode,
    start: number,
    cutoff: number,
    level: number,
    duration: number,
  ): void {
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const decay = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * decay * decay;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.value = level * 0.6;
    source.connect(filter).connect(gain).connect(destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  private shimmer(
    context: AudioContext,
    destination: AudioNode,
    start: number,
    level: number,
  ): void {
    for (let index = 0; index < 10; index += 1) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 1200 + index * 180;
      const gain = context.createGain();
      const offset = start + index * 0.07;
      gain.gain.setValueAtTime(0.0001, offset);
      gain.gain.exponentialRampToValueAtTime(level * 0.05, offset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, offset + 1.4);
      oscillator.connect(gain).connect(destination);
      oscillator.start(offset);
      oscillator.stop(offset + 1.5);
    }
  }
}
