import sys, os
sys.path.insert(0,os.path.dirname(__file__))
from _flow import open_tours
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
  b=p.chromium.launch(); c=b.new_context(viewport={'width':360,'height':700},device_scale_factor=2,is_mobile=True,has_touch=True); pg=c.new_page()
  errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
  open_tours(pg); pg.locator('.btn-ver-propuesta').first.click(); pg.wait_for_timeout(2000)
  print('hist len',pg.evaluate('history.length'),'vista abierta',pg.evaluate("!document.getElementById('vista-detalle').classList.contains('oculto')"))
  pg.locator('.steps__btn').nth(2).click(); pg.wait_for_timeout(1000)
  pg.locator('.local-tour__info:visible').first.click(); pg.wait_for_timeout(500)
  print('modal abierto',pg.evaluate("!!document.querySelector('.booking-modal:not([hidden])')"))
  pg.go_back(); pg.wait_for_timeout(500)
  print('tras atras 1: modal',pg.evaluate("!!document.querySelector('.booking-modal:not([hidden])')"),'vista',pg.evaluate("!document.getElementById('vista-detalle').classList.contains('oculto')"),pg.url)
  # abrir y cerrar con X: no debe dejar entradas colgadas
  pg.locator('.local-tour__info:visible').first.click(); pg.wait_for_timeout(300)
  pg.locator('[data-close-booking]:visible').first.click(); pg.wait_for_timeout(500)
  print('tras X: modal',pg.evaluate("!!document.querySelector('.booking-modal:not([hidden])')"),'vista',pg.evaluate("!document.getElementById('vista-detalle').classList.contains('oculto')"))
  pg.go_back(); pg.wait_for_timeout(500)
  print('tras atras 2: vista',pg.evaluate("!document.getElementById('vista-detalle').classList.contains('oculto')"),pg.url)
  # drag
  pg.go_forward(); pg.wait_for_timeout(500)
  bar=pg.locator('#trip-summary'); box=bar.bounding_box(); print('bar y',box['y'],box['height'])
  hd=pg.locator('.trip-summary__head').bounding_box()
  cdp=c.new_cdp_session(pg)
  x=hd['x']+hd['width']/2; y=hd['y']+hd['height']/2
  for typ,yy in (('touchStart',y),('touchMove',y-40),('touchMove',y-120),('touchMove',y-200),('touchEnd',None)):
    cdp.send('Input.dispatchTouchEvent',{'type':typ,'touchPoints':([{'x':x,'y':yy}] if yy is not None else [])}); pg.wait_for_timeout(60)
  pg.wait_for_timeout(400)
  box2=bar.bounding_box(); print('bar y tras arrastrar',box2['y'],'minimized',pg.evaluate("document.getElementById('trip-summary').classList.contains('minimized')"), pg.evaluate("document.getElementById('trip-summary').style.bottom"))
  pg.screenshot(path=os.environ['TEMP']+'/drag.png'); print('errs',errs)
