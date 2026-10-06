"""Третья процентовка – полный комплект: реферат, задание, оглавление, введение, разделы 1–5, заключение, источники, приложения, ведомость."""
import docx_engine as E
import sec_intro
import sec_1
import sec_2
import sec_3a
import sec_3b
import sec_3c
import sec_4
import sec_5
import sec_end
from sources_data import SRC


def build():
    d = E.Doc()
    d.full = True
    d.sources_db_all = SRC
    sec_intro.add(d)
    sec_1.add(d)
    sec_2.add(d)
    sec_3a.add(d)
    sec_3b.add(d)
    sec_3c.add(d)
    sec_4.add(d)
    sec_5.add(d)
    sec_end.conclusion(d)
    d.h1('Список использованных источников', numbered=False)
    d.sources(SRC)
    sec_end.appendix_report(d)
    sec_end.appendix_code(d)
    sec_end.statement(d)
    return d
