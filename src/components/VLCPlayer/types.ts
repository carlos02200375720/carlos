export type VLCAspectRatio = 'fit' | 'fill' | '16:9' | '4:3' | 'original';

export type VLCEqualizerPreset = 'flat' | 'bass_boost' | 'vocal' | 'rock' | 'pop' | 'club' | 'movie';

export interface VLCAudioSettings {
  volume: number; // 0 to 200 (100 is normal, 101-200 is VLC Audio Boost)
  isMuted: boolean;
  equalizerPreset: VLCEqualizerPreset;
  audioDelayMs: number;
}

export interface HLSQualityLevel {
  id: number; // -1 for auto
  label: string;
  height: number;
  bitrate: number;
}

export interface HLSStreamStats {
  isHLS: boolean;
  currentQuality: string;
  bitrateKbps: number;
  bufferLengthSec: number;
  droppedFrames: number;
  cdnStatus: 'active' | 'direct' | 'cached';
  autoLevel: boolean;
}

export interface VLCPlaybackSettings {
  playbackRate: number; // 0.25 to 2.0
  aspectRatio: VLCAspectRatio;
  hardwareAcceleration: boolean;
  brightness: number; // 0 to 100 (50 is default)
  sleepTimerMinutes: number | null; // null = off
  isLocked: boolean;
  showOSD: boolean;
  hlsQualityLevel?: number; // -1 = Auto, 0, 1, 2, ...
}

export interface VLCGestureState {
  type: 'volume' | 'brightness' | 'seek' | null;
  value: number; // percentage or seconds
  secondaryValue?: number; // delta / reference
  displayLabel?: string;
  subLabel?: string;
}
