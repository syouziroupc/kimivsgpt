export type Audit = {
  verdict: "proceed" | "revise" | "verify";
  risk: number;
  issues: {type: string; target: string; correction: string}[];
  verify: string[];
  next_step: string;
  confidence: number;
};
export type PanelReview = {model: string; status: "ok"; audit: Audit} | {model: string; status: "failed"; error: string};
export function aggregatePanel(reviews: PanelReview[], frontierModels: readonly string[]): Audit & {model_reviews: PanelReview[]; coverage:{valid:number;frontier:number;economy:number;complete:boolean}} {
  const good = [...new Map(reviews.filter((r): r is Extract<PanelReview,{status:"ok"}> => r.status === "ok").map(r=>[r.model,r])).values()];
  const frontier = good.filter(r=>frontierModels.includes(r.model)).length;
  const economy = good.length-frontier;
  const coverage = {valid:good.length,frontier,economy,complete:frontier>=1 && economy>=3};
  const votes = good.map(r => r.audit.verdict);
  const missing = !coverage.complete;
  const disagreement = new Set(votes).size > 1;
  const issues: Audit["issues"] = [];
  const verify: string[] = [];
  const seen = new Set<string>();
  const ordered = [...good].sort((a,b)=>b.audit.risk-a.audit.risk);
  // Preserve the strongest warning from each source before adding secondary ones.
  for(let i=0;i<3;i++) for(const r of ordered) {
    const item = r.audit.issues[i];
    if(!item) continue;
    const key = JSON.stringify(item);
    if(!seen.has(key)){seen.add(key);issues.push(item);}
  }
  if(missing || disagreement) {
    verify.push(missing ? "Incomplete panel: "+frontier+" frontier, "+economy+" economy. Require >=1 frontier and >=3 economy." : "Model verdicts disagree. Resolve material differences against independent evidence.");
  }
  for(const r of ordered) for(const v of r.audit.verify) if(!verify.includes(v))verify.push(v);
  const risk = Math.max(missing || disagreement ? 2 : 0,...good.map(r=>r.audit.risk));
  const verdict = votes.includes("revise") ? "revise" : missing || disagreement || votes.includes("verify") || risk>0 || issues.length>0 || verify.length>0 ? "verify" : "proceed";
  const summary = reviews.map(r=>r.model.split("/").pop()+":"+(r.status==="ok"?r.audit.verdict:"failed")).join(" | ");
  // A bounded compatibility score, not a calibrated probability or averaged self-rating.
  const confidence = missing ? 0.1 : disagreement ? 0.25 : verdict==="proceed" ? 0.6 : 0.4;
  return {verdict,risk,issues:issues.slice(0,3),verify:verify.slice(0,2),next_step:summary.slice(0,180),confidence,model_reviews:reviews,coverage};
}
