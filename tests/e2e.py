"""E2E: every level's stored solution reaches the goal with all stars; real drag+Go wins level 1."""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = sys.argv[2] if len(sys.argv) > 2 else (ROOT / "docs/index.html").as_uri()
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests/out"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    res = pg.evaluate("""() => RB.LEVELS.map((L,i) => {
        const lv = RB.parseLevel(L); const empty = RB.simulate(lv).outcome;
        RB.applySolution(lv, L.sol); const r = RB.simulate(lv);
        return {i, name:L.name, empty, outcome:r.outcome, stars:r.stars, total:lv.stars.length,
                n:RB.placedCount(lv), budget:lv.budget, sandbox:lv.sandbox};
    })""")
    ok = True
    for r in res:
        want = "loop" if r["sandbox"] else "goal"
        good = r["outcome"] == want and r["stars"] == r["total"] and r["empty"] == "derail" and (not r["budget"] or r["n"] <= r["budget"])
        ok &= good
        print(("PASS" if good else "FAIL"), r)

    # Real UI: drag the track on level 1, press Go, expect the win card.
    pg.evaluate("localStorage.clear()"); pg.reload()
    box = pg.locator("canvas").bounding_box()
    S = box["width"] / 9
    y = box["y"] + 4.5 * S
    pg.mouse.move(box["x"] + 1.5 * S, y); pg.mouse.down()
    for c in range(1, 8):
        pg.mouse.move(box["x"] + (c + .5) * S, y, steps=3)
    pg.mouse.up()
    pg.screenshot(path=str(OUT / "phone-built.png"))
    print("meta after drag:", pg.inner_text("#meta"))
    pg.click("#go"); pg.wait_for_timeout(1300)
    pg.screenshot(path=str(OUT / "phone-running.png"))
    pg.wait_for_selector("#overlay.show", timeout=8000)
    card = pg.inner_text("#card"); print("card:", card.replace("\n", " | "))
    pg.screenshot(path=str(OUT / "phone-win.png"))
    ok &= "Station reached" in card and "Perfect" in card

    # Level 4 loop via Solve + run, desktop size; capture mid-loop.
    d = b.new_page(viewport={"width": 1280, "height": 800})
    d.on("pageerror", lambda e: errs.append(str(e)))
    d.goto(URL); d.click("#levels button:nth-child(4)"); d.click("#solve"); d.click("#go")
    d.wait_for_timeout(3300); d.screenshot(path=str(OUT / "desk-loop.png"))
    d.wait_for_selector("#overlay.show", timeout=10000); c4 = d.inner_text("#card"); print("L4 card:", c4.replace("\n", " | "))
    ok &= "Perfect" in c4
    # Derail path: next level with no track built
    d.click("#ov-b"); d.click("#go"); d.wait_for_selector("#overlay.show", timeout=8000)
    c5 = d.inner_text("#card"); print("L5 empty:", c5.replace("\n", " | ")); d.screenshot(path=str(OUT / "desk-derail.png"))
    ok &= "Derailed" in c5
    print("pageerrors:", errs); ok &= not errs
    b.close()
print("ALL OK" if ok else "FAILURES"); sys.exit(0 if ok else 1)
