import subprocess, pathlib, sys
root=pathlib.Path('.')
def git(*args,input=None):
 r=subprocess.run(['git',*args],input=input,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode: raise RuntimeError(r.stderr.decode())
 return r.stdout
def head(path): return git('show','HEAD:'+path).decode('utf-8').replace('\r\n','\n')
def work(path): return pathlib.Path(path).read_text(encoding='utf-8')
def stage(path,s):
 oid=git('hash-object','-w','--stdin',input=s.encode()).decode().strip()
 git('update-index','--cacheinfo','100644',oid,path)
def commit(message):
 print(git('commit','-m',message).decode())
prefix='site/components/arena1573/'
mode=sys.argv[1]
if mode=='language':
 p=prefix+'ArenaExperience.tsx';s=work(p)
 s=s.replace('useCinemaSound(cinema&&playing,musicUnavailable,ready)','useCinemaSound(cinema&&playing&&ready&&filmPrepared,musicUnavailable)')
 stage(p,s);commit('fix(ao): start each visit in English')
elif mode=='music':
 git('add',prefix+'ArenaExperience.tsx',prefix+'useCinemaSound.ts');commit('fix(cinema): preload music and unlock playback on entry')
elif mode=='storm':
 p=prefix+'ArenaScene.tsx';s=head(p).replace("import Rain from './Rain';","import Rain from './Rain';\nimport Storm from './Storm';")
 line='    {rain&&<Rain ink={ink} roofs={roofs} filmTime={track?.seconds}/>};'
 anchor='    {rain&&<Rain ink={ink} roofs={roofs} filmTime={track?.seconds}/>}'
 assert anchor in s
 s=s.replace(anchor,anchor+'\n    {rain&&<Storm audio={matchAudio} active={!reducedMotion&&(chapter===null||playing)}/>}')
 stage(p,s);git('add',prefix+'Storm.tsx',prefix+'useMatchSound.ts');commit('feat(weather): add distant lightning and delayed thunder')
elif mode=='garden':
 git('add',prefix+'GardenSquare.ts',prefix+'FestivalStructures.ts');commit('fix(landscape): blend Garden Square paving and lawn edges')
elif mode=='bridges':
 p=prefix+'model.ts';s=head(p);w=work(p)
 old="import {forkBridgeId,forkBridgeParts} from './forkBridge';"
 new="import {forkBridgeId,forkBridgeParts,currentForkBridgeRing,tennisBridgeId,tennisBridgeParts} from './forkBridge';"
 assert old in s;s=s.replace(old,new)
 start="    if(building.structureType==='Bridge'){";end="    if(building.name==='Margaret Court Arena')return;"
 s=s[:s.index(start)]+w[w.index(start):w.index(end)]+s[s.index(end):]
 stage(p,s);git('add',prefix+'forkBridge.ts');commit('fix(precinct): repair bridge approaches and remove demolished Kia span')
elif mode=='entries':
 p=prefix+'model.ts';s=work(p);before=head(p)
 s=s.replace("import {pavilionEnvelope} from './RodLaverPavilion';\n",'')
 start="    if(building.id==='812707-1-0'){";end="    if(building.name==='John Cain Arena'){"
 s=s[:s.index(start)]+s[s.index(end):]
 s=s.replace("      if('envMap' in material&&material.envMap instanceof T.Texture)textures.add(material.envMap);\n",'')
 stage(p,s)
 git('add',*[prefix+f for f in ['RodLaverBowl.ts','arenaAccess.ts','bowlAccess.ts','showCourtEnvelope.ts']])
 commit('feat(arenas): model recessed entrances and open seating passages')
elif mode=='pavilion':
 git('add','README.md','public/data/ao-seat-sun-v1.bin','scripts/check-arena-access.mjs',*[prefix+f for f in ['model.ts','RodLaverPavilion.ts','roofs.ts','venueVisibility.ts']])
 commit('feat(rla): rebuild glazed eastern pavilion from ground references')
elif mode=='film':
 git('add','scripts/check-pavilion-film.mjs',*[prefix+f for f in ['ArenaScene.tsx','film.ts','i18n.ts']])
 commit('feat(cinema): add Light on glass pavilion camera sequence')
