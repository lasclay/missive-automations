const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.argv[2];
const URL = 'http://127.0.0.1:8801/demo.html';

const ok = [], ko = [];
const t = (nom, cond, det) => (cond ? ok : ko).push(nom + (cond ? '' : ' — ' + det));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 430, height: 1400 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  // Le favicon vient de l'hôte de publication, pas du fichier : sa 404 en test
  // local ne dit rien sur la page. Toute autre ressource manquante, si.
  const manquantes = [];
  p.on('response', r => { if (r.status() >= 400) manquantes.push(r.status() + ' ' + r.url()); });
  p.on('requestfailed', r => manquantes.push('échec ' + r.url()));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return;   // couvert par manquantes
    erreurs.push('console: ' + m.text());
  });
  // le favicon est fourni par l'hôte de publication, pas par le fichier
  p.on('requestfailed', r => { if (!/favicon/.test(r.url())) erreurs.push('requête: ' + r.url()); });
  p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) erreurs.push('http ' + r.status() + ' ' + r.url()); });

  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForTimeout(400);

  t('la vue par défaut est le tableau de bord',
    await p.locator('.vue.on').getAttribute('data-vue') === 'accueil');

  // --- navigation
  await p.click('nav.top a[href="#priorites"]');
  await p.waitForTimeout(200);
  t('la navigation change de vue',
    await p.locator('.vue.on').getAttribute('data-vue') === 'priorites');

  // Tant que rien n'est touché, la démo doit afficher les chiffres du serveur,
  // pas une reconstitution : c'est ce qui la rend citable.
  const attendu = JSON.parse(require('fs').readFileSync((process.env.MRP_DEMO_TRAVAIL || __dirname) + '/demo-data.json', 'utf8'));
  const nItems = attendu.items.filter(i => i.avancement < 100).length;
  const nUnites = attendu.items.reduce((s, i) => s + i.quantite * (100 - i.avancement) / 100, 0);
  const cItems = await p.locator('[data-vue="priorites"] .chiffres .c b').nth(2).textContent();
  const cUnites = await p.locator('[data-vue="priorites"] .chiffres .c b').nth(3).textContent();
  const chiffre = t => Number(t.replace(/[^0-9]/g, ''));
  t('les compteurs intacts sont ceux du serveur',
    chiffre(cItems) === nItems && chiffre(cUnites) === Math.round(nUnites),
    cItems + ' / ' + cUnites + ' attendu ' + nItems + ' / ' + Math.round(nUnites));

  const avant = {
    restant: await p.locator('[data-vue="priorites"] .chiffres .c b').nth(3).textContent(),
    hiver:   await p.locator('[data-vue="priorites"] .repartition b').nth(0).textContent(),
    ligne:   await p.locator('[data-vue="priorites"] #i1 .qte b').textContent(),
  };

  // --- saisie d'avancement sur l'ordre
  await p.goto(URL + '#ordres/1', { waitUntil: 'load' });
  await p.waitForTimeout(400);
  const glob = () => p.locator('[data-vue="ordres/1"] .carte div[style*="font-size:30px"]').textContent();
  const globAvant = await glob();

  await p.click('form.av[action$="/items/1/avancement"] button[value="100"]');
  await p.waitForTimeout(200);

  t("le bouton choisi devient l'actif",
    await p.locator('form.av[action$="/items/1/avancement"] button.on').getAttribute('value') === '100');
  const largeur = await p.evaluate(() => {
    const f = document.querySelector('form.av[action$="/items/1/avancement"]');
    return f.closest('td').querySelector('.jauge i').style.width;
  });
  t('la jauge de l’item suit', largeur === '100%', largeur);
  const globApres = await glob();
  t('l’avancement global est recalculé', globApres !== globAvant, globAvant + ' → ' + globApres);

  // --- répercussion sur À fabriquer
  await p.goto(URL + '#priorites', { waitUntil: 'load' });
  await p.waitForTimeout(300);
  const apres = {
    restant: await p.locator('[data-vue="priorites"] .chiffres .c b').nth(3).textContent(),
    hiver:   await p.locator('[data-vue="priorites"] .repartition b').nth(0).textContent(),
    ligne:   await p.locator('[data-vue="priorites"] #i1 .qte b').textContent(),
  };
  t('le restant de la ligne tombe à 0', apres.ligne === '0', apres.ligne);
  t('les unités restantes baissent', apres.restant !== avant.restant, avant.restant + ' → ' + apres.restant);
  t('la répartition par famille baisse aussi', apres.hiver !== avant.hiver, avant.hiver + ' → ' + apres.hiver);

  // --- persistance
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(400);
  t('la saisie survit au rechargement',
    await p.locator('[data-vue="priorites"] #i1 .qte b').textContent() === '0');

  // --- remise à zéro
  await p.click('#raz');
  await p.waitForTimeout(200);
  t('la remise à zéro restaure la valeur de départ',
    await p.locator('[data-vue="priorites"] #i1 .qte b').textContent() === avant.ligne,
    await p.locator('[data-vue="priorites"] #i1 .qte b').textContent());

  // --- images
  await p.goto(URL + '#produits/1', { waitUntil: 'load' });
  await p.waitForTimeout(600);
  const imgs = await p.locator('.vue.on img[data-img]').count();
  const chargees = await p.evaluate(() =>
    Array.from(document.querySelectorAll('.vue.on img[data-img]')).filter(i => i.naturalWidth > 0).length);
  t('les photos de la fiche s’affichent', imgs > 0 && chargees === imgs, chargees + '/' + imgs);

  // --- rien d'inerte ne navigue
  await p.goto(URL + '#ordres/1', { waitUntil: 'load' });
  await p.waitForTimeout(300);
  const avantURL = p.url();
  const inerte = p.locator('.vue.on [data-inerte]').first();
  if (await inerte.count()) { await inerte.click(); await p.waitForTimeout(150); }
  t('un lien inerte ne quitte pas la vue', p.url() === avantURL, p.url());

  // --- pas de débordement horizontal
  const debord = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  t('aucun débordement horizontal', debord <= 1, debord + 'px');

  t('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  const vraies = manquantes.filter(u => !/favicon/.test(u));
  t('aucune ressource manquante', vraies.length === 0, vraies.join(' | '));

  if (OUT) {
    await p.goto(URL + '#priorites', { waitUntil: 'load' });
    await p.waitForTimeout(400);
    await p.screenshot({ path: OUT + '/demo-priorites.png', clip: { x: 0, y: 0, width: 430, height: 1600 } });
  }
  await b.close();

  ok.forEach(n => console.log('  [OK ] ' + n));
  ko.forEach(n => console.log('  [KO ] ' + n));
  console.log('\n  ' + ok.length + ' réussites, ' + ko.length + ' échecs\n');
  process.exit(ko.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
