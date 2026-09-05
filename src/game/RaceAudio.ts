import type { RaceEvent } from './model';

/** Small procedural audio graph: no downloads, timers, or sound when paused. */
export class RaceAudio {
  private context: AudioContext;
  private master: GainNode;
  private engine: OscillatorNode;
  private harmonic: OscillatorNode;
  private engineFilter: BiquadFilterNode;
  private road: AudioBufferSourceNode;
  private roadGain: GainNode;
  private enabled = false;
  private active = false;

  constructor() {
    this.context = new AudioContext();
    const ctx = this.context;
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 230;
    this.engineFilter.Q.value = .65;
    const body = ctx.createGain(); body.gain.value = .09; body.connect(this.engineFilter);
    this.engineFilter.connect(this.master);
    this.engine = ctx.createOscillator(); this.engine.type = 'triangle'; this.engine.frequency.value = 46; this.engine.connect(body); this.engine.start();
    this.harmonic = ctx.createOscillator(); this.harmonic.type = 'sawtooth'; this.harmonic.frequency.value = 92;
    const harmonicGain = ctx.createGain(); harmonicGain.gain.value = .12;
    this.harmonic.connect(harmonicGain).connect(body); this.harmonic.start();
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < samples.length; i++) { last = (last + (Math.random() * 2 - 1) * .04) / 1.025; samples[i] = last * 3; }
    this.road = ctx.createBufferSource(); this.road.buffer = noise; this.road.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 950;
    this.roadGain = ctx.createGain(); this.roadGain.gain.value = .012;
    this.road.connect(filter).connect(this.roadGain).connect(this.master); this.road.start();
  }

  resume() { return this.context.resume().catch(() => {}); }

  setState(enabled: boolean, active: boolean, speed: number, boosting: boolean) {
    this.enabled = enabled; this.active = active;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(enabled && active ? .8 : 0, now, .09);
    // Periodic gear drops avoid a single rising electronic buzz.
    const gearRpm = 43 + (speed % 36) * 1.45;
    this.engine.frequency.setTargetAtTime(gearRpm, now, .12);
    this.harmonic.frequency.setTargetAtTime(gearRpm * 2.01, now, .12);
    this.engineFilter.frequency.setTargetAtTime(boosting ? 430 : 190 + speed * .5, now, .2);
    this.roadGain.gain.setTargetAtTime(boosting ? .065 : .012 + speed * .00014, now, .12);
  }

  play(event: RaceEvent['type']) {
    if (!this.enabled || !this.active || this.context.state !== 'running') return;
    const ctx = this.context, now = ctx.currentTime;
    if (!['start', 'bonus', 'boost', 'crash', 'near'].includes(event)) return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = event === 'crash' ? 'sawtooth' : 'sine';
    const start = event === 'crash' ? 125 : event === 'bonus' ? 720 : event === 'near' ? 1050 : event === 'boost' ? 100 : 520;
    const end = event === 'crash' ? 36 : event === 'boost' ? 330 : start * 1.5;
    const duration = event === 'boost' ? .5 : event === 'crash' ? .19 : .16;
    oscillator.frequency.setValueAtTime(start, now); oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(event === 'crash' ? .065 : .035, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now); oscillator.stop(now + duration + .03);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  close() {
    this.engine.stop(); this.harmonic.stop(); this.road.stop();
    void this.context.close().catch(() => {});
  }
}
