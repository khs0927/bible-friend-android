export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function isWav(bytes: Uint8Array): boolean {
  return (
    bytes.length > 44 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 // F
  );
}

/** Wraps 16-bit little-endian PCM in a WAV container. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24_000, channels = 1, bitsPerSample = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  const blockAlign = (channels * bitsPerSample) / 8;
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

/** Duration of a PCM WAV in seconds (0 when the header is not understood). */
export function wavSeconds(wav: Uint8Array): number {
  if (!isWav(wav)) return 0;
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const byteRate = view.getUint32(28, true);
  return byteRate > 0 ? (wav.length - 44) / byteRate : 0;
}
