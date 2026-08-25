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
 *   MRP_ADMIN_COURRIEL / MRP_ADMIN_MDP
 *               premier compte, créé au démarrage SI la base n'a aucun
 *               utilisateur. Sans ça, un service neuf n'est ouvrable par
 *               personne. Sans effet dès qu'un compte existe.
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const { db, prochainNumero, avancementOrdre, listeFabrication, dernieresMaj,
        sansMouvement, progressionRecente, fabriqueAilleurs,
        variantesItem } = require('./db.js');
const auth = require('./auth.js');
const V = require('./vues.js');
const assistant = require('./assistant.js');
const outils = require('./outils.js');
const charge = require('./charge.js');

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

/**
 * Compresse si le client le demande et si ça vaut la peine.
 *
 * C'est le seul levier qui agit sur TOUTES les pages d'un coup, et il compte :
 * un ordre de 25 items passe de 47 à 5 Ko. En dessous de 1 Ko, le gain ne paie
 * pas le coût de compression — on envoie tel quel.
 */
const PLANCHER = 1024;

function envoyer(req, res, corps, entetes, code = 200) {
  const buf = Buffer.isBuffer(corps) ? corps : Buffer.from(corps, 'utf8');
  const accepte = String(req.headers['accept-encoding'] || '');
  if (buf.length >= PLANCHER && /\bgzip\b/.test(accepte)) {
    const gz = zlib.gzipSync(buf, { level: 6 });
    res.writeHead(code, { ...entetes, 'content-encoding': 'gzip',
                          'content-length': gz.length, vary: 'accept-encoding' });
    return res.end(gz);
  }
  res.writeHead(code, { ...entetes, 'content-length': buf.length,
                        vary: 'accept-encoding' });
  res.end(buf);
}

// `req` est posé sur `res` à l'entrée du serveur : les vues appellent html()
// sans avoir à trimballer la requête jusqu'en bas.
const html = (res, corps, code = 200) =>
  envoyer(res.req, res, corps, { 'content-type': 'text/html; charset=utf-8',
                                 'cache-control': 'no-store',
                                 'x-content-type-options': 'nosniff',
                                 'referrer-policy': 'same-origin' }, code);
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

// Un fil regroupe les tours d'une même conversation. Identifiant opaque côté
// client : on ne fait que vérifier sa forme avant de s'en servir en requête.
const nouveauFil = () => require('node:crypto').randomBytes(9).toString('hex');
const filValide = (f) => typeof f === 'string' && /^[0-9a-f]{18}$/.test(f);

const EXEMPLES = {
  admin: [
    "Qu'est-ce qui presse cette semaine ?",
    'Où en est la production automne 2026 ?',
    'Passe les cache-cous adultes en priorité haute',
    "Qu'est-ce qui ne bouge plus depuis 10 jours ?",
    'Mets les cache-cous adultes à 70 %',
    "Crée un ordre « Prévente hiver » avec 500 tuques sport et 300 bandeaux",
    "Ajoute une deadline « Départ conteneur » le 2 octobre sur l'ordre en cours",
    "Le bandeau se coupe dans le sens de la longueur — note-le dans sa fiche",
  ],
  atelier: [
    "Qu'est-ce que je fais en premier ?",
    'Les cache-cous adultes sont rendus à 70 %',
    "Qu'est-ce qui s'en vient le mois prochain ?",
    'Montre-moi la fiche du bandeau amovible',
    "Note sur l'ordre en cours qu'il manque du molleton noir",
  ],
};

// --------------------------------------------------------------------- routes
async function router(req, res, url, user) {
  const p = url.pathname;
  const q = url.searchParams;
  const msg = messageDe(q);
  const admin = user.role === 'admin';
  const refus = () => vers(res, '/?err=' + encodeURIComponent('Action réservée à Admin QC'));

  // ---- tableau de bord
  if (p === '/' ) {
    const ordres = R.ordresListe.all().map(o => ({
      ...o, ...avancementOrdre(o.id), prochain: R.jalonProchainOrdre.get(o.id) || null }));
    return html(res, V.vueAccueil({ user, ordres, jalons: R.jalonsProchains.all() }));
  }

  // ---- à fabriquer : la liste de travail, tous ordres confondus
  if (p === '/priorites') {
    const j = Math.min(90, Math.max(1, Number(q.get('jours')) || 7));
    return html(res, V.vuePriorites({ user, msg, jours: j,
      lignes: listeFabrication().map(l => ({ ...l, variantes: variantesItem(l.id) })),
      ailleurs: fabriqueAilleurs() }));
  }
  {
    const m = p.match(/^\/priorites\/(\d+)$/);
    if (m && req.method === 'POST') {
      if (!admin) return refus();
      const f = await corpsFormulaire(req);
      if (['haute', 'normale', 'basse'].includes(f.priorite))
        db.prepare(`UPDATE ordre_items SET priorite = ? WHERE id = ?`)
          .run(f.priorite, Number(m[1]));
      return vers(res, '/priorites#i' + m[1]);
    }
  }

  // ---- suivi : est-ce que ça bouge ?
  if (p === '/suivi') {
    const j = Math.min(90, Math.max(1, Number(q.get('jours')) || 7));
    return html(res, V.vueSuivi({ user, msg, jours: j,
      recentes: dernieresMaj(30),
      immobiles: sansMouvement(j),
      progression: progressionRecente(j) }));
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

    // ---- réservé à Admin QC
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
      items: R.items.all(id).map(it => ({ ...it, variantes: variantesItem(it.id) })),
      jalons: R.jalons.all(id),
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
        if (!V.urlAcceptable(f.url))
          return vers(res, retour + (retour.includes('?') ? '&' : '?') + 'err='
            + encodeURIComponent("Adresse d'image refusée : il faut un lien http(s) "
              + "vers Shopify ou Drive. L'app n'héberge aucun fichier."));
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

  // ---- assistant : il exécute, il ne fait pas que répondre
  if (p === '/assistant') {
    if (req.method === 'POST') {
      const f = await corpsFormulaire(req);
      const fil = filValide(f.fil) ? f.fil : nouveauFil();
      const r = await assistant.traiter({
        demande: f.demande, user, fil });
      return vers(res, '/assistant?fil=' + encodeURIComponent(fil)
        + (r.erreur && !r.tourId ? '&err=' + encodeURIComponent(r.erreur) : '')
        + '#bas');
    }
    let fil = q.get('fil');
    if (!filValide(fil)) fil = nouveauFil();
    return html(res, V.vueAssistant({ user, msg, fil,
      dispo: assistant.disponible(),
      tours: assistant.fil(fil, user.id),
      annulable: outils.dernierTourAnnulable(user.id),
      exemples: EXEMPLES[user.role] || EXEMPLES.atelier }));
  }
  {
    const m = p.match(/^\/assistant\/(\d+)\/annuler$/);
    if (m && req.method === 'POST') {
      const t = db.prepare(`SELECT * FROM agent_tours WHERE id = ?`).get(Number(m[1]));
      // On n'annule que ses propres tours : le journal d'un autre ne se touche pas.
      if (!t || t.utilisateur_id !== user.id)
        return vers(res, '/assistant?err=' + encodeURIComponent('Tour introuvable.'));
      // On ne défait que le dernier : voir dernierTourAnnulable dans outils.js.
      if (outils.dernierTourAnnulable(user.id) !== t.id)
        return vers(res, '/assistant?fil=' + encodeURIComponent(t.fil) + '&err='
          + encodeURIComponent("On ne peut annuler que la dernière action de "
            + "l'assistant. Défais les plus récentes d'abord."));
      const n = outils.annulerTour(t.id);
      return vers(res, '/assistant?fil=' + encodeURIComponent(t.fil) + '&ok='
        + encodeURIComponent(n ? `${n} modification${n > 1 ? 's' : ''} annulée${
            n > 1 ? 's' : ''}.` : 'Rien à annuler.'));
    }
  }

  if (p === '/cedule') {
    const jalons = R.jalonsTous.all();
    return html(res, V.vueCedule({ user, jalons, msg,
      cal: charge.calendrier(listeFabrication()) }));
  }

  if (p === '/cedule/capacite' && req.method === 'POST') {
    if (!admin) return refus();
    const f = await corpsFormulaire(req);
    const r = charge.poserCapacite(f);
    if (r.erreur) return vers(res, '/cedule?err=' + encodeURIComponent(r.erreur));
    return vers(res, '/cedule?ok=' + encodeURIComponent(
      `Capacité : ${r.capacite.postes} postes × ${r.capacite.heures_jour} h × `
      + `${r.capacite.jours_semaine} j = ${r.capacite.heures_semaine} h/semaine.`));
  }

  // ---- son propre compte : changer son mot de passe sans shell
  if (p === '/compte') {
    if (req.method === 'POST') {
      const f = await corpsFormulaire(req);
      if (f.nouveau !== f.nouveau2)
        return vers(res, '/compte?err=' +
          encodeURIComponent('Les deux nouveaux mots de passe ne correspondent pas.'));
      // On garde la session courante ouverte : changer son mot de passe ne
      // doit pas déconnecter celui qui vient de le faire.
      const jeton = lireCookies(req.headers.cookie).mrp_session || null;
      const r = auth.changerMotDePasse({ utilisateurId: user.id,
        ancien: f.ancien, nouveau: f.nouveau, jetonAGarder: jeton });
      if (r.erreur) return vers(res, '/compte?err=' + encodeURIComponent(r.erreur));
      return vers(res, '/compte?ok=' + encodeURIComponent(
        'Mot de passe changé. Les sessions ouvertes ailleurs ont été fermées.'));
    }
    return html(res, V.vueCompte({ user, msg }));
  }

  if (p === '/compte/nom' && req.method === 'POST') {
    const f = await corpsFormulaire(req);
    const r = auth.changerNom(user.id, f.nom);
    if (r.erreur) return vers(res, '/compte?err=' + encodeURIComponent(r.erreur));
    return vers(res, '/compte?ok=' + encodeURIComponent(`Nom changé pour « ${r.nom} ».`));
  }

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
      return envoyer(req, res, buf,
        { 'content-type': type, 'cache-control': 'public, max-age=86400' });
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

/**
 * Premier compte, au démarrage.
 *
 * Une base neuve n'a aucun utilisateur, et la page de connexion n'offre pas de
 * s'inscrire — volontairement. Sans amorce, un service fraîchement déployé est
 * donc inaccessible à tout le monde, y compris à celui qui vient de le créer.
 *
 * L'amorce ne s'exécute QUE si la table est vide : elle ne peut ni écraser un
 * compte, ni changer un mot de passe, ni réactiver un compte désactivé. Une
 * fois le premier compte créé, les deux variables ne servent plus à rien et
 * peuvent être retirées du tableau de bord.
 */
function amorcerPremierCompte() {
  const courriel = (process.env.MRP_ADMIN_COURRIEL || '').trim();
  const mdp = process.env.MRP_ADMIN_MDP || '';
  const n = db.prepare('SELECT COUNT(*) AS n FROM utilisateurs').get().n;
  if (n > 0) return;
  if (!courriel || !mdp) {
    console.warn('[mrp] Aucun utilisateur, et pas d\'amorce : personne ne peut '
      + 'ouvrir une session. Poser MRP_ADMIN_COURRIEL et MRP_ADMIN_MDP, ou créer '
      + 'un compte avec « node mrp/mrp.js utilisateur:creer ».');
    return;
  }
  if (mdp.length < 8) {
    console.error('[mrp] MRP_ADMIN_MDP fait moins de 8 caractères : compte non créé.');
    return;
  }
  try {
    auth.creerUtilisateur({ courriel, mdp, nom: 'Admin QC', role: 'admin' });
    console.log(`[mrp] Premier compte créé : ${courriel}. `
      + 'Changer le mot de passe à la première connexion, puis retirer '
      + 'MRP_ADMIN_MDP du tableau de bord.');
  } catch (e) {
    console.error('[mrp] Amorce du premier compte impossible :', e.message);
  }
}

if (require.main === module) {
  amorcerPremierCompte();
  serveur.listen(PORT, () => console.log(`[mrp] écoute sur http://localhost:${PORT}`));
}

module.exports = serveur;
