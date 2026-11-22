"""Иконки приложения из public/icons/logo.svg: python3 tools/icons.py [public/icons]

SVG рендерится headless-браузером Chrome (единый источник для логотипа в приложении и иконок),
дальше Pillow уменьшает картинку до нужных размеров. Нужны google-chrome (или chromium) и Pillow.
"""
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/icons'
SVG = os.path.abspath(os.path.join(OUT, 'logo.svg'))
SIZE = 1024
TARGETS = [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-32.png', 32)]

browser = next((b for b in ('google-chrome', 'chromium', 'chromium-browser') if shutil.which(b)), None)
if not browser:
    sys.exit('Нужен google-chrome или chromium для рендера SVG')

with tempfile.TemporaryDirectory() as tmp:
    page = os.path.join(tmp, 'page.html')
    with open(page, 'w') as f:
        f.write(f'<!doctype html><style>html,body{{margin:0}}img{{display:block;width:{SIZE}px;height:{SIZE}px}}</style>'
                f'<img src="file://{SVG}">')
    big = os.path.join(tmp, 'big.png')
    subprocess.run([browser, '--headless=new', '--disable-gpu', '--no-first-run', f'--user-data-dir={tmp}/profile',
                    '--hide-scrollbars', f'--window-size={SIZE},{SIZE}', '--force-device-scale-factor=1',
                    '--allow-file-access-from-files', f'--screenshot={big}', f'file://{page}'],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
    image = Image.open(big).convert('RGB').crop((0, 0, SIZE, SIZE))
    for name, size in TARGETS:
        image.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)
        print(os.path.join(OUT, name))
