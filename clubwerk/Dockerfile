ARG BUILD_FROM
FROM ${BUILD_FROM}

# Node.js für die App, poppler (pdftotext) zum Auslesen der Rechnungen,
# Build-Werkzeuge nur vorübergehend für das SQLite-Modul
# icu-data-full: deutsche Zahlen- und Datumsformate auf dem Server (sonst „€0.00“ statt „0,00 €“), tzdata: richtige Ortszeit für Buchungen, tar: Komplettsicherung, tesseract: Fotos und fotografierte PDFs per Bilderkennung lesen
RUN apk add --no-cache nodejs npm icu-data-full poppler-utils tzdata tar tesseract-ocr tesseract-ocr-data-deu tesseract-ocr-data-eng \
 && apk add --no-cache --virtual .build-deps python3 make g++ nodejs-dev

WORKDIR /app
COPY package.json package-lock.json ./
# nodedir=/usr: Header kommen aus nodejs-dev, kein Download von nodejs.org nötig
RUN npm_config_nodedir=/usr npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force \
 && apk del .build-deps

COPY src ./src
COPY public ./public
COPY seed ./seed
COPY erweiterungen ./erweiterungen
COPY sprachen ./sprachen
COPY run.sh /run.sh
RUN chmod a+x /run.sh

ENV NODE_ENV=production
CMD [ "/run.sh" ]
