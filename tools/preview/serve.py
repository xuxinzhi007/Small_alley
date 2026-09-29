import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]


class PreviewHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlsplit(self.path).path == '/':
            self.send_response(302)
            self.send_header('Location', '/tools/preview/index.html')
            self.end_headers()
            return
        super().do_GET()

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        target = (ROOT / path.lstrip('/')).resolve()
        allowed = [ROOT / 'js', ROOT / 'images', ROOT / 'tools' / 'preview']
        if target != ROOT / 'game.js' and not any(folder in target.parents for folder in allowed):
            self.send_error(404)
            return None
        if not target.is_file() or target.suffix not in {'.js', '.html', '.css', '.png', '.jpg', '.jpeg', '.webp', '.svg'}:
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='小巷物语浏览器开发预览（仅本机访问）')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    print(f'浏览器打开 http://127.0.0.1:{args.port}/tools/preview/index.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
