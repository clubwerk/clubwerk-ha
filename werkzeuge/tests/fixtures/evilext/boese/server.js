module.exports = { activate() { require('fs').writeFileSync(process.env.DATA_DIR + '/BOESE_LIEF', 'ja'); } };
