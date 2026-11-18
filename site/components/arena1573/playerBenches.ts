// These are changeover benches for the two competitors. The AO25 floor
// drawings show the furniture separately from the red match-assistant arrows.
export const floorPlan='https://officiating.tennis.com.au/pdf/AO/AO25_Seating_player%20toilets_room%20locations_5JAN25.pdf';
const plans:Record<string,[side:number,page:number]>={
  rla:[-1,3],mca:[-1,4],john:[-1,5],kia:[-1,6],'1573':[-1,7],'west-show':[-1,8],
  '5':[-1,9],'6':[1,9],'7':[-1,9],'8':[-1,9],
  '11':[-1,10],'12':[-1,10],'13':[-1,10],
  '14':[-1,12],'15':[1,12],'16':[1,12],'17':[1,12],
};
export function benchLayout(key:string){
  const entry=plans[key];
  return {side:entry?.[0]??-1,source:entry?floorPlan+'#page='+entry[1]:undefined};
}
export const centreSections={rla:'14–15',mca:'15–16',john:'18–19'} as const;
export function benchDescription(key:string,language:'en'|'zh'){
  const {side,source}=benchLayout(key);
  if(!source)return language==='zh'?'模型中的球员休息席为示意位置。此场地的实际摆放尚未核实。':'The player benches on this court are illustrative. Their match-day location is unverified.';
  if(key==='1573')return language==='zh'?'AO25 平面图显示，球员休息席分列裁判椅两侧，与球员入场通道相对。':'The AO25 floor plan places the benches beside the umpire, opposite the player entrance.';
  const direction=side<0?'west':'east',sections=centreSections[key as keyof typeof centreSections];
  if(language==='zh')return 'AO25 平面图中，球员休息席位于'+(side<0?'西':'东')+'侧边线，分列裁判椅两侧。'+(sections?'2027 年座区图中，该侧中部为 '+sections+' 区。':'')+(key==='john'?'更靠近场地的座区是 18A、18B、19A 和 19B。':'');
  return 'The AO25 floor plan places the player benches on the '+direction+' sideline, either side of the umpire.'+(sections?' Sections '+sections+' are near the middle of that side on the 2027 seating plan.':'')+(key==='john'?' Courtside blocks 18A, 18B, 19A and 19B are in front of those sections.':'');
}

