'use strict';
/** Pfad der Datenbank. Übernimmt einmalig die Datei der Vorgängerversion (getraenke.db → clubwerk.db). */
const fs = require('fs');
const path = require('path');

module.exports = function dbFile(dataDir) {
  const file = path.join(dataDir, 'clubwerk.db');
  const old = path.join(dataDir, 'getraenke.db');
  try {
    if (!fs.existsSync(file) && fs.existsSync(old)) {
      for (const ext of ['', '-wal', '-shm']) if (fs.existsSync(old + ext)) fs.renameSync(old + ext, file + ext);
    }
  } catch (e) { console.error('Datenbank: Umbenennen nicht möglich –', e.message); return old; }
  return file;
};
