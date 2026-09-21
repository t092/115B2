var AUTH_CONFIG = {
  clientId: '403500919614-4c109l85fn6hul7nng2nskbs9kn4reis.apps.googleusercontent.com',
  domain: 'st.tc.edu.tw',
  unit: '二上第1課_商周至隋唐的國家與社會'
};

function googleCertificates() {
  var cache = CacheService.getScriptCache();
  var stored = cache.get('google-id-certificates');
  if (stored) return JSON.parse(stored);
  var response = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v1/certs', { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('暫時無法驗證 Google 帳號，請稍後重試');
  var text = response.getContentText();
  var certificates = JSON.parse(text);
  var headers = response.getAllHeaders();
  var control = Object.keys(headers).filter(function(key) { return key.toLowerCase() === 'cache-control'; })[0];
  var match = String(headers[control] || '').match(/max-age=(\d+)/);
  var ttl = match ? Math.min(21600, Number(match[1])) : 300;
  if (ttl > 0) cache.put('google-id-certificates', text, ttl);
  return certificates;
}

function verifyStudentToken(token) {
  if (typeof token !== 'string' || token.length > 10000 || token.split('.').length !== 3) {
    throw new Error('請重新登入學校 Google 帳號');
  }
  var forge = createForgeVerifier();
  function decode(part) {
    var base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return forge.util.decode64(base64 + '='.repeat((4 - base64.length % 4) % 4));
  }
  var parts = token.split('.');
  var header, claims;
  try {
    header = JSON.parse(forge.util.decodeUtf8(decode(parts[0])));
    claims = JSON.parse(forge.util.decodeUtf8(decode(parts[1])));
  } catch (_) { throw new Error('Google 登入憑證格式錯誤'); }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Google 登入憑證無效');
  var certificates = googleCertificates();
  if (!Object.prototype.hasOwnProperty.call(certificates, header.kid)) {
    // A rotated signing key may not be present in the cached certificate set.
    CacheService.getScriptCache().remove('google-id-certificates');
    certificates = googleCertificates();
  }
  if (!Object.prototype.hasOwnProperty.call(certificates, header.kid)) throw new Error('Google 登入憑證簽章無效');
  var digest = forge.md.sha256.create();
  digest.update(parts[0] + '.' + parts[1], 'utf8');
  var valid = false;
  try {
    valid = forge.pki.certificateFromPem(certificates[header.kid]).publicKey.verify(digest.digest().bytes(), decode(parts[2]));
  } catch (_) { /* Reject malformed RSA signatures. */ }
  var now = Math.floor(Date.now() / 1000);
  if (!valid || claims.aud !== AUTH_CONFIG.clientId ||
      ['accounts.google.com', 'https://accounts.google.com'].indexOf(claims.iss) === -1 ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now + 60 ||
      typeof claims.sub !== 'string' || !claims.sub ||
      claims.email_verified !== true || claims.hd !== AUTH_CONFIG.domain ||
      typeof claims.email !== 'string' || !claims.email.toLowerCase().endsWith('@' + AUTH_CONFIG.domain)) {
    throw new Error('Google 登入已過期或不是允許的學校帳號，請重新登入');
  }
  return claims;
}

function sheetText(value) {
  var text = String(value == null ? '' : value).trim();
  if (text.length > 500) throw new Error('欄位內容過長');
  return /^[=+@-]/.test(text) ? "'" + text : text;
}
