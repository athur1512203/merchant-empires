import {buildingArtwork} from '../config/gameAssets';

type Props={companyId:number;settlementLevel:1|2;factoryLevel?:1|2|3;color:string;selected:boolean;scale:number};

/** Local origin is the center of the normalized artwork, at a board vertex. */
export function BuildingIcon({companyId,settlementLevel,factoryLevel,color,selected,scale}:Props){
  const asset=buildingArtwork(settlementLevel,factoryLevel,companyId);
  const height=asset.frameHeight,width=asset.frameWidth;
  return <g className="building-icon" transform={`scale(${scale})`}>
    <rect className="building-hit-area" x={-width/2-1} y={-height/2-1} width={width+2} height={height+2} rx="3" fill="transparent" pointerEvents="all"/>
    <svg x={-width/2} y={-height/2} width={width} height={height} viewBox={`${asset.x} ${asset.y} ${asset.width} ${asset.height}`} overflow="hidden" preserveAspectRatio="xMidYMid meet" pointerEvents="none" aria-hidden="true">
      <image href={asset.src} width="256" height="256"/>
    </svg>
    <circle className="company-badge" cx={width/2-4} cy={height/2-4} r="3.5" fill={color} stroke={selected?'#fff':'#f8e3ac'} strokeWidth={selected?2:1} pointerEvents="none"/>
    {selected&&<rect x={-width/2-2} y={-height/2-2} width={width+4} height={height+4} rx="3" fill="none" stroke="#fff2be" strokeWidth="1" pointerEvents="none"/>}
  </g>;
}
