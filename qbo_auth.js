/**
 * qbo_auth.js — autorisation OAuth2 QuickBooks Online (à faire UNE fois, ou à refaire
 * si le refresh token est périmé: erreur invalid_grant).
 *
 * CONTEXTE : le connecteur QuickBooks officiel de Claude est une app Intuit US-only
 * (bloquée pour une entreprise canadienne). On utilise donc NOTRE propre app Intuit :
 *   1. https://developer.intuit.com → Create an app → QuickBooks Online and Payments,
 *      scope « com.intuit.quickbooks.accounting ».
 *   2. Dans l'app, onglet « Keys & credentials » (PRODUCTION pour la vraie compta) :
 *      récupérer Client ID + Client Secret, et AJOUTER l'URI de redirection :
 *      https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl
 *
 * ÉTAPE A — générer l'URL d'autorisation :
 *   QBO_CLIENT_ID=xxx node qbo_auth.js url
 *   → ouvrir l'URL dans le navigateur, se connecter au compte QuickBooks LASCLAY,
 *     autoriser. La page de redirection affiche (ou l'URL contient) `code` et `realmId`.
 *
 * ÉTAPE B — échanger le code (valide ~5 min) contre les jetons :
 *   QBO_CLIENT_ID=xxx QBO_CLIENT_SECRET=yyy node qbo_auth.js exchange <code> <realmId>
 *   → affiche les variables à mettre dans Render (QBO_REFRESH_TOKEN, QBO_REALM_ID...).
 *
 * NOTE refresh token : Intuit fait TOURNER sa valeur (~24 h). Le proxy persiste le plus
 * récent via l'API Render (RENDER_API_KEY + RENDER_SERVICE_ID) — sans ça, l'intégration
 * casse au premier redémarrage passé 24 h et il faut refaire A + B.
 *
 * Node 18+. Aucune dépendance.
 */

const CLIENT_ID = process.env.QBO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || "";
const REDIRECT = process.env.QBO_REDIRECT_URI || "https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl";

const [mode, code, realmId] = process.argv.slice(2);

(async () => {
  if (mode === "url") {
    if (!CLIENT_ID) { console.error("Manque QBO_CLIENT_ID."); process.exit(1); }
    const u = new URL("https://appcenter.intuit.com/connect/oauth2");
    u.searchParams.set("client_id", CLIENT_ID);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "com.intuit.quickbooks.accounting");
    u.searchParams.set("redirect_uri", REDIRECT);
    u.searchParams.set("state", "lasclay-qbo");
    console.log("Ouvre cette URL, connecte-toi au compte QuickBooks Lasclay, autorise :\n");
    console.log(u.toString());
    console.log("\nAprès l'autorisation, récupère `code` et `realmId` dans l'URL de redirection,");
    console.log("puis lance :  QBO_CLIENT_ID=... QBO_CLIENT_SECRET=... node qbo_auth.js exchange <code> <realmId>");
    return;
  }

  if (mode === "exchange") {
    if (!CLIENT_ID || !CLIENT_SECRET) { console.error("Manque QBO_CLIENT_ID et/ou QBO_CLIENT_SECRET."); process.exit(1); }
    if (!code || !realmId) { console.error("Usage : node qbo_auth.js exchange <code> <realmId>"); process.exit(1); }
    const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }).toString(),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Échec (${res.status}) :`, JSON.stringify(j).slice(0, 300));
      if (res.status === 400) console.error("→ Le code expire en ~5 minutes et ne sert qu'UNE fois; refais l'étape A au besoin.");
      process.exit(1);
    }
    console.log("OK — autorisation réussie. Variables à mettre dans l'env Render du General Proxy :\n");
    console.log(`QBO_CLIENT_ID=${CLIENT_ID}`);
    console.log(`QBO_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`QBO_REALM_ID=${realmId}`);
    console.log(`QBO_REFRESH_TOKEN=${j.refresh_token}`);
    console.log("\n(+ RENDER_API_KEY et RENDER_SERVICE_ID pour que le proxy garde le refresh");
    console.log("token à jour tout seul — fortement recommandé, voir CONNECTORS_PROXY.md.)");
    console.log(`\nAccess token de test (60 min) reçu; expiration refresh: ${j.x_refresh_token_expires_in ? Math.round(j.x_refresh_token_expires_in / 86400) + " jours" : "?"}.`);
    return;
  }

  console.log("Usage :\n  node qbo_auth.js url\n  node qbo_auth.js exchange <code> <realmId>");
})().catch((e) => { console.error("Erreur:", e.message); process.exit(1); });
