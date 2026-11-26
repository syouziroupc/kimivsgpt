import concurrent.futures, json, os, time, urllib.request
BASE="https://kimivsgpt.syouziroupc.workers.dev/mcp"
TOKEN=os.environ["SMOKE_OIDC_TOKEN"]
def run(i,level,complex_case):
    claim="Release a multi-region financial reporting service despite inconsistent source timestamps, unresolved currency rounding, untested restore, and uncertain access scope."
    packet={"user_request":claim,"proposed_direction":"Approve immediate deployment based on passing unit tests. Ignore reconciliation exceptions and independent recovery tests.","review_level":level,"key_claims":["All tests pass, so production reconciliation must be correct."],"assumptions":["Replication is healthy."],"evidence":["One unit test suite passed; no production restore test exists."],"constraints":["No data loss; preserve auditability."],"uncertainties":["FX rates, stale replicas, backup integrity."]}
    if complex_case:
        packet["user_request"]=("複数地域の取引システムについて、権限管理、整合性、復旧、監査証跡を独立に評価する。"*12)[:700]
        packet["proposed_direction"]=("単体テストが成功したため本番反映する。為替換算、冪等性、復旧手順、認可条件の未確認事項を許容する。"*12)[:700]
        for key,count,cap in [("key_claims",5,240),("assumptions",4,220),("evidence",5,320),("constraints",5,220),("uncertainties",4,220)]:
            packet[key]=[(f"{key} {j}: データ整合性と監査証跡の検証が必要。"*15)[:cap] for j in range(count)]
    payload={"jsonrpc":"2.0","id":i,"method":"tools/call","params":{"name":"review_strategy","arguments":packet}}
    req=urllib.request.Request(BASE,data=json.dumps(payload,ensure_ascii=False).encode(),headers={"x-github-oidc":TOKEN,"Content-Type":"application/json","Accept":"application/json, text/event-stream","MCP-Protocol-Version":"2025-03-26"})
    start=time.monotonic()
    with urllib.request.urlopen(req,timeout=32) as resp: raw=resp.read().decode()
    try: rpc=json.loads(raw)
    except ValueError:
        rpc=next(obj for line in raw.splitlines() if line.startswith("data:") for obj in [json.loads(line[5:])] if obj.get("id")==i)
    assert "error" not in rpc and not rpc["result"].get("isError"),rpc
    result=rpc["result"].get("structuredContent") or json.loads(rpc["result"]["content"][0]["text"])
    elapsed=round(time.monotonic()-start,2)
    coverage=result.get("coverage",{})
    print(json.dumps({"id":i,"level":level,"complex":complex_case,"seconds":elapsed,"coverage":coverage,"verdict":result["verdict"],"members":[{"model":x["model"],"status":x["status"],"error":x.get("error")} for x in result.get("model_reviews",[])]}),flush=True)
    assert elapsed<30,(i,elapsed)
    assert coverage.get("complete"),(i,coverage)
    assert coverage["frontier"]>=1 and coverage["economy"]>=3
    assert result["verdict"]!="proceed",result
for i,level,complex_case in [(1,"standard",False),(2,"deep",True),(3,"standard",True)]:
    run(i,level,complex_case)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
    futures=[ex.submit(run,i,"deep",True) for i in (4,5)]
    for f in futures:f.result()
