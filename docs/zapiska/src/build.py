#!/usr/bin/env python3
"""Сборка пояснительной записки: python3 build.py <номер процентовки> [выходной каталог]

Двухпроходная схема: документ собирается, затем форматируется LibreOffice → PDF; по PDF определяются страницы заголовков
(для оглавления) и места переноса таблиц на другую страницу («Продолжение таблицы N.M»). Сборка повторяется до устойчивого
результата.
"""
import importlib
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import docx_engine as E                                        # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..'))
FIG_DIR = os.path.join(ROOT, 'img')
OUT_DIR_DEFAULT = os.path.join(ROOT, 'out')
EXAMPLE_DIR = os.environ.get('PZ_EXAMPLE_DIR') or os.path.join(HERE, 'template')
E.EXAMPLE_DIR = EXAMPLE_DIR

CFG = dict(
    ministry='Министерство образования Республики Беларусь',
    university=['Учреждение образования «Белорусский государственный университет ', 'информатики и радиоэлектроники»'],
    faculty='Факультет компьютерного проектирования',
    department='Кафедра проектирования информационно-компьютерных систем',
    discipline='Дисциплина «Технологии проектирования сложных информационных систем»',
    supervisor_post='Ассистент',
    supervisor='Е.Н. Котько',
    topic='Проектирование и разработка программного средства прогнозирования объемов продаж с учетом мультиканальных маркетинговых активностей',
    topic_name='Программное средство прогнозирования объемов продаж с учетом мультиканальных маркетинговых активностей',
    cipher='БГУИР КП 6-05-0611-01 004 ПЗ',
    group='314301',
    student='ГУГАЛЕВ Андрей Сергеевич',
    city_year='Минск 2026',
)


# ------------------------------------------------------------------ титульный лист
def _p(text='', jc='center', bold=False, caps=False, size=None, ind=None, keep=False):
    rp = '<w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman"/>' + ('<w:b/>' if bold else '') + ('<w:caps/>' if caps else '') + \
         '<w:szCs w:val="24"/><w:lang w:eastAsia="ru-RU"/>'
    ppr = (f'<w:ind w:firstLine="{ind}"/>' if ind else '') + (f'<w:jc w:val="{jc}"/>' if jc else '') + f'<w:rPr>{rp}</w:rPr>'
    runs = ''
    if text:
        for i, line in enumerate(text.split('\n')):
            runs += f'<w:r><w:rPr>{rp}</w:rPr>' + ('<w:br/>' if i else '') + f'<w:t xml:space="preserve">{E.esc(line)}</w:t></w:r>'
    return f'<w:p><w:pPr>{ppr}</w:pPr>{runs}</w:p>'


def _cell(w, paras):
    return f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/></w:tcPr>{paras}</w:tc>'


def _cp(text, jc='both'):
    rp = '<w:sz w:val="28"/><w:szCs w:val="28"/>'
    runs = f'<w:r><w:rPr>{rp}</w:rPr><w:t xml:space="preserve">{E.esc(text)}</w:t></w:r>' if text else ''
    return f'<w:p><w:pPr><w:jc w:val="{jc}"/><w:rPr>{rp}</w:rPr></w:pPr>{runs}</w:p>'


def _borderless(widths, rows):
    grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    nb = ''.join(f'<w:{s} w:val="none" w:sz="0" w:space="0" w:color="auto"/>' for s in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'))
    return ('<w:tbl><w:tblPr><w:tblStyle w:val="a7"/><w:tblW w:w="0" w:type="auto"/>'
            f'<w:tblBorders>{nb}</w:tblBorders><w:tblLayout w:type="fixed"/>'
            '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
            f'<w:tblGrid>{grid}</w:tblGrid>{rows}</w:tbl>')


def title_page(c):
    x = _p(c['ministry'])
    x += _p('\n'.join(c['university']))
    x += _p()
    x += _p(c['faculty'])
    x += _p(c['department'])
    x += _p(c['discipline'])
    x += _p() + _p()
    left = 5070, 4503
    rows = ('<w:tr>' + _cell(left[0], _p()) + _cell(left[1], _cp('«К ЗАЩИТЕ ДОПУСТИТЬ»')) + '</w:tr>'
            '<w:tr>' + _cell(left[0], _p()) + _cell(left[1], _cp('Руководитель курсового проекта') + _cp(c['supervisor_post']) +
                                                    _cp('________________ ' + c['supervisor'])) + '</w:tr>'
            '<w:tr>' + _cell(left[0], _p()) + _cell(left[1], _cp('___.____.2026')) + '</w:tr>')
    x += _borderless(left, rows)
    x += _p() * 4
    x += _p('ПОЯСНИТЕЛЬНАЯ ЗАПИСКА', bold=True)
    x += _p('к курсовому проекту')
    x += _p('на тему:')
    x += _p('«' + c['topic'] + '»', bold=True, caps=True)
    x += _p()
    x += _p(c['cipher'])
    x += _p() + _p()
    right = 4928, 4645
    rows = ('<w:tr>' + _cell(right[0], _p()) + _cell(right[1], _cp(f'Выполнил студент группы {c["group"]}') + _cp(c['student']) +
                                                     _cp('_______________________________') + _cp('(подпись студента)', 'center')) + '</w:tr>'
            '<w:tr><w:trPr><w:trHeight w:val="591"/></w:trPr>' + _cell(right[0], _p()) +
            _cell(right[1], _cp('Курсовой проект представлен на проверку ___.____.2026') + _cp('_______________________________') +
                  _cp('(подпись студента)', 'center')) + '</w:tr>')
    x += _borderless(right, rows)
    x += _p() * 6
    x += _p(c['city_year'])
    return x


# ------------------------------------------------------------------ реферат и задание
def _run(text, **kw):
    return E.raw_run(text, extra='<w:lang w:eastAsia="ru-RU"/>', **kw)


def _para(runs, jc='both', ind=709, page_break=False, keep=False):
    ppr = ('<w:keepNext/>' if keep else '') + ('<w:pageBreakBefore/>' if page_break else '') + '<w:spacing w:after="0"/>' + \
          (f'<w:ind w:firstLine="{ind}"/>' if ind else '') + f'<w:contextualSpacing/><w:jc w:val="{jc}"/>'
    return f'<w:p><w:pPr>{ppr}</w:pPr>{runs}</w:p>'


def abstract_page(doc, pages):
    """Реферат: заголовок по центру (не в оглавлении), шифр, библиографическое описание, объём, ключевые слова и четыре абзаца с курсивными заголовками."""
    c = CFG
    total = pages.get('__total__') or 0
    n_fig = sum(1 for k, _ in doc.blocks if k == 'figure')
    n_tab = sum(1 for k, _ in doc.blocks if k == 'table')
    n_src = len(doc.cited)
    n_app = sum(1 for _, t, _ in doc.toc if t.startswith('Приложение '))
    app_word = 'приложения' if n_app % 10 in (2, 3, 4) and n_app not in (12, 13, 14) else ('приложение' if n_app % 10 == 1 and n_app != 11 else 'приложений')
    x = '<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:after="0"/><w:contextualSpacing/><w:jc w:val="center"/></w:pPr>' + \
        _run('РЕФЕРАТ', bold=True, size=32) + '</w:p>'
    x += _para('', ind=0)
    x += _para(_run(c['cipher']), ind=0)
    x += _para('', ind=0)
    x += _para(_run('Гугалев А.С.', bold=True) + E.inline(f' {c["topic_name"]}: пояснительная записка к курсовому проекту / '
                                                           f'А.С. Гугалев – Минск : БГУИР, 2026. – {total} с.'))
    x += _para('', ind=0)
    x += _para(E.inline(f'Пояснительная записка с. {total}, рис. {n_fig}, табл. {n_tab}, источников {n_src}, {app_word} {n_app}.'))
    x += _para('', ind=0)
    x += _para(E.inline('ПРОГНОЗИРОВАНИЕ ПРОДАЖ, МУЛЬТИКАНАЛЬНЫЙ МАРКЕТИНГ, МОДЕЛЬ МАРКЕТИНГОВОГО МИКСА, ОПТИМИЗАЦИЯ БЮДЖЕТА, '
                        'МИКРОСЕРВИС, ГОСТИНИЦА, SPRING BOOT, ANGULAR, PYTHON, POSTGRESQL.'))
    x += _para('', ind=0)
    for label, text in ABSTRACT:
        x += _para(_run(label + ': ', italic=True) + E.inline(text))
    return x


def task_pages(doc, r):
    """Задание на курсовой проект – два листа, вставленные рисунками (заменяются подписанным сканом)."""
    x = ''
    for name in ('task_1', 'task_2'):
        doc.figs.append(name)
        x += r.figure(dict(name=name, width_cm=16.5, max_h_cm=24.8, alt='Задание по курсовому проекту'), caption=False, page_break=True)
    return x


ABSTRACT = [
    ('Цель проектирования', 'разработка программного средства прогнозирования объёмов продаж с учётом мультиканальных маркетинговых активностей, '
     'встраиваемого в систему управления номерным фондом гостиницы, для повышения точности планирования продаж и эффективности распределения '
     'маркетингового бюджета.'),
    ('Методология проведения работы', 'системный анализ и моделирование процессов (BPMN 2.0, UML); модель маркетингового микса с переносом эффекта '
     'рекламы и насыщением, регрессия с регуляризацией, скользящая проверка, градиентный бустинг для сравнения, оптимизация методом множителей '
     'Лагранжа. Программное средство состоит из клиентского (Angular), серверного (Spring Boot, PostgreSQL) и интеллектуального '
     '(микросервис на Python, FastAPI) узлов.'),
    ('Результаты работы', 'сформированы требования и построены модели процессов; спроектированы архитектура, модель данных в третьей нормальной '
     'форме и программные интерфейсы. Реализованы обучение и выбор модели, прогноз с интервалом, разложение прогноза на вклады каналов, '
     'оптимизация бюджета, раздел «Прогноз продаж» в интерфейсе, авторизация по ролям, шифрование паролей, моделей и резервных копий, упрощённый '
     'режим при отказе интеллектуального узла; бронирование исходной системы переведено на выбор дат проживания. На проверочных данных ошибка '
     'прогноза выручки составила 6,0 %, прирост эффекта по рекомендации оптимизатора – 14,6 %; все 222 автоматические проверки проходят.'),
    ('Область применения результатов', 'планирование продаж и маркетингового бюджета гостиниц и других предприятий сферы услуг с несколькими '
     'каналами продвижения; учебный процесс.'),
]


def front(doc, pages, r):
    x = title_page(CFG)
    if getattr(doc, 'full', False):
        x += abstract_page(doc, pages)
        x += task_pages(doc, r)
    x += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
    x += E.toc_xml(doc, pages)
    return x


# ------------------------------------------------------------------ LibreOffice → PDF
def to_pdf(docx, outdir):
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', outdir, docx], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
    return os.path.join(outdir, os.path.splitext(os.path.basename(docx))[0] + '.pdf')


def pdf_pages(pdf):
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))
    pages = []
    for i in range(1, n + 1):
        t = subprocess.run(['pdftotext', '-f', str(i), '-l', str(i), '-layout', pdf, '-'], capture_output=True, text=True).stdout
        pages.append(t)
    return pages


def norm(s):
    s = s.replace(' ', ' ').replace('\xad', '')
    return re.sub(r'\s+', ' ', s).strip().casefold()


def locate_headings(doc, pages, first_body_page=2, offset=3):
    """Номер страницы (печатный) для каждой закладки заголовка."""
    texts = [norm(p) for p in pages]
    res = {}
    cur = first_body_page
    for lvl, text, (bid, bname) in doc.toc:
        key = norm(text)[:34]
        for pg in range(cur, len(texts)):
            if key in texts[pg]:
                res[bname] = pg + 1 + offset
                cur = pg
                break
        else:
            print('  ! заголовок не найден в PDF:', text[:50])
    return res


def row_fragment(r):
    """Короткий фрагмент текста строки таблицы для поиска её начала в PDF."""
    cells = (list(r[1]) if isinstance(r[1], list) else [r[1]]) if isinstance(r, tuple) else list(r)
    for c in cells:
        t = re.sub(r'\*\*|\$|\\[a-z]+|[{}_^]', '', str(c).split('\n')[0]).strip()
        t = norm(t)
        if len(t) >= 4:
            cut = t[:16]
            if len(t) > 16 and ' ' in cut:
                cut = cut[:cut.rindex(' ')]
            return cut
    return ''


def locate_table_splits(doc, pages, first_body_page=2):
    """Для каждой таблицы вернуть индексы строк, с которых начинается новая страница."""
    texts = [norm(p) for p in pages]
    offsets, pos = [], 0
    for t in texts:
        offsets.append(pos)
        pos += len(t) + 1
    big = ' '.join(texts)

    def page_of(idx):
        pg = 0
        for i, o in enumerate(offsets):
            if o <= idx:
                pg = i
        return pg

    result = {}
    cur = offsets[first_body_page]
    for kind, data in doc.blocks:
        if kind != 'table':
            continue
        cap = norm(f'Таблица {data["num"]} – ' + doc.ref(data['caption']))[:40]
        j = big.find(cap, cur)
        if j >= 0:
            cur = j
        row_pages = []
        for r in data['rows']:
            frag = row_fragment(r)
            k = big.find(frag, cur + 1) if frag else -1
            if k >= 0 and page_of(k) - page_of(cur) > 1:
                k = -1                      # слишком далеко: совпадение в другом месте текста
            if k < 0:
                row_pages.append(row_pages[-1] if row_pages else page_of(cur))
            else:
                cur = k
                row_pages.append(page_of(k))
        result[data['key']] = [i for i in range(1, len(row_pages)) if row_pages[i] > row_pages[i - 1]]
    return result


# ------------------------------------------------------------------ заполнение страниц: рисунки, не поместившиеся в конец страницы
PAGE_BOTTOM_CM = 26.5          # нижняя граница основного текста (с учётом подвала)
GAP_MIN_CM = 3.0               # пустое место внизу страницы, которое нужно заполнить
MIN_SCALE = 0.72               # во сколько раз можно уменьшить рисунок, чтобы он поместился


def page_bottoms(pdf, workdir):
    """Нижняя граница содержимого (см от верха листа) на каждой странице; подвал (номер страницы) не учитывается."""
    import glob
    from PIL import Image
    for f in glob.glob(os.path.join(workdir, 'pg-*.png')):
        os.remove(f)
    subprocess.run(['pdftoppm', '-r', '30', '-gray', '-png', pdf, os.path.join(workdir, 'pg')], check=True)
    res = []
    for f in sorted(glob.glob(os.path.join(workdir, 'pg-*.png'))):
        im = Image.open(f).convert('L')
        w, h = im.size
        px = im.load()
        lim = int(PAGE_BOTTOM_CM / 29.7 * h)
        last = 0.0
        for y in range(lim, -1, -1):
            if any(px[x, y] < 200 for x in range(w)):
                last = y / h * 29.7
                break
        res.append(last)
    return res


def figure_adjustments(doc, pages, bottoms, adj, body_start):
    """Для рисунков, стоящих первыми на странице после большого пустого места, подбирает уменьшение рисунка или перенос
    следующих за ним абзацев на предыдущую страницу. Изменения только в сторону усиления, чтобы сборка сходилась."""
    new = {'hoist': dict(adj.get('hoist', {})), 'scale': dict(adj.get('scale', {}))}
    texts = [norm(t) for t in pages]
    firsts = []
    for t in pages:
        lines = [ln.strip() for ln in t.split('\n') if ln.strip()]
        firsts.append(norm(lines[0]) if lines else '')
    blocks = doc.blocks
    cur = body_start
    for i, (kind, data) in enumerate(blocks):
        if kind != 'figure':
            continue
        cap = norm(f'Рисунок {data["num"]} –')
        pg = next((k for k in range(cur, len(pages)) if cap in texts[k]), None)
        if pg is None:
            continue
        cur = pg
        if not firsts[pg].startswith(cap) or pg == 0:
            continue                                   # рисунок не в начале страницы – пустого места перед ним нет
        gap = PAGE_BOTTOM_CM - bottoms[pg - 1]
        if gap < GAP_MIN_CM:
            continue
        h_now = E.figure_height_cm(data, FIG_DIR)
        room = gap - 1.7                               # пустая строка до, подпись и пустая строка после
        if room >= h_now * MIN_SCALE:
            if room < h_now - 0.05:
                new['scale'][data['key']] = min(new['scale'].get(data['key'], 99), round(room, 2))
            continue
        # рисунок не уменьшить – заполняем место текстом, который идёт после рисунка
        lines_free = (gap - 0.9) / 0.58
        j, total, n = i + 1, 0, 0
        while j < len(blocks) and blocks[j][0] == 'blank':
            j += 1
        while j < len(blocks) and blocks[j][0] == 'p' and total < lines_free:
            text = blocks[j][1][0]
            if text.rstrip().endswith(':'):             # вводная фраза к списку переносится вместе со списком
                j2 = j + 1
                while j2 < len(blocks) and blocks[j2][0] == 'blank':
                    j2 += 1
                if j2 < len(blocks) and blocks[j2][0] == 'list':
                    total += E.est_lines(text) + sum(E.est_lines(it) for it in blocks[j2][1][1])
                    n += j2 - j + 1
                    j = j2 + 1
                    continue
                break
            total += E.est_lines(text)
            n += 1
            j += 1
        if n:
            new['hoist'][data['key']] = max(new['hoist'].get(data['key'], 0), n)
        elif room >= h_now * 0.6:
            new['scale'][data['key']] = min(new['scale'].get(data['key'], 99), round(room, 2))
    return new


MAX_ADJ_PASSES = 8             # после этого число проходов подбора рисунков фиксируется, остаётся сходимость переносов таблиц


def main():
    import tempfile
    n = sys.argv[1] if len(sys.argv) > 1 else '1'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else OUT_DIR_DEFAULT
    os.makedirs(out_dir, exist_ok=True)
    mod = importlib.import_module(f'content_p{n}')
    name = f'ПЗ_процентовка_{n}'
    docx = os.path.join(out_dir, name + '.docx')
    props = dict(title=CFG['topic'], subject='Пояснительная записка к курсовому проекту', creator='Гугалев А.С.')
    probe = mod.build()
    full = getattr(probe, 'full', False)                # полный комплект: реферат и задание перед оглавлением, нумерация с 1
    pg_start, offset, first_body = (1, 0, 5) if full else (4, 3, 2)
    for sec in E.audit_lists(probe):
        print('  ! раздел заканчивается списком (нужен завершающий абзац):', sec)

    def assemble(splits, pages_map, adj):
        doc = mod.build()
        E.apply_float_adjustments(doc, adj)
        doc.splits = splits
        doc.pages_total = pages_map.get('__total__', 0)
        E.build_package(doc, docx, FIG_DIR, None, front, pages_map, example_dir=EXAMPLE_DIR, props=props, pg_start=pg_start)
        return doc

    splits, pages_map, adj = {}, {}, {'hoist': {}, 'scale': {}}
    seen = []
    work = tempfile.mkdtemp(prefix='pz_pg_')
    for it in range(1, 16):
        doc = assemble(splits, pages_map, adj)
        pdf = to_pdf(docx, out_dir)
        pages = pdf_pages(pdf)
        toc_first = first_body - 1
        if 'СОДЕРЖАНИЕ' not in pages[toc_first]:
            print(f'  ! оглавление не на странице {toc_first + 1} (реферат или задание занимают лишнюю страницу?)')
        # оглавление может занимать несколько страниц: тело начинается после последней страницы с рядами точек
        body = max(i for i in range(toc_first, min(toc_first + 4, len(pages))) if re.search(r'\.{8,}', pages[i])) + 1
        new_adj = adj
        if it <= MAX_ADJ_PASSES:
            new_adj = figure_adjustments(doc, pages, page_bottoms(pdf, work), adj, body)
        new_pages = locate_headings(doc, pages, first_body_page=body, offset=offset)
        new_pages['__total__'] = len(pages) + offset
        new_splits = locate_table_splits(doc, pages, first_body_page=body)
        new_splits = {k: v for k, v in new_splits.items() if v}
        print(f'проход {it}: страниц {len(pages)}, переносов таблиц {sum(len(v) for v in new_splits.values())}, '
              f'рисунков уменьшено {len(new_adj["scale"])}, с переносом текста {len(new_adj["hoist"])}')
        if new_splits == splits and new_pages == pages_map and new_adj == adj:
            break
        diff = {k: (splits.get(k), new_splits.get(k)) for k in set(splits) | set(new_splits) if splits.get(k) != new_splits.get(k)}
        if diff:
            print('   изменения переносов:', diff)
        state = (repr(sorted(new_splits.items())), repr(sorted(new_pages.items())), repr(sorted(new_adj['hoist'].items())),
                 repr(sorted(new_adj['scale'].items())))
        if state in seen:
            print('   ! колебание, фиксирую последнее состояние')
            splits, pages_map, adj = new_splits, new_pages, new_adj
            assemble(splits, pages_map, adj)
            to_pdf(docx, out_dir)
            break
        seen.append(state)
        splits, pages_map, adj = new_splits, new_pages, new_adj
    shutil.rmtree(work, ignore_errors=True)
    print('готово:', docx)
    return docx


if __name__ == '__main__':
    main()
