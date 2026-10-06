"""
Browser suite for Texty (Playwright for Python).

    python3 test/e2e/run.py [BASE_URL] [AI_BASE_URL]

BASE_URL: a server with no AI key (tests graceful "unavailable").
AI_BASE_URL (optional): a server whose AI provider works (e.g. pointed at test/e2e/fake_anthropic.py).

Checks every page at phone and desktop sizes for console errors, horizontal
overflow and axe accessibility violations, then exercises every tool.
Screenshots go to test/e2e/out/.
"""
import json
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8090'
AI_BASE = sys.argv[2] if len(sys.argv) > 2 else None
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'test/e2e/out'
OUT.mkdir(parents=True, exist_ok=True)
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()

PAGES = ['/', '/word-counter', '/character-counter', '/case-converter', '/text-cleaner', '/remove-duplicate-lines',
         '/sort-lines', '/find-and-replace', '/text-diff', '/url-slug-generator', '/lorem-ipsum-generator',
         '/text-repeater', '/ai-text-rewriter', '/about', '/privacy', '/no-such-page']
SIZES = {'phone': {'width': 375, 'height': 812}, 'desktop': {'width': 1280, 'height': 900}}

failures = []
passed = 0


def check(cond, msg):
    global passed
    if cond:
        passed += 1
    else:
        failures.append(msg)
        print('  FAIL', msg)


def new_page(browser, size='desktop', **kw):
    ctx = browser.new_context(viewport=SIZES[size], permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True, **kw)
    # Injected through the browser protocol, so it runs without weakening the site's CSP.
    ctx.add_init_script(AXE)
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    return ctx, page, errors


def out_value(page, rid):
    return page.locator(f'[data-result="{rid}"] textarea').input_value()


def meta(page, rid):
    return page.locator(f'[data-result="{rid}"] [data-result-meta]').inner_text()


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---- Every page, every size: errors, overflow, accessibility ----
        for size in SIZES:
            for path in PAGES:
                ctx, page, errors = new_page(browser, size)
                resp = page.goto(BASE + path, wait_until='networkidle')
                expected = 404 if path == '/no-such-page' else 200
                check(resp.status == expected, f'{path} status {resp.status}')
                overflow = page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
                check(overflow <= 0, f'{path} [{size}] horizontal overflow {overflow}px')
                res = page.evaluate("""async () => {
                    const r = await axe.run(document, { resultTypes: ['violations'] });
                    return r.violations.filter(v => ['serious','critical'].includes(v.impact))
                      .map(v => v.id + ': ' + v.nodes.slice(0,3).map(n => n.target.join(' ')).join(' | '));
                }""")
                check(not res, f'{path} [{size}] axe: {res}')
                if path != '/no-such-page':
                    h1 = page.locator('h1').count()
                    check(h1 == 1, f'{path} has {h1} h1')
                    canon = page.locator('link[rel=canonical]').get_attribute('href')
                    check(canon.endswith(path if path != '/' else '/'), f'{path} canonical {canon}')
                # The 404 page's own status shows up as a console message; that one is expected.
                errors = [e for e in errors if not (path == '/no-such-page' and '404' in e)]
                check(not errors, f'{path} [{size}] console errors: {errors}')
                if path in ('/', '/word-counter', '/text-diff', '/ai-text-rewriter', '/find-and-replace', '/character-counter'):
                    page.screenshot(path=str(OUT / f'{size}{path.replace("/", "_") or "_home"}.png'), full_page=True)
                ctx.close()

        # ---- Unique titles and descriptions ----
        ctx, page, _ = new_page(browser)
        titles, descs = set(), set()
        for path in PAGES[:-1]:
            page.goto(BASE + path)
            titles.add(page.title())
            descs.add(page.locator('meta[name=description]').get_attribute('content'))
            if path not in ('/', '/about', '/privacy'):
                ld = [json.loads(x) for x in page.locator('script[type="application/ld+json"]').all_text_contents()]
                check(any(d.get('@type') == 'FAQPage' for d in ld), f'{path} FAQ schema')
                check(page.locator('a[href^="/"]', has_text='').count() > 10, f'{path} internal links')
        check(len(titles) == len(PAGES) - 1, f'titles unique ({len(titles)})')
        check(len(descs) == len(PAGES) - 1, f'descriptions unique ({len(descs)})')
        ctx.close()

        # ---- Analytics: events fire, never with text ----
        ctx, page, errors = new_page(browser)
        posted = []
        page.on('request', lambda r: posted.append(r.post_data or '') if r.url.endswith('/api/events') else None)
        page.goto(BASE + '/word-counter')
        page.locator('#wc-text').fill('Secret sentence here.')
        page.wait_for_timeout(300)
        ev = page.evaluate('window.__txEvents')
        names = [e['name'] for e in ev]
        check('tool_view' in names and 'text_input' in names, f'analytics events {names}')
        check(all(e['props'].get('tool') == 'word-counter' for e in ev), 'events carry tool id')
        check(not any('Secret' in x for x in posted), 'analytics never contains text')
        ctx.close()

        # ---- Word counter ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/word-counter')
        page.locator('#wc-text').fill("Hello world. It's a well-known café!\n\nSecond paragraph 👍🏽 here?")
        page.wait_for_timeout(100)
        stat = lambda k: page.locator(f'[data-stat="{k}"]').inner_text()
        check(stat('words') == '9', f'words {stat("words")}')
        check(stat('sentences') == '3', f'sentences {stat("sentences")}')
        check(stat('paragraphs') == '2', f'paragraphs {stat("paragraphs")}')
        check(stat('lines') == '3', f'lines {stat("lines")}')
        check(stat('readingTime') == '2 sec', f'reading {stat("readingTime")}')
        page.locator('[data-freq] summary').click()
        page.wait_for_function("() => document.querySelectorAll('[data-freq-table] tbody tr').length >= 5", timeout=2000)
        check(page.locator('[data-freq-table] tbody tr').count() >= 5, 'frequency table rows')
        # Toolbar: copy, clear + undo
        page.locator('[data-editor="wc-text"] [data-act="copy"]').click()
        check('Hello world' in page.evaluate('navigator.clipboard.readText()'), 'editor copy')
        page.locator('[data-editor="wc-text"] [data-act="clear"]').click()
        check(stat('words') == '0' or page.wait_for_timeout(50) or stat('words') == '0', 'clear resets stats')
        page.locator('[data-editor="wc-text"] [data-act="undo"]').click()
        page.wait_for_timeout(50)
        check(stat('words') == '9', 'undo restores')
        # Keyboard: paste via shortcut path works
        page.evaluate("navigator.clipboard.writeText('one two three')")
        page.locator('[data-editor="wc-text"] [data-act="clear"]').click()
        page.locator('[data-editor="wc-text"] [data-act="paste"]').click()
        page.wait_for_timeout(50)
        check(stat('words') == '3', f'paste button {stat("words")}')
        # Large text stays responsive
        page.evaluate("""() => { const t = document.querySelector('#wc-text'); t.value = 'The quick brown fox jumps over the lazy dog. '.repeat(50000); t.dispatchEvent(new Event('input')); }""")
        t0 = time.time()
        page.wait_for_function("() => document.querySelector('[data-stat=words]').textContent === '450,000'", timeout=5000)
        check(time.time() - t0 < 3, f'2MB stats in {time.time() - t0:.2f}s')
        check(page.locator('[data-editor="wc-text"] [data-size-notice]').is_visible(), 'large text notice')
        check(not errors, f'word counter errors {errors}')
        ctx.close()

        # ---- Character counter ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/character-counter')
        page.locator('#cc-text').fill('Hi 😀')
        page.wait_for_timeout(100)
        check(page.locator('[data-stat="characters"]').inner_text() == '4', 'emoji counted once')
        check('70' in page.locator('[data-sms] [data-note]').inner_text() or 'Unicode' in page.locator('[data-sms] [data-note]').inner_text(), 'sms unicode note')
        page.locator('#cc-text').fill('x' * 70)
        page.wait_for_timeout(100)
        check('over' in page.locator('[data-limit="title"] [data-status]').inner_text(), 'title limit over')
        check(not errors, f'char errors {errors}')
        ctx.close()

        # ---- Case converter + copy + download ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/case-converter')
        page.locator('#case-text').fill('the lord of the rings')
        page.wait_for_timeout(100)
        check(out_value(page, 'case-result') == 'The Lord of the Rings', f'title case {out_value(page, "case-result")}')
        page.locator('label:has-text("snake_case")').click()
        page.wait_for_timeout(100)
        check(out_value(page, 'case-result') == 'the_lord_of_the_rings', 'snake case')
        page.locator('[data-result="case-result"] [data-act="copy-result"]').click()
        check(page.evaluate('navigator.clipboard.readText()') == 'the_lord_of_the_rings', 'copy result')
        with page.expect_download() as dl:
            page.locator('[data-result="case-result"] [data-act="download-result"]').click()
        d = dl.value
        check(d.suggested_filename == 'texty-case.txt', 'download name')
        check(pathlib.Path(d.path()).read_text() == 'the_lord_of_the_rings', 'download content')
        # Keyboard-only: radio group with arrows
        page.locator('input[value="upper"]').focus()
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(100)
        check(out_value(page, 'case-result') == 'the lord of the rings', 'keyboard arrow selects lowercase')
        check(not errors, f'case errors {errors}')
        ctx.close()

        # ---- Text cleaner ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/text-cleaner')
        page.locator('#clean-text').fill('  Hello    world  \n\n\n\nNext​ line  ')
        page.wait_for_timeout(100)
        check(out_value(page, 'clean-result') == 'Hello world\n\nNext line', f'cleaned {out_value(page, "clean-result")!r}')
        check('extra space' in meta(page, 'clean-result'), f'clean report {meta(page, "clean-result")}')
        check(page.locator('#clean-text').input_value().startswith('  Hello'), 'original untouched before apply')
        page.locator('[data-act="apply"]').click()
        page.wait_for_timeout(100)
        check(page.locator('#clean-text').input_value() == 'Hello world\n\nNext line', 'clean applied')
        page.locator('[data-act="apply"]').click()
        page.wait_for_timeout(100)
        check(page.locator('#clean-text').input_value().startswith('  Hello'), 'undo clean')
        check(not errors, f'cleaner errors {errors}')
        ctx.close()

        # ---- Remove duplicates ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/remove-duplicate-lines')
        page.locator('#dedupe-text').fill('Apple\nOrange\nApple\nBanana\nOrange')
        page.wait_for_timeout(100)
        check(out_value(page, 'dedupe-result') == 'Apple\nOrange\nBanana', 'dedupe result')
        m = meta(page, 'dedupe-result')
        check('Before: 5' in m and 'After: 3' in m, f'dedupe meta {m}')
        page.locator('label:has-text("Keep last copy")').click()
        page.wait_for_timeout(100)
        check(out_value(page, 'dedupe-result') == 'Apple\nBanana\nOrange', 'keep last')
        check(not errors, f'dedupe errors {errors}')
        ctx.close()

        # ---- Sort ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/sort-lines')
        page.locator('#sort-text').fill('item10\nitem2\n\nbanana')
        page.wait_for_timeout(100)
        check(out_value(page, 'sort-result') == 'banana\nitem2\nitem10', f'sort {out_value(page, "sort-result")!r}')
        page.locator('label:has-text("Shuffle")').click()
        check(page.locator('[data-act="reshuffle"]').is_visible(), 'shuffle again visible')
        check(not errors, f'sort errors {errors}')
        ctx.close()

        # ---- Find & replace, including a catastrophic regex ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/find-and-replace')
        page.locator('#fr-text').fill('cat Cat concat cat')
        page.locator('[name="find"]').fill('cat')
        page.locator('[name="replace"]').fill('dog')
        expect(page.locator('[data-fr] [data-status]')).to_have_text('4 matches found', timeout=3000)
        page.locator('label:has-text("Whole words only")').click()
        expect(page.locator('[data-fr] [data-status]')).to_have_text('3 matches found', timeout=3000)
        page.locator('[data-act="replace-all"]').click()
        expect(page.locator('[data-result="fr-result"] textarea')).to_have_value('dog dog concat dog', timeout=3000)
        page.locator('label:has-text("Regular expression")').click()
        check(page.locator('[data-regex-help]').is_visible(), 'regex help shown')
        page.locator('[name="find"]').fill('(abc')
        expect(page.locator('[data-fr] [data-status]')).to_contain_text('bracket', timeout=3000)
        check(page.locator('[data-act="replace-all"]').is_disabled(), 'replace disabled on bad regex')
        page.locator('#fr-text').fill('a' * 34 + '!')
        page.locator('[name="find"]').fill('(a+)+$')
        t0 = time.time()
        expect(page.locator('[data-fr] [data-status]')).to_contain_text('too long', timeout=6000)
        check(time.time() - t0 < 4, f'catastrophic regex stopped in {time.time() - t0:.1f}s')
        # Page still responsive
        page.locator('label:has-text("Whole words only")').click()
        page.locator('[name="find"]').fill('a')
        expect(page.locator('[data-fr] [data-status]')).to_have_text('34 matches found', timeout=3000)
        check(not errors, f'find errors {errors}')
        ctx.close()

        # ---- Diff ----
        for size in SIZES:
            ctx, page, errors = new_page(browser, size)
            page.goto(BASE + '/text-diff')
            page.locator('#diff-a').fill('one\ntwo\nthree\nThe quick brown fox')
            page.locator('#diff-b').fill('one\nthree\nThe slow brown fox\nfour')
            page.locator('[data-act="compare"]').click()
            expect(page.locator('[data-result="diff-result"] [data-result-meta]')).to_contain_text('added', timeout=5000)
            m = meta(page, 'diff-result')
            check('1 added' in m and '1 removed' in m and '1 changed' in m and '2 matching' in m, f'diff stats {m}')
            check(page.locator('.diff del').first.inner_text() == 'quick', 'diff word del')
            check(page.locator('.diff ins').first.inner_text() == 'slow', 'diff word ins')
            check(page.locator('.diff .r--add .visually-hidden').count() == 1, 'diff screen-reader labels')
            overflow = page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
            check(overflow <= 0, f'diff [{size}] overflow {overflow}')
            page.screenshot(path=str(OUT / f'{size}_diff_result.png'), full_page=True)
            check(not errors, f'diff errors {errors}')
            ctx.close()
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/text-diff')
        page.evaluate("""() => {
            const a = Array.from({length: 20000}, (_, i) => 'line ' + i).join('\\n');
            const b = a.replace('line 5000', 'line five thousand').replace('line 15000\\n', '');
            for (const [id, v] of [['#diff-a', a], ['#diff-b', b]]) { const t = document.querySelector(id); t.value = v; t.dispatchEvent(new Event('input')); }
        }""")
        t0 = time.time()
        page.locator('[data-act="compare"]').click()
        expect(page.locator('[data-result="diff-result"] [data-result-meta]')).to_contain_text('matching', timeout=10000)
        check(time.time() - t0 < 5, f'20k-line diff in {time.time() - t0:.1f}s')
        check(page.locator('.diff .fold').count() >= 2, 'unchanged runs folded')
        page.locator('.diff .fold').first.click()
        check(page.locator('.diff .r').count() > 10, 'fold expands')
        check(not errors, f'big diff errors {errors}')
        ctx.close()

        # ---- Slug ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/url-slug-generator')
        page.locator('#slug-text').fill('How To Start A Small Business In 2026!')
        page.wait_for_timeout(100)
        check(out_value(page, 'slug-result') == 'how-to-start-a-small-business-in-2026', 'slug')
        page.locator('label:has-text("Underscore")').click()
        page.wait_for_timeout(100)
        check(out_value(page, 'slug-result') == 'how_to_start_a_small_business_in_2026', 'slug underscore')
        page.locator('[data-result="slug-result"] [data-act="copy-result"]').click()
        check(page.evaluate('navigator.clipboard.readText()') == 'how_to_start_a_small_business_in_2026', 'copy slug')
        check(not errors, f'slug errors {errors}')
        ctx.close()

        # ---- Lorem ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/lorem-ipsum-generator')
        check(out_value(page, 'lorem-result').startswith('Lorem ipsum dolor sit amet'), 'lorem on load')
        check(len(out_value(page, 'lorem-result').split('\n\n')) == 3, '3 paragraphs')
        page.locator('label:has-text("Words")').click()
        page.locator('[name="count"]').fill('5')
        page.locator('[data-act="generate"]').click()
        check(len(out_value(page, 'lorem-result').split(' ')) == 5, '5 words')
        page.locator('label:has-text("Paragraphs")').click()
        page.locator('[name="count"]').fill('2')
        page.locator('label:has-text("HTML")').click()
        page.locator('[data-act="generate"]').click()
        check(out_value(page, 'lorem-result').count('<p>') == 2, 'html paragraphs')
        check(not errors, f'lorem errors {errors}')
        ctx.close()

        # ---- Repeater ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/text-repeater')
        page.locator('#rep-text').fill('Hello')
        page.locator('[name="count"]').fill('3')
        page.locator('[data-act="repeat"]').click()
        check(out_value(page, 'rep-result') == 'Hello\nHello\nHello', 'repeat')
        page.locator('#rep-text').fill('x' * 200)
        page.locator('[name="count"]').fill('100000')
        page.wait_for_timeout(50)
        check(page.locator('[data-act="repeat"]').is_disabled(), 'too large blocked')
        check('limit' in page.locator('[data-rep-size]').inner_text(), 'too large explained')
        page.locator('[name="count"]').fill('10000')
        page.wait_for_timeout(50)
        page.locator('[data-act="repeat"]').click()
        check('Create' in page.locator('[data-act="repeat"]').inner_text(), 'large needs confirm')
        page.locator('[data-act="repeat"]').click()
        page.wait_for_timeout(300)
        check(len(page.locator('[data-result="rep-result"] textarea').input_value()) == 1_000_000, 'preview capped')
        check(page.locator('[data-result="rep-result"] [data-result-note]').is_visible(), 'preview note')
        check(not errors, f'repeat errors {errors}')
        ctx.close()

        # ---- AI unavailable ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/ai-text-rewriter', wait_until='networkidle')
        page.locator('#ai-text').fill('Please make this better.')
        check(page.locator('[data-ai-unavailable]').is_visible(), 'AI unavailable notice')
        check(page.locator('[data-act="rewrite"]').is_disabled(), 'AI button disabled')
        check(page.locator('[data-quota]').inner_text() == '', 'no quota claim when unavailable')
        check(not errors, f'ai unavailable errors {errors}')
        ctx.close()

        # ---- AI available (fake provider) ----
        if AI_BASE:
            ctx, page, errors = new_page(browser)
            page.goto(AI_BASE + '/ai-text-rewriter', wait_until='networkidle')
            check(page.locator('[data-ai-unavailable]').is_hidden(), 'AI available')
            check('free rewrites left' in page.locator('[data-quota]').inner_text(), 'quota shown')
            page.locator('#ai-text').fill('i think maybe we could perhaps do the thing.')
            page.locator('label:has-text("Make professional")').click()
            page.locator('[name="instruction"]').fill('Make this sound more confident.')
            page.locator('[data-act="rewrite"]').click()
            expect(page.locator('[data-ba="result"]')).to_have_text('This is a clearer, more confident version of your text.', timeout=5000)
            check(page.locator('[data-ba="original"]').inner_text().startswith('i think'), 'original shown')
            page.locator('[data-ai] [data-act="copy-result"]').click()
            check(page.evaluate('navigator.clipboard.readText()').startswith('This is a clearer'), 'AI copy')
            names = [e['name'] for e in page.evaluate('window.__txEvents')]
            check('ai_processing_started' in names and 'ai_processing_completed' in names, f'ai events {names}')
            page.screenshot(path=str(OUT / 'desktop_ai_result.png'), full_page=True)
            # Timeout path: server gives up after 3s
            page.locator('#ai-text').fill('SLOW please')
            page.locator('[data-act="rewrite"]').click()
            check(page.locator('[data-processing="ai"]').is_visible(), 'processing state shown')
            expect(page.locator('[data-ai-error]')).to_contain_text('took too long', timeout=8000)
            # Too long input
            page.locator('#ai-text').fill('x' * 6001)
            page.wait_for_timeout(50)
            check(page.locator('[data-act="rewrite"]').is_disabled(), 'over-limit disabled')
            check(not [e for e in errors if '504' not in e], f'ai errors {errors}')
            ctx.close()

        # ---- Reduced motion & dark mode ----
        ctx, page, errors = new_page(browser, reduced_motion='reduce', color_scheme='dark')
        page.goto(BASE + '/')
        dur = page.evaluate("getComputedStyle(document.querySelector('.caret')).animationDuration")
        check(dur in ('1e-05s', '0.01ms', '0.00001s'), f'reduced motion animation {dur}')
        bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
        check(bg == 'rgb(18, 21, 29)', f'dark mode bg {bg}')
        res = page.evaluate("""async () => (await axe.run(document, { runOnly: ['color-contrast'] })).violations.map(v => v.nodes.length)""")
        check(not res, f'dark contrast {res}')
        page.screenshot(path=str(OUT / 'dark_home.png'), full_page=False)
        ctx.close()

        # ---- Keyboard: skip link and menu ----
        ctx, page, errors = new_page(browser)
        page.goto(BASE + '/word-counter')
        page.keyboard.press('Tab')
        check(page.evaluate('document.activeElement.textContent') == 'Skip to content', 'skip link first')
        page.locator('.menu summary').click()
        check(page.locator('.menu nav').is_visible(), 'menu opens')
        page.keyboard.press('Escape')
        check(page.locator('.menu nav').is_hidden(), 'menu closes on Escape')
        ctx.close()

        browser.close()


run()
print(f'\n{passed} checks passed, {len(failures)} failed')
for f in failures:
    print(' -', f)
sys.exit(1 if failures else 0)
