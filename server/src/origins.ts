export function allowedOrigins(){
  return (process.env.FRONTEND_ORIGIN??(process.env.NODE_ENV==='production'?'':'http://localhost:5173,http://127.0.0.1:5173')).split(',').map(s=>s.trim()).filter(Boolean);
}
