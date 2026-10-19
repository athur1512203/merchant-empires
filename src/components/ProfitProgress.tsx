import {formatGold} from '../i18n/vi';

export function profitProgress(profit:number,target:number|null){
  if(target==null||!Number.isFinite(target)||target<=0)return null;
  return {percent:Math.min(100,Math.max(0,profit/target*100)),remaining:Math.max(target-profit,0)};
}
export function ProfitProgress({profit,target,won=false}:{profit:number;target:number|null;won?:boolean}){
  const progress=profitProgress(profit,target);
  return <section className="profit-progress" aria-label="Lợi nhuận công ty">
    <h2>Lợi nhuận công ty</h2><div className="profit-amount">{formatGold(profit)}</div>
    <div className="profit-target"><span>Mục tiêu</span><b>{progress?formatGold(target!):'Chưa thiết lập'}</b></div>
    {progress&&<><div role="progressbar" aria-label="Tiến độ chiến thắng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="profit-track"><span style={{width:`${progress.percent}%`}}/></div>
    <div className="profit-target"><b>{progress.percent.toLocaleString('vi-VN',{maximumFractionDigits:1})}%</b><span>{won?'Đã chiến thắng':progress.remaining===0?'Đã đạt mục tiêu':`Còn ${formatGold(progress.remaining)}`}</span></div></>}
  </section>;
}
