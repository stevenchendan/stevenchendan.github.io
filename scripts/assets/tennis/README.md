# Court Atlas athlete models

`player-sculpts.blend` contains four editable portraits, their shared anatomical neck, fitted hands and court shoes. The faces and neck share a jawline boundary. The skin colouring follows the facial UVs. The right fingers curl around the racket grip. The packed `public/models/tennis/rally-athlete.glb` contains the skeleton, racket, running cycle and five captured strokes. Each court pairs two portraits and assigns their kits in `athleteKits.ts`.

## Export an edited sculpt

From the repository root, with Blender available on PATH, run these commands. The exporter returns the portraits to their matching bind origins and writes an intermediate GLB under `.astro`.

```sh
blender -b scripts/assets/tennis/player-sculpts.blend --python scripts/sculpt-tennis-players.py -- --export-only .astro/player-portraits.glb
node scripts/pack-rally-athlete.mjs /path/to/Tennis-Agent/frontend
node scripts/pack-court-crew.mjs
node scripts/pack-precinct-motion.mjs
node scripts/check-rally-athlete.mjs
node scripts/check-precinct-rallies.mjs
```

The packer uses the Tennis-Agent frontend's `public/models/tennis/tennis-athlete.glb`, `quaternius-human.glb`, `src/lib/drills/recorded-motion.json` and `src/lib/tennis-motion/rig-bones.json`. The original `public/models/tennis/club-player.glb` in this repository supplies the racket. The crew packer poses the same geometry for the seated chair umpire and the kneeling and standing ball crew.

To regenerate the facial sculpts from their topology, save `makehuman/data/3dobjs/base.obj` as `makehuman-base.obj` in an input folder. Add `caucasian-male-young.target.gz`, `african-male-young.target.gz` and `universal-male-young-maxmuscle-averageweight.target.gz` from MPFB's `macrodetails` directory to the same folder. The input folder must also contain the MakeHuman System Assets complexion `young_lightskinned_male_diffuse.png` or the equivalent `skin-diffuse.jpg` from the Tennis-Agent match athlete. The editable Blender file already contains the baked vertex colours. Run `blender -b --python scripts/sculpt-tennis-players.py -- /path/to/input .astro/player-portraits.glb`. [MakeHuman mesh](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj) · [MPFB shapes](https://github.com/makehumancommunity/mpfb2/tree/master/src/mpfb/data/targets/macrodetails)

The faces and run use CC0 source assets. The motion-captured strokes and their baked playback poses use CC BY-SA 3.0. Sources, authors and adaptations are listed in the [model credits](../../../public/models/tennis/motion-credits.txt).
