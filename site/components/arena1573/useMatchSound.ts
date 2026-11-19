import {useCallback,useEffect,useRef,useState} from 'react';
import type {MatchCue} from './matchSoundCues';

/** The contact bank has six onset-aligned, quarter-second recordings. */
export class MatchAudio {
  readonly context=new AudioContext();
  private buffers=new Map<string,AudioBuffer>();
  private fetching=new Set<string>();
  private voices=new Set<AudioBufferSourceNode>();
  private abort=new AbortController();

  prepare(){
    for(const file of ['court-contacts.wav','point-cheer.mp3']){
      if(this.fetching.has(file)||this.buffers.has(file))continue;
      this.fetching.add(file);
      void fetch('/audio/'+file,{signal:this.abort.signal}).then(r=>{
        if(!r.ok)throw Error('Audio unavailable');
        return r.arrayBuffer();
      }).then(b=>this.context.decodeAudioData(b)).then(b=>{
        if(!this.abort.signal.aborted)this.buffers.set(file,b);
      }).catch(()=>{/* Retry a missing recording on the next interaction. */})
        .finally(()=>this.fetching.delete(file));
    }
  }
  play(cue:MatchCue,volume:number,pan:number){
    const ctx=this.context,cheer=cue.sample==='cheer';
    const buffer=this.buffers.get(cheer?'point-cheer.mp3':'court-contacts.wav');
    if(!buffer||ctx.state!=='running'||document.hidden)return;
    const source=ctx.createBufferSource(),level=ctx.createGain(),stereo=ctx.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=cue.rate;
    stereo.pan.value=pan;
    const start=ctx.currentTime,gain=volume*cue.gain;
    level.gain.value=gain;
    if(cheer){
      level.gain.setValueAtTime(0,start);
      level.gain.linearRampToValueAtTime(gain,start+.14);
      level.gain.setValueAtTime(gain,start+1.6);
      level.gain.linearRampToValueAtTime(0,start+2.6);
    }
    source.connect(level).connect(stereo).connect(ctx.destination);
    this.voices.add(source);
    source.onended=()=>{
      this.voices.delete(source);source.disconnect();level.disconnect();stereo.disconnect();
    };
    if(cue.sample==='cheer'){source.start();source.stop(start+2.6);}
    else source.start(start,cue.sample*.25,.25);
  }
  stop(){for(const source of this.voices)source.stop();}
  dispose(){this.abort.abort();this.stop();void this.context.close().catch(()=>{});}
}

export function useMatchSound(){
  const output=useRef<MatchAudio|null>(null),muted=useRef(false);
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{
    try{muted.current=localStorage.getItem('1573-arena-match-sound')==='off';}catch{/* Optional storage. */}
    const hide=()=>{if(document.hidden)output.current?.stop();};
    document.addEventListener('visibilitychange',hide);
    return ()=>{
      document.removeEventListener('visibilitychange',hide);
      const audio=output.current;output.current=null;
      if(audio){audio.context.onstatechange=null;audio.dispose();}
    };
  },[]);
  const unlock=useCallback(()=>{
    if(muted.current||typeof AudioContext==='undefined')return;
    try{
      const audio=output.current??=new MatchAudio(),ctx=audio.context;
      const sync=()=>setEnabled(output.current===audio&&!muted.current&&ctx.state==='running');
      ctx.onstatechange=sync;
      if(ctx.state!=='running')void ctx.resume().then(sync).catch(sync);
      else sync();
      audio.prepare();
    }catch{/* Keep the visual match available when audio output is unavailable. */}
  },[]);
  function toggle(){
    muted.current=enabled;
    try{localStorage.setItem('1573-arena-match-sound',enabled?'off':'on');}catch{/* Optional storage. */}
    if(enabled){output.current?.stop();setEnabled(false);}
    else unlock();
  }
  return {audio:enabled?output.current:null,enabled,unlock,toggle};
}
