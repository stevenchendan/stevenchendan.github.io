import { useEffect, useRef, useState } from 'react';

/** Decode the complete loop before the film clock starts. */
export function useCinemaSound(playing: boolean, onUnavailable: () => void) {
  const context = useRef<AudioContext | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  const loading = useRef(false);
  const offset = useRef(0);
  const [ready, setReady] = useState(false);

  function unlock() {
    if (context.current?.state === 'suspended') void context.current.resume().catch(onUnavailable);
  }
  function prepare() {
    offset.current = 0;
    try {
      const ctx = context.current ??= new AudioContext();
      unlock();
      if (buffer.current || loading.current) return;
      loading.current = true;
      setReady(false);
      void fetch('/audio/cinema-music.mp3').then(response => {
        if (!response.ok) throw new Error('Soundtrack unavailable');
        return response.arrayBuffer();
      }).then(bytes => ctx.decodeAudioData(bytes)).then(decoded => {
        if (context.current === ctx) buffer.current = decoded;
      }).catch(() => { if (context.current === ctx) onUnavailable(); }).finally(() => {
        if (context.current === ctx) { loading.current = false; setReady(true); }
      });
    } catch { setReady(true); onUnavailable(); }
  }
  useEffect(() => {
    const ctx = context.current, loop = buffer.current;
    if (!playing || !ready || !ctx || !loop) return;
    const gain = ctx.createGain();
    gain.gain.value = .4;
    gain.connect(ctx.destination);
    let source: AudioBufferSourceNode | undefined, started = 0;
    function pause() {
      if (!source) return;
      offset.current = (offset.current + ctx!.currentTime - started) % loop!.duration;
      source.stop(); source.disconnect(); source = undefined;
    }
    function sync() {
      if (document.hidden) { pause(); return; }
      if (source) return;
      source = ctx!.createBufferSource(); source.buffer = loop; source.loop = true;
      source.connect(gain); started = ctx!.currentTime; source.start(0, offset.current);
    }
    sync(); document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); pause(); gain.disconnect(); };
  }, [playing, ready]);
  useEffect(() => () => {
    const ctx = context.current; context.current = null;
    if (ctx) void ctx.close().catch(() => {});
  }, []);
  return { ready, prepare, unlock };
}
