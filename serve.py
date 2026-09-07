"""Servidor local sin caché para desarrollo.

python -m http.server no manda encabezados de caché, así que el navegador
puede quedarse con una versión vieja del index.html/JS incluso después de
reiniciar el servidor. Este script fuerza "no-store" en cada respuesta para
que eso no vuelva a pasar. Uso: python serve.py [puerto]
"""
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5609
    # ThreadingHTTPServer (no HTTPServer a secas): así una pestaña con conexión
    # persistente (keep-alive) no bloquea a las demás peticiones.
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
