#!/usr/bin/env python3
"""
Álamos de Añelo · armado de la web
==================================

Toma las plantillas de `src/` y genera los HTML que se publican, cada uno en un
solo archivo autocontenido (fotos, logos, videos, estilos y código embebidos):

    html/ALAMOS-WEB-home.html
    html/ALAMOS-WEB-inversores.html
    html/ALAMOS-WEB-empresas.html
    html/ALAMOS-WEB-club.html

y una copia navegable del sitio en `_site/` con la misma estructura que se
publica (/, /inversores/, /empresas/, /club/, /brochures/).

Uso
---
    python build.py            arma todo
    python build.py --serve    arma y abre una vista previa en http://localhost:8000

Requisitos: Python 3.9+ y Pillow (`pip install pillow`).

Sintaxis de las plantillas
--------------------------
    <!--#include parciales/header.html-->   inserta un parcial
    {{ROOT}}                                ruta a la raíz del sitio ("" o "../")
    {{PAGE}}                                clave de la página (home, inversores…)
    {{T:clave}}                             dato de src/datos/sitio.json
    @/ruta/al/archivo.jpg?w=1160            archivo del repo que se embebe.
        · .jpg/.jpeg/.png → WebP (w = ancho máximo; por defecto 1160 px)
        · .svg → SVG base64 · .mp4 → video base64
        · .css/.js en <link>/<script> → se insertan en línea
"""
import base64, hashlib, io, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
CACHE = os.path.join(ROOT, "_cache")
LIMITE_MB = 30          # límite de subida por archivo

PAGINAS = {
    # clave       plantilla             salida en html/                 ruta publicada
    "home":       ("home.html",       "ALAMOS-WEB-home.html",       "index.html"),
    "inversores": ("inversores.html", "ALAMOS-WEB-inversores.html", "inversores/index.html"),
    "empresas":   ("empresas.html",   "ALAMOS-WEB-empresas.html",   "empresas/index.html"),
    "club":       ("club.html",       "ALAMOS-WEB-club.html",       "club/index.html"),
}

DATOS = json.load(open(os.path.join(SRC, "datos", "sitio.json"), encoding="utf-8"))


def _cache_get(key):
    p = os.path.join(CACHE, key)
    return open(p, "rb").read() if os.path.exists(p) else None


def _cache_put(key, data):
    os.makedirs(CACHE, exist_ok=True)
    open(os.path.join(CACHE, key), "wb").write(data)


def imagen_webp(path, w):
    """Convierte una imagen a WebP sin deformarla (sólo achica, nunca estira)."""
    st = os.stat(path)
    key = hashlib.md5(f"{path}|{st.st_mtime}|{st.st_size}|{w}|v3".encode()).hexdigest() + ".webp"
    hit = _cache_get(key)
    if hit:
        return hit
    from PIL import Image, ImageOps
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alpha else "RGB")
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=90 if alpha else 72, method=6)
    data = buf.getvalue()
    _cache_put(key, data)
    return data


MIME = {".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm",
        ".gif": "image/gif", ".ico": "image/x-icon", ".webp": "image/webp"}


def data_uri(ref):
    """`@/fotos/x.jpg?w=900` → data URI."""
    ref = ref[2:]
    path, _, q = ref.partition("?")
    params = dict(p.split("=") for p in q.split("&") if "=" in p)
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        raise SystemExit(f"Falta el archivo: {path}")
    ext = os.path.splitext(path)[1].lower()
    if ext in (".jpg", ".jpeg", ".png"):
        data = imagen_webp(full, int(params.get("w", 1160)))
        mime = "image/webp"
    else:
        data = open(full, "rb").read()
        mime = MIME.get(ext, "application/octet-stream")
    return f"data:{mime};base64," + base64.b64encode(data).decode()


PESOS = [("extrabold", 800), ("ultrabold", 800), ("semibold", 600), ("demibold", 600), ("ultralight", 200),
         ("extralight", 200), ("black", 900), ("heavy", 900), ("bold", 700), ("medium", 500), ("light", 300),
         ("thin", 100), ("regular", 400), ("book", 400), ("normal", 400)]


def fuentes_css():
    """Embebe la tipografía Gilroy desde fuentes/ (Gilroy-Regular.otf, Gilroy-Bold.woff2, …).
    Si fontTools está instalado se recorta a caracteres latinos y se pasa a WOFF2/WOFF."""
    carpeta = os.path.join(ROOT, "fuentes")
    if not os.path.isdir(carpeta):
        return ""
    reglas, vistos = [], set()
    for f in sorted(os.listdir(carpeta)):
        base, ext = os.path.splitext(f)
        ext = ext.lower()
        if ext not in (".otf", ".ttf", ".woff", ".woff2") or "gilroy" not in base.lower():
            continue
        nombre = base.lower().replace("gilroy", "").replace("-", "").replace("_", "").replace(" ", "")
        italic = "italic" in nombre
        peso = next((w for k, w in PESOS if k in nombre), 400)
        if (peso, italic) in vistos:
            continue
        vistos.add((peso, italic))
        full = os.path.join(carpeta, f)
        st = os.stat(full)
        key = hashlib.md5(f"{full}|{st.st_mtime}|{st.st_size}|font1".encode()).hexdigest() + ".font"
        data, fmt = _cache_get(key), "woff2"
        if data is None:
            data = open(full, "rb").read()
            fmt = {".otf": "opentype", ".ttf": "truetype", ".woff": "woff", ".woff2": "woff2"}[ext]
            try:
                from fontTools import subset
                from fontTools.ttLib import TTFont
                fnt = TTFont(full)
                opts = subset.Options(); opts.layout_features = ["*"]; opts.name_IDs = ["*"]
                try:
                    import brotli  # noqa: F401
                    opts.flavor = "woff2"
                except ImportError:
                    opts.flavor = "woff"
                sub = subset.Subsetter(opts)
                sub.populate(unicodes=list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x20AC, 0x2192, 0x2122, 0x00B2])
                sub.subset(fnt)
                buf = io.BytesIO(); fnt.flavor = opts.flavor; fnt.save(buf)
                data, fmt = buf.getvalue(), opts.flavor
            except Exception:
                pass
            _cache_put(key, data)
            _cache_put(key + ".fmt", fmt.encode())
        else:
            fmt = (_cache_get(key + ".fmt") or b"woff2").decode()
        mime = {"woff2": "font/woff2", "woff": "font/woff", "opentype": "font/otf", "truetype": "font/ttf"}[fmt]
        reglas.append("@font-face{font-family:'Gilroy';font-style:%s;font-weight:%d;font-display:block;"
                      "src:url(data:%s;base64,%s) format('%s')}" % ("italic" if italic else "normal", peso, mime,
                                                                   base64.b64encode(data).decode(), fmt))
    return "<style>\n" + "\n".join(reglas) + "\n</style>\n" if reglas else ""


def incluir(txt, depth=0):
    def rep(m):
        p = os.path.join(SRC, m.group(1).strip())
        return incluir(open(p, encoding="utf-8").read(), depth + 1)
    if depth > 6:
        raise SystemExit("Inclusiones anidadas de más")
    return re.sub(r"<!--#include\s+([^>]+?)-->", rep, txt)


def armar(clave):
    plantilla, salida, publicada = PAGINAS[clave]
    html = incluir(open(os.path.join(SRC, "paginas", plantilla), encoding="utf-8").read())
    root = "../" * publicada.count("/")
    form = {"home": "inversor", "inversores": "inversor", "empresas": "empresa", "club": "empresa"}[clave]
    html = html.replace("{{ROOT}}", root).replace("{{PAGE}}", clave).replace("{{FORM}}", form)
    html = re.sub(r"{{T:([\w.]+)}}", lambda m: str(DATOS[m.group(1)]), html)
    # marca la página activa en el menú
    html = html.replace(f'data-nav="{clave}"', f'data-nav="{clave}" aria-current="page"')
    # css y js en línea
    html = re.sub(r'<link rel="stylesheet" href="(@/[^"]+)">',
                  lambda m: "<style>\n" + open(os.path.join(ROOT, m.group(1)[2:]), encoding="utf-8").read() + "\n</style>", html)
    html = re.sub(r'<script src="(@/[^"]+)"></script>',
                  lambda m: "<script>\n" + open(os.path.join(ROOT, m.group(1)[2:]), encoding="utf-8").read() + "\n</script>", html)
    # tipografía Gilroy embebida (si están los archivos en fuentes/)
    html = html.replace("</head>", fuentes_css() + "</head>", 1)
    # assets embebidos
    html = re.sub(r'@/[\w./\-]+(?:\?[\w=&]+)?', lambda m: data_uri(m.group(0)), html)
    return html, salida, publicada


def main():
    os.makedirs(os.path.join(ROOT, "html"), exist_ok=True)
    site = os.path.join(ROOT, "_site")
    shutil.rmtree(site, ignore_errors=True)
    resumen = []
    for clave in PAGINAS:
        html, salida, publicada = armar(clave)
        open(os.path.join(ROOT, "html", salida), "w", encoding="utf-8").write(html)
        dst = os.path.join(site, publicada)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "w", encoding="utf-8").write(html)
        mb = len(html.encode()) / 1048576
        resumen.append((salida, mb))
        if mb > LIMITE_MB:
            print(f"ATENCIÓN: {salida} pesa {mb:.1f} MB (límite {LIMITE_MB} MB)")
    shutil.copytree(os.path.join(ROOT, "brochures"), os.path.join(site, "brochures"),
                    ignore=shutil.ignore_patterns("*.csv"))
    for f in os.listdir(os.path.join(ROOT, "iconos", "web")):
        shutil.copy(os.path.join(ROOT, "iconos", "web", f), site)
    for f in ("robots.txt", "sitemap.xml"):
        p = os.path.join(ROOT, "html", f)
        if os.path.exists(p):
            shutil.copy(p, site)
    for s, mb in resumen:
        print(f"  {s:32s} {mb:6.1f} MB")
    print("Listo: html/ y _site/")


if __name__ == "__main__":
    main()
    if "--serve" in sys.argv:
        import http.server, functools, webbrowser
        h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, "_site"))
        print("Vista previa en http://localhost:8000  (Ctrl+C para cortar)")
        webbrowser.open("http://localhost:8000")
        http.server.ThreadingHTTPServer(("", 8000), h).serve_forever()
