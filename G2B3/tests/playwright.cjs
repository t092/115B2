// Standard install first; an explicit path also supports bundled/offline runtimes.
try {
  module.exports = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
} catch (error) {
  throw new Error('找不到 Playwright。請安裝 playwright，或設定 PLAYWRIGHT_MODULE 為套件絕對路徑。', {cause:error});
}
