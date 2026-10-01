import sys, os
from playwright.sync_api import sync_playwright
tmp=os.environ.get('TEMP','.')
def open_tours(pg):
  pg.goto('http://localhost:3000/app',wait_until='networkidle'); pg.wait_for_timeout(1000)
  pg.fill('#dest-trigger','Ilha Grande'); pg.wait_for_timeout(400)
  pg.locator('#dest-menu [data-dest-value]:visible').first.click(); pg.wait_for_timeout(600)
  pg.click('#dep-trigger'); pg.wait_for_timeout(400)
  days=pg.locator('.date-range-day:visible:not([disabled])')
  days.nth(12).click(); pg.wait_for_timeout(200); days.nth(16).click(); pg.wait_for_timeout(500)
  pg.fill('#bud','3000')
if __name__=='__main__':
  w=int(sys.argv[1])
  with sync_playwright() as p:
    b=p.chromium.launch(); c=b.new_context(viewport={'width':w,'height':780},device_scale_factor=2,is_mobile=True,has_touch=True); pg=c.new_page()
    open_tours(pg)
    print(pg.evaluate("[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>(b.id||b.className)+':'+b.innerText.slice(0,25))"))
    pg.screenshot(path=f'{tmp}/flow_{w}.png')
