import { VLCEqualizerPreset } from "./types";

class VLCAudioEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNodeMap = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private gainNodeMap = new WeakMap<HTMLMediaElement, GainNode>();
  private lowFilterMap = new WeakMap<HTMLMediaElement, BiquadFilterNode>();
  private midFilterMap = new WeakMap<HTMLMediaElement, BiquadFilterNode>();
  private highFilterMap = new WeakMap<HTMLMediaElement, BiquadFilterNode>();

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        try {
          this.audioCtx = new AudioContextClass();
        } catch {
          // Fallback if audio context cannot be initialized immediately
        }
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public attachElement(videoElement: HTMLMediaElement) {
    if (typeof window === "undefined" || !videoElement) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (!this.sourceNodeMap.has(videoElement)) {
        try {
          const source = ctx.createMediaElementSource(videoElement);
          const gainNode = ctx.createGain();

          // 3-Band Equalizer nodes
          const lowFilter = ctx.createBiquadFilter();
          lowFilter.type = "lowshelf";
          lowFilter.frequency.value = 250;

          const midFilter = ctx.createBiquadFilter();
          midFilter.type = "peaking";
          midFilter.frequency.value = 1500;
          midFilter.Q.value = 1.0;

          const highFilter = ctx.createBiquadFilter();
          highFilter.type = "highshelf";
          highFilter.frequency.value = 4000;

          // Connect pipeline: Source -> LowFilter -> MidFilter -> HighFilter -> GainNode -> Destination
          source.connect(lowFilter);
          lowFilter.connect(midFilter);
          midFilter.connect(highFilter);
          highFilter.connect(gainNode);
          gainNode.connect(ctx.destination);

          this.sourceNodeMap.set(videoElement, source);
          this.gainNodeMap.set(videoElement, gainNode);
          this.lowFilterMap.set(videoElement, lowFilter);
          this.midFilterMap.set(videoElement, midFilter);
          this.highFilterMap.set(videoElement, highFilter);
        } catch {
          // If already connected or cross-origin restricted, let native audio play
        }
      }
    } catch {
      // safe fallback
    }
  }

  public setVolume(videoElement: HTMLMediaElement, volumePercent: number, isMuted: boolean) {
    if (!videoElement) return;

    if (isMuted) {
      videoElement.muted = true;
      const gainNode = this.gainNodeMap.get(videoElement);
      if (gainNode && this.audioCtx) {
        gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
      }
      return;
    }

    videoElement.muted = false;

    // Normal volume range (0 - 100%) uses video.volume directly
    // Audio Boost range (101 - 200%) keeps video.volume at 1.0 and applies GainNode multiplier up to 2.0x
    const normalizedVideoVolume = Math.min(1, Math.max(0, volumePercent / 100));
    videoElement.volume = normalizedVideoVolume;

    const gainMultiplier = volumePercent > 100 ? volumePercent / 100 : 1.0;
    const gainNode = this.gainNodeMap.get(videoElement);
    if (gainNode && this.audioCtx) {
      gainNode.gain.setValueAtTime(gainMultiplier, this.audioCtx.currentTime);
    }
  }

  public setEqualizer(videoElement: HTMLMediaElement, preset: VLCEqualizerPreset) {
    const low = this.lowFilterMap.get(videoElement);
    const mid = this.midFilterMap.get(videoElement);
    const high = this.highFilterMap.get(videoElement);

    if (!low || !mid || !high || !this.audioCtx) return;

    const t = this.audioCtx.currentTime;

    switch (preset) {
      case "bass_boost":
        low.gain.setValueAtTime(7, t);
        mid.gain.setValueAtTime(-1, t);
        high.gain.setValueAtTime(1, t);
        break;
      case "vocal":
        low.gain.setValueAtTime(-2, t);
        mid.gain.setValueAtTime(5, t);
        high.gain.setValueAtTime(2, t);
        break;
      case "rock":
        low.gain.setValueAtTime(4.5, t);
        mid.gain.setValueAtTime(-2, t);
        high.gain.setValueAtTime(4, t);
        break;
      case "pop":
        low.gain.setValueAtTime(2, t);
        mid.gain.setValueAtTime(3, t);
        high.gain.setValueAtTime(3, t);
        break;
      case "club":
        low.gain.setValueAtTime(6, t);
        mid.gain.setValueAtTime(2, t);
        high.gain.setValueAtTime(4, t);
        break;
      case "movie":
        low.gain.setValueAtTime(4, t);
        mid.gain.setValueAtTime(1, t);
        high.gain.setValueAtTime(5, t);
        break;
      case "flat":
      default:
        low.gain.setValueAtTime(0, t);
        mid.gain.setValueAtTime(0, t);
        high.gain.setValueAtTime(0, t);
        break;
    }
  }
}

export const vlcAudioEngine = new VLCAudioEngine();
