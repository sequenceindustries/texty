"""Render the favicon PNGs and the Open Graph image with a headless browser.

    python3 scripts/make-images.py

Uses the real Recursive web font from node_modules, so the OG image matches the site.
"""
import base64
import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
pub = root / 'public'
font = 'data:font/woff2;base64,' + base64.b64encode((root / 'node_modules/@fontsource-variable/recursive/files/recursive-latin-casl-normal.woff2').read_bytes()).decode()
svg = (pub / 'favicon.svg').read_text()

og = f"""<!doctype html><html><head><style>
@font-face {{ font-family: R; src: url({font}) format('woff2-variations'); font-weight: 300 1000; }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1200px; height: 630px; background: #eef0ea; font-family: R; color: #18213a; padding: 64px 72px; display: flex; flex-direction: column; gap: 36px; }}
.brand {{ font-size: 54px; font-weight: 850; font-variation-settings: 'CASL' 1; letter-spacing: -0.04em; display: flex; align-items: center; }}
.caret {{ display: inline-block; width: 7px; height: 52px; background: #2445d6; border-radius: 3px; margin-left: 5px; }}
.paper {{ flex: 1; background: #fff; border-radius: 8px; box-shadow: 0 18px 40px -24px rgba(24,33,58,.45), inset 0 0 0 1px #d6dad0; position: relative;
  background-image: linear-gradient(to right, transparent 86px, #f0a7a7 86px, #f0a7a7 89px, transparent 89px),
  repeating-linear-gradient(to bottom, transparent 0, transparent 71px, #dfe7f3 71px, #dfe7f3 72px);
  background-position: 0 0, 0 30px; padding: 30px 48px 0 116px; }}
h1 {{ font-size: 76px; line-height: 72px; font-weight: 800; font-variation-settings: 'CASL' 1; letter-spacing: -0.03em; }}
p {{ font-size: 34px; line-height: 72px; color: #4b5468; font-variation-settings: 'CASL' 0; font-weight: 450; }}
mark {{ background: #ffe985; color: inherit; padding: 0 6px; }}
</style></head><body>
<div class="brand">texty<span class="caret"></span></div>
<div class="paper"><h1>Text tools that just work.</h1><p>Count, clean, transform, compare and rewrite text in seconds.</p></div>
</body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    pg.set_content(og, wait_until='networkidle')
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(pub / 'og.png'))
    for size, name in [(32, 'favicon-32.png'), (180, 'apple-touch-icon.png'), (512, 'icon-512.png')]:
        pg = b.new_page(viewport={'width': size, 'height': size})
        # Apple touch icons should not be transparent: the SVG fills its square already.
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=\"{size}\" height=\"{size}\" ", 1)}</body></html>')
        pg.screenshot(path=str(pub / name), omit_background=True)
    b.close()
print('done')
