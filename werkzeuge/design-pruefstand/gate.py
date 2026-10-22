"""Clubwerk Design-Prüfstand.

Läuft gegen den Demo-Server (3801/5801/5803) und prüft alle Oberflächen in Handy-, Tablet- und Rechnergröße,
hell und dunkel, mit Bedienabläufen (Reiter, Fenster, Menü, bis ganz unten scrollen) und statischen Regeln im Quelltext.

  python3 werkzeuge/design-pruefstand/gate.py            vollständig → werkzeuge/design-pruefstand/ausgabe
  python3 werkzeuge/design-pruefstand/gate.py --schnell  nur Handy + Rechner, nur dunkel (für Zwischenstände)
Vorher den Demo-Server starten: bash werkzeuge/demo/start.sh

Ergebnis: OUTDIR/befunde.json, OUTDIR/befunde.txt, markierte Bilder; Rückgabewert 1, wenn es offene Befunde gibt.
Ausnahmen mit Begründung stehen in erlaubt.txt (Regel | Element-Teil | Zustand-Teil | Begründung)."""
import asyncio, json, os, re, sys, glob
from playwright.async_api import async_playwright

D = os.path.dirname(os.path.abspath(__file__)); LINT = open(D + '/lint.js').read()
OUT = os.path.abspath(next((a for a in sys.argv[1:] if not a.startswith('--')), os.path.join(D, 'ausgabe'))); QUICK = '--schnell' in sys.argv; WEBKIT = '--webkit' in sys.argv
APP = os.environ.get('CW_APP', os.path.join(D, '..', '..', 'clubwerk'))
os.makedirs(OUT, exist_ok=True)
for f in glob.glob(OUT + '/*.png') + glob.glob(OUT + '/gruen'): os.remove(f)
B = os.environ.get('CW_URL', 'http://127.0.0.1:3801/'); MB = os.environ.get('CW_APP_URL', 'http://127.0.0.1:5803/'); BB = os.environ.get('CW_BEREGNUNG_URL', 'http://127.0.0.1:5801/')
H = {'Content-Type': 'application/json', 'X-Clubwerk': '1'}
slug = lambda t: re.sub(r'[^a-z0-9]+', '-', t.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')).strip('-')[:20]
ADMIN_PW = os.environ.get('CW_ADMIN_PW', 'Test-Kennwort-42'); TABLET_PW = os.environ.get('CW_TABLET_PW', 'Theke-Abend7')   # Zugangsdaten des Demo-Servers (werkzeuge/demo)
FIND = []; ERRS = []; STATES = [0]; SEEN = set()

REACH = r'''async () => {
  const sc = [document.scrollingElement, ...[...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return /auto|scroll/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2 && e.offsetParent !== null; })];
  const before = sc.map(e => e.scrollTop);
  sc.forEach(e => { e.scrollTop = e.scrollHeight; });
  await new Promise(r => setTimeout(r, 300));
  let limit = innerHeight;
  const fixedAnc = e => { for (let q = e; q && q !== document.body; q = q.parentElement) if (getComputedStyle(q).position === 'fixed') return q; return null; };
  document.querySelectorAll('body *').forEach(e => { const s = getComputedStyle(e); if (s.position !== 'fixed' || s.display === 'none' || s.visibility === 'hidden') return; const r = e.getBoundingClientRect(); if (r.height > 0 && r.height < innerHeight * 0.4 && r.bottom >= innerHeight - 2 && r.width > innerWidth * 0.6) limit = Math.min(limit, r.top); });
  const hiddenAnc = e => { for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) { const s = getComputedStyle(q); if (s.display === 'none' || s.visibility === 'hidden') return true; if (/hidden|clip/.test(s.overflowY) && q.getBoundingClientRect().bottom < e.getBoundingClientRect().bottom) return true; } return false; };
  let worst = null;
  for (const e of document.querySelectorAll('button, a, input, select, textarea, h1, h2, h3, p, td, li, label')) {
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const ov = document.querySelector('.overlay:not(.hidden), #overlay:not(.hidden), .vh-sheet.show');
    if (ov && !ov.contains(e)) continue;
    if (fixedAnc(e) || hiddenAnc(e)) continue;
    if (r.bottom > limit + 2 && (!worst || r.bottom > worst.b)) worst = { b: Math.round(r.bottom), limit: Math.round(limit), el: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''), text: (e.innerText || e.value || '').trim().slice(0, 40) };
  }
  sc.forEach((e, i) => { e.scrollTop = before[i]; });
  return worst;
}'''


def allowed():
    rows = []
    p = D + '/erlaubt.txt'
    if os.path.exists(p):
        for l in open(p):
            l = l.strip()
            if not l or l.startswith('#'): continue
            parts = [x.strip() for x in l.split('|')]
            rows.append(parts + [''] * (4 - len(parts)))
    return rows
ALLOW = allowed()


def record(state, items, shot=None):
    for it in items:
        it['state'] = state
        if shot: it['bild'] = shot
        acc = next((a for a in ALLOW if a[0] == it['rule'] and a[1] in it.get('el', '') and a[2] in state), None)
        it['erlaubt'] = acc[3] if acc else None
        FIND.append(it)


async def check(pg, state, phone, frame=None):
    """Eine Ansicht prüfen: Regeln + bis unten erreichbar + Scrollsperre bei offenem Fenster."""
    tgt = frame or pg
    state = re.sub(r'-+', '-', state)
    if state in SEEN: state += '_' + str(len(SEEN))
    SEEN.add(state); STATES[0] += 1
    await asyncio.sleep(0.35)
    try: items = await tgt.evaluate(LINT, {'mark': False, 'phone': phone})
    except Exception as e: ERRS.append(f'{state}: lint {str(e)[:80]}'); return
    try:
        w = await tgt.evaluate(REACH)
        if w: items.append({'rule': 'nicht-erreichbar', 'el': w['el'], 'text': w['text'], 'unten': w['b'], 'sichtbar-bis': w['limit']})
    except Exception as e: ERRS.append(f'{state}: reach {str(e)[:80]}')
    # Fenster offen? Dann darf die Seite dahinter nicht scrollen
    try:
        if await tgt.evaluate("() => !!document.querySelector('.overlay:not(.hidden), #overlay:not(.hidden), dialog[open], .vh-sheet.show')"):
            y0 = await tgt.evaluate("() => [scrollY, ...[...document.querySelectorAll('main, #main, .page')].map(e => e.scrollTop)]")
            vp = pg.viewport_size
            await pg.mouse.move(6, vp['height'] - 6); await pg.mouse.wheel(0, 600); await asyncio.sleep(0.35)
            y1 = await tgt.evaluate("() => [scrollY, ...[...document.querySelectorAll('main, #main, .page')].map(e => e.scrollTop)]")
            if y1 != y0: items.append({'rule': 'scrollt-hinter-fenster', 'el': 'body', 'text': f'{y0} → {y1}'})
    except Exception as e: ERRS.append(f'{state}: lock {str(e)[:80]}')
    shot = None
    if items:
        try:
            await tgt.evaluate(LINT, {'mark': True, 'phone': phone})
            shot = state + '.png'; await pg.screenshot(path=f'{OUT}/{shot}')
            await tgt.evaluate("()=>document.querySelectorAll('[style*=outline]').forEach(e=>{e.style.outline='';e.style.outlineOffset=''})")
        except Exception: pass
    record(state, items, shot)
    print(f'{state}: {len(items)}', flush=True)


async def close_dlg(pg):
    for sel in ['#overlay:not(.hidden) button:has-text("Abbrechen")', '#overlay:not(.hidden) button:has-text("Schließen")', '.overlay:not(.hidden) button:has-text("Abbrechen")', '.overlay:not(.hidden) button:has-text("Schließen")', 'dialog[open] button:has-text("Abbrechen")', 'button:visible:has-text("Abbrechen")', 'button:visible:has-text("Schließen")', 'button:visible:has-text("Zurück")']:
        try:
            l = pg.locator(sel)
            if await l.count() and await l.first.is_visible(): await l.first.click(timeout=1500); await asyncio.sleep(0.5); return
        except Exception: pass
    await pg.keyboard.press('Escape'); await asyncio.sleep(0.4)


async def unlock_tablet(c):
    t = await c.new_page(); t.on('pageerror', lambda e: ERRS.append(f'tablet js {e}'))
    await t.goto(B); await asyncio.sleep(1.5)
    if await t.locator('#gate').is_visible(): await t.fill('#gate input[type=password]', TABLET_PW); await t.keyboard.press('Enter'); await asyncio.sleep(2)
    await t.goto(B); await asyncio.sleep(2)
    return t


async def tablet(b, w, h, scheme, tag):
    phone = w <= 640
    c = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': w, 'height': h}, color_scheme=scheme, has_touch=phone)
    t = await unlock_tablet(c)
    labels = [(await x.inner_text()).strip() for x in await t.locator('#topnav > *').all()]
    for i, l in enumerate(labels):
        try:
            await t.locator('#topnav > *').nth(i).scroll_into_view_if_needed(timeout=2000)
            await t.locator('#topnav > *').nth(i).click(timeout=3000)
        except Exception:
            record(f'{tag}-{i}-{slug(l)}', [{'rule': 'reiter-nicht-erreichbar', 'el': '#topnav', 'text': l}]); await t.locator('#topnav > *').nth(i).click(force=True)
        await asyncio.sleep(1.8)
        base = f'{tag}-{i}-{slug(l)}'
        fr = None
        for f in t.frames[1:]:
            if f.url.startswith('http'): fr = f
        await check(t, base, phone)
        if fr: await check(t, base + '-rahmen', phone, fr)
        tgt = fr or t
        for j, sel in enumerate(['.tk-tile.big', '.tk-grid .tk-tile:not(.big)', '.vh-tile button:not([data-p]):not(.vh-btn)', '.vh-names button', '.mtile, .member']):
            try:
                loc = tgt.locator(sel)
                if await loc.count() == 0 or not await loc.first.is_visible(): continue
                await loc.first.click(timeout=2000); await asyncio.sleep(1.2); await check(t, f'{base}-k{j}', phone, fr)
                await close_dlg(tgt)
            except Exception as e: ERRS.append(f'{base} {sel}: ' + str(e).split(chr(10))[0][:90])
        if 'Pl' in l and 'tze' in l:
            try:
                await t.locator('#days button').nth(2).click(); await asyncio.sleep(1.3); await check(t, base + '-tag3', phone)
            except Exception as e: ERRS.append(f'{base} plan: {str(e)[:80]}')
    # Verwaltung im Tablet-Rahmen (so öffnet man sie am Handy über die Tablet-Adresse)
    try:
        await t.goto(B + 'verwaltung.html'); await asyncio.sleep(2.5)
        fr = next((f for f in t.frames[1:] if 'admin.html' in f.url), None)
        if fr:
            if await fr.locator('#un').count() and await fr.locator('#un').is_visible():
                await fr.fill('#un', 'admin'); await fr.fill('#pw', ADMIN_PW); await fr.press('#pw', 'Enter'); await asyncio.sleep(2.2)
            ib = await t.evaluate("() => { const r = document.getElementById('frame').getBoundingClientRect(); return [Math.round(r.bottom), innerHeight]; }")
            if ib[0] > ib[1] + 1: record(tag + '-verwaltung-rahmen', [{'rule': 'nicht-erreichbar', 'el': 'iframe#frame', 'text': f'Rahmen endet bei {ib[0]} px, sichtbar {ib[1]} px'}])
            await check(t, tag + '-verwaltung-rahmen', phone, fr)
            if phone: await menu_check(t, tag + '-verwaltung-rahmen-menue', fr)
    except Exception as e: ERRS.append(f'{tag} verwaltung: {str(e)[:80]}')
    await c.close()


async def menu_check(pg, state, fr=None):
    tgt = fr or pg
    try:
        if not await tgt.locator('#menuT').is_visible(): return
        await tgt.click('#menuT'); await asyncio.sleep(0.5)
        y0 = await tgt.evaluate("() => [scrollY, document.querySelector('#main') ? document.querySelector('#main').scrollTop : 0]")
        await pg.mouse.move(150, pg.viewport_size['height'] - 40); await pg.mouse.wheel(0, 2500); await asyncio.sleep(0.4)
        y1 = await tgt.evaluate("() => [scrollY, document.querySelector('#main') ? document.querySelector('#main').scrollTop : 0]")
        items = []
        if y1 != y0: items.append({'rule': 'scrollt-hinter-menue', 'el': 'nav.side', 'text': f'{y0} → {y1}'})
        await check(pg, state, True, fr)
        record(state, items)
        await tgt.click('#menuT'); await asyncio.sleep(0.4)
    except Exception as e: ERRS.append(f'{state}: {str(e)[:80]}')


async def admin(b, w, h, scheme, tag, dialogs=True):
    phone = w <= 640
    c = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': w, 'height': h}, color_scheme=scheme, has_touch=phone)
    pg = await c.new_page(); pg.on('pageerror', lambda e: ERRS.append(f'admin js {e}'))
    await pg.goto(B + 'admin.html'); await pg.wait_for_selector('#un'); await check(pg, tag + '-anmeldung', phone)
    await pg.fill('#un', 'admin'); await pg.fill('#pw', ADMIN_PW); await pg.press('#pw', 'Enter'); await asyncio.sleep(2.2)
    if phone: await menu_check(pg, tag + '-menue')
    navs = await pg.eval_on_selector_all('nav.side button.nav', 'bs=>bs.map(b=>[b.dataset.p, (b.querySelector("span")||b).textContent.trim()])')
    done = set()
    for k, l in navs:
        if await pg.locator('#overlay:not(.hidden)').count(): await close_dlg(pg)
        try: await pg.evaluate("k => document.querySelector('nav.side button.nav[data-p=\"' + k + '\"]').click()", k)
        except Exception as e: ERRS.append(f'nav {k}: {str(e)[:60]}'); continue
        await asyncio.sleep(1.5)
        await explore(pg, f'{tag}-{slug(l)}', 0, dialogs, phone, done)
    await c.close()


async def explore(pg, base, depth, dialogs, phone, done):
    await check(pg, base, phone)
    if dialogs: await try_dialog(pg, base, phone)
    if await pg.locator('#overlay:not(.hidden)').count(): await close_dlg(pg)
    if depth >= 2: return
    groups = await pg.evaluate("""()=>[...document.querySelectorAll('#main .tabs, #main .seg, #main .drinktabs')].filter(g=>g.offsetParent && !g.closest('#overlay')).map(g=>[...g.children].filter(x=>x.tagName==='BUTTON'&&x.offsetParent).map(x=>x.textContent.trim()))""")
    for labels in groups:
        if tuple(labels) in done: continue
        done.add(tuple(labels))
        for i, lab in enumerate(labels):
            if i == 0: continue
            try:
                btn = pg.locator('#main .tabs > button:visible, #main .seg > button:visible, #main .drinktabs > button:visible').filter(has_text=re.compile('^\\s*' + re.escape(lab) + '\\s*$'))
                if await btn.count() == 0: continue
                await btn.first.scroll_into_view_if_needed(timeout=1500); await btn.first.click(timeout=2000); await asyncio.sleep(1.1)
                await explore(pg, f'{base}__{slug(lab)}', depth + 1, dialogs, phone, done)
            except Exception as e: ERRS.append(f'tab {base} {lab}: {str(e)[:70]}')
        try:
            btn = pg.locator('#main .tabs > button:visible, #main .seg > button:visible, #main .drinktabs > button:visible').filter(has_text=re.compile('^\\s*' + re.escape(labels[0]) + '\\s*$'))
            if await btn.count(): await btn.first.click(timeout=1500); await asyncio.sleep(0.7)
        except Exception: pass


async def try_dialog(pg, base, phone):
    cand = pg.locator('#main button:visible:not([disabled]), #tabTools button:visible:not([disabled])').filter(has_text=re.compile(r'^\s*(\+|Bearbeiten|Neu|Anlegen)'))
    try:
        if await cand.count() == 0: cand = pg.locator('#main button.ico[title="Bearbeiten"]:visible')
        if await cand.count() == 0: return
        await cand.first.click(timeout=2000); await asyncio.sleep(0.9)
        if await pg.locator('#overlay:not(.hidden)').count():
            await check(pg, base + '-fenster', phone); await close_dlg(pg)
    except Exception as e: ERRS.append(f'dlg {base}: ' + str(e).split(chr(10))[0][:90])


async def app(b, w, h, scheme, tag):
    c = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': 1280, 'height': 800}); rq = c.request
    async def A(u, m='GET', d=None):
        r = await rq.fetch(B + u, method=m, data=json.dumps(d) if d is not None else None, headers=H)
        try: return await r.json()
        except Exception: return {}
    await A('api/admin/login', 'POST', {'username': 'admin', 'password': ADMIN_PW})
    ms = await A('api/admin/members'); lst = ms if isinstance(ms, list) else ms.get('rows', [])
    wid = [m for m in lst if m.get('kind', 'mitglied') == 'mitglied' and '(' not in m.get('name', '')][0]['id']   # erstes echtes Mitglied der Demo-Daten
    for mod in ['buchung', 'spielbetrieb', 'arbeitseinsatz', 'mitglieder', 'beregnung', 'zugang', 'verkauf']: await A(f'api/admin/app/member/{wid}/access', 'PUT', {'module': mod, 'grant': True})
    inv = await A(f'api/admin/app/member/{wid}/invite', 'POST', {})
    cx = await b.new_context(locale='de-DE', timezone_id='Europe/Berlin', viewport={'width': w, 'height': h}, color_scheme=scheme, has_touch=True, is_mobile=True)
    pa = await cx.new_page(); pa.on('pageerror', lambda e: ERRS.append(f'app js {e}'))
    await pa.goto(MB + '#i=' + inv['token']); await asyncio.sleep(1.5); await check(pa, f'{tag}-koppeln', True)
    await pa.fill('#pair1', '2468')
    if await pa.locator('#pair2').is_visible(): await pa.fill('#pair2', '2468')
    await pa.click('#pairOk'); await asyncio.sleep(2.5)
    tabs = await pa.eval_on_selector_all('#tabs button', 'els=>els.map(e=>[e.dataset.t,e.textContent.trim()])')
    for k, l in tabs:
        try: await pa.click(f'#tabs button[data-t="{k}"]', timeout=3000)
        except Exception: record(f'{tag}-{slug(l)}', [{'rule': 'reiter-nicht-erreichbar', 'el': '#tabs', 'text': l}]); continue
        await asyncio.sleep(1.6); base = f'{tag}-{slug(l)}'; await check(pa, base, True)
        segs = pa.locator('#view .seg:visible > button, main .seg:visible > button, #view .vh-seg:visible > button')
        n = await segs.count()
        for i in range(1, min(n, 6)):
            try: lab = (await segs.nth(i).inner_text()).strip(); await segs.nth(i).click(timeout=1500); await asyncio.sleep(1.1); await check(pa, f'{base}__{slug(lab)}', True)
            except Exception as e: ERRS.append(f'seg {base}: {str(e)[:60]}')
        for j, sel in enumerate(['.vh-tile button', '.vh-btn:not([disabled])']):
            try:
                loc = pa.locator('#view ' + sel)
                if await loc.count() and await loc.first.is_visible() and k not in ('beregnung', 'zugang'):
                    await loc.first.click(timeout=1500); await asyncio.sleep(1.1)
                    if await pa.evaluate("() => !!document.querySelector('.overlay:not(.hidden), dialog[open], .vh-sheet.show')"): await check(pa, f'{base}-fenster{j}', True); await close_dlg(pa)
            except Exception as e: ERRS.append(f'app dlg {base}: {str(e)[:60]}')
    bw = await cx.new_page(); await bw.goto(BB); await asyncio.sleep(1.5); await check(bw, f'{tag}-web-beregnung', True)
    await cx.close(); await c.close()


def static_scan():
    """Regeln im Quelltext – Fehler, die man im Testbrowser nicht sieht (z. B. iPhone-Höhe)."""
    items = []
    files = [f for pat in ['public/*.html', 'public/*.css', 'public/*.js', 'public/app/*', 'erweiterungen/*/public/*', 'erweiterungen/*/public/*/*'] for f in glob.glob(APP + '/' + pat) if os.path.isfile(f) and re.search(r'\.(html|css|js)$', f)]
    for f in files:
        rel = f[len(APP) + 1:]; src = open(f, encoding='utf-8', errors='replace').read()
        for n, line in enumerate(src.split('\n'), 1):
            if rel not in ('public/style.css', 'public/nav.js') and re.search(r'(header\.top|#gkHeader|\.topnav)\b[^{;]*\{', line):
                items.append({'rule': 'eigene-kopfzeile', 'el': f'{rel}:{n}', 'text': line.strip()[:90]})
            if re.search(r'font:\s*[^;"]*\binherit\b', line) and not re.search(r'font:\s*inherit\s*[;}"]', line):
                items.append({'rule': 'font-kurzform-ungueltig', 'el': f'{rel}:{n}', 'text': line.strip()[:90]})
            for m in re.finditer(r'(min-height|height|max-height)\s*:\s*100vh', line):
                seg = line[m.start():m.start() + 120]
                if 'dvh' not in line: items.append({'rule': 'iphone-hoehe-100vh', 'el': f'{rel}:{n}', 'text': line.strip()[:90]})
            # PIN-Eingabe nur über den gemeinsamen Baustein GKPin (nav.js) – sonst laufen Kreise, Texte und Abstände wieder auseinander
            if rel != 'public/nav.js' and re.search(r'class="pin-dots"|data-k="ok">OK<', line):
                items.append({'rule': 'eigene-pin-eingabe', 'el': f'{rel}:{n}', 'text': line.strip()[:90]})
            # Schrift auf Vereins- oder Warnfarbe nie fest weiß: im dunklen Modus bzw. bei heller Vereinsfarbe fehlt sonst der Kontrast (--on-brand / --on-red)
            if re.search(r'background(-color)?\s*:\s*var\(--(brand|red)\)', line) and re.search(r'(?<![-\w])color\s*:\s*(#fff(fff)?|white)\b', line, re.I):
                items.append({'rule': 'feste-schrift-auf-token', 'el': f'{rel}:{n}', 'text': line.strip()[:90]})
            if (rel.startswith('public/app/') or re.search(r'/public/(member|app)\.js$', rel)) and re.search(r'target=["\\\']?_blank|window\.open\(', line):
                items.append({'rule': 'app-neues-fenster', 'el': f'{rel}:{n}', 'text': line.strip()[:90]})
    record('quelltext', items)


async def main():
    static_scan()
    themes = ['dark'] if QUICK else ['light', 'dark']
    jobs = []
    for sc in themes:
        sx = 'd' if sc == 'dark' else 'h'
        sizes_t = [(390, 664, 'TH')] + ([] if QUICK else [(800, 1280, 'TP')]) + [(1280, 800, 'TL')]
        sizes_a = [(390, 664, 'AH')] + ([] if QUICK else [(1024, 768, 'AT')]) + [(1440, 900, 'AR')]
        for w, h, t in sizes_t: jobs.append(('chromium', 'tablet', w, h, sc, f'{t}{sx}'))
        for w, h, t in sizes_a: jobs.append(('chromium', 'admin', w, h, sc, f'{t}{sx}'))
        jobs.append(('chromium', 'app', 390, 664, sc, f'MH{sx}'))
        if WEBKIT:   # Safari-Technik: die Handy-Ansichten zusätzlich
            jobs += [('webkit', 'tablet', 390, 664, sc, f'W-TH{sx}'), ('webkit', 'admin', 390, 664, sc, f'W-AH{sx}'), ('webkit', 'app', 390, 664, sc, f'W-MH{sx}')]
    sem = asyncio.Semaphore(6)
    async with async_playwright() as p:
        browsers = {'chromium': await p.chromium.launch()}
        if WEBKIT:
            try: browsers['webkit'] = await p.webkit.launch()
            except Exception as e: ERRS.append('WebKit fehlt – einmal: python3 -m playwright install webkit (' + str(e).split(chr(10))[0][:80] + ')'); jobs[:] = [j for j in jobs if j[0] != 'webkit']
        async def run(j):
            async with sem:
                eng, kind, w, h, sc, tag = j; b = browsers[eng]
                try:
                    if kind == 'tablet': await tablet(b, w, h, sc, tag)
                    elif kind == 'admin': await admin(b, w, h, sc, tag)
                    else: await app(b, w, h, sc, tag)
                except Exception as e: ERRS.append(f'{tag}: ABBRUCH ' + str(e).split(chr(10))[0][:120])
        await asyncio.gather(*[run(j) for j in jobs])
        for b in browsers.values(): await b.close()
    open_ = [f for f in FIND if not f['erlaubt']]
    groups = {}
    for f in open_: groups.setdefault((f['rule'], f.get('el', '')), []).append(f)
    json.dump({'zustaende': STATES[0], 'befunde': FIND, 'fehler': ERRS}, open(OUT + '/befunde.json', 'w'), ensure_ascii=False, indent=1)
    with open(OUT + '/befunde.txt', 'w') as o:
        for (r, el), fs in sorted(groups.items(), key=lambda x: (x[0][0], -len(x[1]))):
            ex = fs[0]; extra = {k: v for k, v in ex.items() if k not in ('rule', 'el', 'state', 'bild', 'erlaubt', 'text')}
            o.write(f"{r:24} {el[:70]:70} ×{len(fs):3}  „{ex.get('text','')[:40]}“ {extra}  [{', '.join(sorted({x['state'] for x in fs})[:4])}]\n")
        if ERRS: o.write('\nABLAUF-FEHLER:\n' + '\n'.join(ERRS[:80]) + '\n')
    print(f'FERTIG: {STATES[0]} Ansichten, {len(open_)} offene Befunde in {len(groups)} Gruppen, {len(FIND) - len(open_)} erlaubt, {len(ERRS)} Ablauf-Fehler')
    if not open_ and not ERRS and not QUICK: open(OUT + '/gruen', 'w').write(f'{STATES[0]} Ansichten geprüft\n')
    sys.exit(1 if open_ or ERRS else 0)

asyncio.run(main())
