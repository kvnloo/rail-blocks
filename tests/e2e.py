"""Play desktop and mobile builds in a disposable headless Chromium."""
import contextlib, functools, http.server, os, pathlib, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'tests/out')
OUT.mkdir(parents=True, exist_ok=True)

@contextlib.contextmanager
def server():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT / 'docs')
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as httpd:
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            yield f'http://127.0.0.1:{httpd.server_port}/'
        finally:
            httpd.shutdown()

with server() as local, sync_playwright() as p:
    url = sys.argv[2] if len(sys.argv) > 2 else local
    browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM'), args=['--enable-unsafe-swiftshader'])
    errors = []
    def page(width, height, touch=False):
        pg = browser.new_page(viewport={'width': width, 'height': height}, has_touch=touch, is_mobile=touch)
        pg.on('pageerror', lambda err: errors.append(str(err)))
        return pg
    def launch(pg):
        pg.goto(url, wait_until='networkidle')
        pg.wait_for_function('window.RB !== undefined')
    def sockets(pg):
        return pg.evaluate("async()=>{const {V}=await import('./track.mjs');return RB.cells().map(p=>RB.screen(V(...p)));}")
    def result(pg, title):
        pg.wait_for_selector('#result[open]', timeout=25000)
        assert pg.inner_text('#result-title') == title, pg.inner_text('#result-title')
    ph = page(390,844,True)
    launch(ph)
    ph.screenshot(path=str(OUT/'phone.png'))
    for x,y in sockets(ph):
        ph.touchscreen.tap(round(x),round(y))
    assert ph.evaluate('RB.snapshot().blocks')==2
    ph.tap('#go');result(ph,'Station reached')
    assert '1/1 stars' in ph.inner_text('#result-copy')
    ph.screenshot(path=str(OUT/'phone-win.png'))
    ph.reload();ph.wait_for_function('window.RB?.snapshot().blocks===2')
    assert '★' in ph.inner_text('#levels button:first-child')
    ph.close(); print('PASS phone: touchscreen snap, station, star, progress reload')

    d=page(1280,800);launch(d)
    for l in d.evaluate('RB.solutions()'):
        assert l['outcome']=='goal' and l['empty']=='derail' and l['stars']==l['total'],l
        print('PASS solution:',l['name'],flush=True)
    src=d.locator('#parts button').first.bounding_box(); x,y=sockets(d)[0]
    d.mouse.move(src['x']+src['width']/2,src['y']+src['height']/2);d.mouse.down();d.mouse.move(x,y,steps=8);d.mouse.up()
    assert d.evaluate('RB.snapshot().blocks')==1
    d.click('#go');d.wait_for_function('RB.snapshot().phase==="air"',timeout=12000);result(d,'Derailed')
    d.click('#retry');d.click('#levels button:nth-child(3)')
    d.screenshot(path=str(OUT/'desktop.png'))
    for _ in sockets(d):d.click('#hint')
    d.click('#go');result(d,'Station reached')
    d.click('#retry');d.click('#levels button:last-child')
    d.click('#higher');d.click('#yaw');d.click('#pitch');d.click('#roll')
    d.mouse.click(650,426);assert d.evaluate('RB.snapshot().blocks')==1
    d.click('#reset');d.click('#hint');d.click('#go');d.wait_for_function('RB.snapshot().outcome==="loop"');d.click('#go')
    assert d.evaluate('RB.snapshot().mode')=='build'
    d.screenshot(path=str(OUT/'sandbox.png'))
    print('PASS desktop: tray drag, gravity phase, wall challenge, sandbox layer and orientation', flush=True)

    d.select_option('#preset','cross-junction');d.click('#load-preset')
    assert d.inner_text('#title')=='Cross Junction'
    assert d.evaluate('RB.snapshot().blocks')==23
    d.reload();d.wait_for_function('window.RB?.snapshot().preset === "cross-junction"')
    assert d.input_value('#preset')=='cross-junction'
    d.screenshot(path=str(OUT/'cross-junction.png'));d.close()
    print('PASS desktop: crossing preset builds and survives reload', flush=True)

    m=page(390,844,True);launch(m);m.tap('#levels button:last-child')
    assert m.locator('#preset option').count()==11 # Placeholder, sample loop and nine named layouts.
    m.select_option('#preset','full-circle');m.tap('#load-preset')
    assert m.inner_text('#title')=='Full Circle'
    m.screenshot(path=str(OUT/'phone-preset.png'))
    m.evaluate('''() => {
        window.railEvents = [];
        window.addEventListener('railblocks:audio', e => railEvents.push(e.detail));
    }''')
    m.tap('#go');m.wait_for_function('RB.snapshot().laps >= 1',timeout=35000);m.tap('#go')
    events=m.evaluate('railEvents')
    assert [e['type'] for e in events[:2]]==['seat','start']
    assert events[-1]['type']=='stop'
    assert len([e for e in events if e['type']=='seam' and 0 < e['speed'] <= .25])>=4
    assert not any(e['type']=='impact' for e in events)
    m.close();print('PASS phone: named layout, full lap, seating, seam and stop events', flush=True)

    s=page(360,360)
    for n in range(1,8):
        s.goto(f'{url}?shot={n}&t=1.25&capture=1',wait_until='networkidle')
        s.wait_for_function('window.RBShot !== undefined')
        a,b=s.evaluate('()=>{let a=RBShot.png(1.25);RBShot.png(0);return [a,RBShot.png(1.25)];}')
        assert a==b and len(a)>2000,(n,len(a))
        s.locator('canvas').screenshot(path=str(OUT/f'shot-{n}.png'))
    assert not errors,errors
    print('PASS replay: 7 seek-stable shots, no page errors',flush=True)
