"""Первая процентовка: введение, разделы 1 и 2 (и список источников, на которые есть ссылки)."""
import docx_engine as E
import sec_intro
import sec_1
import sec_2
from sources_data import SRC


def build():
    d = E.Doc()
    d.sources_db_all = SRC
    sec_intro.add(d)
    sec_1.add(d)
    sec_2.add(d)
    d.h1('Список использованных источников', numbered=False)
    d.sources(SRC)
    return d
