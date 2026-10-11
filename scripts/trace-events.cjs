// Chrome emits both complete (X) and begin/end (B/E) slices.
module.exports=function slices(events) {
 const stacks=new Map(),out=[];
 for(const e of events) {
  const key=e.pid+':'+e.tid;const stack=stacks.get(key)||[];stacks.set(key,stack);
  if(e.ph==='B') stack.push(e);
  else if(e.ph==='E') {const b=stack.pop();if(b)out.push({...b,ph:'X',dur:e.ts-b.ts});}
  else if(e.ph==='X')out.push(e);
 }
 return out.map(e=>({...e,name:e.name.endsWith('::RunTask')?'RunTask':e.name}));
};
