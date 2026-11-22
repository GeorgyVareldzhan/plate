"""Статический сервер для разработки: отключает кэш браузера, чтобы правки были видны сразу.

python3 tools/serve.py [--port 8080] [--bind 127.0.0.1] [--dir public]
"""
import argparse
import functools
import http.server


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
server = http.server.ThreadingHTTPServer((args.bind, args.port), handler)
print(f'Сервер: http://{args.bind}:{args.port} (Ctrl+C — остановить)')
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
