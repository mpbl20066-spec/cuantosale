import sys, json
from playwright.sync_api import sync_playwright
BASE='http://localhost:3000'
PAGES=['/app','/tours.html','/transfers.html','/grupo.html','/waitlist.html','/privacidad.html','/terminos.html']
VPS=[(280,560),(320,568),(360,640),(375,667),(390,844),(412,915),(430,932)]
JS='''() => {
 const W=document.documentElement.clientWidth; const out=[];
 const de=document.documentElement;
 const over=de.scrollWidth-W;
 const clipped=(el)=>{for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(/(auto|scroll|hidden|clip)/.test(s.overflowX)&&p.getBoundingClientRect().right<=W+1)return true;}return false;};
 for(const el of document.querySelectorAll('body *')){
  const r=el.getBoundingClientRect(); if(!r.width||!r.height)continue;
  const s=getComputedStyle(el); if(s.visibility==='hidden'||s.display==='none'||s.position==='fixed'&&0)continue;
  if((r.right>W+1||r.left<-1)&&!clipped(el)){out.push((el.tagName+'.'+(el.className&&el.className.baseVal===undefined?el.className:'')).slice(0,70)+' L'+Math.round(r.left)+' R'+Math.round(r.right));}
 }
 return {W,over,els:out.slice(0,12),n:out.length};
}'''
res={}
with sync_playwright() as p:
  b=p.chromium.launch()
  for (w,h) in VPS:
    ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2,is_mobile=True,has_touch=True)
    for path in PAGES:
      pg=ctx.new_page()
      try:
        pg.goto(BASE+path,wait_until='networkidle',timeout=30000)
      except Exception as e:
        print('ERR',w,path,e); pg.close(); continue
      pg.wait_for_timeout(500)
      r=pg.evaluate(JS)
      if r['over']>0 or r['n']:
        print(f'{w}px {path}: overflow={r["over"]} n={r["n"]}'); [print('   ',e) for e in r['els']]
      pg.close()
    ctx.close()
  b.close()
print('done')
