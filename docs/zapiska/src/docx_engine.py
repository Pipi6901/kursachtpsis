"""Генератор пояснительной записки в формате Word (.docx).

Берёт за основу пакет образца (стили, нумерация, подвал, шрифты) и заменяет в нём содержимое документа,
поэтому абзацные и символьные стили, поля страницы и подвал совпадают с образцом.

Правила оформления образца, которые воспроизводятся здесь:
  * A4, поля: верхнее и нижнее 2 см, левое 3 см, правое 1,5 см; Times New Roman 14 пт, одинарный интервал;
  * абзац: отступ первой строки 1,25 см (709 twips), выравнивание по ширине;
  * заголовок 1-го уровня — стиль «heading 1» (прописные, полужирный 16 пт), 2-го — «heading 2» (полужирный 14 пт),
    3-й уровень — полужирный абзац с отступом, в оглавление не входит;
  * таблица: подпись сверху «Таблица N.M – …», шрифт ячеек 12 пт, заголовок полужирный, строка номеров граф,
    при переносе — «Продолжение таблицы N.M»;
  * рисунок по центру, подпись снизу «Рисунок N.M – …»;
  * формулы — редактор формул (OMML), номер «(N.M)» у правого поля;
  * слова латиницей выделяются курсивом;
  * номер страницы в правом нижнем углу, на титульном листе номера нет, нумерация с 4 (как в образце).
"""
import os
import re
import shutil
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
EXAMPLE_DIR = os.environ.get('PZ_EXAMPLE_DIR', '')      # распакованный образец (каталог ex/)

W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
TEXT_W = 9355                                  # ширина текста, twips (21 - 3 - 1.5 см)
FIRST_LINE = 709


def esc(s):
    return escape(s, {'"': '&quot;'})


# ------------------------------------------------------------------ текстовые прогоны
LATIN = re.compile(r'([A-Za-z]+(?:[\'’][A-Za-z]+)?)')
INLINE = re.compile(r'(\*\*.+?\*\*|\$.+?\$)')


FONT_TNR = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'


def rpr(bold=False, italic=False, size=None, caps=False, extra='', font=False):
    s = FONT_TNR if font else ''
    if bold:
        s += '<w:b/><w:bCs/>'
    if italic:
        s += '<w:i/><w:iCs/>'
    if caps:
        s += '<w:caps/>'
    if size:
        s += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
    s += extra
    return f'<w:rPr>{s}</w:rPr>' if s else ''


def raw_run(text, **kw):
    """Прогон без разбора разметки; \\t и \\n превращаются в табуляцию и перевод строки."""
    pr = rpr(**kw)
    parts = re.split(r'(\t|\n)', text)
    inner = ''
    for p in parts:
        if p == '\t':
            inner += '<w:tab/>'
        elif p == '\n':
            inner += '<w:br/>'
        elif p:
            inner += f'<w:t xml:space="preserve">{esc(p)}</w:t>'
    return f'<w:r>{pr}{inner}</w:r>' if inner else ''


def text_runs(text, bold=False, size=None, italic_latin=True, caps=False, italic=False, font=False):
    out = []
    for part in LATIN.split(text):
        if not part:
            continue
        is_lat = bool(LATIN.fullmatch(part)) and italic_latin
        out.append(raw_run(part, bold=bold, italic=italic or is_lat, size=size, caps=caps, font=font))
    return ''.join(out)


def inline(text, bold=False, size=None, italic_latin=True, math_size=None, caps=False, font=False):
    """Разметка: **полужирный**, $формула$; слова латиницей — курсивом."""
    out = []
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith('**') and part.endswith('**') and len(part) > 4:
            out.append(inline(part[2:-2], bold=True, size=size, italic_latin=italic_latin, math_size=math_size, caps=caps, font=font))
        elif part.startswith('$') and part.endswith('$') and len(part) > 2:
            out.append(Math.inline(part[1:-1], size=math_size or size))
        else:
            out.append(text_runs(part, bold=bold, size=size, italic_latin=italic_latin, caps=caps, font=font))
    return ''.join(out)


# ------------------------------------------------------------------ формулы (OMML)
class Math:
    """Мини-язык формул: \\frac{a}{b}, x_{i}, x^{2}, \\sum_{a}^{b}{...}, \\mathrm{текст}, \\left( ... \\right), греческие буквы."""
    SYMBOLS = {
        'cdot': '·', 'times': '×', 'le': '≤', 'ge': '≥', 'in': '∈', 'to': '→', 'approx': '≈', 'infty': '∞',
        'pm': '±', 'neq': '≠', 'sum': '∑', 'forall': '∀', 'rightarrow': '→', 'ldots': '…', 'partial': '∂',
        'cap': '∩', 'prime': '′', 'le_': '≤', 'sim': '∼', 'lambda': 'λ', 'beta': 'β', 'alpha': 'α', 'tau': 'τ', 'varepsilon': 'ε',
        'epsilon': 'ε', 'mu': 'μ', 'sigma': 'σ', 'gamma': 'γ', 'theta': 'θ', 'delta': 'δ', 'Delta': 'Δ', 'Sigma': 'Σ',
        'pi': 'π', 'omega': 'ω', 'phi': 'φ', 'rho': 'ρ', 'kappa': 'κ', 'eta': 'η',
    }
    GREEK = set('λβατεμσγθδΔΣπωφρκη')

    def __init__(self, size=None):
        self.size = size or 28

    @staticmethod
    def inline(src, size=None):
        return '<m:oMath>' + Math(size)._parse_all(src) + '</m:oMath>'

    @staticmethod
    def display(src, size=None):
        return '<m:oMath>' + Math(size)._parse_all(src) + '</m:oMath>'

    # -- run helpers
    def _r(self, text, italic=False):
        pr = '<w:rFonts w:cs="Times New Roman"/>' + ('<w:i/><w:iCs/>' if italic else '')
        if self.size:
            pr += f'<w:sz w:val="{self.size}"/><w:szCs w:val="{self.size}"/>'
        return f'<m:r><m:rPr><m:nor/></m:rPr><w:rPr>{pr}</w:rPr><m:t xml:space="preserve">{esc(text)}</m:t></m:r>'

    def _ctrl(self):
        return '<m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:cs="Times New Roman"/><w:i/></w:rPr></m:ctrlPr>'

    # -- parser
    def _parse_all(self, s):
        self.s, self.i = s, 0
        return self._seq(None)

    def _peek(self):
        return self.s[self.i] if self.i < len(self.s) else ''

    def _group(self):
        """Прочитать {…} или один символ/команду; вернуть OMML-содержимое."""
        if self._peek() == '{':
            self.i += 1
            r = self._seq('}')
            self.i += 1
            return r
        atom = self._atom()
        return atom or ''

    def _seq(self, stop):
        out = ''
        while self.i < len(self.s) and self._peek() != stop:
            atom = self._atom()
            if atom is None:
                break
            # индексы / степени после атома
            sub = sup = None
            while self._peek() in ('_', '^'):
                c = self._peek()
                self.i += 1
                g = self._group()
                if c == '_':
                    sub = g
                else:
                    sup = g
            if sub is not None and sup is not None:
                atom = (f'<m:sSubSup><m:sSubSupPr>{self._ctrl()}</m:sSubSupPr><m:e>{atom}</m:e><m:sub>{sub}</m:sub><m:sup>{sup}</m:sup></m:sSubSup>')
            elif sub is not None:
                atom = f'<m:sSub><m:sSubPr>{self._ctrl()}</m:sSubPr><m:e>{atom}</m:e><m:sub>{sub}</m:sub></m:sSub>'
            elif sup is not None:
                atom = f'<m:sSup><m:sSupPr>{self._ctrl()}</m:sSupPr><m:e>{atom}</m:e><m:sup>{sup}</m:sup></m:sSup>'
            out += atom
        return out

    def _atom(self):
        while self.i < len(self.s) and self.s[self.i] == ' ':
            self.i += 1
        if self.i >= len(self.s):
            return None
        c = self.s[self.i]
        if c == '{':
            return self._group()
        if c == '\\':
            m = re.match(r'\\([A-Za-z]+|.)', self.s[self.i:])
            name = m.group(1)
            self.i += len(m.group(0))
            if name == 'frac':
                a = self._group()
                b = self._group()
                return f'<m:f><m:fPr>{self._ctrl()}</m:fPr><m:num>{a}</m:num><m:den>{b}</m:den></m:f>'
            if name == 'hat':
                g = self._group()
                return f'<m:acc><m:accPr><m:chr m:val="̂"/>{self._ctrl()}</m:accPr><m:e>{g}</m:e></m:acc>'
            if name == 'mathrm':
                self.i += 1 if self._peek() == '{' else 0
                j = self.s.index('}', self.i)
                txt = self.s[self.i:j]
                self.i = j + 1
                return self._r(txt)
            if name == 'sum':
                sub = sup = ''
                while self._peek() in ('_', '^'):
                    t = self._peek()
                    self.i += 1
                    g = self._group()
                    if t == '_':
                        sub = g
                    else:
                        sup = g
                body = self._group()
                hide = '' if sup else '<m:supHide m:val="1"/>'
                return (f'<m:nary><m:naryPr><m:chr m:val="∑"/>{hide}{self._ctrl()}</m:naryPr>'
                        f'<m:sub>{sub}</m:sub><m:sup>{sup}</m:sup><m:e>{body}</m:e></m:nary>')
            if name == 'left':
                op = self.s[self.i]
                self.i += 1
                inner = self._seq(None)
                m2 = re.match(r'\\right(.)', self.s[self.i:])
                cl = m2.group(1)
                self.i += len(m2.group(0))
                return (f'<m:d><m:dPr><m:begChr m:val="{esc(op)}"/><m:endChr m:val="{esc(cl)}"/>{self._ctrl()}</m:dPr>'
                        f'<m:e>{inner}</m:e></m:d>')
            if name == 'right':      # закрывающая часть обрабатывается в \left
                self.i -= len(m.group(0))
                return None
            if name == ',':
                return self._r(' ')
            sym = self.SYMBOLS.get(name, name)
            if name in ('le', 'ge', 'in', 'to', 'approx', 'neq', 'rightarrow', 'sim', 'times'):
                return self._r(f' {sym} ')
            return self._r(sym, italic=sym in self.GREEK)
        if c in '([':
            close = ')' if c == '(' else ']'
            self.i += 1
            inner = self._seq(close)
            if self._peek() == close:
                self.i += 1
            return (f'<m:d><m:dPr><m:begChr m:val="{c}"/><m:endChr m:val="{close}"/>{self._ctrl()}</m:dPr>'
                    f'<m:e>{inner}</m:e></m:d>')
        if c in '=<>+':
            self.i += 1
            return self._r(f' {c} ')
        if c == '-':
            prev = self.s[self.i - 1] if self.i else ''
            self.i += 1
            return self._r('−' if (not prev or prev in '(=+<>[,{_^') else ' − ')
        if c.isalpha():
            # переменная: одна буква курсивом (латиница, греческие); слова — через \mathrm
            self.i += 1
            return self._r(c, italic=True)
        if c.isdigit():
            m = re.match(r'\d+(?:[.,]\d+)?', self.s[self.i:])
            self.i += len(m.group(0))
            return self._r(m.group(0))
        self.i += 1
        return self._r(c)


# ------------------------------------------------------------------ документ
class Doc:
    def __init__(self):
        self.blocks = []            # (kind, data)
        self.chapter = 0
        self.counters = {'t': 0, 'f': 0, 'e': 0}
        self.labels = {}            # ключ -> номер
        self.figs = []              # файлы рисунков
        self.toc = []               # (уровень, номер, текст, закладка)
        self.bm_id = 100
        self.list_id = 0
        self.splits = {}            # ключ таблицы -> список индексов строк, перед которыми таблица разрывается
        self.fig_dir = None
        self.chapter_label = None
        self.cited = []             # ключи источников в порядке первого упоминания
        self.sources_db = {}
        self.sources_db_all = {}

    # ---- разметка
    def blank(self):
        self.blocks.append(('blank', None))

    def p(self, text, indent=True):
        self.blocks.append(('p', (text, indent)))

    def pn(self, text):
        """Абзац без красной строки («где …»)."""
        self.p(text, indent=False)

    def h1(self, text, numbered=True):
        if numbered:
            self.chapter += 1
            self.counters = {'t': 0, 'f': 0, 'e': 0}
            full = f'{self.chapter} {text}'
        else:
            full = text
        bm = self._bookmark()
        self.toc.append((1, full, bm))
        self.blocks.append(('h1', (full, bm, numbered)))
        self.blank()

    def h2(self, text):
        if self.blocks and self.blocks[-1][0] != 'blank':
            self.blank()
        bm = self._bookmark()
        self.toc.append((2, text, bm))
        self.blocks.append(('h2', (text, bm)))
        self.blank()

    def h3(self, text):
        self.blocks.append(('h3', text))

    def lst(self, items):
        self.list_id += 1
        self.blocks.append(('list', (self.list_id, items)))

    def table(self, key, caption, header, rows, widths, numbered_cols=True, align=None, small=False):
        """rows: список строк; строка — список ячеек (строк с \\n = несколько абзацев) или ('~', 'заголовок группы').
        widths — доли ширины столбцов."""
        self.counters['t'] += 1
        num = f'{self.chapter}.{self.counters["t"]}'
        self.labels['t:' + key] = num
        if not self.blocks or self.blocks[-1][0] != 'blank':
            self.blank()
        self.blocks.append(('table', dict(key=key, num=num, caption=caption, header=header, rows=rows, widths=widths,
                                         numbered_cols=numbered_cols, align=align or [], small=small)))

    def figure(self, key, caption, name, width_cm=16.5, max_h_cm=21.0, alt=None):
        self.counters['f'] += 1
        num = f'{self.chapter}.{self.counters["f"]}'
        self.labels['f:' + key] = num
        self.figs.append(name)
        if not self.blocks or self.blocks[-1][0] != 'blank':
            self.blank()
        self.blocks.append(('figure', dict(key=key, num=num, caption=caption, name=name, width_cm=width_cm, max_h_cm=max_h_cm, alt=alt or caption)))
        self.blank()

    def formula(self, key, expr):
        self.counters['e'] += 1
        num = f'{self.chapter}.{self.counters["e"]}'
        self.labels['e:' + key] = num
        self.blank()
        self.blocks.append(('formula', dict(num=num, expr=expr)))
        self.blank()

    def pagebreak(self):
        self.blocks.append(('pagebreak', None))

    def raw(self, xml):
        self.blocks.append(('raw', xml))

    def _bookmark(self):
        self.bm_id += 1
        return (self.bm_id, f'_Toc2410{self.bm_id:05d}')

    def sources(self, db):
        """Список использованных источников: номера по порядку первого упоминания в тексте."""
        self.sources_db = db
        self.list_id += 1
        self.blocks.append(('sources', self.list_id))

    # ---- подстановка ссылок {t:key} {f:key} {e:key} {s:key}
    def _cite(self, key):
        if key not in self.sources_db_all:
            raise KeyError('нет источника ' + key)
        if key not in self.cited:
            self.cited.append(key)
        return self.cited.index(key) + 1

    def ref(self, s):
        s = re.sub(r'\{s:([a-z0-9_]+)\}', lambda m: str(self._cite(m.group(1))), s)
        return re.sub(r'\{([tfe]):([a-z0-9_]+)\}', lambda m: self.labels[m.group(1) + ':' + m.group(2)], s)


# ---- рендер блоков в XML
def p_xml(ppr, runs):
    return f'<w:p><w:pPr>{ppr}</w:pPr>{runs}</w:p>' if ppr else f'<w:p>{runs}</w:p>'


class Renderer:
    def __init__(self, doc, fig_dir, page_map=None):
        self.d = doc
        self.fig_dir = fig_dir
        self.rels = []          # (rId, target)
        self.docpr = 10
        self.page_map = page_map or {}

    def rid(self, target):
        rid = f'rId{100 + len(self.rels)}'
        self.rels.append((rid, target))
        return rid

    def render(self):
        d = self.d
        out = []
        prev = None
        for kind, data in d.blocks:
            out.append(self.block(kind, data))
            prev = kind
        return ''.join(out)

    # -- отдельные блоки
    def block(self, kind, data):
        d = self.d
        if kind == 'blank':
            return '<w:p/>'
        if kind == 'pagebreak':
            return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
        if kind == 'raw':
            return data
        if kind == 'p':
            text, indent = data
            ppr = ('<w:ind w:firstLine="709"/>' if indent else '') + '<w:jc w:val="both"/>'
            return p_xml(ppr, inline(d.ref(text)))
        if kind == 'h1':
            full, (bid, bname), numbered = data
            if numbered:
                ppr = '<w:pStyle w:val="12"/><w:pageBreakBefore/><w:ind w:left="993" w:hanging="285"/>'
            else:
                ppr = '<w:pStyle w:val="12"/><w:pageBreakBefore/><w:ind w:hanging="708"/><w:jc w:val="center"/>'
            body = (f'<w:bookmarkStart w:id="{bid}" w:name="{bname}"/>' + text_runs(full) + f'<w:bookmarkEnd w:id="{bid}"/>')
            return p_xml(ppr, body)
        if kind == 'h2':
            text, (bid, bname) = data
            ppr = '<w:pStyle w:val="2"/><w:ind w:left="1128" w:hanging="420"/>'
            body = (f'<w:bookmarkStart w:id="{bid}" w:name="{bname}"/>' + text_runs(text) + f'<w:bookmarkEnd w:id="{bid}"/>')
            return p_xml(ppr, body)
        if kind == 'h3':
            return p_xml('<w:keepNext/><w:ind w:firstLine="709"/>', inline(d.ref(data), bold=True))
        if kind == 'list':
            lid, items = data
            xml = ''
            n = len(items)
            for it in items:
                ppr = (f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{200 + lid}"/></w:numPr>'
                       '<w:ind w:left="0" w:firstLine="709"/><w:jc w:val="both"/>')
                xml += p_xml(ppr, inline(d.ref(it)))
            return xml
        if kind == 'sources':
            xml = ''
            for key in d.cited:
                ppr = (f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{200 + data}"/></w:numPr>'
                       '<w:ind w:left="0" w:firstLine="709"/><w:jc w:val="both"/>')
                xml += p_xml(ppr, inline(d.sources_db[key]))
            return xml
        if kind == 'formula':
            ppr = '<w:tabs><w:tab w:val="center" w:pos="4677"/><w:tab w:val="right" w:pos="9355"/></w:tabs>'
            body = ('<w:r><w:tab/></w:r>' + Math.display(data['expr']) + '<w:r><w:tab/></w:r>' +
                    raw_run(f'({data["num"]})'))
            return p_xml(ppr, body)
        if kind == 'figure':
            return self.figure(data)
        if kind == 'table':
            return self.table(data)
        raise ValueError(kind)

    def figure(self, f):
        from struct import unpack
        path = os.path.join(self.fig_dir, f['name'] + '.png')
        with open(path, 'rb') as fh:
            head = fh.read(24)
        w_px, h_px = unpack('>II', head[16:24])
        w_cm = f['width_cm']
        h_cm = w_cm * h_px / w_px
        if h_cm > f['max_h_cm']:
            h_cm = f['max_h_cm']
            w_cm = h_cm * w_px / h_px
        cx, cy = int(w_cm * 360000), int(h_cm * 360000)
        rid = self.rid(f'media/{f["name"]}.png')
        self.docpr += 1
        pid = self.docpr
        drawing = (
            f'<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>'
            f'<wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="{pid}" name="Рисунок {pid}" descr="{esc(f["alt"])}"/>'
            '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
            '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr>'
            f'<pic:cNvPr id="{pid}" name="{f["name"]}.png"/><pic:cNvPicPr/></pic:nvPicPr>'
            f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
            '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>')
        pic = p_xml('<w:keepNext/><w:jc w:val="center"/>', f'<w:r><w:rPr><w:noProof/></w:rPr>{drawing}</w:r>')
        cap = p_xml('<w:jc w:val="center"/>', inline(f'Рисунок {f["num"]} – {self.d.ref(f["caption"])}'))
        return pic + cap

    # -- таблицы
    def cell(self, text, width, bold=False, jc=None, span=1, keep=False):
        paras = ''
        for line in str(text).split('\n'):
            ppr = ('<w:keepNext/>' if keep else '') + (f'<w:jc w:val="{jc}"/>' if jc else '')
            paras += p_xml(ppr, inline(self.d.ref(line), bold=bold, size=24, math_size=24, font=True) if line else '')
        if not paras:
            paras = '<w:p/>'
        tcpr = f'<w:tcW w:w="{width}" w:type="dxa"/>' + (f'<w:gridSpan w:val="{span}"/>' if span > 1 else '')
        return f'<w:tc><w:tcPr>{tcpr}</w:tcPr>{paras}</w:tc>'

    def min_widths(self, t):
        """Минимальная ширина каждого столбца (twips): самое длинное неразрывное слово + поля ячейки."""
        try:
            from PIL import ImageFont
        except ImportError:
            return [0] * len(t['widths'])
        base = '/usr/share/fonts/truetype/liberation/LiberationSerif-%s.ttf'
        reg, bold = ImageFont.truetype(base % 'Regular', 120), ImageFont.truetype(base % 'Bold', 120)
        wtw = lambda word, f: f.getlength(word) / 10.0 * 20          # 12 пт -> twips
        rows = ([('B', t['header'])] if t['header'] else []) + list(t['rows'])
        mins = [0.0] * len(t['widths'])
        for r in rows:
            if isinstance(r, tuple):
                if r[0] == '~':
                    continue
                cells, f = r[1], bold
            else:
                cells, f = r, reg
            for ci, c in enumerate(cells):
                for word in re.split(r'[\s/]+', re.sub(r'\*\*|\$', '', str(c))):
                    for part in re.split(r'(?<=-)', word):
                        if part:
                            mins[ci] = max(mins[ci], wtw(part, f))
        return [int(m) + 216 + 40 for m in mins]

    def col_widths(self, fr, t=None):
        tot = float(sum(fr))
        w = [TEXT_W * x / tot for x in fr]
        if t is not None:
            mn = self.min_widths(t)
            if sum(mn) > TEXT_W:
                print(f'  ! таблица {t["num"]}: минимальные ширины ({sum(mn)}) больше ширины текста')
            for _ in range(20):
                low = [i for i in range(len(w)) if w[i] < mn[i]]
                if not low:
                    break
                need = sum(mn[i] - w[i] for i in low)
                for i in low:
                    w[i] = mn[i]
                slack = {i: w[i] - mn[i] for i in range(len(w)) if i not in low and w[i] > mn[i]}
                ts = sum(slack.values())
                if ts <= 0:
                    break
                for i, sl in slack.items():
                    w[i] -= need * sl / ts
        w = [int(round(x)) for x in w]
        w[-1] += TEXT_W - sum(w)
        return w

    def table(self, t):
        d = self.d
        widths = self.col_widths(t['widths'], t)
        ncol = len(widths)
        cap_par = lambda text: p_xml('<w:keepNext/><w:jc w:val="both"/>', inline(text))
        first_cap = cap_par(f'Таблица {t["num"]} – {d.ref(t["caption"])}')

        def trow(cells, bold=False, jc=None, header=False, keep=True):
            trpr = '<w:cantSplit/>' + ('<w:tblHeader/>' if False else '')
            return f'<w:tr><w:trPr>{trpr}</w:trPr>{cells}</w:tr>'

        aligns = t['align'] or [None] * ncol

        def header_rows(with_titles):
            x = ''
            if with_titles and t['header']:
                cells = ''.join(self.cell(h, widths[i], bold=True, keep=True) for i, h in enumerate(t['header']))
                x += trow(cells, keep=True)
            if t['numbered_cols']:
                cells = ''.join(self.cell(str(i + 1), widths[i], bold=True, jc='center', keep=True) for i in range(ncol))
                x += trow(cells)
            return x

        small_tbl = len(t['rows']) <= 4

        def body_row(r, last=False):
            if isinstance(r, tuple) and r and r[0] == '~':
                return trow(self.cell(r[1], sum(widths), bold=True, span=ncol, keep=True))
            if isinstance(r, tuple) and r and r[0] == 'B':
                return trow(''.join(self.cell(c, widths[i], bold=True, keep=True) for i, c in enumerate(r[1])))
            cells = ''.join(self.cell(c, widths[i], jc=aligns[i], keep=small_tbl and not last) for i, c in enumerate(r))
            return trow(cells)

        def tbl(rows_xml):
            grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths)
            return ('<w:tbl><w:tblPr><w:tblStyle w:val="16"/>'
                    f'<w:tblW w:w="{sum(widths)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
                    '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>'
                    f'</w:tblPr><w:tblGrid>{grid}</w:tblGrid>{rows_xml}</w:tbl>')

        splits = sorted(d.splits.get(t['key'], []))
        bounds = [0] + splits + [len(t['rows'])]
        xml = first_cap
        for k in range(len(bounds) - 1):
            a, b = bounds[k], bounds[k + 1]
            rows_xml = header_rows(with_titles=(k == 0))
            if k > 0 and not t['numbered_cols']:
                rows_xml = header_rows(with_titles=True)
            rows_xml += ''.join(body_row(r, last=(a + j == len(t['rows']) - 1)) for j, r in enumerate(t['rows'][a:b]))
            if k > 0:
                xml += p_xml('<w:keepNext/>', raw_run(f'Продолжение таблицы {t["num"]}'))
            xml += tbl(rows_xml)
        return xml + '<w:p/>'



# ------------------------------------------------------------------ оглавление
def toc_xml(doc, pages):
    """pages: {закладка: номер страницы}"""
    out = []
    out.append('<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>'
               '<w:r><w:rPr><w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>СОДЕРЖАНИЕ</w:t></w:r></w:p>')
    out.append('<w:p/>')
    entries = []
    for i, (lvl, text, (bid, bname)) in enumerate(doc.toc):
        style = '14' if lvl == 1 else '21'
        pg = str(pages.get(bname, ''))
        first = i == 0
        run_pr = '<w:rPr><w:noProof/></w:rPr>'
        link_pr = '<w:rPr><w:rStyle w:val="af5"/><w:noProof/></w:rPr>'
        hid = '<w:rPr><w:noProof/><w:webHidden/></w:rPr>'
        begin = ''
        if first:
            begin = ('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText></w:r>'
                     '<w:r><w:fldChar w:fldCharType="separate"/></w:r>')
        # текст оглавления — без курсива и без жирности, как в образце
        link_runs = ''.join(f'<w:r>{link_pr}<w:t xml:space="preserve">{esc(seg)}</w:t></w:r>' if j == 0 else
                            f'<w:r>{link_pr}<w:br/><w:t xml:space="preserve">{esc(seg)}</w:t></w:r>' for j, seg in enumerate([text]))
        spacing0 = '<w:spacing w:after="0"/>'
        entry = (f'<w:p><w:pPr><w:pStyle w:val="{style}"/>{spacing0}</w:pPr>{begin}'
                 f'<w:hyperlink w:anchor="{bname}" w:history="1">{link_runs}'
                 f'<w:r>{hid}<w:tab/></w:r><w:r>{hid}<w:fldChar w:fldCharType="begin"/></w:r>'
                 f'<w:r>{hid}<w:instrText xml:space="preserve"> PAGEREF {bname} \\h </w:instrText></w:r>'
                 f'<w:r>{hid}<w:fldChar w:fldCharType="separate"/></w:r><w:r>{hid}<w:t>{pg}</w:t></w:r>'
                 f'<w:r>{hid}<w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>')
        entries.append(entry)
    out.extend(entries)
    out.append('<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')
    return ''.join(out)


# ------------------------------------------------------------------ пакет
def build_package(doc, out_path, fig_dir, title_xml, front_xml_fn, pages=None, example_dir=None, props=None):
    """front_xml_fn(doc, pages) -> XML титульного листа и оглавления; тело строится из doc.blocks."""
    example_dir = example_dir or EXAMPLE_DIR
    tmp = out_path + '.dir'
    if os.path.exists(tmp):
        shutil.rmtree(tmp)
    shutil.copytree(example_dir, tmp)
    # убрать лишнее из образца
    shutil.rmtree(os.path.join(tmp, 'customXml'), ignore_errors=True)
    shutil.rmtree(os.path.join(tmp, 'word', 'media'), ignore_errors=True)
    os.makedirs(os.path.join(tmp, 'word', 'media'))

    r = Renderer(doc, fig_dir)
    body = r.render()
    front = front_xml_fn(doc, pages or {})
    ex_doc = open(os.path.join(example_dir, 'word', 'document.xml'), encoding='utf-8').read()
    head = ex_doc[:ex_doc.index('<w:body>')]
    sect = ('<w:sectPr><w:footerReference w:type="default" r:id="rId23"/><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>'
            '<w:pgNumType w:start="4"/><w:cols w:space="708"/><w:titlePg/><w:docGrid w:linePitch="381"/></w:sectPr>')
    document = head + '<w:body>' + front + body + sect + '</w:body></w:document>'
    with open(os.path.join(tmp, 'word', 'document.xml'), 'w', encoding='utf-8') as fh:
        fh.write(document)

    # связи
    rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
            '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings" Target="webSettings.xml"/>',
            '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>',
            '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>',
            '<Relationship Id="rId23" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>',
            '<Relationship Id="rId24" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>',
            '<Relationship Id="rId25" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>']
    for rid, target in r.rels:
        rels.append(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="{target}"/>')
    rels.append('</Relationships>')
    with open(os.path.join(tmp, 'word', '_rels', 'document.xml.rels'), 'w', encoding='utf-8') as fh:
        fh.write(''.join(rels))
    for name in sorted(set(doc.figs)):
        shutil.copy(os.path.join(fig_dir, name + '.png'), os.path.join(tmp, 'word', 'media', name + '.png'))

    # нумерованные списки: отдельный w:num на каждый список, нумерация с 1
    num_path = os.path.join(tmp, 'word', 'numbering.xml')
    num = open(num_path, encoding='utf-8').read()
    abstract = ('<w:abstractNum w:abstractNumId="200"><w:multiLevelType w:val="singleLevel"/>'
                '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:suff w:val="space"/><w:lvlText w:val="%1"/><w:lvlJc w:val="left"/>'
                '<w:pPr><w:ind w:left="0" w:firstLine="709"/></w:pPr>'
                '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:hint="default"/><w:b w:val="0"/><w:bCs w:val="0"/><w:i w:val="0"/><w:sz w:val="28"/></w:rPr></w:lvl>'
                '</w:abstractNum>')
    nums = ''.join(f'<w:num w:numId="{200 + k}"><w:abstractNumId w:val="200"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>'
                   for k in range(1, doc.list_id + 1))
    first_num = num.index('<w:num ')
    num = num[:first_num] + abstract + num[first_num:]
    tail = num.rindex('<w:numIdMacAtCleanup') if '<w:numIdMacAtCleanup' in num else num.rindex('</w:numbering>')
    num = num[:tail] + nums + num[tail:]
    with open(num_path, 'w', encoding='utf-8') as fh:
        fh.write(num)

    # свойства и типы содержимого
    ct_path = os.path.join(tmp, '[Content_Types].xml')
    ct = open(ct_path, encoding='utf-8').read()
    ct = re.sub(r'<Override PartName="/customXml/itemProps1.xml"[^>]*/>', '', ct)
    ct = ct.replace('<Default Extension="svg" ContentType="image/svg+xml"/>', '')
    with open(ct_path, 'w', encoding='utf-8') as fh:
        fh.write(ct)
    props = props or {}
    core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
            'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f'<dc:title>{esc(props.get("title", ""))}</dc:title><dc:subject>{esc(props.get("subject", ""))}</dc:subject>'
            f'<dc:creator>{esc(props.get("creator", ""))}</dc:creator><cp:lastModifiedBy>{esc(props.get("creator", ""))}</cp:lastModifiedBy>'
            '<cp:revision>1</cp:revision>'
            f'<dcterms:created xsi:type="dcterms:W3CDTF">{props.get("created", "2026-10-06T08:00:00Z")}</dcterms:created>'
            f'<dcterms:modified xsi:type="dcterms:W3CDTF">{props.get("created", "2026-10-06T08:00:00Z")}</dcterms:modified></cp:coreProperties>')
    with open(os.path.join(tmp, 'docProps', 'core.xml'), 'w', encoding='utf-8') as fh:
        fh.write(core)
    app = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
           'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Template>Normal</Template>'
           '<Application>Microsoft Office Word</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>'
           '<LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged>'
           '<AppVersion>16.0000</AppVersion></Properties>')
    with open(os.path.join(tmp, 'docProps', 'app.xml'), 'w', encoding='utf-8') as fh:
        fh.write(app)

    # упаковка: [Content_Types].xml первым
    if os.path.exists(out_path):
        os.remove(out_path)
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(ct_path, '[Content_Types].xml')
        for root, _, files in os.walk(tmp):
            for fn in sorted(files):
                full = os.path.join(root, fn)
                arc = os.path.relpath(full, tmp)
                if arc == '[Content_Types].xml':
                    continue
                z.write(full, arc)
    shutil.rmtree(tmp)
    return out_path
