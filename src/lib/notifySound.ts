/** Short notification beeps for dispatch console (no external asset required). */
let audioCtx: AudioContext | null = null;

export type NotifySoundKind =
  | 'new_booking'
  | 'job_created'
  | 'job_updated'
  | 'job_cancelled'
  | 'driver_online'
  | 'general'
  | 'alert'
  | 'error';

function ensureAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function playTone(freqs: number[], duration = 0.32, volume = 0.15) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  freqs.forEach((f, i) => {
    osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
  });
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration + 0.02);
}

const SOUND_PROFILES: Record<NotifySoundKind, number[]> = {
  new_booking: [880, 1100],
  job_created: [740, 880],
  job_updated: [660, 780],
  job_cancelled: [520, 420],
  driver_online: [600, 720],
  general: [700, 620],
  alert: [980, 820, 980],
  error: [440, 360],
};

export function playNotificationSound(kind: NotifySoundKind = 'general') {
  playTone(SOUND_PROFILES[kind] ?? SOUND_PROFILES.general);
}

/** @deprecated Use playNotificationSound('new_booking') */
export function playNewJobSound() {
  playNotificationSound('new_booking');
}
