# Erzeugt gute und präparierte tar.gz-Archive für tarx_test.js. Aufruf: python3 make_tars.py <ordner>
import tarfile, io, os, sys
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
def mk(name, entries, fmt=tarfile.GNU_FORMAT):
    with tarfile.open(os.path.join(out, name), 'w:gz', format=fmt) as t:
        for e in entries:
            ti = tarfile.TarInfo(e['n']); ti.type = e.get('t', tarfile.REGTYPE)
            if 'l' in e: ti.linkname = e['l']
            data = e.get('d', b'x')
            if ti.type == tarfile.REGTYPE: ti.size = len(data); t.addfile(ti, io.BytesIO(data))
            else: t.addfile(ti)
long = 'fotos/' + 'a' * 150 + '.jpg'
mk('good.tgz', [{'n': 'manifest.json'}, {'n': 'clubwerk.db'}, {'n': 'fotos', 't': tarfile.DIRTYPE}, {'n': long}, {'n': 'belege/x.pdf'}])
mk('goodpax.tgz', [{'n': 'manifest.json'}, {'n': long}, {'n': 'fotos/ümlaut é.jpg'}], tarfile.PAX_FORMAT)
mk('sym.tgz', [{'n': 'manifest.json'}, {'n': 'fotos/x', 't': tarfile.SYMTYPE, 'l': '/etc/passwd'}])
mk('hard.tgz', [{'n': 'manifest.json'}, {'n': 'fotos/x', 't': tarfile.LNKTYPE, 'l': 'manifest.json'}])
mk('dotdot.tgz', [{'n': 'fotos/../../etc/x'}])
mk('abs.tgz', [{'n': '/etc/x'}])
mk('longdd.tgz', [{'n': 'fotos/' + 'b' * 120 + '/../../../x'}])
mk('paxdd.tgz', [{'n': 'fotos/' + 'c' * 120 + '/../../x'}], tarfile.PAX_FORMAT)
mk('dev.tgz', [{'n': 'fotos/dev', 't': tarfile.CHRTYPE}])
mk('fifo.tgz', [{'n': 'fotos/f', 't': tarfile.FIFOTYPE}])
mk('unknown.tgz', [{'n': 'evil.sh'}])
mk('nl.tgz', [{'n': 'fotos/a\nclubwerk.db'}])
mk('bslash.tgz', [{'n': 'fotos/a\\..\\x'}])
mk('dirroot.tgz', [{'n': 'clubwerk.db', 't': tarfile.DIRTYPE}])
