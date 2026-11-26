// Шифрование семейного сайта. Один и тот же код работает в браузере (window.Vault) и в Node (module.exports).
// Ключ: PBKDF2-HMAC-SHA256 из фразы-пароля, 64 байта: 32 на шифр AES-256-GCM, 32 на имена файлов (HMAC-SHA256).
// Вектор инициализации — HMAC от SHA-256 содержимого: одинаковый файл даёт одинаковый шифр.
(function (root) {
  var subtle = (root.crypto || globalThis.crypto).subtle;
  var encoder = new TextEncoder();

  function normalizePassphrase(text) {
    return String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase().replace(/ё/g, 'е');
  }

  function hex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function importKeys(raw) {
    raw = new Uint8Array(raw);
    return Promise.all([
      subtle.importKey('raw', raw.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
      subtle.importKey('raw', raw.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    ]).then(function (keys) { return { raw: raw, enc: keys[0], names: keys[1] }; });
  }

  function deriveKeys(passphrase, salt, iterations) {
    var bytes = encoder.encode(normalizePassphrase(passphrase));
    return subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations: iterations }, base, 512);
      })
      .then(importKeys);
  }

  function fileName(keys, path) {
    return subtle.sign('HMAC', keys.names, encoder.encode(path)).then(function (mac) { return hex(mac).slice(0, 24); });
  }

  function encrypt(keys, data) {
    data = new Uint8Array(data);
    return subtle.digest('SHA-256', data)
      .then(function (digest) { return subtle.sign('HMAC', keys.names, digest); })
      .then(function (mac) {
        var iv = new Uint8Array(mac).slice(0, 12);
        return subtle.encrypt({ name: 'AES-GCM', iv: iv }, keys.enc, data).then(function (sealed) {
          var out = new Uint8Array(12 + sealed.byteLength);
          out.set(iv, 0);
          out.set(new Uint8Array(sealed), 12);
          return out;
        });
      });
  }

  function decrypt(keys, data) {
    data = new Uint8Array(data);
    return subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, keys.enc, data.slice(12))
      .then(function (plain) { return new Uint8Array(plain); });
  }

  function unhex(text) {
    var out = new Uint8Array(text.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(text.substr(i * 2, 2), 16);
    return out;
  }

  // Открыть данные сайта ключом: {key — 128 шестнадцатеричных знаков для хранения в телефоне, data — данные сайта}.
  function openWithKey(keyHex, dataBytes) {
    return importKeys(unhex(keyHex)).then(function (keys) {
      return decrypt(keys, dataBytes).then(function (plain) {
        return { key: keyHex, keys: keys, data: JSON.parse(new TextDecoder().decode(plain)) };
      });
    });
  }

  // Открыть данные сайта фразой-паролем. Неверная фраза — ошибка с сообщением «wrong-phrase».
  function openSite(passphrase, site, dataBytes) {
    return deriveKeys(passphrase, unhex(site.salt), site.iterations).then(function (keys) {
      return decrypt(keys, dataBytes).then(function (plain) {
        return { key: hex(keys.raw), keys: keys, data: JSON.parse(new TextDecoder().decode(plain)) };
      }, function () { throw new Error('wrong-phrase'); });
    });
  }

  var api = { normalizePassphrase: normalizePassphrase, deriveKeys: deriveKeys, importKeys: importKeys,
              fileName: fileName, encrypt: encrypt, decrypt: decrypt, openSite: openSite, openWithKey: openWithKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Vault = api;
})(typeof window !== 'undefined' ? window : globalThis);
