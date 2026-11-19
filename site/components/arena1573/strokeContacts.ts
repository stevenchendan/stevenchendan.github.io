export type StrokeKind = 'forehand' | 'volley' | 'backhand-volley' | 'backhand' | 'serve';
export const impactTime = (kind:StrokeKind) => kind==='serve'?1.26:kind==='backhand'?.72:.60;

// Centre of the strung face, in metres from the actor's root on the court.
// These are measured on the deployed skinned rig at each clip’s impact time.
export const STROKE_CONTACT: Record<StrokeKind, readonly [number, number, number]> = {
  forehand: [1.003895, .864854, -.227508],
  backhand: [-.693112, .966457, -.463416],
  serve: [.178397, 2.490058, -.064881],
  volley: [.927518, 1.308905, -.402681],
  'backhand-volley': [-.579022, 1.537381, -.552939],
};
