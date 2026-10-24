ARG BUILD_FROM
FROM ${BUILD_FROM}

# Node.js bringt das Grundsystem mit (offizielles Paket, deutsche Zahlen- und Datumsformate eingebaut).
# poppler (pdftotext) zum Auslesen der Rechnungen, Build-Werkzeuge nur vorübergehend für das SQLite-Modul
# tzdata: richtige Ortszeit für Buchungen, tar: Komplettsicherung, tesseract: Fotos und fotografierte PDFs per Bilderkennung lesen
RUN apk add --no-cache poppler-utils tzdata tar tesseract-ocr tesseract-ocr-data-deu tesseract-ocr-data-eng \
 && apk add --no-cache --virtual .build-deps python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
# nodedir=/usr/local: Header liegen im Node-Paket, kein Download von nodejs.org nötig
RUN npm_config_nodedir=/usr/local npm ci --omit=dev --no-audit --no-fund \
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
