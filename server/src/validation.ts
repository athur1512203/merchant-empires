import {z} from 'zod';
const positive=z.number().int().min(1).max(1_000_000);
const vertexId=z.string().min(1).max(100);
const resource=z.enum(['metal','wood','wheat','cotton']);
const product=z.enum(['machinery','rail','furniture','flour','fabric','clothing']);
const simple=(type:'ROLL_DICE'|'END_TURN'|'SKIP_BID')=>z.object({type:z.literal(type)}).strict();
const vertex=(type:'placeSetupSettlement'|'BUILD_SETTLEMENT'|'UPGRADE_SETTLEMENT'|'BUILD_FACTORY'|'UPGRADE_FACTORY')=>z.object({type:z.literal(type),vertexId}).strict();
export const actionSchema=z.discriminatedUnion('type',[
  simple('ROLL_DICE'),simple('END_TURN'),simple('SKIP_BID'),
  vertex('placeSetupSettlement'),vertex('BUILD_SETTLEMENT'),vertex('UPGRADE_SETTLEMENT'),vertex('BUILD_FACTORY'),vertex('UPGRADE_FACTORY'),
  z.object({type:z.literal('BUY_RAW_MATERIAL'),resource,quantity:positive}).strict(),
  z.object({type:z.literal('SELL_RAW_MATERIAL'),resource,quantity:positive}).strict(),
  z.object({type:z.literal('MANUFACTURE_GOODS'),vertexId,product,batches:positive}).strict(),
  z.object({type:z.literal('SUBMIT_BID'),amount:positive}).strict(),
  z.object({type:z.literal('DELIVER_CONTRACT'),contractId:vertexId,quantity:positive}).strict()
]);
export const memberSchema=z.object({displayName:z.string().trim().min(1).max(60),companyId:z.number().int().min(0).max(3)}).strict();
export const actionRequest=z.object({expectedVersion:z.number().int().min(0).max(2_147_483_646),action:actionSchema}).strict();
export const startRequest=z.object({expectedVersion:z.number().int().min(0).max(2_147_483_646),targetProfit:positive}).strict();
export const roomCodeSchema=z.string().regex(/^[A-Z2-9]{8}$/);
export const keySchema=z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/);
