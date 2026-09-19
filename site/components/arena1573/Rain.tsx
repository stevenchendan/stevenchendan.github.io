'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';

/** A bounded, camera-following shower. One draw call, no per-frame allocations. */
export default function Rain({ ink }: { ink: boolean }) {
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const shower = useMemo(() => {
    const count = 1100, positions = new Float32Array(count * 6);
    const seeds = new Float32Array(count * 3);
    // Stable distribution avoids a different shower on every React render.
    let random = 7919;
    for (let i = 0; i < seeds.length; i++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      seeds[i] = random / 4294967296;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
    return { count, positions, seeds, geometry, elapsed: 0 };
  }, []);
  useEffect(() => () => shower.geometry.dispose(), [shower]);
  useFrame(({ camera }, delta) => {
    if (!reducedMotion) shower.elapsed += Math.min(delta, .05);
    const span = Math.max(35, camera.position.y * 1.6);
    for (let i = 0; i < shower.count; i++) {
      const seed = i * 3, p = i * 6;
      const phase = (shower.seeds[seed + 1] + shower.elapsed * .32) % 1;
      const x = camera.position.x + (shower.seeds[seed] - .5) * span;
      const y = camera.position.y + (.45 - phase) * span;
      const z = camera.position.z + (shower.seeds[seed + 2] - .5) * span;
      const length = span * .014;
      shower.positions[p] = x;
      shower.positions[p + 1] = Math.max(.15, y);
      shower.positions[p + 2] = z;
      shower.positions[p + 3] = x + (y > .15 ? length * .18 : 0);
      shower.positions[p + 4] = Math.max(.15, y - length);
      shower.positions[p + 5] = z;
    }
    shower.geometry.attributes.position.needsUpdate = true;
  });
  return <lineSegments geometry={shower.geometry} frustumCulled={false}>
    <lineBasicMaterial color={ink ? '#657d86' : '#e3f0f5'} transparent opacity={.42} depthWrite={false} toneMapped={false} />
  </lineSegments>;
}
