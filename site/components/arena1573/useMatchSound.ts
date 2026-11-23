import {useCallback,useEffect,useRef,useState} from 'react';
import type {MatchCue} from './matchSoundCues';

/** The contact bank has six onset-aligned, quarter-second recordings. */
export class MatchAudio {
  readonly context=new AudioContext();
  private buffer:AudioBuffer|null=null;
  private fetching=false;
  private voices=new Set<AudioBufferSourceNode>();
  private abort=new AbortController();

  prepare(){
    if(this.buffer||this.fetching)return;
    this.fetching=true;
    void fetch('/audio/court-contacts.wav',{signal:this.abort.signal}).then(r=>{
      if(!r.ok)throw Error('Audio unavailable');
      return r.arrayBuffer();
    }).then(b=>this.context.decodeAudioData(b)).then(b=>{
      if(!this.abort.signal.aborted)this.buffer=b;
    }).catch(()=>{/* Retry on the next interaction. */})
      .finally(()=>{this.fetching=false;});
  }
  play(cue:MatchCue,volume:number,pan:number){
    const ctx=this.context,buffer=this.buffer;
    if(!buffer||ctx.state!=='running'||document.hidden)return;
    const source=ctx.createBufferSource(),level=ctx.createGain(),stereo=ctx.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=cue.rate;
    stereo.pan.value=pan;
    const start=ctx.currentTime,gain=volume*cue.gain;
    level.gain.value=gain;
    source.connect(level).connect(stereo).connect(ctx.destination);
    this.voices.add(source);
    source.onended=()=>{
      this.voices.delete(source);source.disconnect();level.disconnect();stereo.disconnect();
    };
    source.start(start,cue.sample*.25,.25);
  }
  stop(){for(const source of this.voices)source.stop();}
  thunder(){
    const ctx=this.context;
    if(ctx.state!=='running'||document.hidden)return ()=>{};
    const duration=5,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate);
    const samples=buffer.getChannelData(0);
    let rumble=0;
    for(let i=0;i<samples.length;i++){
      rumble=(rumble+.035*(Math.random()*2-1))/1.035;
      samples[i]=rumble*9;
    }
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),level=ctx.createGain();
    source.buffer=buffer;filter.type='lowpass';filter.frequency.value=350;
    const start=ctx.currentTime+1.4;
    level.gain.setValueAtTime(0,ctx.currentTime);
    level.gain.setValueAtTime(0,start);
    level.gain.linearRampToValueAtTime(.65,start+.35);
    level.gain.exponentialRampToValueAtTime(.001,start+duration);
    source.connect(filter).connect(level).connect(ctx.destination);
    this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();level.disconnect();};
    source.start(start);source.stop(start+duration);
    return ()=>{if(this.voices.has(source))source.stop();};
  }
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
