/**
 * Ingestion — remplir le clone.
 *
 * Deux chemins :
 *   1. `migrerDepuisShipStation()` — récupère tout le compte par le General Proxy. À lancer
 *      AVANT toute résiliation : l'accès API disparaît avec l'abonnement (AUDIT.md §8).
 *   2. `importerCommandes()` — le format normalisé qu'utiliseront les connecteurs Shopify,
 *      Etsy et Faire. Les règles d'automatisation s'appliquent à l'import, comme chez
 *      ShipStation.
 */
const { all, one, run, tx, dump, parse, maintenant, journaliser, poserReglage } = require("./db");
const orders = require("./orders");
const rules = require("./rules");
const catalog = require("./catalog");

const PROXY = process.env.GENERAL_PROXY_URL || "https://general-proxy-5muf.onrender.com";
const SECRET = process.env.GENERAL_PROXY_SECRET || process.env.PROXY_SECRET || "";

/**
 * Appel au proxy, avec reprise sur les pannes passagères.
 *
 * Sans cette reprise, la migration s'arrêtait toujours au même endroit : page 59 des
 * commandes expédiées, cumul 29 442 sur 38 126, sur un **502 du proxy Render**. C'est
 * l'explication du trou de 10 284 commandes que le rapprochement signalait — pas un oubli
 * de lancer la migration, une coupure au milieu, une seule fois suffisante pour perdre le
 * quart de l'historique.
 *
 * Un 502 après cinquante-neuf pages n'est pas une erreur de programme : c'est un service qui
 * a hoqueté. La distinction se fait sur le code — on réessaie les 5xx, les 429 et les coupures
 * réseau, jamais un 400 ou un 401, qui ne guériront pas d'être redemandés.
 */
const TRANSITOIRE = (statut) => statut === 429 || (statut >= 500 && statut <= 599);
const PAUSES = [2000, 4000, 8000, 16000, 32000];

async function ss(action, params, { essais = PAUSES.length, journal = null } = {}) {
  let derniere = null;
  for (let n = 0; n <= essais; n++) {
    let res, txt;
    try {
      res = await fetch(`${PROXY}/shipstation/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Proxy-Secret": SECRET },
        body: JSON.stringify(params || {}),
      });
      txt = await res.text();
    } catch (e) {
      // Coupure réseau, DNS, socket fermée : toujours passager.
      derniere = new Error(`${action} → réseau : ${e.message}`);
      if (n === essais) break;
      journal?.(`  ↻ ${action} : ${e.message} — reprise dans ${PAUSES[n] / 1000} s`);
      await new Promise((ok) => setTimeout(ok, PAUSES[n]));
      continue;
    }
    let j; try { j = JSON.parse(txt); } catch { j = null; }
    if (res.ok && j && !j.error) return j.data;

    derniere = new Error(`${action} → ${res.status} ${txt.slice(0, 200)}`);
    if (!TRANSITOIRE(res.status) || n === essais) break;
    journal?.(`  ↻ ${action} : ${res.status} — reprise dans ${PAUSES[n] / 1000} s (essai ${n + 1}/${essais})`);
    await new Promise((ok) => setTimeout(ok, PAUSES[n]));
  }
  throw derniere;
}

/**
 * Références vers un objet disparu → NULL.
 *
 * L'historique pointe vers des entrepôts et des boutiques supprimés depuis longtemps chez
 * ShipStation. Les garder ferait échouer la contrainte de clé étrangère et perdrait
 * l'expédition entière ; les annuler ne perd qu'un lien mort.
 */
const _connus = {};
function refValide(table, colonne, valeur) {
  if (valeur === null || valeur === undefined) return null;
  if (!_connus[table]) _connus[table] = new Set(all(`SELECT ${colonne} v FROM ${table}`).map((r) => String(r.v)));
  return _connus[table].has(String(valeur)) ? valeur : null;
}
const oublierConnus = () => { for (const k of Object.keys(_connus)) delete _connus[k]; };

/** Poids en grammes quelle que soit l'unité — ShipStation en mélange trois. */
function grammes(w) {
  if (!w || !w.value) return 0;
  const u = String(w.units || "").toLowerCase();
  if (u.startsWith("ounce")) return w.value * 28.3495;
  if (u.startsWith("pound")) return w.value * 453.592;
  return w.value;
}

// ------------------------------------------------------- conversion ShipStation

function convertirCommande(o) {
  return {
    order_number: o.orderNumber,
    order_key: o.orderKey || `ss-${o.orderId}`,
    store_id: refValide("stores", "id", (o.advancedOptions || {}).storeId),
    status: o.orderStatus,
    order_date: o.orderDate, paid_at: o.paymentDate,
    ship_by_date: o.shipByDate, hold_until: o.holdUntilDate,
    customer_email: o.customerEmail,
    customer_name: (o.shipTo || {}).name || o.customerUsername,
    bill_to: o.billTo, ship_to: o.shipTo || {},
    order_total: o.orderTotal || 0, amount_paid: o.amountPaid || 0,
    tax_amount: o.taxAmount || 0, shipping_paid: o.shippingAmount || 0,
    customer_notes: o.customerNotes, internal_notes: o.internalNotes,
    gift: !!o.gift, gift_message: o.giftMessage,
    requested_service: o.requestedShippingService,
    carrier_code: o.carrierCode, service_id: o.serviceCode, package_id: o.packageCode,
    confirmation: o.confirmation === "none" ? null : o.confirmation,
    weight_g: grammes(o.weight),
    dimensions: o.dimensions,
    warehouse_id: refValide("warehouses", "id", (o.advancedOptions || {}).warehouseId),
    insurance: o.insuranceOptions && o.insuranceOptions.insureShipment ? o.insuranceOptions : null,
    customs: o.internationalOptions && o.internationalOptions.customsItems ? o.internationalOptions : null,
    custom_field1: (o.advancedOptions || {}).customField1,
    custom_field2: (o.advancedOptions || {}).customField2,
    custom_field3: (o.advancedOptions || {}).customField3,
    source: (o.advancedOptions || {}).source,
    externally_fulfilled: !!o.externallyFulfilled,
    tag_ids: o.tagIds || [],
    items: (o.items || []).map((i) => ({
      line_key: i.lineItemKey, sku: i.sku, name: i.name, image_url: i.imageUrl,
      quantity: i.quantity, unit_price: i.unitPrice, weight_g: grammes(i.weight),
      tax: i.taxAmount, warehouse_location: i.warehouseLocation, upc: i.upc,
      adjustment: !!i.adjustment, options: i.options || [],
    })),
    raw: o,
  };
}

// ------------------------------------------------------------------ migration

/**
 * Migration complète. `journal` reçoit les messages de progression (console par défaut).
 * Respecte la limite de 40 requêtes/minute en pageant à 500.
 *
 * Chaque bloc est une **étape nommée**, tracée dans `migration_suivi`. Deux raisons : une
 * migration de 28 565 commandes et 14 406 envois qui casse à mi-chemin doit dire où elle
 * s'est arrêtée plutôt que de laisser deviner ; et on doit pouvoir n'en rejouer qu'un
 * morceau (`objets: ["produits"]`) sans repasser trois quarts d'heure sur le reste.
 *
 * Une étape qui échoue ne fait pas tomber la migration : elle est notée en échec et les
 * suivantes continuent. Perdre les produits ne doit pas faire perdre les commandes.
 */
const ETAPES = ["referentiels", "commandes", "expeditions", "lots", "fulfillments",
  "produits", "clients", "webhooks", "marketplaces", "retours", "consolidation"];

async function migrerDepuisShipStation({ journal = console.error, maxPagesCommandes = 100,
  depuis = null, objets = null } = {}) {
  if (!SECRET) throw new Error("GENERAL_PROXY_SECRET requis pour la migration");
  const bilan = {};

  const demandes = objets && objets.length ? new Set(objets) : null;
  if (demandes) {
    const inconnus = [...demandes].filter((o) => !ETAPES.includes(o));
    if (inconnus.length) throw new Error(`étape inconnue : ${inconnus.join(", ")} — ` +
      `étapes possibles : ${ETAPES.join(", ")}`);
  }

  /** Joue une étape, la trace, et laisse passer la suivante si elle échoue. */
  async function etape(nom, fn) {
    if (demandes && !demandes.has(nom)) { bilan[nom] = "ignorée"; return; }
    run(`INSERT INTO migration_suivi (objet, statut, demarre_le, lus, ecrits, ignores, erreur)
         VALUES (?, 'en_cours', ?, 0, 0, 0, NULL)
         ON CONFLICT(objet) DO UPDATE SET statut='en_cours', demarre_le=excluded.demarre_le,
           fini_le=NULL, erreur=NULL`, nom, maintenant());
    try {
      await fn();
      run("UPDATE migration_suivi SET statut='termine', fini_le=? WHERE objet=?", maintenant(), nom);
    } catch (e) {
      const msg = String(e.message || e).slice(0, 300);
      run("UPDATE migration_suivi SET statut='echec', fini_le=?, erreur=? WHERE objet=?",
        maintenant(), msg, nom);
      bilan[`${nom}_erreur`] = msg;
      journal(`  ⚠ étape « ${nom} » en échec : ${msg}`);
    }
  }

  /** Avance le curseur d'une étape — ce qu'il faut pour reprendre sans tout relire. */
  const curseur = (nom, valeur, lus, ecrits) =>
    run("UPDATE migration_suivi SET curseur=?, lus=?, ecrits=? WHERE objet=?",
      String(valeur), lus, ecrits, nom);

  await etape("referentiels", async () => {
    // -- référentiels
    journal("Référentiels…");
    const carriers = await ss("carriers");
    tx(() => {
      for (const c of carriers) {
        run(`INSERT INTO carriers (code,name,account,balance,requires_funding,active) VALUES (?,?,?,?,?,1)
             ON CONFLICT(code) DO UPDATE SET name=excluded.name, balance=excluded.balance`,
          c.code, c.nickname || c.name, c.accountNumber, c.balance || 0, c.requiresFundedAccount ? 1 : 0);
      }
    });
    bilan.transporteurs = carriers.length;

    const stores = await ss("stores");
    tx(() => {
      for (const s of stores) {
        run(`INSERT INTO stores (id,name,marketplace,active,auto_refresh,last_refresh) VALUES (?,?,?,?,?,?)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, active=excluded.active`,
          s.storeId, s.storeName, s.marketplaceName, s.active ? 1 : 0, s.autoRefresh ? 1 : 0, s.refreshDate);
      }
    });
    bilan.boutiques = stores.length;

    const warehouses = await ss("warehouses");
    tx(() => {
      for (const w of warehouses) {
        run(`INSERT INTO warehouses (id,name,origin_address,return_address,is_default) VALUES (?,?,?,?,?)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, origin_address=excluded.origin_address`,
          w.warehouseId, w.warehouseName, dump(w.originAddress), dump(w.returnAddress), w.isDefault ? 1 : 0);
      }
    });
    bilan.entrepots = warehouses.length;

    try {
      const users = await ss("users", { showInactive: true });
      tx(() => {
        for (const u of users) {
          run(`INSERT INTO users (id,name,email,active,permissions,created_at) VALUES (?,?,?,1,?,?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
            u.userId, u.name || u.userName, u.userName, dump({ role: "expediteur", importe: true }), maintenant());
        }
      });
      bilan.utilisateurs = users.length;
    } catch (e) { bilan.utilisateurs = `non migrés (${String(e.message).slice(0, 60)})`; }

    // Catalogues de services et de colis, par transporteur : ce sont eux qui donnent les
    // serviceCode et packageCode valides, indispensables pour rejouer une expédition.
    let nServices = 0, nColis = 0;
    for (const c of carriers) {
      for (const [action, table, compteur] of [["listservices", "services", "s"], ["listpackages", "packages", "p"]]) {
        try {
          const liste = await ss(action, { carrierCode: c.code });
          tx(() => {
            for (const x of liste) {
              if (table === "services") {
                run(`INSERT INTO services (id,carrier_code,name,domestic,international,drop_off)
                     VALUES (?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
                  x.code, c.code, x.name, x.domestic ? 1 : 0, x.international ? 1 : 0);
                nServices++;
              } else {
                run(`INSERT INTO packages (id,carrier_code,name,domestic) VALUES (?,?,?,?)
                     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
                  x.code, c.code, x.name, x.domestic ? 1 : 0);
                nColis++;
              }
            }
          });
        } catch { /* transporteur sans catalogue exposé */ }
      }
    }
    bilan.services = nServices;
    bilan.types_de_colis = nColis;

    const tags = await ss("listtags");
    tx(() => {
      for (const t of tags) {
        run("INSERT INTO tags (id,name,color) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name",
          t.tagId, t.name, t.color);
      }
    });
    bilan.tags = tags.length;

    oublierConnus();   // les référentiels viennent d'être écrits

  });

  await etape("commandes", async () => {
    // -- commandes
    journal("Commandes…");
    let nCommandes = 0;
    for (const statut of ["awaiting_shipment", "on_hold", "awaiting_payment", "shipped", "cancelled"]) {
      for (let page = 1; page <= maxPagesCommandes; page++) {
        const params = { orderStatus: statut, pageSize: 500, page };
        if (depuis) params.createDateStart = depuis;
        const d = await ss("orders", params, { journal });
        const lot = d.orders || [];
        if (page === maxPagesCommandes && lot.length === 500) {
          journal(`  ⚠ plafond de ${maxPagesCommandes} pages atteint pour « ${statut} » — ` +
            `il reste des commandes non migrées. Relancer avec maxPagesCommandes plus haut.`);
        }
        tx(() => {
          for (const o of lot) {
            const c = convertirCommande(o);
            const id = orders.upsert(c);
            for (const t of c.tag_ids) {
              try { orders.ajouterTag(id, t); } catch { /* tag absent du référentiel */ }
            }
            nCommandes++;
          }
        });
        curseur("commandes", `${statut}:p${page}`, nCommandes, nCommandes);
        journal(`  ${statut} p${page} : ${lot.length} (cumul ${nCommandes})`);
        if (lot.length < 500) break;
      }
    }
    bilan.commandes = nCommandes;

  });

  await etape("expeditions", async () => {
    // -- expéditions
    journal("Expéditions…");
    let nExp = 0;
    for (let page = 1; page <= maxPagesCommandes; page++) {
      // Sans includeShipmentItems, ShipStation ne renvoie pas le détail des lignes expédiées —
      // et le rattachement article ↔ expédition reste vide sans que rien ne le signale.
      const params = { pageSize: 500, page, includeShipmentItems: true };
      if (depuis) params.shipDateStart = depuis;
      const d = await ss("shipments", params, { journal });
      const lot = d.shipments || [];
      let refusees = 0;
      tx(() => {
        for (const s of lot) {
         try {
          const cmd = one("SELECT id FROM orders WHERE order_key = ? OR order_number = ?",
            s.orderKey || `ss-${s.orderId}`, s.orderNumber);
          run(`INSERT INTO shipments (order_id,label_id,tracking_number,carrier_code,service_id,package_id,
                 confirmation,cost,insurance_cost,ship_date,created_at,weight_g,dimensions,ship_to,
                 warehouse_id,is_return,voided,voided_at,marketplace_notified,raw)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            cmd ? cmd.id : null, String(s.shipmentId), s.trackingNumber, s.carrierCode, s.serviceCode,
            s.packageCode, s.confirmation, s.shipmentCost || 0, s.insuranceCost || 0,
            s.shipDate, s.createDate, grammes(s.weight), dump(s.dimensions), dump(s.shipTo),
            refValide("warehouses", "id", s.warehouseId), s.isReturnLabel ? 1 : 0, s.voided ? 1 : 0, s.voidDate,
            s.marketplaceNotified ? 1 : 0, dump(s));
          const sid = one("SELECT last_insert_rowid() r").r;
          // Rattache les lignes expédiées, quand ShipStation les donne : c'est ce qui distingue
          // une expédition partielle d'une expédition complète.
          for (const it of s.shipmentItems || []) {
            run(`UPDATE order_items SET shipment_id = ? WHERE order_id = ? AND (line_key = ? OR sku = ?)`,
              sid, cmd ? cmd.id : null, it.lineItemKey || null, it.sku || null);
          }
          nExp++;
         } catch (e) { refusees++; journal(`    expédition ${s.shipmentId} refusée : ${String(e.message).slice(0, 70)}`); }
        }
      });
      curseur("expeditions", `p${page}`, nExp + refusees, nExp);
      journal(`  expéditions p${page} : ${lot.length} (cumul ${nExp}${refusees ? `, ${refusees} refusée(s)` : ""})`);
      if (lot.length < 500) break;
    }
    bilan.expeditions = nExp;
    bilan.expeditions_sans_commande = one(
      "SELECT COUNT(*) n FROM shipments WHERE order_id IS NULL AND label_id IS NOT NULL").n;
    if (bilan.expeditions_sans_commande) {
      journal(`  ${bilan.expeditions_sans_commande} expédition(s) sans commande : leur commande a ` +
        `été purgée chez ShipStation. Elles sont conservées — elles portent le coût réel, donc ` +
        `elles comptent dans l'analytique.`);
    }

  });

  await etape("lots", async () => {
    // -- lots : ShipStation n'expose pas les lots, mais chaque expédition porte son
    // batchNumber. On les reconstitue, ce qui rend l'historique des lots consultable.
    journal("Reconstitution des lots…");
    const numeros = all(`SELECT DISTINCT json_extract(raw,'$.batchNumber') b FROM shipments
                         WHERE json_extract(raw,'$.batchNumber') IS NOT NULL`).map((r) => r.b);
    tx(() => {
      for (const num of numeros) {
        const membres = all(`SELECT id, created_at FROM shipments
                             WHERE json_extract(raw,'$.batchNumber') = ?`, num);
        if (!membres.length) continue;
        run(`INSERT INTO batches (name, created_at, status, notes) VALUES (?,?, 'done', ?)`,
          `Lot ${num}`, membres[0].created_at, dump({ batchNumber: num, importe: true }));
        const batchId = one("SELECT last_insert_rowid() r").r;
        for (const m of membres) run("UPDATE shipments SET batch_id = ? WHERE id = ?", batchId, m.id);
      }
    });
    bilan.lots = numeros.length;

  });

  await etape("fulfillments", async () => {
    // -- fulfillments (envois sans étiquette ShipStation)
    journal("Fulfillments…");
    let nFul = 0;
    for (let page = 1; page <= maxPagesCommandes; page++) {
      const d = await ss("fulfillments", { pageSize: 500, page }, { journal });
      const lot = d.fulfillments || [];
      tx(() => {
        for (const f of lot) {
          const cmd = one("SELECT id FROM orders WHERE order_number = ?", f.orderNumber);
          run(`INSERT INTO shipments (order_id,tracking_number,carrier_code,cost,ship_date,created_at,
                 ship_to,voided,marketplace_notified,raw) VALUES (?,?,?,0,?,?,?,?,?,?)`,
            cmd ? cmd.id : null, f.trackingNumber || null, f.carrierCode, f.shipDate, f.createDate,
            dump(f.shipTo), f.voided ? 1 : 0, f.marketplaceNotified ? 1 : 0, dump(f));
          nFul++;
        }
      });
      curseur("fulfillments", `p${page}`, nFul, nFul);
      journal(`  fulfillments p${page} : ${lot.length} (cumul ${nFul})`);
      if (lot.length < 500) break;
    }
    bilan.fulfillments = nFul;

  });

  await etape("produits", async () => {
    // -- produits (action ajoutée au proxy ; absente tant qu'elle n'est pas déployée)
    try {
      const sondeP = await ss("products", { pageSize: 1 });
      journal(`Produits… ${sondeP.total} au total`);
      let nProd = 0;
      for (let page = 1; page <= Math.ceil((sondeP.total || 0) / 500); page++) {
        const d = await ss("products", { pageSize: 500, page }, { journal });
        const lot = d.products || [];
        tx(() => {
          for (const p of lot) {
            catalog.sauverProduit({
              external_id: p.productId,
              sku: p.sku, name: p.name, image_url: p.imageUrl, upc: p.upc,
              weight_g: grammes({ value: p.weightOz, units: "ounces" }),
              price: p.price, active: p.active !== false,
              warehouse_location: p.warehouseLocation,
              customs_description: p.customsDescription, hs_code: p.customsTariffNo,
              country_of_origin: p.customsCountryCode || "CA",
              default_carrier: p.defaultCarrierCode, default_service: p.defaultServiceCode,
              default_package: p.defaultPackageCode, fulfillment_sku: p.fulfillmentSku,
            });
            nProd++;
          }
        });
        curseur("produits", `p${page}`, nProd, nProd);
        journal(`  produits p${page} : ${lot.length} (cumul ${nProd})`);
        if (lot.length < 500) break;
      }
      bilan.produits = nProd;
    } catch (e) {
      journal(`  produits ignorés : ${e.message.slice(0, 120)}`);
      bilan.produits = `non migrés (${String(e.message).slice(0, 80)})`;
    }

  });

  await etape("clients", async () => {
    // -- clients tels que ShipStation les agrège (identifiants, marché d'origine)
    try {
      const sonde = await ss("customers", { pageSize: 1 });
      const pagesCli = Math.ceil((sonde.total || 0) / 500);
      journal(`Clients ShipStation… ${sonde.total} au total, ${pagesCli} page(s)`);
      let nCli = 0;
      for (let page = 1; page <= pagesCli; page++) {
        const d = await ss("customers", { pageSize: 500, page }, { journal });
        const lot = d.customers || [];
        tx(() => {
          for (const c of lot) {
            run(`INSERT INTO customers (email,name,phone,address,store_id,order_count,total_spent,
                   first_order,last_order) VALUES (?,?,?,?,?,?,?,?,?)
                 ON CONFLICT(email) DO UPDATE SET name = excluded.name, address = excluded.address`,
              c.email, c.name, c.phone, dump({
                street1: c.street1, street2: c.street2, city: c.city, state: c.state,
                postalCode: c.postalCode, country: c.countryCode,
              }), c.marketplaceId || null, 0, 0, c.createDate, c.modifyDate);
            nCli++;
          }
        });
        curseur("clients", `p${page}`, nCli, nCli);
        journal(`  clients p${page} : ${lot.length} (cumul ${nCli})`);
        if (lot.length < 500) break;
      }
      bilan.clients_shipstation = nCli;
    } catch (e) { bilan.clients_shipstation = `non migrés (${String(e.message).slice(0, 60)})`; }

  });

  await etape("webhooks", async () => {
    // -- abonnements webhook existants, pour ne pas les redécouvrir à la main
    try {
      const wh = await ss("webhooks");
      const liste = wh.webhooks || wh || [];
      tx(() => {
        for (const w of liste) {
          run(`INSERT INTO webhooks (event, target_url, store_id, friendly_name, active, created_at)
               VALUES (?,?,?,?,0,?)`,
            w.Event || w.event, w.Url || w.target_url, w.StoreID || null,
            `(ShipStation) ${w.Name || w.friendly_name || ""}`.trim(), maintenant());
        }
      });
      bilan.webhooks = liste.length;
    } catch (e) { bilan.webhooks = `non migrés (${String(e.message).slice(0, 60)})`; }

  });

  await etape("marketplaces", async () => {
    // -- catalogue des canaux de vente intégrables
    try {
      const mk = await ss("marketplaces");
      poserReglage("marketplaces_shipstation", mk);
      bilan.marketplaces = (mk || []).length;
    } catch { bilan.marketplaces = "non migrés"; }

  });

  // -- retours : ShipStation n'expose pas les RMA, mais chaque étiquette de retour en est
  // un. Les reconstituer rend l'historique des retours consultable — c'est la seule source
  // qui existe, et elle porte le coût réel de chaque renvoi.
  await etape("retours", async () => {
    journal("Reconstitution des retours…");
    const etiquettes = all(`SELECT s.id, s.order_id, s.created_at, s.ship_date, s.tracking_number,
                                   s.voided, o.order_number
                              FROM shipments s LEFT JOIN orders o ON o.id = s.order_id
                             WHERE s.is_return = 1`);
    let n = 0;
    tx(() => {
      for (const e of etiquettes) {
        // Le RMA reprend le numéro de commande quand on l'a : c'est ce que le client cite au
        // téléphone. À défaut, l'identifiant de l'expédition, qui est au moins stable.
        // Une même commande peut être retournée deux fois : on suffixe plutôt que d'ignorer
        // la seconde étiquette — dix retours disparaissaient ainsi de l'historique.
        if (one("SELECT id FROM returns WHERE shipment_id = ?", e.id)) continue;
        const base = `RMA-${e.order_number || `EXP${e.id}`}`;
        let rma = base, suite = 1;
        while (one("SELECT id FROM returns WHERE rma = ?", rma)) rma = `${base}-${++suite}`;
        run(`INSERT INTO returns (rma, order_id, shipment_id, status, reason, requested_at, notes, items)
             VALUES (?,?,?,?,?,?,?,'[]')`,
          rma, e.order_id, e.id,
          e.voided ? "rejected" : (e.ship_date ? "in_transit" : "approved"),
          null,                                   // le motif n'existe pas côté ShipStation
          e.created_at || e.ship_date,
          "Reconstitué depuis l'étiquette de retour ShipStation — motif et articles à saisir");
        n++;
      }
    });
    bilan.retours = n;
    journal(`  ${n} retour(s) reconstitué(s) depuis les étiquettes de retour`);
  });

  await etape("consolidation", async () => {
    // -- dérivés
    journal("Consolidation des clients…");
    bilan.clients = catalog.reconstruireClients();

  });

  // L'état par étape part avec le bilan : c'est ce qui permet de dire « les produits ont
  // échoué, relancer --objets produits » sans avoir à relire les journaux.
  bilan.etapes = Object.fromEntries(all("SELECT objet, statut, curseur, erreur FROM migration_suivi")
    .map((r) => [r.objet, r.erreur ? `${r.statut} — ${r.erreur}` : `${r.statut}${r.curseur ? ` (${r.curseur})` : ""}`]));
  poserReglage("derniere_migration", maintenant());
  journaliser("migration.shipstation", "system", null, bilan);
  journal("Terminé.");
  return bilan;
}

// ------------------------------------------------------------------ import normalisé

/**
 * Import de commandes au format normalisé, avec application des règles.
 * C'est le point d'entrée des connecteurs Shopify/Etsy/Faire à venir.
 */
function importerCommandes(liste, { appliquerRegles = true } = {}) {
  const ids = [];
  tx(() => {
    for (const c of liste) {
      // Les défauts produit complètent ce que la boutique n'envoie pas.
      if (!c.weight_g && c.items) {
        for (const it of c.items) {
          if (!it.weight_g && it.sku) {
            const d = catalog.defautsPour(it.sku);
            if (d.weight_g) it.weight_g = d.weight_g;
          }
        }
      }
      ids.push(orders.upsert(c));
    }
  });
  const regles = appliquerRegles ? rules.appliquerLot(ids) : {};
  journaliser("import.orders", "order", null, { n: ids.length });
  return { importees: ids.length, ids, regles };
}

/** Amorçage : réglages, rôles, gabarits et règles de départ sur une base vierge. */
function amorcer() {
  const templates = require("./templates");
  const accounts = require("./accounts");
  const { reglage } = require("./db");
  if (reglage("amorce")) return { deja: true };
  tx(() => {
    poserReglage("marque", accounts.MARQUE_DEFAUT);
    poserReglage("tarif_dropoff_cible", 6.31);
    for (const t of templates.gabaritsParDefaut()) templates.sauver(t);
    poserReglage("amorce", maintenant());
  });
  // La configuration réelle de ShipStation est chargée d'emblée : c'est ce qui rend la
  // bascule utilisable dès le premier démarrage plutôt qu'après une journée de re-saisie.
  // Les règles y sont dans l'état exact du compte — la règle DDD email reste inactive.
  const config = require("./lasclay").charger();
  return { amorce: true, config };
}

/**
 * Rapprochement clone ↔ ShipStation — combien de commandes manquent, et où.
 *
 * Il n'existait aucun moyen de savoir si la migration avait tout ramené. Le clone affichait
 * « Expédiée 27 974 » avec l'aplomb d'un chiffre complet, alors que ShipStation en comptait
 * 38 126 : **10 152 commandes absentes, soit 26 % de l'historique**, et rien à l'écran ne le
 * disait. Le symptôme visible était ailleurs — une recherche « josée » qui rendait 330
 * résultats au lieu de 391 — ce qui envoie chercher un défaut de recherche là où le défaut
 * est un défaut de données.
 *
 * C'est le contrôle qui doit passer au vert **avant** de résilier ShipStation : tant qu'il ne
 * l'est pas, l'historique n'est que partiellement chez nous et l'abonnement reste nécessaire.
 *
 * Lit uniquement — aucune écriture, aucun effet de bord. Une étape en échec n'interrompt pas
 * les autres : un rapprochement partiel vaut mieux que pas de rapprochement.
 */
async function reconcilier() {
  if (!SECRET) throw new Error("GENERAL_PROXY_SECRET requis pour le rapprochement");

  // Les statuts de ShipStation, et leur équivalent chez nous. `pending_fulfillment` n'existe
  // que côté clone (préparations externes) : il est compté à part, sans référence distante.
  const PAIRES = [
    ["awaiting_payment", "awaiting_payment"],
    ["awaiting_shipment", "awaiting_shipment"],
    ["on_hold", "on_hold"],
    ["shipped", "shipped"],
    ["cancelled", "cancelled"],
  ];

  const lignes = [];
  for (const [distant, local] of PAIRES) {
    let attendu = null, erreur = null;
    try {
      // `pageSize: 1` suffit : c'est `total` qu'on lit, pas les commandes.
      attendu = (await ss("orders", { orderStatus: distant, pageSize: 1 })).total ?? null;
    } catch (e) { erreur = String(e.message || e).slice(0, 160); }
    const present = one("SELECT COUNT(*) n FROM orders WHERE status = ?", local).n;
    lignes.push({ statut: local, distant, attendu, present,
      ecart: attendu === null ? null : present - attendu, erreur });
  }

  const hors = one("SELECT COUNT(*) n FROM orders WHERE status = 'pending_fulfillment'").n;
  if (hors) lignes.push({ statut: "pending_fulfillment", distant: null, attendu: null,
    present: hors, ecart: null, erreur: null });

  const mesurables = lignes.filter((l) => l.attendu !== null);
  const attendu = mesurables.reduce((s, l) => s + l.attendu, 0);
  const present = mesurables.reduce((s, l) => s + l.present, 0);
  const manquantes = Math.max(0, attendu - present);

  return {
    lignes, attendu, present, manquantes,
    taux: attendu ? Math.round((present / attendu) * 1000) / 10 : null,
    // Un rapprochement dont une étape a échoué n'est pas « complet » : on le dit.
    incomplet: lignes.some((l) => l.erreur),
    verdict: lignes.some((l) => l.erreur) ? "indisponible"
      : manquantes === 0 ? "complet"
      : manquantes < attendu * 0.01 ? "presque complet" : "incomplet",
    a: maintenant(),
  };
}

module.exports = { migrerDepuisShipStation, importerCommandes, convertirCommande, grammes, amorcer, ss, reconcilier };

// ============================================================ commandes manuelles

/**
 * Boutique « Commandes manuelles » — l'équivalent du *Manual Store* de ShipStation.
 * Elle accueille ce qui n'arrive d'aucun canal : saisies à la main et imports CSV.
 */
function boutiqueManuelle() {
  const s = one("SELECT id FROM stores WHERE marketplace = 'Manuel' ORDER BY id LIMIT 1")
    || one("SELECT id FROM stores WHERE lower(name) LIKE '%manual%' ORDER BY id LIMIT 1");
  if (s) return s.id;
  run("INSERT INTO stores (id,name,marketplace,active,auto_refresh) VALUES (?,?,?,1,0)",
    900000, "Commandes manuelles", "Manuel");
  return 900000;
}

/** Numérotation automatique, comme ShipStation : préfixe + compteur. */
function prochainNumeroManuel(prefixe = "M-") {
  const d = one(`SELECT order_number n FROM orders WHERE order_number LIKE ?
                 ORDER BY CAST(substr(order_number, ?) AS INTEGER) DESC LIMIT 1`,
    `${prefixe}%`, prefixe.length + 1);
  const suivant = d ? (parseInt(String(d.n).slice(prefixe.length), 10) || 0) + 1 : 1;
  return `${prefixe}${String(suivant).padStart(5, "0")}`;
}

/** Crée une commande à la main. Les défauts produit et les règles s'appliquent comme à l'import. */
function creerCommandeManuelle(cmd, { userId = null } = {}) {
  const rules = require("./rules");
  const numero = cmd.order_number || prochainNumeroManuel();
  const id = orders.upsert({
    ...cmd,
    order_number: numero,
    order_key: cmd.order_key || `manuel-${numero}`,
    store_id: cmd.store_id || boutiqueManuelle(),
    status: cmd.status || "awaiting_shipment",
    order_date: cmd.order_date || maintenant(),
    source: "manuel",
  });
  rules.appliquer(id);
  journaliser("order.manual", "order", id, { order_number: numero }, userId);
  return { id, order_number: numero };
}

// ------------------------------------------------------------------ import CSV

/** Découpage CSV tolérant : guillemets, doublage de guillemets, séparateur virgule ou tabulation. */
function lireCsv(texte) {
  const t = String(texte).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const sep = (t.split("\n")[0].match(/\t/g) || []).length > (t.split("\n")[0].match(/,/g) || []).length ? "\t" : ",";
  const lignes = [];
  let champ = "", ligne = [], guillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guillemets) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') guillemets = false;
      else champ += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter((l) => l.some((x) => String(x).trim()));
}

/** Colonnes reconnues — les intitulés de ShipStation, plus des variantes françaises. */
const COLONNES_CSV = {
  order_number: ["order number", "ordernumber", "commande", "n° commande", "numero"],
  order_date: ["order date", "orderdate", "date"],
  customer_email: ["email", "courriel", "customer email"],
  name: ["ship to name", "name", "nom", "recipient", "destinataire"],
  company: ["company", "entreprise", "société"],
  street1: ["address 1", "address1", "street1", "adresse", "adresse 1"],
  street2: ["address 2", "address2", "street2", "adresse 2"],
  city: ["city", "ville"],
  state: ["state", "province", "state/province"],
  postalCode: ["zip", "postal code", "postalcode", "code postal"],
  country: ["country", "pays"],
  phone: ["phone", "téléphone", "telephone"],
  sku: ["sku", "item sku"],
  item_name: ["item name", "product", "produit", "article"],
  quantity: ["quantity", "qty", "quantité", "qte"],
  unit_price: ["unit price", "price", "prix"],
  weight_g: ["weight", "poids", "weight (g)", "poids (g)"],
  order_total: ["order total", "total"],
  notes: ["notes", "customer notes", "note"],
};

const normaliser = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

function mapperEntetes(entetes) {
  const map = {};
  entetes.forEach((e, i) => {
    const n = normaliser(e);
    for (const [champ, variantes] of Object.entries(COLONNES_CSV)) {
      if (variantes.includes(n)) { map[champ] = i; break; }
    }
  });
  return map;
}

/**
 * Importe un CSV de commandes. Plusieurs lignes partageant un même numéro de commande
 * deviennent plusieurs articles d'une seule commande — c'est ainsi que ShipStation lit ses
 * fichiers, et c'est ce que produisent les exports de tableur.
 *
 * `apercu: true` analyse sans rien écrire.
 */
function importerCsv(texte, { apercu = false, userId = null } = {}) {
  const lignes = lireCsv(texte);
  if (lignes.length < 2) throw new Error("fichier vide ou sans en-tête");
  const map = mapperEntetes(lignes[0]);
  if (map.order_number === undefined)
    throw new Error(`colonne « Order Number » introuvable. Colonnes lues : ${lignes[0].join(", ")}`);

  const v = (l, c) => (map[c] === undefined ? undefined : String(l[map[c]] ?? "").trim() || undefined);
  const parNumero = new Map();
  const soucis = [];

  for (let i = 1; i < lignes.length; i++) {
    const l = lignes[i];
    const num = v(l, "order_number");
    if (!num) { soucis.push(`ligne ${i + 1} : numéro de commande vide`); continue; }
    if (!parNumero.has(num)) {
      parNumero.set(num, {
        order_number: num,
        order_date: v(l, "order_date") || maintenant(),
        customer_email: v(l, "customer_email") || null,
        customer_name: v(l, "name") || null,
        ship_to: {
          name: v(l, "name") || "", company: v(l, "company") || null,
          street1: v(l, "street1") || "", street2: v(l, "street2") || null,
          city: v(l, "city") || "", state: v(l, "state") || "",
          postalCode: v(l, "postalCode") || "", country: (v(l, "country") || "CA").toUpperCase(),
          phone: v(l, "phone") || null,
        },
        order_total: Number(v(l, "order_total")) || 0,
        weight_g: Number(v(l, "weight_g")) || 0,
        customer_notes: v(l, "notes") || null,
        items: [],
      });
    }
    const cmd = parNumero.get(num);
    const sku = v(l, "sku"), nom = v(l, "item_name");
    if (sku || nom) {
      cmd.items.push({
        sku: sku || null, name: nom || sku,
        quantity: Number(v(l, "quantity")) || 1,
        unit_price: Number(v(l, "unit_price")) || 0,
        weight_g: 0,
      });
    }
    // Une adresse incomplète bloquera l'étiquette : autant le dire à l'import.
    if (!cmd.ship_to.street1 || !cmd.ship_to.postalCode)
      soucis.push(`${num} : adresse incomplète (rue ou code postal manquant)`);
  }

  const commandes = [...parNumero.values()];
  if (apercu) {
    return { apercu: true, commandes: commandes.length,
      articles: commandes.reduce((s, c) => s + c.items.length, 0),
      colonnes_reconnues: Object.keys(map), colonnes_ignorees: lignes[0].filter((e) =>
        !Object.values(COLONNES_CSV).flat().includes(normaliser(e))),
      soucis: [...new Set(soucis)].slice(0, 20), exemple: commandes[0] };
  }

  const ids = [];
  tx(() => { for (const c of commandes) ids.push(creerCommandeManuelle(c, { userId }).id); });
  journaliser("import.csv", "order", null, { commandes: ids.length, soucis: soucis.length }, userId);
  return { importees: ids.length, articles: commandes.reduce((s, c) => s + c.items.length, 0),
    soucis: [...new Set(soucis)].slice(0, 20) };
}

module.exports.boutiqueManuelle = boutiqueManuelle;
module.exports.prochainNumeroManuel = prochainNumeroManuel;
module.exports.creerCommandeManuelle = creerCommandeManuelle;
module.exports.importerCsv = importerCsv;
module.exports.lireCsv = lireCsv;
