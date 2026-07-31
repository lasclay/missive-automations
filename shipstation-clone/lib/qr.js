/**
 * Encodeur de QR code — mode octet, correction d'erreur niveau M, versions 1 à 10.
 *
 * Pourquoi l'écrire plutôt que d'appeler une API de génération de QR : le QR contient le
 * secret TOTP. L'envoyer à un service tiers, c'est lui confier le second facteur de tous les
 * employés. Ça vaut deux cents lignes.
 *
 * Sortie en SVG, affichable directement dans la page. Aucune dépendance.
 * Référence : ISO/IEC 18004.
 */

// ---------------------------------------------------- corps de Galois GF(256)

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Polynôme générateur de degré n pour Reed-Solomon. */
function generateur(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const suivant = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      suivant[j] ^= poly[j];
      suivant[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = suivant;
  }
  return poly;
}

/** Codes de correction d'erreur pour un bloc de données. */
function correction(donnees, nEc) {
  const gen = generateur(nEc);
  const reste = new Array(nEc).fill(0);
  for (const octet of donnees) {
    const facteur = octet ^ reste[0];
    reste.shift(); reste.push(0);
    if (facteur !== 0) for (let i = 0; i < nEc; i++) reste[i] ^= mul(gen[i + 1], facteur);
  }
  return reste;
}

// ------------------------------------------------- tables par version (niveau M)

//                    v1  v2  v3   v4   v5   v6   v7   v8   v9   v10
const TOTAL      = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const EC_PAR_BLOC= [0, 10, 16, 26,  18,  24,  16,  18,  22,  22,  26];
const BLOCS_G1   = [0,  1,  1,  1,   2,   2,   4,   4,   2,   3,   4];
const BLOCS_G2   = [0,  0,  0,  0,   0,   0,   0,   0,   2,   2,   1];
const ALIGNEMENT = [[], [], [6,18], [6,22], [6,26], [6,30], [6,34],
                    [6,22,38], [6,24,42], [6,26,46], [6,28,50]];

const taille = (v) => 17 + 4 * v;

function capaciteDonnees(v) {
  const blocs = BLOCS_G1[v] + BLOCS_G2[v];
  return TOTAL[v] - EC_PAR_BLOC[v] * blocs;
}

/** Plus petite version qui contient `n` octets en mode octet. */
function choisirVersion(n) {
  for (let v = 1; v <= 10; v++) {
    const entete = 4 + (v < 10 ? 8 : 16);                 // mode + compteur de caractères
    if (capaciteDonnees(v) * 8 >= entete + n * 8) return v;
  }
  throw new Error("contenu trop long pour un QR de version 10");
}

// ------------------------------------------------------------------ encodage

function encoderDonnees(octets, v) {
  const bits = [];
  const pousser = (valeur, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valeur >>> i) & 1); };
  pousser(0b0100, 4);                                     // mode octet
  pousser(octets.length, v < 10 ? 8 : 16);
  for (const o of octets) pousser(o, 8);

  const capacite = capaciteDonnees(v) * 8;
  for (let i = 0; i < 4 && bits.length < capacite; i++) bits.push(0);   // terminateur
  while (bits.length % 8) bits.push(0);

  const mots = [];
  for (let i = 0; i < bits.length; i += 8)
    mots.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  const bourrage = [0xec, 0x11];
  for (let i = 0; mots.length < capaciteDonnees(v); i++) mots.push(bourrage[i % 2]);

  // Découpage en blocs, puis entrelacement — l'ordre imposé par la norme.
  const n1 = BLOCS_G1[v], n2 = BLOCS_G2[v], nEc = EC_PAR_BLOC[v];
  const tailleG1 = Math.floor(capaciteDonnees(v) / (n1 + n2));
  const blocs = [], blocsEc = [];
  let pos = 0;
  for (let i = 0; i < n1 + n2; i++) {
    const t = tailleG1 + (i >= n1 ? 1 : 0);
    const bloc = mots.slice(pos, pos + t); pos += t;
    blocs.push(bloc); blocsEc.push(correction(bloc, nEc));
  }
  const sortie = [];
  for (let i = 0; i < tailleG1 + 1; i++) for (const b of blocs) if (i < b.length) sortie.push(b[i]);
  for (let i = 0; i < nEc; i++) for (const b of blocsEc) sortie.push(b[i]);
  return sortie;
}

// ------------------------------------------------------------------ matrice

function motifsFixes(v) {
  const n = taille(v);
  const m = Array.from({ length: n }, () => new Array(n).fill(null));   // null = module libre
  const reserve = Array.from({ length: n }, () => new Array(n).fill(false));

  const poserFinder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const y = r + i, x = c + j;
      if (y < 0 || y >= n || x < 0 || x >= n) continue;
      const bord = i >= 0 && i <= 6 && (j === 0 || j === 6) || j >= 0 && j <= 6 && (i === 0 || i === 6);
      const centre = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      m[y][x] = bord || centre ? 1 : 0;
      reserve[y][x] = true;
    }
  };
  poserFinder(0, 0); poserFinder(0, n - 7); poserFinder(n - 7, 0);

  // Motifs de synchronisation.
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = m[i][6] = i % 2 === 0 ? 1 : 0;
    reserve[6][i] = reserve[i][6] = true;
  }

  // Motifs d'alignement, sauf ceux qui chevauchent un finder.
  const centres = ALIGNEMENT[v];
  for (const r of centres) for (const c of centres) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      m[r + i][c + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1 ? 1 : 0;
      reserve[r + i][c + j] = true;
    }
  }

  m[n - 8][8] = 1; reserve[n - 8][8] = true;              // module toujours noir

  // Zones réservées à l'information de format.
  for (let i = 0; i <= 8; i++) {
    if (!reserve[8][i]) { reserve[8][i] = true; m[8][i] = 0; }
    if (!reserve[i][8]) { reserve[i][8] = true; m[i][8] = 0; }
  }
  for (let i = 0; i < 8; i++) {
    if (!reserve[8][n - 1 - i]) { reserve[8][n - 1 - i] = true; m[8][n - 1 - i] = 0; }
    if (!reserve[n - 1 - i][8]) { reserve[n - 1 - i][8] = true; m[n - 1 - i][8] = 0; }
  }

  // Information de version, à partir de la version 7.
  if (v >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3), c = i % 3;
      reserve[r][n - 11 + c] = reserve[n - 11 + c][r] = true;
      m[r][n - 11 + c] = m[n - 11 + c][r] = 0;
    }
  }
  return { m, reserve, n };
}

/** Place les données en zigzag, de bas à droite vers le haut. */
function placerDonnees(m, reserve, n, mots) {
  const bits = [];
  for (const o of mots) for (let i = 7; i >= 0; i--) bits.push((o >>> i) & 1);
  let k = 0, montant = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;                                  // la colonne de synchro ne compte pas
    for (let i = 0; i < n; i++) {
      const ligne = montant ? n - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (reserve[ligne][c]) continue;
        m[ligne][c] = k < bits.length ? bits[k++] : 0;
      }
    }
    montant = !montant;
  }
}

const MASQUES = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Pénalités de la norme — on retient le masque le moins pénalisé. */
function penalite(m, n) {
  let p = 0;
  // Règle 1 : suites de cinq modules identiques ou plus.
  for (let i = 0; i < n; i++) {
    for (const ligne of [true, false]) {
      let compte = 1, prec = -1;
      for (let j = 0; j < n; j++) {
        const v = ligne ? m[i][j] : m[j][i];
        if (v === prec) { compte++; if (compte === 5) p += 3; else if (compte > 5) p++; }
        else { compte = 1; prec = v; }
      }
    }
  }
  // Règle 2 : blocs 2×2 uniformes.
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
  }
  // Règle 3 : motifs ressemblant à un finder.
  const motif = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const inverse = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let i = 0; i < n; i++) for (let j = 0; j <= n - 11; j++) {
    for (const [ligne, seq] of [[true, motif], [true, inverse], [false, motif], [false, inverse]]) {
      let ok = true;
      for (let k = 0; k < 11; k++) if ((ligne ? m[i][j + k] : m[j + k][i]) !== seq[k]) { ok = false; break; }
      if (ok) p += 40;
    }
  }
  // Règle 4 : déséquilibre noir/blanc.
  let noirs = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) noirs += m[r][c];
  p += Math.floor(Math.abs(noirs * 100 / (n * n) - 50) / 5) * 10;
  return p;
}

function poserFormat(m, n, masque) {
  // Niveau M = 00 ; BCH(15,5) puis masque 0x5412.
  let donnees = (0b00 << 3) | masque;
  let reste = donnees << 10;
  for (let i = 14; i >= 10; i--) if ((reste >>> i) & 1) reste ^= 0b10100110111 << (i - 10);
  const bits = ((donnees << 10) | reste) ^ 0b101010000010010;

  // Les quinze bits se placent du poids fort au poids faible dans l'ordre ci-dessous.
  for (let i = 0; i < 15; i++) {
    const b = (bits >>> (14 - i)) & 1;

    // Copie 1, autour du repère haut-gauche.
    if (i < 6) m[8][i] = b;
    else if (i < 8) m[8][i + 1] = b;              // saute la colonne de synchronisation
    else if (i === 8) m[7][8] = b;
    else m[14 - i][8] = b;                        // remonte de la ligne 5 à la ligne 0

    // Copie 2 : sept bits sous le repère bas-gauche, huit à droite du repère haut-droit.
    // La bascule est à i = 7, pas 8 — sinon on écrase le module toujours noir en (n-8, 8).
    if (i < 7) m[n - 1 - i][8] = b;
    else m[8][n - 15 + i] = b;
  }
}

function poserVersion(m, n, v) {
  if (v < 7) return;
  let reste = v << 12;
  for (let i = 17; i >= 12; i--) if ((reste >>> i) & 1) reste ^= 0b1111100100101 << (i - 12);
  const bits = (v << 12) | reste;
  for (let i = 0; i < 18; i++) {
    const b = (bits >>> i) & 1;
    const r = Math.floor(i / 3), c = i % 3;
    m[r][n - 11 + c] = b;
    m[n - 11 + c][r] = b;
  }
}

// ------------------------------------------------------------------ API

/** Construit la matrice de modules (0/1) pour un texte. */
function matrice(texte) {
  const octets = Array.from(Buffer.from(String(texte), "utf8"));
  const v = choisirVersion(octets.length);
  const mots = encoderDonnees(octets, v);

  let meilleure = null, meilleurScore = Infinity;
  for (let masque = 0; masque < 8; masque++) {
    const { m, reserve, n } = motifsFixes(v);
    placerDonnees(m, reserve, n, mots);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (!reserve[r][c] && MASQUES[masque](r, c)) m[r][c] ^= 1;
    poserFormat(m, n, masque);
    poserVersion(m, n, v);
    const p = penalite(m, n);
    if (p < meilleurScore) { meilleurScore = p; meilleure = m; }
  }
  return meilleure;
}

/** SVG autonome, sans image externe — affichable tel quel dans la page. */
function svg(texte, { module = 5, marge = 4, fond = "#fff", encre = "#000" } = {}) {
  const m = matrice(texte);
  const n = m.length;
  const cote = (n + marge * 2) * module;
  const chemins = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!m[r][c]) { c++; continue; }
      let largeur = 0;
      while (c + largeur < n && m[r][c + largeur]) largeur++;
      chemins.push(`M${(c + marge) * module} ${(r + marge) * module}h${largeur * module}v${module}h-${largeur * module}z`);
      c += largeur;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cote}" height="${cote}" viewBox="0 0 ${cote} ${cote}" shape-rendering="crispEdges" role="img" aria-label="Code QR de configuration">` +
    `<rect width="${cote}" height="${cote}" fill="${fond}"/><path fill="${encre}" d="${chemins.join("")}"/></svg>`;
}

module.exports = { matrice, svg, choisirVersion, capaciteDonnees, taille };
