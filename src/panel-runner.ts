import type { Audit, PanelReview } from "./panel";

export type Candidate = {model:string; tier:"frontier"|"economy"};
type Options = {
  primary: Candidate[];
  reserve: Candidate[];
  budgetMs: number;
  hedgeMs: number;
  invoke: (model:string) => Promise<Audit>;
  onResult?: (result:PanelReview, elapsedMs:number) => void;
};

export function classifyFailure(error:unknown):string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timeout|deadline|budget_exhausted/i.test(message)) return "timeout";
  if (/5028|deprecated|retired|model not found/i.test(message)) return "model_unavailable";
  if (/429|3040|capacity|busy|5035|allocation|rate.limit/i.test(message)) return "upstream_capacity_or_quota";
  if (/schema|json|parse|unexpected token/i.test(message)) return "invalid_output";
  return "upstream_error";
}

// No dependency on slowest Promise.all member. The two reserves are independent
// families, started early only if their tier is still short. Each model runs once.
export function runPanel(opts:Options):Promise<PanelReview[]> {
  return new Promise(resolve=>{
    const started = Date.now();
    const launched = new Map<string,Candidate>();
    const settled = new Map<string,PanelReview>();
    let done=false;
    let hedge: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const all = [...opts.primary,...opts.reserve];
    const valid = (tier:Candidate["tier"]) => all.filter(c=>c.tier===tier && settled.get(c.model)?.status==="ok").length;
    const covered = () => valid("frontier")>=1 && valid("economy")>=3;
    const needed = (tier:Candidate["tier"]) => valid(tier)<(tier==="frontier"?1:3);
    function finish(reason:string) {
      if(done)return;
      done=true;
      if(hedge!==undefined)clearTimeout(hedge);
      if(deadline!==undefined)clearTimeout(deadline);
      resolve([...launched.keys()].map(model=>settled.get(model) ?? {model,status:"failed" as const,error:reason}));
    }
    function launch(c:Candidate) {
      if(done||launched.has(c.model)||Date.now()-started>=opts.budgetMs)return;
      launched.set(c.model,c);
      const t=Date.now();
      Promise.resolve().then(()=>opts.invoke(c.model)).then(
        audit=>complete(c,{model:c.model,status:"ok",audit},t),
        error=>complete(c,{model:c.model,status:"failed",error:classifyFailure(error)},t),
      );
    }
    function complete(c:Candidate,result:PanelReview,t:number) {
      if(done)return;
      settled.set(c.model,result);
      try{opts.onResult?.(result,Date.now()-t);}catch{/* logging cannot break review */}
      if(covered()){finish("superseded_after_quorum");return;}
      if(result.status==="failed"&&needed(c.tier))for(const r of opts.reserve)if(r.tier===c.tier)launch(r);
      if(settled.size===launched.size){
        for(const r of opts.reserve)if(needed(r.tier))launch(r);
        if(settled.size===launched.size)finish("panel_exhausted");
      }
    }
    deadline=setTimeout(()=>finish("panel_deadline"),Math.max(0,opts.budgetMs));
    for(const c of opts.primary)launch(c);
    hedge=setTimeout(()=>{for(const r of opts.reserve)if(needed(r.tier))launch(r);},Math.min(opts.hedgeMs,opts.budgetMs));
    if(!launched.size)finish("panel_deadline");
  });
}
