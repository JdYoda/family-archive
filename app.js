(function () {
  var main = document.getElementById('main');
  function stored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function forget(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plainText(s) { return String(s).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); }
  function matches(query, name) {
    var words = plainText(query).split(' ').filter(Boolean), target = plainText(name);
    return words.every(function (word) { return target.indexOf(word) >= 0; });
  }
  function header(title, showNav) {
    document.getElementById('title').textContent = title;
    document.getElementById('nav').style.display = showNav ? '' : 'none';
    document.getElementById('back').style.visibility = 'hidden';
  }

  function start(F, media) {
    var P = F.people, D = F.docs, viewer = stored('ft_viewer');
    var as = (location.search.match(/[?&]as=([A-Za-z0-9-]+)/) || [])[1];
    if (as && F.viewers.indexOf(as) >= 0) { viewer = as; store('ft_viewer', as); }
    if (F.viewers.indexOf(viewer) < 0) viewer = null;

    // «638-м», «115-й»: неразрывный дефис, чтобы окончание не уезжало на новую строку.
    function prose(s) { return esc(s).replace(/(\d)-([а-яё]{1,2})(?![а-яё])/g, '$1‑$2'); }
    function joinNonEmpty(parts, sep) {
      return parts.filter(function (part) { return part && String(part).trim(); }).join(sep || ' · ');
    }
    function bare(name) { return name.replace(/\s*\([^)]*\)/g, ''); }
    function initials(p) { return bare(p.name).split(' ').slice(0, 2).map(function (w) { return w.charAt(0); }).join(''); }
    function kin(id) { return (F.kin[viewer] || {})[id] || ''; }
    function hedge(role, ref) { return role + (ref.hyp ? ', предположительно' : ''); }
    // Картинки вставляются с data-src: настоящий адрес подставляет media.url (на сайте — после расшифровки).
    function picture(path, cls, lazy) {
      return '<img' + (cls ? ' class="' + cls + '"' : '') + (lazy ? ' data-lazy="1"' : '') + ' data-src="' + esc(path) + '" alt="">';
    }

    function parentRefs(id) {
      var own = P[id].parents;
      if (own.length || !P[id].twin.length) return own;
      var found = [];
      P[id].twin.forEach(function (twin) {
        P[twin].parents.forEach(function (ref) { found.push({ id: ref.id, hyp: true, via: true }); });
      });
      return found;
    }
    function parentsOf(id, sex) { return parentRefs(id).filter(function (ref) { return P[ref.id].sex === sex; }); }

    function chip(ref, note) {
      var p = P[ref.id];
      return '<a class="chip big' + (ref.hyp ? ' hyp' : '') + '" href="#/tree/' + ref.id + '"><b>' + esc(p.short) + '</b><span>' + esc(p.years) + '</span>' +
        (note ? '<small>' + esc(note) + '</small>' : '') + '</a>';
    }
    function slot(refs, emptyText) {
      if (!refs.length) return '<div class="chip empty">' + esc(emptyText || 'пока не знаем') + '</div>';
      var note = refs.length > 1 ? 'один из ' + (refs.length === 2 ? 'двух' : 'нескольких') : '';
      return refs.map(function (ref) { return chip(ref, note || (ref.via ? 'если это тот же человек' : (ref.hyp ? 'предположительно' : ''))); }).join('');
    }
    function grandPair(side) {
      if (!side.length) return '<div class="pair"><div class="chip empty">—</div></div>';
      return '<div class="pair">' + slot(parentsOf(side[0].id, 'm')) + slot(parentsOf(side[0].id, 'f')) + '</div>';
    }
    function grandRow(fathers, mothers) {
      if (fathers.length < 2 && mothers.length < 2) return '<div class="row">' + grandPair(fathers) + grandPair(mothers) + '</div>';
      // Несколько кандидатов в родители: их родителей показываем общим рядом на всю ширину, по двое.
      var seen = {}, chips = '';
      [fathers, mothers].forEach(function (side) {
        side.forEach(function (candidate) {
          parentRefs(candidate.id).forEach(function (ref) {
            if (seen[ref.id]) return;
            seen[ref.id] = 1;
            chips += side.length > 1 ? chip({ id: ref.id, hyp: true }, 'предположительно') : chip(ref, ref.hyp ? 'предположительно' : '');
          });
        });
      });
      return chips ? '<div class="row wrap multi">' + chips + '</div>' : '<div class="row"><div class="chip empty">пока не знаем</div></div>';
    }

    function viewWho() {
      var h = '<div class="who-screen"><h2>Кто вы?</h2><p>Выберите себя. Дерево покажет, кто кем вам приходится.</p>' +
        F.viewers.map(function (k) { return '<button class="btn whob" data-who="' + k + '">' + esc(bare(P[k].name)) + '</button>'; }).join('') + '</div>';
      if (media.encrypted) h += '<p class="foot"><a class="logout" data-logout="1">Выйти на этом телефоне</a></p>';
      return h;
    }

    function viewTree(id) {
      if (!P[id]) id = viewer;
      var p = P[id], fathers = parentsOf(id, 'm'), mothers = parentsOf(id, 'f'), h = '';
      h += '<a class="me" href="#/who">Вы: ' + esc(P[viewer].short) + ' · сменить</a>';
      if (fathers.length || mothers.length) {
        h += '<div class="gen-label">родители родителей</div>' + grandRow(fathers, mothers) + '<div class="join"></div>';
        h += '<div class="gen-label">родители</div><div class="row"><div class="pair">' + slot(fathers) + '</div><div class="pair">' + slot(mothers) + '</div></div><div class="join"></div>';
      }
      h += '<a class="focus" href="#/p/' + id + '"><div class="nm">' + esc(p.name) + '</div><div class="yr">' + esc(p.years) + '</div><div class="rl">' + esc(kin(id)) + '</div><div class="btn">Открыть страницу</div></a>';
      if (p.spouses.length) {
        h += '<div class="gen-label">' + (p.sex === 'm' ? 'жена' : 'муж') + '</div><div class="row wrap">' + p.spouses.map(function (ref) { return chip(ref, ref.hyp ? 'предположительно' : ''); }).join('') + '</div>';
      }
      if (p.children.length) {
        h += '<div class="join"></div><div class="gen-label">дети</div><div class="row wrap">' + p.children.map(function (ref) { return chip(ref, ref.hyp ? 'предположительно' : ''); }).join('') + '</div>';
      }
      h += '<p class="hint">Нажмите на человека, чтобы перейти к нему.<br>Нажмите на рамку в середине — откроется его страница.</p>';
      if (id !== viewer) h += '<a class="btn light" href="#/tree/' + viewer + '">Вернуться к себе</a>';
      return h;
    }

    function personRow(id, role) {
      var p = P[id];
      return '<a href="#/p/' + id + '"><div class="who">' + esc(p.name) + '<small>' + esc(joinNonEmpty([role, p.years])) + '</small></div><span class="arr">›</span></a>';
    }
    function docCard(d) {
      var who = D[d].people.slice(0, 2).map(function (k) { return P[k].short; }).join(', ');
      return '<a class="doc" href="#/d/' + d + '">' + picture(D[d].thumb, '', true) + '<div><b>' + esc(D[d].title) + '</b><span>' + esc(D[d].date || who) + '</span></div></a>';
    }
    function viewPerson(id) {
      var p = P[id];
      // В кружке — снимок, выбранный пометкой «аватар»; без него — инициалы.
      var face = p.face ? picture(p.face, 'ava', false) : '<div class="ava">' + esc(initials(p)) + '</div>';
      var h = '<div class="hero">' + face + '<div><div class="nm">' + esc(p.name) + '</div><div class="yr">' + joinNonEmpty([esc(p.years), esc(p.place)], '<br>') + '</div></div></div>';
      h += '<div class="tags"><span class="tag">' + (id === viewer ? 'это вы' : 'Вам: ' + esc(kin(id))) + '</span>';
      if (p.badge === 'doc') h += '<span class="tag ok">есть документы</span>';
      if (p.badge === 'oral') h += '<span class="tag oral">со слов семьи</span>';
      if (p.badge === 'hyp') h += '<span class="tag hyp">предположение</span>';
      h += '</div>';
      if (p.story.length) h += '<h2>История</h2>' + p.story.map(function (t) { return '<p>' + prose(t) + '</p>'; }).join('');
      if (p.facts.length) h += '<h2>Коротко</h2><dl class="facts">' + p.facts.map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + prose(x[1]) + '</dd></div>'; }).join('') + '</dl>';
      var fam = '';
      p.parents.forEach(function (ref) { fam += personRow(ref.id, hedge(P[ref.id].sex === 'm' ? 'отец' : 'мать', ref)); });
      p.spouses.forEach(function (ref) { fam += personRow(ref.id, hedge(P[ref.id].sex === 'm' ? 'муж' : 'жена', ref)); });
      p.siblings.forEach(function (ref) { fam += personRow(ref.id, hedge(P[ref.id].sex === 'm' ? 'брат' : 'сестра', ref)); });
      p.children.forEach(function (ref) { fam += personRow(ref.id, hedge(P[ref.id].sex === 'm' ? 'сын' : 'дочь', ref)); });
      p.twin.forEach(function (k) { fam += personRow(k, 'возможно, это тот же человек'); });
      if (fam) h += '<h2>Семья</h2><div class="list">' + fam + '</div>';
      if (p.photos.length) {
        h += '<h2>Фотографии</h2><div class="docs">' + p.photos.map(function (photo) {
          return '<a class="doc photo" data-view="' + esc(photo.web) + '">' + picture(photo.thumb, '', true) + '<div><b>' + esc(photo.caption) + '</b></div></a>';
        }).join('') + '</div>';
      }
      if (p.docs.length) h += '<h2>Документы</h2><p class="count">Листов: ' + p.docs.length + '</p><div class="docs">' + p.docs.map(docCard).join('') + '</div>';
      if (p.unknown.length) h += '<h2>Чего мы пока не знаем</h2><ul class="unk">' + p.unknown.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      h += '<a class="btn light" href="#/tree/' + id + '">Показать на дереве</a>';
      if (ancestors(id).depth > 0) h += '<a class="btn light" href="#/fan/' + id + '">Предки на веере</a>';
      h += '<p class="foot">Даты до 1918 года даны по старому стилю.</p>';
      return h;
    }

    var zoom = 1;
    function viewDoc(id) {
      var d = D[id], h = '';
      zoom = 1;
      if (d.date) h += '<p class="docdate">' + esc(d.date) + '</p>';
      h += '<div class="scan">' + picture(d.web, '', false).replace('<img', '<img id="scan"') + '</div>';
      h += '<div class="zoom"><button data-z="-1">− Меньше</button><button data-z="1">＋ Крупнее</button><button data-view="' + esc(d.web) + '">Весь лист</button></div>';
      if (d.sheet) {
        h += '<div class="sheets">' + (d.sheet.prev ? '<a href="#/d/' + d.sheet.prev + '">← Предыдущий</a>' : '<span></span>') +
          '<b>Лист ' + d.sheet.n + ' из ' + d.sheet.of + '</b>' + (d.sheet.next ? '<a href="#/d/' + d.sheet.next + '">Следующий →</a>' : '<span></span>') + '</div>';
      }
      if (d.plain) h += '<h2>Простыми словами</h2><p>' + prose(d.plain) + '</p>';
      if (d.quote) h += '<h2>Что написано в документе</h2><blockquote>' + esc(d.quote) + '</blockquote>';
      if (d.source) h += '<h2>Откуда документ</h2><p class="src">' + esc(d.source) + '</p>';
      if (d.people.length) h += '<h2>Кто здесь упомянут</h2><div class="list">' + d.people.map(function (k) { return personRow(k, kin(k)); }).join('') + '</div>';
      h += '<button class="orig" data-view="' + esc(d.orig) + '">Оригинал в полном качестве</button>';
      h += '<p class="foot">Даты до 1918 года даны по старому стилю.</p>';
      return h;
    }

    function viewPeople() {
      var ids = Object.keys(P).sort(function (a, b) { return bare(P[a].name).localeCompare(bare(P[b].name), 'ru'); });
      return '<input class="search" id="q" type="search" placeholder="Найти по имени или фамилии">' +
        '<p class="count">Всего людей: ' + ids.length + '</p>' +
        '<a class="btn light" href="#/docs">Все документы: ' + Object.keys(D).length + ' листов</a>' +
        '<p class="note" id="none" style="display:none">Никого не нашли. Попробуйте только фамилию или только имя.</p>' +
        '<div class="list" id="plist">' + ids.map(function (k) { return personRow(k, kin(k)); }).join('') + '</div>';
    }

    function archiveOf(d) {
      // Архив — первая часть строки «Откуда документ», до первой запятой или точки.
      var name = (d.source || '').split(/[.,]/)[0].trim();
      return name || 'Прочие документы';
    }
    function viewDocs() {
      var groups = {}, order = [];
      Object.keys(D).sort(function (a, b) { return D[a].title.localeCompare(D[b].title, 'ru'); }).forEach(function (id) {
        var key = archiveOf(D[id]);
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(id);
      });
      order.sort(function (a, b) { return groups[b].length - groups[a].length; });
      var h = '<p class="count">Всего листов: ' + Object.keys(D).length + '. Документы, где упомянуты люди, есть и на их страницах.</p>';
      order.forEach(function (key) {
        h += '<h2>' + esc(key) + '</h2><div class="list">' + groups[key].map(function (id) {
          return '<a href="#/d/' + id + '"><div class="who">' + esc(D[id].title) + '<small>' + esc(D[id].date) + '</small></div><span class="arr">›</span></a>';
        }).join('') + '</div>';
      });
      return h;
    }

    function viewQuestions() {
      var h = '<div class="note">Здесь собрано то, чего мы пока не знаем. Если вы что-то помните — расскажите Юре, он допишет.</div>';
      if (!F.questions.length) return h + '<p class="count">Вопросов пока нет.</p>';
      F.questions.forEach(function (entry) {
        var p = P[entry.id];
        h += '<div class="q"><a href="#/p/' + entry.id + '"><b>' + esc(p.name) + '</b><small>' + esc(joinNonEmpty([kin(entry.id), p.years])) + '</small></a>' +
          '<ul class="unk">' + entry.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
      });
      return h;
    }

    // Веер предков: место 1 — тот, от кого строим; у места s отец — 2s, мать — 2s+1.
    var GEN_TITLES = ['', 'Родители', 'Бабушки и дедушки', 'Прабабушки и прадедушки', 'Прапрабабушки и прапрадедушки',
      'Пятое поколение предков', 'Шестое поколение предков', 'Седьмое поколение предков', 'Восьмое поколение предков'];
    var LINES = ['дедушка по отцу', 'бабушка по отцу', 'дедушка по матери', 'бабушка по матери'];
    var MAX_GEN = 8, fan = null;
    function genOf(s) { var g = 0; while (s > 1) { s >>= 1; g++; } return g; }
    function ancestors(root) {
      var slots = { 1: { id: root, hyp: false, alts: [] } }, depth = 0;
      for (var g = 1; g <= MAX_GEN; g++) {
        for (var s = 1 << g; s < 2 << g; s++) {
          var child = slots[s >> 1];
          if (!child || !child.id) continue;
          var sex = s % 2 ? 'f' : 'm';
          var refs = parentRefs(child.id).filter(function (ref) { return P[ref.id].sex === sex; });
          if (refs.length) {
            slots[s] = { id: refs[0].id, hyp: child.hyp || !!refs[0].hyp || refs.length > 1, alts: refs.slice(1).map(function (ref) { return ref.id; }) };
            depth = g;
          } else {
            slots[s] = { id: '', hyp: false, alts: [] };
          }
        }
      }
      // Пустые места показываем только в тех поколениях, где кто-то уже найден.
      Object.keys(slots).forEach(function (s) { if (!slots[s].id && genOf(Number(s)) > depth) delete slots[s]; });
      return { root: root, slots: slots, depth: depth };
    }
    function fanRadii(depth) {
      var weights = [0, 1.45, 1.4, 1.3, 1.15, 0.55, 0.45, 0.4, 0.35], total = 0, r = [72];
      for (var g = 1; g <= depth; g++) total += weights[g];
      for (g = 1; g <= depth; g++) r[g] = r[g - 1] + 428 * weights[g] / total;
      return r;
    }
    function num(x) { return x.toFixed(1); }
    function pt(r, a) { var rad = a * Math.PI / 180; return num(r * Math.cos(rad)) + ' ' + num(-r * Math.sin(rad)); }
    function sector(r1, r2, a0, a1) {
      return 'M' + pt(r2, a0) + 'A' + num(r2) + ' ' + num(r2) + ' 0 0 1 ' + pt(r2, a1) + 'L' + pt(r1, a1) +
        'A' + num(r1) + ' ' + num(r1) + ' 0 0 0 ' + pt(r1, a0) + 'Z';
    }
    // Ширина сектора по горизонтали на высоте y вокруг точки x: ближайшие границы слева и справа.
    function spanAt(x, y, r1, r2, a0, a1) {
      var cuts = [], h = Math.abs(y), left = -Infinity, right = Infinity;
      if (h < r2) { var xo = Math.sqrt(r2 * r2 - h * h); cuts.push(-xo, xo); }
      if (h < r1) { var xi = Math.sqrt(r1 * r1 - h * h); cuts.push(-xi, xi); }
      [a0, a1].forEach(function (a) {
        var s = Math.sin(a * Math.PI / 180);
        if (Math.abs(s) > 1e-6) cuts.push(-y * Math.cos(a * Math.PI / 180) / s);
      });
      cuts.forEach(function (c) { if (c < x && c > left) left = c; if (c > x && c < right) right = c; });
      return right - left;
    }
    function centerLabel(text) {
      return '<text x="0" y="-34" font-size="' + num(Math.min(30, 120 / (0.58 * text.length))) + '"><tspan x="0" dy="0em">' + esc(text) + '</tspan></text>';
    }
    // Подпись сектора: в двух ближних кольцах — поперёк, дальше — вдоль радиуса. Не влезает — без подписи.
    function fanLabel(lines, r1, r2, a0, a1, g, dark) {
      var mid = (a0 + a1) / 2, rm = (r1 + r2) / 2, rad = mid * Math.PI / 180, x = rm * Math.cos(rad), y = -rm * Math.sin(rad);
      var longest = Math.max.apply(null, lines.map(function (line) { return line.length; })), size, rot = 0;
      if (g <= 2) {
        var width = spanAt(x, y, r1, r2, a0, a1) * 0.9;
        size = Math.min(g === 1 ? 30 : 26, width / (0.58 * longest), (r2 - r1) * 0.8 / (lines.length * 1.15));
      } else {
        lines = lines.slice(0, 1);
        size = Math.min(22, (r2 - r1 - 10) / (0.58 * longest));
        rot = mid > 90 ? 180 - mid : -mid;
      }
      if (size < 11) return '';
      var first = -(lines.length - 1) * 0.575;
      return '<text x="' + num(x) + '" y="' + num(y) + '" font-size="' + num(size) + '"' + (dark ? ' class="dark"' : '') +
        (rot ? ' transform="rotate(' + num(rot) + ' ' + num(x) + ' ' + num(y) + ')"' : '') + '>' +
        lines.map(function (line, i) { return '<tspan x="' + num(x) + '" dy="' + (i ? '1.15' : num(first)) + 'em">' + esc(line) + '</tspan>'; }).join('') + '</text>';
    }
    function viewFan(id) {
      var root = P[id] ? id : viewer, tree = ancestors(root), r = fanRadii(tree.depth), body = '', count = 0, seen = {};
      fan = tree;
      if (!tree.depth) {
        return (root !== viewer ? '<p class="fan-for">Предки: <b>' + esc(P[root].name) + '</b></p>' : '') +
          '<p class="note">Предки пока не найдены. Если вы что-то знаете, расскажите Юре.</p>' +
          (root !== viewer ? '<a class="btn light" href="#/fan">Вернуться к своему вееру</a>' : '');
      }
      body += '<path data-slot="1" data-id="' + root + '" class="root" d="M-72 0A72 72 0 0 1 72 0Z"/>' +
        centerLabel(root === viewer ? 'Вы' : bare(P[root].short).split(' ')[0]);
      Object.keys(tree.slots).map(Number).sort(function (a, b) { return a - b; }).forEach(function (s) {
        if (s === 1) return;
        var e = tree.slots[s], g = genOf(s), n = 1 << g, i = s - n, a0 = 180 - i * 180 / n, a1 = 180 - (i + 1) * 180 / n;
        var cls = g === 1 ? 'par' : 'q' + ((s >> (g - 2)) - 4) + ' g' + g;
        if (!e.id) cls += ' empty'; else if (e.hyp) cls += ' hyp';
        if (e.id && !seen[e.id]) { seen[e.id] = 1; count += 1; }
        body += '<path data-slot="' + s + '" data-id="' + e.id + '" class="' + cls + '" d="' + sector(r[g - 1], r[g], a0, a1) + '"/>';
        var words = e.id ? bare(P[e.id].short).split(' ') : ['?'];
        if (e.id || g <= 3) body += fanLabel(words.slice(0, 1), r[g - 1], r[g], a0, a1, g, g >= 3 || !e.id || e.hyp);
      });
      var h = '';
      if (root !== viewer) h += '<p class="fan-for">Предки: <b>' + esc(P[root].name) + '</b></p>';
      h += '<p class="count">Известно предков: ' + count + '</p>';
      h += '<div class="fan"><svg viewBox="-505 -505 1010 515" role="img" aria-label="Веер предков">' + body + '</svg></div>';
      h += '<div class="fan-card" id="fan-card"><span>Нажмите на любую часть веера — здесь появится, кто это. Мелкие имена можно увеличить двумя пальцами, полный список — ниже.</span></div>';
      if (tree.depth >= 2) {
        h += '<div class="legend">' + [4, 5, 6, 7].map(function (s, i) {
          var e = tree.slots[s];
          return '<span><i class="sw q' + i + '"></i>' + LINES[i] + ': ' + (e && e.id ? esc(P[e.id].short) : 'пока не знаем') + '</span>';
        }).join('') + '<span><i class="sw pale"></i>бледные с пунктиром — предположительно</span><span><i class="sw none"></i>серое — пока не знаем</span></div>';
      }
      for (var g = 1; g <= tree.depth; g++) {
        var rows = '', known = 0;
        for (var s = 1 << g; s < 2 << g; s++) {
          var e = tree.slots[s];
          if (!e || !e.id) continue;
          known += 1;
          var note = e.alts.length ? (e.alts.length === 1 ? 'один из двух' : 'один из нескольких') : (e.hyp ? 'предположительно' : '');
          rows += personRow(e.id, joinNonEmpty([kin(e.id), note]));
          e.alts.forEach(function (alt) { rows += personRow(alt, joinNonEmpty([kin(alt), note])); });
        }
        h += '<h2>' + GEN_TITLES[g] + '</h2><p class="count">Известно ' + known + ' из ' + (1 << g) + '</p><div class="list">' + rows + '</div>';
      }
      if (root !== viewer) h += '<a class="btn light" href="#/fan">Вернуться к своему вееру</a>';
      return h;
    }
    function showSlot(s, node) {
      var e = fan && fan.slots[s], card = document.getElementById('fan-card');
      if (!e || !card) return;
      // Обводка выбранного сектора — отдельной линией поверх веера, чтобы соседи её не перекрывали.
      Array.prototype.forEach.call(main.querySelectorAll('.fan path.outline'), function (p) { p.parentNode.removeChild(p); });
      if (node.cloneNode) {
        var ring = node.cloneNode(false);
        ring.setAttribute('class', 'outline');
        ring.removeAttribute('data-slot');
        ring.removeAttribute('data-id');
        node.parentNode.appendChild(ring);
      }
      if (!e.id) {
        card.innerHTML = '<b>Пока не знаем, кто это</b><span>Здесь должен быть ' + (s % 2 ? 'мать' : 'отец') + '. Ребёнок — ' +
          esc(P[fan.slots[s >> 1].id].short) + '.</span><span>Если вы что-то знаете, расскажите Юре.</span>';
        if (s % 2) card.innerHTML = card.innerHTML.replace('должен быть мать', 'должна быть мать');
        return;
      }
      var p = P[e.id], note = '';
      if (e.alts.length === 1) note = 'Один из двух возможных. Второй — ' + P[e.alts[0]].short + '.';
      else if (e.alts.length) note = 'Один из нескольких возможных. Другие — ' + e.alts.map(function (alt) { return P[alt].short; }).join(', ') + '.';
      else if (e.hyp) note = 'Предположительно: связь не доказана документом.';
      card.innerHTML = '<b>' + esc(p.name) + '</b><span>' + esc(joinNonEmpty([p.years, e.id === viewer ? 'это вы' : 'Вам: ' + kin(e.id)])) + '</span>' +
        (note ? '<span class="hy">' + esc(note) + '</span>' : '') + '<a class="btn" href="#/p/' + e.id + '">Открыть страницу</a>';
    }

    var observer = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { observer.unobserve(entry.target); load(entry.target); } });
    }, { rootMargin: '400px' }) : null;
    function load(img) {
      var path = img.getAttribute('data-src');
      img.removeAttribute('data-src');
      function broken() { img.className += ' broken'; img.alt = 'Не удалось открыть картинку'; }
      img.onerror = broken;
      media.url(path).then(function (url) { img.src = url; }, broken);
    }
    function hydrate() {
      Array.prototype.forEach.call(document.querySelectorAll('#main img[data-src]'), function (img) {
        if (observer && img.getAttribute('data-lazy')) observer.observe(img); else load(img);
      });
    }

    var box = document.getElementById('viewer'), boxImg = document.getElementById('viewer-img'), boxWait = document.getElementById('viewer-wait'),
      boxBody = document.getElementById('viewer-body'), boxZoom = 1, boxUrl = null, openSeq = 0, inHistory = false;
    // Окно просмотра — отдельный шаг в истории: кнопка «Назад» телефона закрывает окно, а не уводит со страницы.
    function openViewer(path) {
      var seq = ++openSeq;
      boxZoom = 1;
      boxImg.style.width = '100%';
      boxImg.removeAttribute('src');
      boxWait.style.display = '';
      boxBody.scrollTop = 0;
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      if (history.pushState && !inHistory) { history.pushState({ viewer: true }, ''); inHistory = true; }
      media.open(path).then(function (url) {
        if (seq !== openSeq) { media.release(url); return; }
        boxUrl = url;
        boxImg.src = url;
        boxWait.style.display = 'none';
      }, function () { if (seq === openSeq) boxWait.textContent = 'Не удалось открыть картинку. Проверьте интернет.'; });
    }
    function closeViewer() {
      openSeq++;
      box.hidden = true;
      boxImg.removeAttribute('src');
      if (boxUrl) { media.release(boxUrl); boxUrl = null; }
      boxWait.textContent = 'Открываю…';
      document.body.style.overflow = '';
    }
    document.getElementById('viewer-close').addEventListener('click', function () {
      if (inHistory) history.back(); else closeViewer();
    });
    window.addEventListener('popstate', function () {
      if (!inHistory) return;
      inHistory = false;
      if (box.hidden === false) closeViewer();
    });
    document.getElementById('viewer-zoom').addEventListener('click', function () {
      boxZoom = boxZoom >= 3 ? 1 : boxZoom + 1;
      boxImg.style.width = (boxZoom * 100) + '%';
    });

    var positions = {}, current = null, byLink = false;
    function render() {
      if (box.hidden === false) { inHistory = false; closeViewer(); }
      if (observer) observer.disconnect();
      var parts = location.hash.replace(/^#\/?/, '').split('/'), v = parts[0] || 'tree', id = parts[1], title = 'Наша семья';
      if (!viewer || v === 'who') { v = 'who'; main.innerHTML = viewWho(); }
      else if (v === 'p' && P[id]) { main.innerHTML = viewPerson(id); title = P[id].short; }
      else if (v === 'd' && D[id]) { main.innerHTML = viewDoc(id); title = D[id].title; }
      else if (v === 'people') { main.innerHTML = viewPeople(); }
      else if (v === 'questions') { main.innerHTML = viewQuestions(); title = 'Вопросы к семье'; }
      else if (v === 'docs') { main.innerHTML = viewDocs(); title = 'Все документы'; }
      else if (v === 'fan') { main.innerHTML = viewFan(id); title = 'Предки'; }
      else { v = 'tree'; main.innerHTML = viewTree(id); }
      hydrate();
      document.getElementById('title').textContent = title;
      document.getElementById('nav').style.display = v === 'who' ? 'none' : '';
      ['tree', 'fan', 'people', 'questions'].forEach(function (tab) { document.getElementById('tab-' + tab).className = v === tab ? 'on' : ''; });
      document.getElementById('back').style.visibility = (v === 'who' || ((v === 'tree' || v === 'fan') && (!P[id] || id === viewer))) ? 'hidden' : 'visible';
      window.scrollTo(0, byLink ? 0 : (positions[location.hash] || 0));
      byLink = false;
      current = location.hash;
    }

    main.addEventListener('click', function (e) {
      var t = e.target, who = t.getAttribute && t.getAttribute('data-who'), z = t.getAttribute && t.getAttribute('data-z');
      if (who) {
        viewer = who;
        store('ft_viewer', who);
        if (location.hash === '#/tree') render(); else location.hash = '#/tree';
        return;
      }
      if (t.getAttribute && t.getAttribute('data-logout')) {
        forget('ft_key');
        location.reload();
        return;
      }
      var node = t;
      while (node && node !== main && !(node.getAttribute && (node.getAttribute('data-view') || node.getAttribute('data-slot')))) node = node.parentNode;
      if (node && node !== main && node.getAttribute) {
        e.preventDefault();
        if (node.getAttribute('data-slot')) showSlot(Number(node.getAttribute('data-slot')), node);
        else openViewer(node.getAttribute('data-view'));
        return;
      }
      if (!z) return;
      zoom = Math.min(4, Math.max(1, zoom + Number(z) * 0.75));
      document.getElementById('scan').style.width = (zoom * 100) + '%';
    });
    main.addEventListener('input', function (e) {
      if (e.target.id !== 'q') return;
      var shown = 0;
      Array.prototype.forEach.call(document.querySelectorAll('#plist a'), function (a) {
        var hit = matches(e.target.value, a.querySelector('.who').firstChild.textContent);
        a.style.display = hit ? '' : 'none';
        shown += hit ? 1 : 0;
      });
      document.getElementById('none').style.display = shown ? 'none' : '';
    });
    document.addEventListener && document.addEventListener('click', function (e) {
      var node = e.target;
      while (node && node.tagName !== 'A') node = node.parentNode;
      if (node && (node.getAttribute('href') || '').charAt(0) === '#') byLink = true;
    }, true);
    document.getElementById('back').addEventListener('click', function () { if (history.length > 1) history.back(); else location.hash = '#/tree'; });
    window.addEventListener('scroll', function () { if (current !== null) positions[current] = window.pageYOffset || 0; });
    window.addEventListener('hashchange', render);
    render();
  }

  function plainMedia() {
    function same(path) { return Promise.resolve(path); }
    return { encrypted: false, url: same, open: same, release: function () {} };
  }

  // Картинки сайта зашифрованы: скачать, расшифровать на телефоне, показать через blob-адрес.
  function cryptoMedia(keys) {
    var cache = {}, order = [];
    function decrypted(path) {
      return fetch(path)
        .then(function (r) { if (!r.ok) throw new Error('load'); return r.arrayBuffer(); })
        .then(function (bytes) { return window.Vault.decrypt(keys, bytes); })
        .then(function (plain) {
          var type = plain[0] === 0x89 ? 'image/png' : 'image/jpeg';
          return URL.createObjectURL(new Blob([plain], { type: type }));
        });
    }
    return {
      encrypted: true,
      // Миниатюры и листы на страницах: кэш на 80 картинок; картинку, которая сейчас на экране, не отзываем.
      url: function (path) {
        if (cache[path]) return cache[path];
        var promise = decrypted(path);
        cache[path] = promise;
        order.push(path);
        promise.catch(function () {
          if (cache[path] !== promise) return;
          delete cache[path];
          order.splice(order.indexOf(path), 1);
        });
        if (order.length > 80) {
          var old = order.shift(), stale = cache[old];
          delete cache[old];
          if (stale) stale.then(function (url) { if (!document.querySelector('img[src="' + url + '"]')) URL.revokeObjectURL(url); }, function () {});
        }
        return promise;
      },
      // Окно просмотра (в том числе оригиналы по 5–10 МБ): без кэша, адрес отзывается при закрытии.
      open: decrypted,
      release: function (url) { URL.revokeObjectURL(url); }
    };
  }

  var siteFiles = null;
  function loadSite() {
    if (!siteFiles) {
      siteFiles = Promise.all([
        fetch('site.json').then(function (r) { if (!r.ok) throw new Error('load'); return r.json(); }),
        fetch('data.bin').then(function (r) { if (!r.ok) throw new Error('load'); return r.arrayBuffer(); })
      ]).then(function (all) { return { meta: all[0], bytes: all[1] }; });
      siteFiles.catch(function () { siteFiles = null; });
    }
    return siteFiles;
  }

  function showUnlock(note) {
    header('Наша семья', false);
    main.innerHTML = '<form id="unlock" class="login">' +
      '<h2>Вход для семьи</h2>' +
      '<p>Введите фразу-пароль. Её вам пришлёт Юра. Телефон запомнит вход. Если через какое-то время он снова спросит фразу, введите её ещё раз.</p>' +
      '<label for="phrase">Фраза-пароль</label>' +
      '<input id="phrase" class="search" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false">' +
      '<label class="show"><input id="show" type="checkbox"> Показать фразу</label>' +
      '<p class="note" id="note"' + (note ? '' : ' style="display:none"') + '>' + esc(note || '') + '</p>' +
      '<button class="btn whob" type="submit" id="open">Открыть</button>' +
      '</form>';
    var field = document.getElementById('phrase'), button = document.getElementById('open'), box = document.getElementById('note');
    function say(text) { box.textContent = text; box.style.display = text ? '' : 'none'; }
    document.getElementById('show').addEventListener('change', function (e) { field.type = e.target.checked ? 'text' : 'password'; });
    document.getElementById('unlock').addEventListener('submit', function (e) {
      e.preventDefault();
      var phrase = field.value;
      if (!window.Vault.normalizePassphrase(phrase)) { say('Введите фразу-пароль.'); return; }
      say('Открываю…');
      button.disabled = true;
      loadSite()
        .then(function (site) { return window.Vault.openSite(phrase, site.meta, site.bytes); })
        .then(function (opened) {
          store('ft_key', opened.key);
          start(opened.data, cryptoMedia(opened.keys));
        }, function (error) {
          button.disabled = false;
          say(error && error.message === 'wrong-phrase'
            ? 'Фраза не подошла. Проверьте её и попробуйте ещё раз.'
            : 'Не удалось открыть сайт. Проверьте интернет и попробуйте ещё раз.');
        });
    });
  }

  var sizes = [18, 21, 24], si = Math.max(0, sizes.indexOf(Number(stored('ft_font'))));
  function applyFont() { document.documentElement.style.setProperty('--fs', sizes[si] + 'px'); }
  document.getElementById('fsz').addEventListener('click', function () { si = (si + 1) % sizes.length; store('ft_font', String(sizes[si])); applyFont(); });
  applyFont();
  window.FT = { matches: matches };

  // Нет связи: сохранённый вход не трогаем, предлагаем повторить.
  function showOffline() {
    header('Наша семья', false);
    main.innerHTML = '<div class="login"><h2>Нет связи</h2><p class="note">Сайт не загрузился. Проверьте интернет и нажмите «Повторить».</p>' +
      '<button class="btn whob" type="button" id="retry">Повторить</button></div>';
    document.getElementById('retry').addEventListener('click', boot);
  }

  function boot() {
    if (window.FAMILY) { start(window.FAMILY, plainMedia()); return; }
    if (!window.crypto || !window.crypto.subtle || !window.Vault) {
      header('Наша семья', false);
      main.innerHTML = '<p class="note">Этот телефон не может открыть сайт: браузер слишком старый. Напишите Юре.</p>';
      return;
    }
    var key = stored('ft_key');
    if (!key) { showUnlock(); return; }
    header('Наша семья', false);
    main.innerHTML = '<p class="count">Открываю…</p>';
    loadSite().then(function (site) {
      return window.Vault.openWithKey(key, site.bytes).then(function (opened) {
        start(opened.data, cryptoMedia(opened.keys));
      }, function () {
        // Ключ больше не открывает данные: фразу на сайте сменили.
        forget('ft_key');
        showUnlock('Фраза на сайте сменилась. Введите новую — её пришлёт Юра.');
      });
    }, showOffline);
  }
  boot();
})();
