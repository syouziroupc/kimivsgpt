"""Authenticated production image-only proof; never log the token."""
import base64, hashlib, io, json, os, secrets, subprocess
from PIL import Image, ImageDraw, ImageFont
BASE="https://kimivsgpt.syouziroupc.workers.dev"
TOKEN=os.environ["SMOKE_OIDC_TOKEN"]
def post(path,payload,auth=True):
    cmd=["curl","--silent","--show-error","--max-time","35","--write-out","\\n%{http_code}","-H","Content-Type: application/json","-H","Accept: application/json, text/event-stream","-H","MCP-Protocol-Version: 2025-03-26"]
    if auth: cmd+=["-H","x-github-oidc: "+TOKEN]
    cmd+=["--data-binary","@-",BASE+path]
    raw=subprocess.run(cmd,input=json.dumps(payload).encode(),stdout=subprocess.PIPE,check=True).stdout.decode()
    body,status=raw.rsplit("\n",1)
    status=int(status)
    if not auth:
        assert status==401,("unauthenticated request did not reach Worker OAuth challenge",path,status,body[:200])
        return
    assert status==200,("authenticated request failed",path,status,body[:300])
    try: return json.loads(body)
    except ValueError:
        return next(x for line in body.splitlines() if line.startswith("data:") for x in [json.loads(line[5:])] if "id" in x)
post("/visual",{},False)
listed=post("/mcp",{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}})
tools={t["name"]:t for t in listed["result"]["tools"]}
assert "review_strategy" in tools
assert tools["review_visual_page"]["_meta"]["openai/fileParams"]==["image"]
code="K"+secrets.token_hex(3).upper()
im=Image.new("RGB",(900,600),"white")
draw=ImageDraw.Draw(im)
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",88)
draw.text((60,80),code,font=font,fill="black")
draw.rectangle((120,260,480,520),fill=(255,0,0))
buf=io.BytesIO(); im.save(buf,format="PNG"); image=buf.getvalue()
digest=hashlib.sha256(image).hexdigest()
payload={"artifact_sha256":digest,"page":1,"page_count":1,"requirements":"画像上部の英数字コードを observed に正確に転記してください。赤い四角形は禁止されています。実際に見える場合は指摘して revise を返してください。","renderer":"synthetic Pillow test","image_base64":base64.b64encode(image).decode()}
result=post("/visual",payload)
assert result["image_sha256"]==digest and result["artifact_sha256"]==digest,result
assert result["coverage"]["complete"] and result["verdict"]=="revise",result
votes=[r["vote"] for r in result["model_reviews"] if r["status"]=="ok"]
assert len(votes)>=2
assert all(code in " ".join(v["observed"]).upper() and v["verdict"]=="revise" for v in votes),(code,votes)
print(json.dumps({"verdict":result["verdict"],"coverage":result["coverage"],"image_only_code_confirmed":True,"models":[r["model"] for r in result["model_reviews"] if r["status"]=="ok"]}))
