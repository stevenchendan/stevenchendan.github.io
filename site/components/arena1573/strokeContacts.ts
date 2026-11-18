export type StrokeKind = 'forehand' | 'volley' | 'backhand-volley';

// Centre of the strung face, in metres from the actor's root on the court.
// These are measured on the deployed skinned rig at frame 30 of each clip.
export const STROKE_CONTACT: Record<StrokeKind, readonly [number, number, number]> = {
  forehand: [1.003895, .864854, -.227508],
  volley: [.927518, 1.308905, -.402681],
  'backhand-volley': [-.579022, 1.537381, -.552939],
};
