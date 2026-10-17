export type Rng=()=>number;
export function mulberry32(seed:number):Rng{
  let a=seed>>>0;
  return()=>{a+=0x6D2B79F5;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
}
export function shuffleInPlace<T>(items:T[],random:Rng){
  for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}
  return items;
}
