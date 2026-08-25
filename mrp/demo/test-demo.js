/**
 * Vérifie la démo publiée : la navigation, les deux rôles, les deux gestes
 * réels, et que rien ne ment tant que rien n'est touché.
 *
 *   npx http-server -p 8801 -s /chemin/de/sortie
 *   MRP_DEMO_TRAVAIL=/chemin node mrp/demo/test-demo.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const URL = process.env.MRP_DEMO_URL || 'http://127.0.0.1:8801/demo.html';
const TRAVAIL = process.env.MRP_DEMO_TRAVAIL || __dirname;

const ok = [], ko = [];
const t = (nom, cond, det) => { if (process.env.MRP_DEMO_TRACE) console.log('· ' + nom); return (cond ? ok : ko).push(nom + (cond ? '' : ' — ' + det)); };
const chiffre = txt => Number(String(txt).replace(/[^0-9]/g, ''));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 430, height: 1400 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();

  // Le favicon vient de l'hôte de publication, pas du fichier : sa 404 en test
  // local ne dit rien sur la page. Toute autre ressource manquante, si.
  const erreurs = [], manquantes = [];
  const pertinent = u => !/favicon/.test(u);
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return;   // couvert par manquantes
    erreurs.push('console: ' + m.text());
  });
  p.on('response', r => { if (r.status() >= 400 && pertinent(r.url())) manquantes.push(r.status() + ' ' + r.url()); });
  p.on('requestfailed', r => { if (pertinent(r.url())) manquantes.push('échec ' + r.url()); });

  const attendu = JSON.parse(fs.readFileSync(TRAVAIL + '/demo-data.json', 'utf8'));
  const parProduit = new Map(attendu.produits.map(x => [x.id, x]));
  const atelier = attendu.items.filter(i =>
    (parProduit.get(i.produit_id) || {}).fabrication === 'tunisie');

  const vue = () => p.locator('.vue.on').first();
  const va = async h => { await p.goto(URL + h, { waitUntil: 'load' }); await p.waitForTimeout(350); };

  await va('');
  t('la vue par défaut est le tableau de bord',
    await vue().getAttribute('data-vue') === 'accueil');

  // --------------------------------------------------------------- rôles
  await p.click('.ruban button[data-role="atelier"]');
  await p.waitForTimeout(200);
  t('le rôle bascule', await vue().getAttribute('data-role') === 'atelier',
    await vue().getAttribute('data-role'));

  await va('#priorites');
  t("l'atelier ne voit aucun sélecteur de priorité",
    await p.locator('.vue.on .pri select').count() === 0);
  t("mais voit la priorité en toutes lettres",
    (await p.locator('.vue.on .pri').first().textContent() || '').trim().length > 0);

  await p.click('.ruban button[data-role="admin"]');
  await p.waitForTimeout(250);
  t('Québec voit les sélecteurs de priorité',
    await p.locator('.vue.on .pri select').count() > 0);

  // ------------------------------------------- rien touché = chiffres serveur
  const cItems = await p.locator('.vue.on .chiffres .c b').nth(2).textContent();
  const cUnites = await p.locator('.vue.on .chiffres .c b').nth(3).textContent();
  const nUnites = atelier.reduce((s, i) => s + i.quantite * (100 - i.avancement) / 100, 0);
  t('les compteurs intacts sont ceux du serveur',
    chiffre(cItems) === atelier.filter(i => i.avancement < 100).length
      && chiffre(cUnites) === Math.round(nUnites),
    cItems + ' / ' + cUnites);

  t('tout part à zéro',
    attendu.items.every(i => i.avancement === 0),
    JSON.stringify(attendu.items.filter(i => i.avancement).map(i => i.id)));

  // ---------------------------------------- ce qui se fabrique ailleurs se dit
  const ailleurs = attendu.items.filter(i =>
    (parProduit.get(i.produit_id) || {}).fabrication !== 'tunisie');
  t('ce qui est fabriqué ailleurs est annoncé, pas escamoté',
    !ailleurs.length || await p.locator('.vue.on .ailleurs').count() > 0);
  if (ailleurs.length) {
    const code = parProduit.get(ailleurs[0].produit_id).code;
    t('le produit fabriqué ailleurs est nommé',
      (await p.locator('.vue.on .ailleurs').textContent() || '').includes(code), code);
    t("et il n'est pas dans le tableau de l'atelier",
      await p.locator(`.vue.on table.fab #i${ailleurs[0].id}`).count() === 0);
  }

  const premierAvant = await p.locator('.vue.on table.fab tbody tr').first().getAttribute('id');

  // ------------------------------------------------------- geste de Québec
  const dernier = await p.locator('.vue.on table.fab tbody tr').last().getAttribute('id');
  await p.selectOption(`.vue.on ${dernier ? '#' + dernier : 'tr'} .pri select`, 'haute');
  await p.waitForTimeout(250);
  t('une priorité haute remonte la ligne en tête',
    await p.locator('.vue.on table.fab tbody tr').first().getAttribute('id') === dernier,
    dernier + ' attendu, ' + await p.locator('.vue.on table.fab tbody tr').first().getAttribute('id'));
  t('les rangs sont renumérotés',
    await p.locator('.vue.on table.fab tbody tr').first().locator('.num').textContent() === '1');

  await p.selectOption(`.vue.on #${dernier} .pri select`, 'normale');
  await p.waitForTimeout(250);
  t('remise en normale, la ligne retrouve sa place',
    await p.locator('.vue.on table.fab tbody tr').first().getAttribute('id') === premierAvant);

  // ------------------------------------------------------ geste de l'atelier
  const cible = Number(premierAvant.slice(1));
  await va('#ordres/1');
  const glob = () => p.locator('.vue.on .carte div[style*="font-size:30px"]').textContent();
  t("l'ordre part à 0 %", (await glob()).trim() === '0 %', await glob());

  await p.click(`.vue.on form.av[action$="/items/${cible}/avancement"] button[value="30"]`);
  await p.waitForTimeout(250);
  t("le bouton choisi devient l'actif",
    await p.locator(`.vue.on form.av[action$="/items/${cible}/avancement"] button.on`)
      .getAttribute('value') === '30');
  const largeur = await p.evaluate(id => {
    const f = document.querySelector(`.vue.on form.av[action$="/items/${id}/avancement"]`);
    return f.closest('td').querySelector('.jauge i').style.width;
  }, cible);
  t('la jauge de l’item suit', largeur === '30%', largeur);
  t("l'avancement global n'est plus zéro", (await glob()).trim() !== '0 %', await glob());

  // --------------------------------------------------- répercussion partout
  await va('#priorites');
  const it = attendu.items.find(i => i.id === cible);
  t('le restant de la ligne baisse',
    chiffre(await p.locator(`.vue.on #i${cible} .qte b`).textContent())
      === Math.round(it.quantite * 0.7),
    await p.locator(`.vue.on #i${cible} .qte b`).textContent());
  t('les unités restantes baissent',
    chiffre(await p.locator('.vue.on .chiffres .c b').nth(3).textContent()) < chiffre(cUnites));

  await va('#suivi');
  t('le suivi se remplit du geste posé',
    await p.locator('.vue.on ul.flux li').count() === 1,
    String(await p.locator('.vue.on ul.flux li').count()));
  t('le suivi convertit la progression en pièces',
    chiffre(await p.locator('.vue.on .c-unites').textContent())
      === Math.round(it.quantite * 0.3),
    await p.locator('.vue.on .c-unites').textContent());

  await p.click('.ruban button[data-role="atelier"]');
  await p.waitForTimeout(250);
  t("le geste se voit aussi dans l'autre rôle",
    await p.locator('.vue.on ul.flux li').count() === 1);

  // ------------------------------------------------------------ persistance
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(400);
  t('le rôle survit au rechargement', await vue().getAttribute('data-role') === 'atelier');
  await va('#priorites');
  t('la saisie survit au rechargement',
    chiffre(await p.locator(`.vue.on #i${cible} .qte b`).textContent())
      === Math.round(it.quantite * 0.7));

  await p.click('#raz');
  await p.waitForTimeout(600);
  await va('#priorites');
  t('« Repartir à zéro » restaure le HTML du serveur',
    chiffre(await p.locator('.vue.on #i' + cible + ' .qte b').textContent()) === it.quantite,
    await p.locator('.vue.on #i' + cible + ' .qte b').textContent());

  // ----------------------------------------------------------------- reste
  await va('#produits/1');
  const imgs = await p.locator('.vue.on img[data-img]').count();
  const chargees = await p.evaluate(() =>
    Array.from(document.querySelectorAll('.vue.on img[data-img]')).filter(i => i.naturalWidth > 0).length);
  t('les photos de la fiche s’affichent', imgs > 0 && chargees === imgs, chargees + '/' + imgs);

  await va('#ordres/1');
  const avantURL = p.url();
  const inerte = p.locator('.vue.on [data-inerte]').first();
  if (await inerte.count()) { await inerte.click(); await p.waitForTimeout(150); }
  t('un lien inerte ne quitte pas la vue', p.url() === avantURL, p.url());

  const debord = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  t('aucun débordement horizontal', debord <= 1, debord + 'px');

  t('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  t('aucune ressource manquante', manquantes.length === 0, manquantes.join(' | '));

  if (OUT) {
    await va('#priorites');
    await p.screenshot({ path: OUT + '/demo-priorites.png', clip: { x: 0, y: 0, width: 430, height: 1700 } });
  }
  await b.close();

  ok.forEach(n => console.log('  [OK ] ' + n));
  ko.forEach(n => console.log('  [KO ] ' + n));
  console.log('\n  ' + ok.length + ' réussites, ' + ko.length + ' échecs\n');
  process.exit(ko.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
