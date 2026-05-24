/**
 * Generates a premium transaction "ding" sound as a base64 data URI.
 * Synthesized on-the-fly — no copyrighted audio files needed.
 *
 * Sound design: ascending frequency sweep (800Hz -> 1600Hz)
 * with an exponential decay envelope. Sounds like Apple Pay.
 *
 * Returns a `data:audio/wav;base64,...` URI that expo-av can play
 * directly without touching the file system.
 */

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 0.4;

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Premium metallic bell / service-chime synthesis.
 *
 * Apple Pay's sound is a short, clean, metallic "ding" with:
 *  - a very fast attack (~2 ms)
 *  - a clear bell-like fundamental (~950 Hz)
 *  - specific inharmonic overtones (like a real service bell)
 *  - a smooth exponential decay where higher harmonics die faster
 *  - a tiny "shimmer" caused by phase drift between overtones
 */
function generateWavBuffer(): ArrayBuffer {
  const numSamples = Math.floor(SAMPLE_RATE * DURATION_SECONDS);
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // WAV Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);       
  view.setUint16(20, 1, true);        
  view.setUint16(22, 1, true);        
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);       
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const dataView = new DataView(buffer, 44);

  // Clean, high-frequency digital tones. Pure octaves keep it from sounding sour or dirty.
  const PARTIALS = [
    { ratio: 1.0, amp: 0.60 }, // Crisp high fundamental
    { ratio: 2.0, amp: 0.35 }, // Upper octave sheen
    { ratio: 3.0, amp: 0.05 }  // Subtle air
  ];

  // Base frequencies moved way up out of the "muddy" zone into the crystal treble zone.
  const baseFreq = 1150; 
  const targetFreq = 1350;

  // Track phase accurately sample-by-sample to completely eliminate clicks or distortion
  let phase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // --- 1. THE ICONIC DOUBLE-PING ENVELOPE ---
    // Apple Pay has two distinct notes overlapping very rapidly:
    // Ping A (The rapid introductory click/pop)
    const envA = Math.exp(-t * 85); 
    
    // Ping B (The main, soaring success chime — delayed by ~32 milliseconds)
    const delayB = 0.032; 
    let envB = 0;
    if (t > delayB) {
      const tB = t - delayB;
      // Ultra-snappy attack (~3ms), smooth exponential fade
      envB = Math.exp(-tB * 14) * (1 - Math.exp(-tB * 300));
    }

    // --- 2. SMOOTH PITCH SWEEP ---
    // The pitch glides upward smoothly over the first 120ms, then stabilizes.
    const sweepProgress = Math.min(t / 0.12, 1.0);
    // Smoothstep interpolation prevents a sudden structural jerk in the sound
    const smoothSweep = sweepProgress * sweepProgress * (3 - 2 * sweepProgress);
    const currentFreq = baseFreq + (targetFreq - baseFreq) * smoothSweep;

    // --- 3. WAVE GENERATION ---
    let toneSample = 0;
    for (const p of PARTIALS) {
      toneSample += Math.sin(phase * p.ratio) * p.amp;
    }

    // Advance phase smoothly matching the current frequency 
    phase += (2 * Math.PI * currentFreq) / SAMPLE_RATE;

    // Combine both pings into the main mix
    // Ping A triggers immediately with a high static ratio, Ping B carries the sweeping tone
    let finalSample = (Math.sin(phase * 1.5) * envA * 0.4) + (toneSample * envB);

    // --- 4. TIGHT MASTER CLEANUP ---
    // Soft limiter prevents clipping while keeping the output exceptionally bright and tight
    finalSample = Math.max(-1, Math.min(1, finalSample * 1.3));
    
    const value = finalSample * 0.90 * 32767;
    dataView.setInt16(i * 2, value, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let cachedUri: string | null = null;

/**
 * Returns a `data:audio/wav;base64,...` URI ready for expo-av.
 * The sound is generated once and cached in memory.
 */
export function ensureSuccessSound(): string {
  if (cachedUri) return cachedUri;

  const wavBuffer = generateWavBuffer();
  const base64 = arrayBufferToBase64(wavBuffer);
  cachedUri = `data:audio/wav;base64,${base64}`;
  return cachedUri;
}
