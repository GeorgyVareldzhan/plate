"""Static dev server: disables the browser cache so edits show up immediately.

python3 tools/serve.py [--port 8080] [--bind 127.0.0.1] [--dir public]
"""
import argparse
import errno
import functools
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()


parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8080)
parser.add_argument('--bind', default='127.0.0.1')
parser.add_argument('--dir', default='public')
args = parser.parse_args()

handler = functools.partial(NoCacheHandler, directory=args.dir)
try:
    server = http.server.ThreadingHTTPServer((args.bind, args.port), handler)
except OSError as error:
    if error.errno == errno.EADDRINUSE:
        sys.exit(f'Порт {args.port} уже занят — скорее всего, сервер уже запущен (make serve / make lan).\n'
                 f'Остановите его (Ctrl+C в том окне) или запустите на другом порту: make serve PORT={args.port + 1}')
    raise
print(f'Сервер: http://{args.bind}:{args.port} (Ctrl+C — остановить)')
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
