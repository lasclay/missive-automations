/**
 * Lasclay — MRP : serveur
 * ---------------------------------------------------------------------------
 * Serveur HTTP natif, sans framework, à l'image du reste du dépôt.
 * Aucune dépendance : Node 22 suffit (node:sqlite, node:crypto, node:http).
 *
 * Pourquoi rendu côté serveur et sans JavaScript client : l'atelier en Tunisie
 * travaille sur une connexion lente. Chaque page fait moins de 20 Ko, chaque
 * action est un formulaire qui poste et redirige. C'est robuste et ça marche
 * sur n'importe quel appareil.
 *
 * Variables d'environnement
 *   PORT        port d'écoute (défaut 3000)
 *   MRP_DB      chemin du fichier SQLite (défaut ./data/mrp.db)
 *               sur Render : pointer vers un disque persistant
 *   MRP_SECURE  '1' pour exiger HTTPS sur le cookie de session (production)
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { db, prochainNumero, avancementOrdre } = require('./db.js');
const auth = require('./auth.js');
const V = require('./vues.js');

const PORT = process.env.PORT || 3000;
const SECURE = process.env.MRP_SECURE === '1';
auth.menage();

// ------------------------------------------------------------------ utilitaires
const lireCookies = (h) => Object.fromEntries(
  String(h || '').split(';').map(c => {
    const i = c.indexOf('=');
    return i < 0 ? null : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }).filter(Boolean));

function corpsFormulaire(req) {
  return new Promise((resolve, reject) => {
    let brut = '', taille = 0;
    req.on('data', c => {
      taille += c.length;
      if (taille > 1e6) { req.destroy(); reject(new Error('corps trop volumineux')); }
      brut += c;
    });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(brut))));
    req.on('error', reject);
  });
}

const html = (res, corps, code = 200) => {
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8',
                        'cache-control': 'no-store',
                        'x-content-type-options': 'nosniff',
                        'referrer-policy': 'same-origin' });
  res.end(corps);
};
const vers = (res, url) => { res.writeHead(303, { location: url }); res.end(); };

/** Message éphémère passé par la chaîne de requête (?ok=… / ?err=…). */
function messageDe(q) {
  if (q.get('ok'))  return { type: 'ok',  texte: q.get('ok') };
  if (q.get('err')) return { type: 'err', texte: q.get('err') };
  return null;
}

// ------------------------------------------------------------------- requêtes
const R = {
  ordresListe: db.prepare(`SELECT * FROM ordres ORDER BY
      CASE statut WHEN 'en_cours' THEN 0 WHEN 'planifie' THEN 1
                  WHEN 'brouillon' THEN 2 WHEN 'termine' THEN 3 ELSE 4 END,
      cree_le DESC`),
  ordre: db.prepare(`SELECT * FROM ordres WHERE id = ?`),
  items: db.prepare(`SELECT i.*, p.nom AS produit_nom, p.code AS produit_code
      FROM ordre_items i JOIN produits p ON p.id = i.produit_id
      WHERE i.ordre_id = ? ORDER BY i.rang, i.id`),
  item: db.prepare(`SELECT * FROM ordre_items WHERE id = ? AND ordre_id = ?`),
  jalons: db.prepare(`SELECT * FROM ordre_jalons WHERE ordre_id = ? ORDER BY date, id`),
  jalonsTous: db.prepare(`SELECT j.*, o.numero, o.titre AS ordre_titre
      FROM ordre_jalons j JOIN ordres o ON o.id = j.ordre_id
      WHERE o.statut NOT IN ('annule') ORDER BY j.date, j.id`),
  jalonsProchains: db.prepare(`SELECT j.*, o.numero FROM ordre_jalons j
      JOIN ordres o ON o.id = j.ordre_id
      WHERE o.statut NOT IN ('annule','termine') AND j.date >= date('now','-14 days')
      ORDER BY j.date LIMIT 12`),
  jalonProchainOrdre: db.prepare(`SELECT * FROM ordre_jalons
      WHERE ordre_id = ? AND date >= date('now') ORDER BY date LIMIT 1`),
  commentaires: db.prepare(`SELECT c.*, u.nom AS auteur FROM ordre_commentaires c
      LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
      WHERE c.ordre_id = ? ORDER BY c.cree_le DESC`),
  produitsActifs: db.prepare(`SELECT id, code, nom FROM produits WHERE actif = 1
      ORDER BY nom`),
  produitsListe: db.prepare(`SELECT p.*,
      (SELECT url FROM produit_photos f WHERE f.produit_id = p.id
         ORDER BY CASE type WHEN 'studio' THEN 0 ELSE 1 END, rang, id LIMIT 1) AS photo
      FROM produits p WHERE p.actif = 1 ORDER BY p.nom`),
  produit: db.prepare(`SELECT * FROM produits WHERE id = ?`),
  photos: db.prepare(`SELECT * FROM produit_photos WHERE produit_id = ?
      ORDER BY rang, id`),
  materiaux: db.prepare(`SELECT * FROM produit_materiaux WHERE produit_id = ?
      ORDER BY rang, id`),
  patrons: db.prepare(`SELECT * FROM produit_patrons WHERE produit_id = ?
      ORDER BY rang, id`),
  ordresDuProduit: db.prepare(`SELECT i.ordre_id, i.quantite, i.avancement,
      o.numero, o.titre, o.statut FROM ordre_items i JOIN ordres o ON o.id = i.ordre_id
      WHERE i.produit_id = ? ORDER BY o.cree_le DESC`),
};

// ------------------------------------------------------------------ statiques
const STATIQUES = { '/style.css': ['text/css; charset=utf-8', 'public/style.css'] };

// --------------------------------------------------------------------- routes
async function router(req, res, url, user) {
  const p = url.pathname;
  const q = url.searchParams;
  const msg = messageDe(q);
  const admin = user.role === 'admin';
  const refus = () => vers(res, '/?err=' + encodeURIComponent('Action réservée à l\'administration'));

  // ---- tableau de bord
  if (p === '/' ) {
    const ordres = R.ordresListe.all().map(o => ({
      ...o, ...avancementOrdre(o.id), prochain: R.jalonProchainOrdre.get(o.id) || null }));
    return html(res, V.vueAccueil({ user, ordres, jalons: R.jalonsProchains.all() }));
  }

  // ---- ordres
  if (p === '/ordres')
    return html(res, V.vueOrdres({ user, msg,
      ordres: R.ordresListe.all().map(o => ({ ...o, ...avancementOrdre(o.id) })) }));

  if (p === '/ordres/nouveau') {
    if (!admin) return refus();
    if (req.method === 'POST') {
      const f = await corpsFormulaire(req);
      if (!f.titre?.trim())
        return html(res, V.vueOrdreForm({ user, msg: { type:'err', texte:'Le titre est requis.' } }));
      const r = db.prepare(`INSERT INTO ordres (numero, titre, statut, note, cree_par)
          VALUES (?,?,?,?,?)`).run(prochainNumero(), f.titre.trim(),
          V.STATUTS[f.statut] ? f.statut : 'planifie', (f.note || '').trim(), user.id);
      return vers(res, `/ordres/${r.lastInsertRowid}?ok=` +
        encodeURIComponent('Ordre créé. Ajoutez les items et les dates.'));
    }
    return html(res, V.vueOrdreForm({ user }));
  }

  let m = p.match(/^\/ordres\/(\d+)(\/.*)?$/);
  if (m) {
    const id = +m[1], reste = m[2] || '';
    const o = R.ordre.get(id);
    if (!o) return html(res, V.page({ titre:'Introuvable', user,
      corps:'<div class="carte"><p class="vide">Cet ordre n\'existe pas.</p></div>' }), 404);

    // avancement d'un item — la seule action ouverte à l'atelier
    let mi = reste.match(/^\/items\/(\d+)\/avancement$/);
    if (mi && req.method === 'POST') {
      const it = R.item.get(+mi[1], id);
      const f = await corpsFormulaire(req);
      const v = parseInt(f.valeur, 10);
      if (it && Number.isInteger(v) && v >= 0 && v <= 100 && v % 10 === 0 && v !== it.avancement) {
        db.exec('BEGIN');
        try {
          db.prepare(`UPDATE ordre_items SET avancement = ?, maj_le = datetime('now')
                      WHERE id = ?`).run(v, it.id);
          db.prepare(`INSERT INTO avancement_historique (item_id, utilisateur_id, avant, apres)
                      VALUES (?,?,?,?)`).run(it.id, user.id, it.avancement, v);
          // l'ordre passe en cours dès la première progression déclarée
          if (o.statut === 'planifie' && v > 0)
            db.prepare(`UPDATE ordres SET statut='en_cours', maj_le=datetime('now')
                        WHERE id=?`).run(id);
          db.exec('COMMIT');
        } catch (err) { db.exec('ROLLBACK'); throw err; }
      }
      return vers(res, `/ordres/${id}#i${mi[1]}`);
    }

    if (reste === '/commentaires' && req.method === 'POST') {
      const f = await corpsFormulaire(req);
      if (f.texte?.trim())
        db.prepare(`INSERT INTO ordre_commentaires (ordre_id, utilisateur_id, texte)
                    VALUES (?,?,?)`).run(id, user.id, f.texte.trim());
      return vers(res, `/ordres/${id}`);
    }

    // ---- réservé à l'administration
    if (reste && reste !== '') {
      if (!admin) return refus();

      if (reste === '/items' && req.method === 'POST') {
        const f = await corpsFormulaire(req);
        const qte = parseInt(f.quantite, 10);
        if (+f.produit_id && qte > 0)
          db.prepare(`INSERT INTO ordre_items (ordre_id, produit_id, quantite, note, rang)
              VALUES (?,?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM ordre_items WHERE ordre_id=?))`)
            .run(id, +f.produit_id, qte, (f.note || '').trim(), id);
        return vers(res, `/ordres/${id}`);
      }
      if ((mi = reste.match(/^\/items\/(\d+)\/supprimer$/)) && req.method === 'POST') {
        db.prepare(`DELETE FROM ordre_items WHERE id = ? AND ordre_id = ?`).run(+mi[1], id);
        return vers(res, `/ordres/${id}`);
      }
      if (reste === '/jalons' && req.method === 'POST') {
        const f = await corpsFormulaire(req);
        if (f.titre?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(f.date || ''))
          db.prepare(`INSERT INTO ordre_jalons (ordre_id, titre, date, type, note)
                      VALUES (?,?,?,?,?)`).run(id, f.titre.trim(), f.date,
                      V.TYPES_JALON[f.type] ? f.type : 'deadline', (f.note || '').trim());
        return vers(res, `/ordres/${id}`);
      }
      if ((mi = reste.match(/^\/jalons\/(\d+)\/supprimer$/)) && req.method === 'POST') {
        db.prepare(`DELETE FROM ordre_jalons WHERE id = ? AND ordre_id = ?`).run(+mi[1], id);
        return vers(res, `/ordres/${id}`);
      }
      if (reste === '/modifier') {
        if (req.method === 'POST') {
          const f = await corpsFormulaire(req);
          if (f.titre?.trim())
            db.prepare(`UPDATE ordres SET titre=?, statut=?, note=?, maj_le=datetime('now')
                        WHERE id=?`).run(f.titre.trim(),
                        V.STATUTS[f.statut] ? f.statut : o.statut, (f.note || '').trim(), id);
          return vers(res, `/ordres/${id}?ok=` + encodeURIComponent('Ordre mis à jour.'));
        }
        return html(res, V.vueOrdreForm({ user, o }));
      }
      if (reste === '/supprimer' && req.method === 'POST') {
        db.prepare(`DELETE FROM ordres WHERE id = ?`).run(id);
        return vers(res, '/ordres?ok=' + encodeURIComponent('Ordre supprimé.'));
      }
      return html(res, V.page({ titre:'Introuvable', user,
        corps:'<div class="carte"><p class="vide">Page inconnue.</p></div>' }), 404);
    }

    return html(res, V.vueOrdre({ user, o, msg,
      items: R.items.all(id), jalons: R.jalons.all(id),
      commentaires: R.commentaires.all(id), produits: R.produitsActifs.all(),
      pct: avancementOrdre(id).pct }));
  }

  // ---- produits
  if (p === '/produits')
    return html(res, V.vueProduits({ user, produits: R.produitsListe.all(), msg }));

  if (p === '/produits/nouveau') {
    if (!admin) return refus();
    if (req.method === 'POST') {
      const f = await corpsFormulaire(req);
      if (!f.code?.trim() || !f.nom?.trim())
        return html(res, V.vueProduitForm({ user,
          msg: { type:'err', texte:'Le code et le nom sont requis.' } }));
      try {
        const r = db.prepare(`INSERT INTO produits (code, nom, description, usage, notes_tech)
            VALUES (?,?,?,?,?)`).run(f.code.trim(), f.nom.trim(),
            (f.description || '').trim(), (f.usage || '').trim(), (f.notes_tech || '').trim());
        return vers(res, `/produits/${r.lastInsertRowid}/modifier?ok=` +
          encodeURIComponent('Fiche créée. Ajoutez photos, matériaux et patrons.'));
      } catch {
        return html(res, V.vueProduitForm({ user,
          msg: { type:'err', texte:'Ce code de produit existe déjà.' } }));
      }
    }
    return html(res, V.vueProduitForm({ user }));
  }

  m = p.match(/^\/produits\/(\d+)(\/.*)?$/);
  if (m) {
    const id = +m[1], reste = m[2] || '';
    const pr = R.produit.get(id);
    if (!pr) return html(res, V.page({ titre:'Introuvable', user,
      corps:'<div class="carte"><p class="vide">Cette fiche n\'existe pas.</p></div>' }), 404);

    if (reste) {
      if (!admin) return refus();
      const retour = `/produits/${id}/modifier`;

      if (reste === '/modifier') {
        if (req.method === 'POST') {
          const f = await corpsFormulaire(req);
          if (f.code?.trim() && f.nom?.trim())
            db.prepare(`UPDATE produits SET code=?, nom=?, description=?, usage=?,
                        notes_tech=?, maj_le=datetime('now') WHERE id=?`)
              .run(f.code.trim(), f.nom.trim(), (f.description||'').trim(),
                   (f.usage||'').trim(), (f.notes_tech||'').trim(), id);
          return vers(res, `/produits/${id}?ok=` + encodeURIComponent('Fiche mise à jour.'));
        }
        return html(res, V.vueProduitForm({ user, p: pr, msg,
          photos: R.photos.all(id), materiaux: R.materiaux.all(id),
          patrons: R.patrons.all(id) }));
      }
      if (reste === '/photos' && req.method === 'POST') {
        const f = await corpsFormulaire(req);
        if (f.url?.trim())
          db.prepare(`INSERT INTO produit_photos (produit_id, url, type, legende, rang)
              VALUES (?,?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM produit_photos WHERE produit_id=?))`)
            .run(id, f.url.trim(), f.type === 'contexte' ? 'contexte' : 'studio',
                 (f.legende || '').trim(), id);
        return vers(res, retour);
      }
      if (reste === '/materiaux' && req.method === 'POST') {
        const f = await corpsFormulaire(req);
        if (f.nom?.trim())
          db.prepare(`INSERT INTO produit_materiaux (produit_id, nom, detail, rang)
              VALUES (?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM produit_materiaux WHERE produit_id=?))`)
            .run(id, f.nom.trim(), (f.detail || '').trim(), id);
        return vers(res, retour);
      }
      if (reste === '/patrons' && req.method === 'POST') {
        const f = await corpsFormulaire(req);
        if (f.nom?.trim())
          db.prepare(`INSERT INTO produit_patrons (produit_id, nom, url, format, dimensions, note, rang)
              VALUES (?,?,?,?,?,?, (SELECT COALESCE(MAX(rang),0)+1 FROM produit_patrons WHERE produit_id=?))`)
            .run(id, f.nom.trim(), (f.url||'').trim(), (f.format||'').trim(),
                 (f.dimensions||'').trim(), (f.note||'').trim(), id);
        return vers(res, retour);
      }
      let ms = reste.match(/^\/(photos|materiaux|patrons)\/(\d+)\/supprimer$/);
      if (ms && req.method === 'POST') {
        const table = { photos:'produit_photos', materiaux:'produit_materiaux',
                        patrons:'produit_patrons' }[ms[1]];
        db.prepare(`DELETE FROM ${table} WHERE id = ? AND produit_id = ?`).run(+ms[2], id);
        return vers(res, retour);
      }
      return html(res, V.page({ titre:'Introuvable', user,
        corps:'<div class="carte"><p class="vide">Page inconnue.</p></div>' }), 404);
    }

    return html(res, V.vueProduit({ user, p: pr, msg,
      photos: R.photos.all(id), materiaux: R.materiaux.all(id),
      patrons: R.patrons.all(id), ordres: R.ordresDuProduit.all(id) }));
  }

  if (p === '/cedule')
    return html(res, V.vueCedule({ user, jalons: R.jalonsTous.all(), msg }));

  return html(res, V.page({ titre:'Introuvable', user,
    corps:'<div class="carte"><p class="vide">Page inconnue.</p></div>' }), 404);
}

// -------------------------------------------------------------------- serveur
const serveur = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (p === '/sante') { res.writeHead(200, {'content-type':'application/json'});
      return res.end(JSON.stringify({ ok: true, service: 'lasclay-mrp' })); }

    if (STATIQUES[p]) {
      const [type, rel] = STATIQUES[p];
      const buf = fs.readFileSync(path.join(__dirname, rel));
      res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=86400' });
      return res.end(buf);
    }

    const cookies = lireCookies(req.headers.cookie);
    const user = auth.utilisateurDeSession(cookies.mrp_session);

    if (p === '/connexion') {
      if (req.method === 'POST') {
        const f = await corpsFormulaire(req);
        const u = auth.connecter(f.courriel, f.mdp);
        if (!u) return html(res, V.vueConnexion({ erreur: 'Courriel ou mot de passe invalide.' }), 401);
        const jeton = auth.ouvrirSession(u.id);
        res.writeHead(303, { location: '/', 'set-cookie':
          `mrp_session=${jeton}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30*86400}` +
          (SECURE ? '; Secure' : '') });
        return res.end();
      }
      if (user) return vers(res, '/');
      return html(res, V.vueConnexion({}));
    }

    if (p === '/deconnexion') {
      auth.fermerSession(cookies.mrp_session);
      res.writeHead(303, { location: '/connexion',
        'set-cookie': 'mrp_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
      return res.end();
    }

    if (!user) return vers(res, '/connexion');
    return await router(req, res, url, user);

  } catch (err) {
    console.error('[mrp]', err);
    if (!res.headersSent) html(res, V.page({ titre: 'Erreur', user: null,
      corps: '<div class="carte"><h2>Erreur du serveur</h2>' +
             '<p class="muted">L\'action n\'a pas pu être complétée.</p></div>' }), 500);
    else res.end();
  }
});

if (require.main === module)
  serveur.listen(PORT, () => console.log(`[mrp] écoute sur http://localhost:${PORT}`));

module.exports = serveur;
