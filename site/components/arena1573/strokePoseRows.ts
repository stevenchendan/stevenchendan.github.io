import {impactTime,type StrokeKind} from './strokeContacts';

export const strokeOrder:StrokeKind[]=['forehand','backhand','volley','backhand-volley','serve'];
export const samplesPerStroke=98;
export const gaitSamples=32;
export const extraPoseRows=strokeOrder.length*samplesPerStroke+gaitSamples+1;

export function matchPoseRow(actor:{kind:StrokeKind;relativeTime:number;pace:number;vx:number;vz:number;travel:number},base:number){
  const t=impactTime(actor.kind)+actor.relativeTime*actor.pace;
  const duration=impactTime(actor.kind)+.64;
  if(t>=0&&t<=duration)return base+strokeOrder.indexOf(actor.kind)*samplesPerStroke+t*50;
  const speed=Math.hypot(actor.vx,actor.vz),gait=base+strokeOrder.length*samplesPerStroke;
  return speed>.6?gait+((actor.travel/1.65%1+1)%1)*(gaitSamples-1):gait+gaitSamples;
}
