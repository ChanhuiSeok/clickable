// Web Audio API based Arcade Sound Synthesizer

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Quick punchy tap sound
  playClick(pitchMultiplier: number = 1.0) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = Math.min(2400, 320 * pitchMultiplier);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // ignore audio context restrictions
    }
  }

  // Short combo milestone sound
  playCombo() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.04);

        gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.04 + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + index * 0.04);
        osc.stop(ctx.currentTime + index * 0.04 + 0.08);
      });
    } catch {}
  }

  // Countdown beep (3, 2, 1)
  playCountdownBeep(isGo: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isGo ? 'square' : 'sine';
      const freq = isGo ? 880 : 440;
      const duration = isGo ? 0.35 : 0.15;

      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (isGo) {
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  // Finish whistle / horn
  playFinish() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const freqs = [350, 440, 520];
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(freq * 0.8, ctx.currentTime + 0.8);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      });
    } catch {}
  }
}

export const sound = new SoundEngine();
