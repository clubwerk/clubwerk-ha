#!/usr/bin/env python3
"""Leistungsmessung aller Oberflächen (Verwaltung, Tablet, Mitglieder-App) – mit dem großen Musterverein.

   bash werkzeuge/last/start.sh                       # großer Musterverein, Server mit Abfrage-Zähler (Ports 3810/5810/5811)
   python3 werkzeuge/last/messen.py                   # misst alles, schreibt werkzeuge/last/ausgabe/messung.{json,md}
   python3 werkzeuge/last/messen.py --port 3801 --app 5803 --log <zaehler.log>   # z. B. gegen den Demo-Server

Gemessen wird mit 4-fach gebremster CPU (wie ein älteres Tablet/Handy):
  ms   Zeit bis die Ansicht fertig ist (keine offenen Anfragen, 0,5 s keine Änderung mehr an der Seite)
  js   Summe der langen Aufgaben im Browser (blockiert Tippen/Scrollen)
  api  Anfragen an den Server, srv = deren Serverzeit, q = Datenbankabfragen (aus dem Zähler, werkzeuge/last/zaehler.js)
"""
import argparse, asyncio, json, os, re, time
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, default=3810); ap.add_argument('--app', type=int, default=5810)
ap.add_argument('--log', default=os.path.join(os.path.dirname(__file__), 'zaehler.log'))
ap.add_argument('--aus', default=os.path.join(os.path.dirname(__file__), 'ausgabe'))
ap.add_argument('--cpu', type=float, default=4)
ap.add_argument('--nur', default='', help='nur diese Oberflächen, z. B. verwaltung,tablet,app')
A = ap.parse_args()
B, MB = f'http://127.0.0.1:{A.port}/', f'http://127.0.0.1:{A.app}/'
ADMIN_PW, TABLET_PW, PIN = 'Test-Kennwort-42', 'Theke-Abend7', '2468'
RES = []

# im Browser: letzte Änderung an der Seite (ohne Uhr/Hinweise), offene Anfragen, Summe langer Aufgaben
INIT = r"""(() => { const w = window.__cw = { last: performance.now(), inflight: 0, lt: 0 };
  const quiet = n => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return e && e.closest && e.closest('#clock,.clock,#toast,.toast,.vh-toast'); };
  new MutationObserver(rs => { if (!rs.every(r => quiet(r.target))) w.last = performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.lt += e.duration; }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const f = window.fetch; window.fetch = function () { w.inflight++; w.last = performance.now(); return f.apply(this, arguments).finally(() => { w.inflight--; w.last = performance.now(); }); };
})();"""

def server_rows(t0, t1):
    try:
        with open(A.log) as f: rows = [json.loads(l) for l in f if l.strip()]
    except FileNotFoundError: return []
    return [r for r in rows if t0 <= r['t'] <= t1 + 50 and r['url'].startswith('/api/')]

async def settle(pg, start):
    """wartet, bis die Seite ruhig ist; → (ms seit start bis zur letzten Änderung, lange Aufgaben seit start)"""
    t_end = time.time() + 25
    while time.time() < t_end:
        try: now, last, inflight, lt = await pg.evaluate('() => [performance.now(), __cw.last, __cw.inflight, __cw.lt]')
        except Exception: await asyncio.sleep(0.2); continue
        if inflight == 0 and now - last >= 500: return max(0, last - start), lt
        await asyncio.sleep(0.1)
    return 25000, lt

async def measure(pg, flaeche, ansicht, action):
    """action: async Funktion, die die Ansicht auslöst (Navigation oder Klick)"""
    try: lt0 = await pg.evaluate('() => __cw.lt')
    except Exception: lt0 = 0
    t0 = int(time.time() * 1000)
    nav = await action()
    if nav: lt0 = 0   # neue Seite: Zähler beginnt bei 0, Zeit ab Navigationsbeginn
    start = 0 if nav else await pg.evaluate('() => window.__cwClick')
    ms, lt = await settle(pg, start)
    rows = server_rows(t0, int(time.time() * 1000))
    top = max(rows, key=lambda r: r['ms'], default=None); topq = max(rows, key=lambda r: r['q'], default=None)
    r = {'flaeche': flaeche, 'ansicht': ansicht, 'ms': round(ms), 'js': round(lt - lt0), 'api': len(rows),
         'srv': round(sum(r['ms'] for r in rows)), 'q': sum(r['q'] for r in rows),
         'langsamste': f"{top['m']} {top['url'][:70]} {top['ms']:.0f} ms" if top else '', 'meiste_q': f"{topq['url'][:70]} {topq['q']}" if topq else ''}
    RES.append(r); print(f"{r['ms']:>6} ms  js {r['js']:>5}  api {r['api']:>3}  srv {r['srv']:>5}  q {r['q']:>6}  {flaeche} · {ansicht}", flush=True)
    return r

async def throttle(c, pg):
    cdp = await c.new_cdp_session(pg); await cdp.send('Emulation.setCPUThrottlingRate', {'rate': A.cpu})

async def click_action(pg, loc):
    async def go():
        await pg.evaluate('() => { window.__cwClick = performance.now(); }')
        await loc.click(timeout=5000); return False
    return go

async def verwaltung(b):
    c = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': 1280, 'height': 800})
    await c.add_init_script(INIT); pg = await c.new_page(); await throttle(c, pg)
    await pg.goto(B + 'admin.html'); await pg.wait_for_selector('#un')
    await pg.fill('#un', 'admin'); await pg.fill('#pw', ADMIN_PW)
    await measure(pg, 'Verwaltung', 'Anmelden → Übersicht', await click_action(pg, pg.locator('#lf button')))
    navs = await pg.eval_on_selector_all('nav.side button.nav', 'bs=>bs.map(b=>[b.dataset.p, (b.querySelector("span")||b).textContent.trim()])')
    for k, label in navs:
        if await pg.locator('#overlay:not(.hidden)').count(): await pg.keyboard.press('Escape')
        await measure(pg, 'Verwaltung', label, await click_action(pg, pg.locator(f'nav.side button.nav[data-p="{k}"]')))
        tabs = await pg.evaluate("""()=>[...document.querySelectorAll('#main .tabs > button, #main .seg > button, #main .drinktabs > button, #tabRow button, .tabrow button')]
            .filter(x=>x.offsetParent && !x.closest('#overlay')).map(x=>x.textContent.trim()).filter(Boolean)""")
        for t in list(dict.fromkeys(tabs))[1:8]:
            loc = pg.locator('#main .tabs > button:visible, #main .seg > button:visible, #main .drinktabs > button:visible, #tabRow button:visible, .tabrow button:visible').filter(has_text=re.compile('^\\s*' + re.escape(t) + '\\s*$'))
            if not await loc.count(): continue
            try: await measure(pg, 'Verwaltung', f'{label} › {t}', await click_action(pg, loc.first))
            except Exception as e: print('  übersprungen', label, t, str(e)[:60])
    await c.close()

async def tablet(b):
    c = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': 1280, 'height': 800}, has_touch=True)
    await c.add_init_script(INIT); pg = await c.new_page()
    await pg.goto(B); await asyncio.sleep(1)
    if await pg.locator('#gate').is_visible(): await pg.fill('#gate input[type=password]', TABLET_PW); await pg.keyboard.press('Enter'); await asyncio.sleep(2)
    await throttle(c, pg)
    async def nav_to(u):
        async def go(): await pg.goto(u); return True
        return go
    await measure(pg, 'Tablet', 'Verkauf (Start)', await nav_to(B))
    links = await pg.eval_on_selector_all('#topnav a', 'as=>as.map(a=>[a.textContent.trim(), a.href])')
    for label, href in links:
        if href.rstrip('/') == B.rstrip('/'): continue
        await measure(pg, 'Tablet', label, await nav_to(href))
    # Verkauf: Namen antippen, dann Artikel
    await pg.goto(B); await settle(pg, 0)
    name = pg.locator('.names button[data-id]').first
    await measure(pg, 'Tablet', 'Verkauf › Namen antippen', await click_action(pg, name))
    if await pg.locator('.pin-dots:visible').count():
        for k in PIN: await pg.locator(f'[data-k="{k}"]').first.click()
        await measure(pg, 'Tablet', 'Verkauf › PIN bestätigen', await click_action(pg, pg.locator('[data-k="ok"]').first))
    art = pg.locator('#cats button[data-a]').first
    if await art.count(): await measure(pg, 'Tablet', 'Verkauf › Artikel antippen', await click_action(pg, art))
    await c.close()

async def app(b):
    c = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': 1280, 'height': 800}); rq = c.request
    H = {'X-Clubwerk': '1', 'Content-Type': 'application/json'}
    await rq.post(B + 'api/admin/login', data=json.dumps({'username': 'admin', 'password': ADMIN_PW}), headers=H)
    ms = await (await rq.get(B + 'api/admin/members', headers=H)).json(); lst = ms if isinstance(ms, list) else ms.get('rows', [])
    wid = [m for m in lst if m.get('kind', 'mitglied') == 'mitglied' and '(' not in m.get('name', '')][0]['id']
    for mod in ['buchung', 'spielbetrieb', 'arbeitseinsatz', 'mitglieder', 'beregnung', 'zugang', 'verkauf']:
        await rq.put(B + f'api/admin/app/member/{wid}/access', data=json.dumps({'module': mod, 'grant': True}), headers=H)
    inv = await (await rq.post(B + f'api/admin/app/member/{wid}/invite', data='{}', headers=H)).json()
    cx = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': 390, 'height': 664}, has_touch=True, is_mobile=True)
    await cx.add_init_script(INIT); pa = await cx.new_page(); await throttle(cx, pa)
    await pa.goto(MB + '#i=' + inv['token']); await asyncio.sleep(1.5)
    await pa.fill('#pair1', PIN)
    if await pa.locator('#pair2').is_visible(): await pa.fill('#pair2', PIN)
    await measure(pa, 'Mitglieder-App', 'Koppeln → Start', await click_action(pa, pa.locator('#pairOk')))
    tabs = await pa.eval_on_selector_all('#tabs button', 'els=>els.map(e=>[e.dataset.t,e.textContent.trim()])')
    for k, l in tabs:
        try: await measure(pa, 'Mitglieder-App', l, await click_action(pa, pa.locator(f'#tabs button[data-t="{k}"]')))
        except Exception as e: print('  übersprungen', l, str(e)[:60])
    async def reload(): await pa.reload(); return True
    await measure(pa, 'Mitglieder-App', 'App neu öffnen', reload)
    await cx.close(); await c.close()

async def main():
    os.makedirs(A.aus, exist_ok=True)
    nur = set(x for x in A.nur.split(',') if x)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, fn in [('verwaltung', verwaltung), ('tablet', tablet), ('app', app)]:
            if nur and name not in nur: continue
            try: await fn(b)
            except Exception as e: print('ABBRUCH', name, str(e)[:200])
        await b.close()
    with open(os.path.join(A.aus, 'messung.json'), 'w') as f: json.dump(RES, f, ensure_ascii=False, indent=1)
    rows = sorted(RES, key=lambda r: -r['ms'])
    md = ['| ms | lange JS-Aufgaben | Anfragen | Serverzeit | DB-Abfragen | Oberfläche · Ansicht | langsamste Anfrage | meiste Abfragen |', '|---:|---:|---:|---:|---:|---|---|---|']
    md += [f"| {r['ms']} | {r['js']} | {r['api']} | {r['srv']} | {r['q']} | {r['flaeche']} · {r['ansicht']} | {r['langsamste']} | {r['meiste_q']} |" for r in rows]
    with open(os.path.join(A.aus, 'messung.md'), 'w') as f: f.write('\n'.join(md) + '\n')
    print(f'\n{len(RES)} Ansichten gemessen → {A.aus}/messung.md')

asyncio.run(main())
