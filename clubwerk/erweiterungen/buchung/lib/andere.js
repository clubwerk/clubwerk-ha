'use strict';
/** Wer steht in der Nachricht an `id`? Alle anderen Beteiligten (Bucher und Mitspieler), nie der Empfänger selbst. */
module.exports = (ids, id, nameOf) => [...new Set(ids)].filter(x => x !== id).map(nameOf);
