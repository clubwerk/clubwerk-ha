// Läuft in der Buchungsseite: meldet der Homepage (nur den eingetragenen Adressen) die Höhe des Inhalts, damit der Rahmen mitwächst.
(() => {
  let ziele = [];
  try { if (window.top === window.self) return; } catch (e) { /* fremder Rahmen: weiter */ }
  ziele = String(document.body.dataset.homepage || '').split(/\s+/).filter(Boolean);
  if (!ziele.length) return;
  let alt = 0;
  const melden = () => {
    const h = Math.ceil(document.documentElement.scrollHeight);
    if (Math.abs(h - alt) < 2) return; alt = h;
    for (const z of ziele) window.parent.postMessage({ typ: 'cw-gb-hoehe', h }, z);
  };
  new ResizeObserver(melden).observe(document.documentElement);
  window.addEventListener('load', melden);
})();
