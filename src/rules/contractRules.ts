export {generateContract,remainingToDeliver,type ContractStatus,type GameContract} from './economyConfig';
export function isActiveContract(contract:{status:string}){return contract.status==='active'}
