import {buildingArtwork} from '../config/gameAssets';

type Props={settlementLevel:1|2;factoryLevel?:1|2|3;color:string;selected:boolean;scale:number};

/** Local origin is the midpoint of the artwork's bottom edge, at a board vertex. */
export function BuildingIcon({settlementLevel,factoryLevel,color,selected,scale}:Props){
  const asset=buildingArtwork(settlementLevel,factoryLevel);
  const height=28,width=height*asset.width/asset.height;
  return <g className="building-icon" transform={`scale(${scale})`}>
    <rect className="building-hit-area" x={-width/2-1} y={-height-1} width={width+2} height={height+5} rx="3" fill="transparent" pointerEvents="all"/>
    <svg x={-width/2} y={-height} width={width} height={height} viewBox={`${asset.x} ${asset.y} ${asset.width} ${asset.height}`} preserveAspectRatio="xMidYMax meet" pointerEvents="none" aria-hidden="true">
      <image href={asset.src} width="256" height="256"/>
    </svg>
    <circle className="company-badge" cy="1" r="3.5" fill={color} stroke={selected?'#fff':'#f8e3ac'} strokeWidth={selected?2:1} pointerEvents="none"/>
    {selected&&<rect x={-width/2-2} y={-height-2} width={width+4} height={height+7} rx="3" fill="none" stroke="#fff2be" strokeWidth="1" pointerEvents="none"/>}
  </g>;
}
