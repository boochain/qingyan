const FILES = {
  tap: "/cc/kenney/click_003.wav",
  ok: "/cc/kenney/confirmation_001.wav",
  bad: "/cc/kenney/error_003.wav",
  next: "/cc/kenney/switch_003.wav",
  open: "/cc/kenney/open_001.wav",
  close: "/cc/kenney/close_001.wav",
  combo: "/cc/kenney/pluck_001.wav",
} as const;

export type SfxName = keyof typeof FILES;

const MUTE_KEY = "qingyan-sfx-mute";

let ctx: AudioContext | null = null;
let muted = false;
const buffers = new Map<SfxName, AudioBuffer>();
const loading = new Map<SfxName, Promise<void>>();
let bootstrapped = false;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext({ latencyHint: "interactive" });
  return ctx;
}

export function sfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function loadSfxPref(): void {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    muted = false;
  }
}

async function loadOne(name: SfxName): Promise<void> {
  const audio = context();
  if (!audio || buffers.has(name)) return;
  const pending = loading.get(name);
  if (pending) return pending;
  const task = (async () => {
    const response = await fetch(FILES[name]);
    if (!response.ok) return;
    const data = await response.arrayBuffer();
    const copy = data.slice(0);
    const decoded = await audio.decodeAudioData(copy);
    buffers.set(name, decoded);
  })().catch(() => undefined);
  loading.set(name, task);
  await task;
}

export function preloadSfx(): void {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  loadSfxPref();
  context();
  for (const name of Object.keys(FILES) as SfxName[]) void loadOne(name);
  window.addEventListener("pointerdown", unlockSfx, { capture: true });
  window.addEventListener("keydown", unlockSfx, { capture: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockSfx();
  });
}

/** Call synchronously inside a click or key handler. */
export function unlockSfx(): void {
  const audio = context();
  if (audio && audio.state === "suspended") void audio.resume();
}

export function playSfx(name: SfxName): void {
  if (muted) return;
  const audio = context();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
  const buffer = buffers.get(name);
  if (!buffer) {
    void loadOne(name);
    return;
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const gain = audio.createGain();
  const now = audio.currentTime;
  const volume = name === "bad" ? 0.28 : name === "ok" || name === "combo" ? 0.4 : 0.32;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  source.playbackRate.value = name === "tap" ? 0.96 + Math.random() * 0.08 : 1;
  source.connect(gain);
  gain.connect(audio.destination);
  source.start();
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
}
