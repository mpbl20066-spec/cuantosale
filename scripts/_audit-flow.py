import sys, os
sys.path.insert(0,os.path.dirname(__file__))
from _flow import open_tours, tmp
from playwright.sync_api import sync_playwright
exec(open(os.path.join(os.path.dirname(__file__),'_audit-mobile.py')).read().split("res={}")[0].split("JS='''")[1].join(["JS='''",""]) if False else "")
JS=open(os.path.join(os.path.dirname(__file__),'_audit-mobile.py'),encoding='utf-8').read().split("JS='''")[1].split("'''")[0]
ws=[int(x) for x in sys.argv[1:]] or [320,360,412]
shots='--shots' in os.environ.get('AUDIT','')
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in ws:
    c=b.new_context(viewport={'width':w,'height':780},device_scale_factor=2,is_mobile=True,has_touch=True,color_scheme='dark'); pg=c.new_page()
    open_tours(pg); pg.locator('.btn-ver-propuesta').first.click(); pg.wait_for_timeout(2500)
    def rep(tag):
      r=pg.evaluate(JS); print(f'{w}px [{tag}] overflow={r["over"]} n={r["n"]}'); [print('    ',e) for e in r['els']]
    for i in range(3):
      pg.locator('.steps__btn').nth(i).click(); pg.wait_for_timeout(1800); rep('paso %d'%(i+1))
      pg.screenshot(path=f'{tmp}/paso{i+1}_{w}.png',full_page=True)
    pg.locator('.steps__btn').nth(2).click(); pg.wait_for_timeout(1200)
    n=pg.locator('.local-tour:visible').count(); print('  tours',n)
    if n:
      pg.locator('.local-tour:visible').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
      pg.screenshot(path=f'{tmp}/tours_{w}.png')
      pg.locator('.local-tour__info:visible').first.click(); pg.wait_for_timeout(500)
      rep('modal tour'); pg.screenshot(path=f'{tmp}/modal_{w}.png'); pg.locator('[data-close-booking]:visible').first.click(); pg.wait_for_timeout(300)
    pg.locator('.steps__btn').nth(3).click(); pg.wait_for_timeout(1500); rep('paso 4 modal'); pg.screenshot(path=f'{tmp}/paso4_{w}.png')
    c.close()
