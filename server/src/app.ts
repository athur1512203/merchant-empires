import express,{type ErrorRequestHandler} from 'express';
import {ZodError} from 'zod';
import {ApiError} from './domain';
import {RoomService} from './service';
import {roomCodeSchema} from './validation';
import {allowedOrigins} from './origins';
export function createApp(service:RoomService){
  const app=express();
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    const origin=req.get('origin');
    if(origin&&allowedOrigins().includes(origin)){
      res.setHeader('Access-Control-Allow-Origin',origin);res.vary('Origin');
      res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, Idempotency-Key');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    }
    if(req.method==='OPTIONS'){res.sendStatus(204);return}next();
  });
  app.get('/api/health',(_req,res)=>{res.json({status:'ok'})});
  app.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
  app.use(express.json({limit:'16kb'}));
  const token=(req:express.Request)=>{
    const authorization=req.get('authorization');
    return authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;
  };
  app.post('/api/rooms',async(req,res)=>{res.status(201).json(await service.create(req.body))});
  app.param('roomCode',(req,_res,next,value)=>{try{roomCodeSchema.parse(value);next()}catch(error){next(error)}});
  app.post('/api/rooms/:roomCode/join',async(req,res)=>{res.status(201).json(await service.join(String(req.params.roomCode),req.body))});
  app.get('/api/rooms/:roomCode/availability',async(req,res)=>{res.json(await service.availability(String(req.params.roomCode)))});
  app.get('/api/rooms/:roomCode',async(req,res)=>{res.json(await service.get(String(req.params.roomCode),token(req)))});
  app.get('/api/rooms/:roomCode/state',async(req,res)=>{res.json(await service.get(String(req.params.roomCode),token(req),true))});
  app.post('/api/rooms/:roomCode/start',async(req,res)=>{res.json(await service.execute(String(req.params.roomCode),token(req),req.get('idempotency-key'),req.body,true))});
  app.post('/api/rooms/:roomCode/actions',async(req,res)=>{res.json(await service.execute(String(req.params.roomCode),token(req),req.get('idempotency-key'),req.body))});
  app.use((_req,res)=>{res.status(404).json({error:'NOT_FOUND'})});
  const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
    if(error instanceof ZodError){res.status(400).json({error:'INVALID_REQUEST'});return}
    if(error instanceof ApiError){res.status(error.status).json({error:error.code,message:error.message});return}
    if(error.type==='entity.parse.failed'||error.type==='entity.too.large'){res.status(error.status).json({error:'INVALID_JSON_BODY'});return}
    if(error.code==='P2002'){res.status(409).json({error:'CONFLICT'});return}
    // Never serialize Prisma errors, payloads, tokens, or private state.
    res.status(500).json({error:'INTERNAL_ERROR'});
  };
  app.use(errors);
  return app;
}
