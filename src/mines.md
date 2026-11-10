---
title: Transition Mines
toc: false
sql:
    energy_transition: data/energy_transition.parquet
    energy_transition_geo: data/energy_transition_geo.parquet
---

# Transition Mines

<style>
  #boot-loading { display: flex; align-items: center; justify-content: center; gap: 0.6rem; height: 160px; color: var(--theme-foreground-muted); font-size: 0.9rem; }
  main:has(select) #boot-loading { display: none; }
  /* Inputs pose `table-layout: fixed` (en style inline) et `white-space: nowrap` : les en-têtes
     longs sont tronqués. On repasse en `auto` pour que les colonnes s'adaptent (et débordent
     horizontalement sur petit écran, le conteneur défile), et on autorise les retours à la ligne. */
  main .inputs-3a86ea-table table { table-layout: auto !important; }
  main .inputs-3a86ea-table thead th { white-space: pre-line; }
  /* Cellule volontairement vide (graphique non affiché) : le bloc entier disparaît. */
  main .observablehq--block:has(.kal-empty) { display: none; }
</style>
<div id="boot-loading" role="status" aria-live="polite">
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.8s" repeatCount="indefinite" />
    </circle>
  </svg>
  <span>Loading dashboard…</span>
</div>

```js
const countries = await sql`
  SELECT DISTINCT country_name, country_code
  FROM energy_transition
  WHERE country_code IS NOT NULL
  AND list_has_any(dataset_l, ['Mines'])
  ORDER BY country_name
`;
```

```js
const selectedCountry = view(Inputs.select(countries, {
  label: "Select a country",
  format: (country) => country.country_name
}));
```

```js
// Identités IPLC filtrables (IP = Indigenous Peoples, LC = Local Communities), avec libellés.
const iplcIdentities = ["Indigenous", "Community"];
const identityLabels = {Indigenous: "Indigenous Peoples (IP)", Community: "Local Communities (LC)"};
```

```js
// Options du pays courant : statuts et identités IPLC réellement présents. L'objet-porteur
// expose la promesse dès le changement de pays ; les deux requêtes sont enchaînées pour
// n'exécuter qu'une seule requête à la fois.
const countryOptions = {
  promise: (async () => {
    const countryCode = selectedCountry.country_code;
    const statuses = Array.from(
      await sql`
        SELECT DISTINCT status
        FROM energy_transition, UNNEST(implementation_status_l) AS t(status)
        WHERE country_code = ${countryCode}
        AND list_has_any(dataset_l, ['Mines'])
      `,
      (d) => d.status,
    );
    const identities = Array.from(
      await sql`
        SELECT DISTINCT identity
        FROM energy_transition, UNNEST(iplc_identity_l) AS t(identity)
        WHERE country_code = ${countryCode}
        AND list_has_any(dataset_l, ['Mines'])
        AND iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0
      `,
      (d) => d.identity,
    );
    return {countryCode, statuses, identities};
  })(),
};
```

```js
// Ordre d'affichage des statuts : cycle de vie.
const statusOrder = [
  "Exploration on site",
  "Evaluation & Planning",
  "Development & Construction",
  "Operation",
  "Inactive (never built)",
  "Inactive (with physical footprint)",
  "Unknown",
];
```

```js
// Panneau de filtres : un spinner remplace les filtres dès le changement de pays (ou le clic
// sur « Reset filters », qui recrée le panneau via `resetFilters`), puis les cases, toutes
// cochées, sont reconstruites avec les options du pays. Les sélections exposées portent le
// code pays : les requêtes ne partent qu'avec un couple (pays, filtres) cohérent, jamais
// avec les filtres du pays précédent. La première valeur émise est `null` (rechargement en
// cours) pour que la carte et les graphiques affichent eux aussi un spinner immédiatement.
void resetFilters;
const selectedFilters = Generators.observe((notify) => {
  // Conteneur neutre (sans la classe du spinner) : y substituer le panneau efface bien le
  // spinner, ce qui ne serait pas le cas en réutilisant le conteneur de `loading()`.
  const container = display(document.createElement("div"));
  container.append(loading("Loading filters…", {height: 100}));
  let stopped = false;
  notify(null);
  (async () => {
    try {
      const {countryCode, statuses, identities} = await countryOptions.promise;
      if (stopped) return;
      const presentStatuses = new Set(statuses);
      const statusOptions = [
        ...statusOrder.filter((status) => presentStatuses.has(status)),
        ...statuses.filter((status) => !statusOrder.includes(status)),
      ];
      const identityOptions = [
        ...iplcIdentities.filter((identity) => identities.includes(identity)),
        ...identities.filter((identity) => !iplcIdentities.includes(identity)),
      ];
      const status = Inputs.checkbox(statusOptions, {label: "Implementation status", value: statusOptions});
      // Le groupe d'identités n'est affiché que si le pays a des aires IPLC concernées ;
      // sinon la sélection vaut `null` (filtre non applicable, voir la cellule des sélections).
      const identity = identityOptions.length
        ? Inputs.checkbox(identityOptions, {
            label: "IPs’ & LCs’ identity",
            value: identityOptions,
            format: (value) => identityLabels[value] ?? value,
          })
        : null;
      const panel = document.createElement("div");
      panel.style.cssText = "display:flex;flex-direction:column;gap:0.2rem";
      panel.append(status);
      if (identity) panel.append(identity);
      // On remplace le contenu du conteneur affiché (et non le conteneur) : il est suivi par
      // le runtime, qui le supprime à la réévaluation de la cellule.
      container.replaceChildren(panel);
      const emit = () =>
        notify({countryCode, status: status.value, identity: identity ? identity.value : null});
      emit();
      for (const input of [status, ...(identity ? [identity] : [])]) input.addEventListener("input", emit);
    } catch (error) {
      if (!stopped) container.replaceChildren(document.createTextNode(`Error: ${error?.message ?? error}`));
    }
  })();
  return () => {
    stopped = true;
  };
});
```

```js
// Bouton de réinitialisation des filtres : chaque clic recrée le panneau ci-dessus (toutes
// les cases cochées), sans nouvelle requête (les options du pays sont déjà connues).
const resetFilters = view(Inputs.button("Reset filters"));
```

```js
// Sélections courantes ; `null` pendant le rechargement des filtres (changement de pays).
// `identity` vaut `null` quand le pays n'a aucune aire IPLC concernée : le filtre n'est pas
// applicable (et aucune ligne empiétante n'existe alors pour ce pays).
// `hasSelection` évite d'afficher « aucun empiètement » quand rien n'est coché.
const selectedStatusesCsv = selectedFilters ? selectedFilters.status.join(String.fromCharCode(31)) : null;
const selectedIdentitiesCsv = selectedFilters?.identity?.join(String.fromCharCode(31)) ?? null;
const hasSelection =
  Boolean(selectedFilters) &&
  selectedFilters.status.length > 0 &&
  (selectedFilters.identity == null || selectedFilters.identity.length > 0);
```

```js
// Terme possessif affiché (à la place de « IPLC ») sur la carte, les tableaux et les plots :
// « Indigenous Peoples’ » si IP seul, « Local Communities’ » si LC seul, « IPs’ & LCs’ » sinon
// (les deux cochés, ou filtre non applicable).
const iplcTerm =
  !selectedFilters || selectedFilters.identity == null || selectedFilters.identity.length !== 1
    ? "IPs’ & LCs’"
    : selectedFilters.identity[0] === "Indigenous"
      ? "Indigenous Peoples’"
      : "Local Communities’";
```

```js
// Empiètement IPLC pour le pays courant, exposé sous forme d'objet-porteur : la valeur est
// disponible immédiatement (non attendue par le runtime), ce qui permet aux cellules
// dépendantes d'afficher un spinner au lieu de garder le résultat du pays précédent.
const encroachment = {
  promise: selectedFilters
    ? sql`
        SELECT bool_or(
          iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0
          AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31)))
        ) AS encroaching
        FROM energy_transition
        WHERE country_code = ${selectedFilters.countryCode}
        AND list_has_any(dataset_l, ['Mines'])
      `.then((rows) => Boolean(Array.from(rows)[0]?.encroaching))
    : new Promise(() => {}), // filtres en cours de rechargement : le spinner tourne d'ici là
};
```

```js
// Message affiché à la place des graphiques quand aucun projet n'empiète sur une aire IPLC.
// Fonction : chaque cellule doit recevoir son propre nœud DOM (un nœud ne peut être qu'à un endroit).
const noEncroachment = () =>
  html`<div class="kal-notice">No encroachment on ${iplcTerm} areas for the selected filters.</div>`;

// Cellule volontairement vide : son bloc est masqué en CSS (voir le style en haut de page),
// ce qui permet de faire disparaître complètement un graphique sans laisser d'espace.
const blank = () => html`<div class="kal-empty"></div>`;
```

```js
// Imports centralisés : un import dans plusieurs cellules définirait plusieurs fois la même
// variable de page (« withLoading is defined more than once »).
import {map, toFeatureCollection} from "./components/map.js";
import {matrix} from "./components/matrix.js";
import {barplot} from "./components/barplot.js";
import {loading, withLoading} from "./components/loading.js";
```

```js
// La requête démarre à l'appel de `sql` ; withLoading affiche le spinner puis la carte.
// La promesse est transmise dans un objet (non attendu par le runtime) pour que la matrice
// sache quand la carte a terminé sans être bloquée en attendant.
const mapQuery = {
  promise: selectedFilters
    ? sql`
        WITH country AS (
          SELECT
            t.ID,
            -- Intersection avec une aire IPLC de l'identité choisie (IP et/ou LC)…
            bool_or(
              iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0
              AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31)))
            ) AS intersects,
            -- … et caractérisation « indicative » de cette même intersection.
            bool_or(
              iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0
              AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31)))
              AND lower(iplc_indicative) = 'true'
            ) AS indicative
          FROM energy_transition, UNNEST(id_l) AS t(ID)
          WHERE country_code = ${selectedFilters.countryCode}
            AND list_has_any(dataset_l, ['Mines'])
          GROUP BY t.ID
        )
        SELECT
          g.ID,
          CASE
            WHEN NOT g.intersects_iplc OR NOT coalesce(c.intersects, false) THEN 'none'
            WHEN coalesce(c.indicative, false)  THEN 'indicative'
            ELSE 'precise'
          END AS category,
          ST_AsGeoJSON(g.geom) AS geom_json
        FROM energy_transition_geo g
        JOIN country c USING (ID)
        WHERE SUBSTR(g.ID, 1, 2) = 'SP' -- Only mines
      `.then(toFeatureCollection)
    : new Promise(() => {}), // filtres en cours de rechargement : le spinner tourne d'ici là
};

display(withLoading(
  mapQuery.promise,
  (geojson) =>
    map(geojson, {
      category: "category",
      label: {
        precise: `Precisely mapped ${iplcTerm} areas`,
        indicative: `Indicative ${iplcTerm} areas`,
        none: `No intersection with ${iplcTerm} areas`,
      },
      colorOf: {
        precise: {stroke: "#071d44", fill: "#1C3A6C"},
        indicative: {stroke: "#4d9dbb", fill: "#85CFEB"},
        none: {stroke: "#777777", fill: "#BBBBBB"},
      },
      // Ordre de dessin et de légende, du dessous vers le dessus.
      order: ["none", "indicative", "precise"],
      // Taille, opacité et épaisseur du contour des points.
      pointRadius: 2,
      pointOpacity: 1,
      weight: 1.5,
      //popup: true,
      legendTitle: "Transition Mines Projects",
      ariaLabel: "Interactive map of transition mines projects",
    }),
  {loading: "Loading map…", height: 420},
));
```

```js
// Message unique, juste sous la carte, quand aucun projet n'empiète sur une aire IPLC.
// Pendant la vérification (changement de pays), un spinner remplace l'ancien contenu.
display(withLoading(
  encroachment.promise,
  (hasEncroachment) => (hasEncroachment || !hasSelection ? blank() : noEncroachment()),
  {loading: "Checking IPs’ & LCs’ encroachment…", height: 40},
));
```

```js
// En-têtes de tableau sur plusieurs lignes (`\n` = retour à la ligne, via `white-space: pre-line`).
// Libellés en texte : un élément DOM serait enveloppé dans le `<span>` du tri, large de 0.5em.
// Les colonnes absentes de l'objet gardent leur nom ; le libellé complet reste en infobulle (`title`).
const tableHeaders = (term = "IPs’ & LCs’") => ({
  "Encroaching IPLC areas (ha)": `Encroaching\n${term} areas (ha)`,
  "Encroaching precisely mapped IPLC areas (ha)": `Encroaching precisely\nmapped ${term} areas (ha)`,
  "Encroaching indicative IPLC areas (ha)": `Encroaching indicative\n${term} areas (ha)`,
  "Not encroaching IPLC areas (ha)": `Not encroaching\n${term} areas (ha)`,
  "Total (ha)": "Total\n(ha)",
});
```

## By Implementation Status

```js
// display SQL result as data table
// Relais : cette requête ne démarre qu'une fois la carte terminée.
const statusTable = {
  promise: mapQuery.promise.catch(() => null).then(() => selectedFilters ? sql`
    SELECT 
    implementation_status as "Implementation status",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31)))), 0) AS "Encroaching IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31))) AND lower(iplc_indicative) = 'false'), 0) AS "Encroaching precisely mapped IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31))) AND lower(iplc_indicative) = 'true'), 0) AS "Encroaching indicative IPLC areas (ha)",
    COALESCE(SUM(area_ha) FILTER (WHERE NOT (iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0 AND list_has_any(iplc_identity_l, string_split(coalesce(${selectedIdentitiesCsv}, ''), chr(31))))), 0) AS "Not encroaching IPLC areas (ha)",
    COALESCE(SUM(area_ha), 0) AS "Total (ha)"
    FROM energy_transition, UNNEST(implementation_status_l) AS t(implementation_status)
    WHERE list_contains(string_split(${selectedStatusesCsv}, chr(31)), implementation_status)
    AND list_has_any(dataset_l, ['Mines'])
    AND country_code = ${selectedFilters.countryCode}
    GROUP BY implementation_status
    ORDER BY 2 DESC;
  ` : new Promise(() => {})),
};

display(withLoading(
  statusTable.promise,
  (data) => Inputs.table(data, {select: false, header: tableHeaders(iplcTerm)}),
  {loading: "Loading implementation status table…", height: 40},
));
```

```js
// Surfaces par statut d'implémentation (Mha). Toutes les catégories de référence sont
// affichées, même à 0 ; les statuts supplémentaires présents dans la donnée suivent.
// La requête n'est construite (et lancée) que si le pays a un empiètement IPLC.
const fetchStatuses = () => sql`
  SELECT
    t.status,
    COALESCE(SUM(area_ha), 0) / 1e6 AS surface_mha
  FROM energy_transition, UNNEST(implementation_status_l) AS t(status)
  WHERE list_has_any(dataset_l, ['Mines'])
    AND list_contains(string_split(${selectedStatusesCsv}, chr(31)), t.status)
    AND iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0
    AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31)))
    AND country_code = ${selectedFilters.countryCode}
  GROUP BY t.status
`;

// Le spinner s'affiche dès le changement de pays (dépendance à `encroachment`, disponible
// immédiatement) ; la requête ne part qu'après les tableaux et si l'empiètement existe.
// `statusChart` sert de relais pour la matrice.
const statusChart = {
  promise: encroachment.promise.then((hasEncroachment) =>
    hasEncroachment ? statusTable.promise.catch(() => null).then(fetchStatuses) : null,
  ),
};

display(withLoading(
  statusChart.promise,
  (data) => (data ? barplot(data, {
    category: "status",
    value: "surface_mha",
    order: [
      "Exploration on site",
      "Evaluation & Planning",
      "Development & Construction",
      "Operation",
      "Inactive (never built)",
      "Inactive (with physical footprint)",
      "Unknown",
    ],
    // Tri des barres, de haut en bas : "-value" (décroissant), "value", "label", "-label"
    // ou comparateur (a, b) => number. `order` fixe alors seulement la liste des catégories.
    sort: "-value",
    labels: {
      "Development & Construction": "Development & construction",
      "Evaluation & Planning": "Evaluation & planning",
      "Operation": "Operational",
    },
    colors: {
      "Exploration on site": "#E5A83B",
      "Development & Construction": "#c8c8c8",
      "Evaluation & Planning": "#d9c8b2",
      "Inactive (never built)": "#a8ddf5",
      "Inactive (with physical footprint)": "#0b2a4a",
      "Operation": "#3b1a10",
      "Unknown": "#9aa5b1",
    },
    title: `Transition mines projects intersecting ${iplcTerm} areas by implementation status`,
    legendTitle: "Implementation status",
    unit: "Surface (Mha)",
  }) : blank()),
  {loading: "Loading implementation status chart…", height: 220},
));
```

```js
// Libellés, ordre des axes et légende sont dérivés des données : aucune liste codée en dur.
// La requête ne démarre qu'une fois le barplot terminé (exécution séquentielle), et seulement
// s'il y avait un empiètement (sinon le relais vaut null).
const fetchMatrix = () => sql`
SELECT 
    -- Axe X : phase d'implémentation (le libellé affiché vient de la donnée)
    CASE status
        WHEN 'Exploration on site'         THEN 'Exploration on site - 2042-2044'
        WHEN 'Evaluation & Planning'       THEN 'Evaluation & planning - 2034-2041'
        WHEN 'Development & Construction'  THEN 'Development & construction - 2031'
        WHEN 'Operation'                   THEN 'Operational - 2026'
    END AS implementation_phase,
    -- Axe Y : type d'empiètement
    CASE 
      WHEN lower(iplc_indicative) = 'true'  THEN 'Indicative'
      WHEN lower(iplc_indicative) = 'false' THEN 'Precisely mapped'
    END AS encroachment_type,
    COALESCE(SUM(area_ha), 0) / 1e6 AS surface_mha
FROM energy_transition,
     UNNEST(implementation_status_l)  AS s(status)
WHERE list_has_any(dataset_l, ['Mines'])                  -- mines uniquement
  AND iplc_id_l IS NOT NULL AND len(iplc_id_l) > 0        -- intersection IPLC
  AND list_has_any(iplc_identity_l, string_split(${selectedIdentitiesCsv}, chr(31)))  -- identité IPLC sélectionnée (IP et/ou LC)
  AND status IN ('Exploration on site', 'Operation', 'Development & Construction', 'Evaluation & Planning')
  AND country_code = ${selectedFilters.countryCode}
GROUP BY 1, 2
-- L'ordre doit être Operational -> Development & Construction -> Evaluation & Planning -> Exploration on site
ORDER BY 
  CASE implementation_phase
    WHEN 'Operational - 2026'                  THEN 1
    WHEN 'Development & construction - 2031'   THEN 2
    WHEN 'Evaluation & planning - 2034-2041'   THEN 3
    WHEN 'Exploration on site - 2042-2044'     THEN 4
  END
`;

display(withLoading(
  statusChart.promise.catch(() => null).then((hasData) => (hasData ? fetchMatrix() : null)),
  (data) =>
    data
      ? matrix(
          Array.from(data, (d) => ({...d, encroachment_type: `${d.encroachment_type} ${iplcTerm} areas`})),
          {
            x: "implementation_phase",
            y: "encroachment_type",
            value: "surface_mha",
            title: `Development phases of transition mines projects intersecting ${iplcTerm} areas`,
            legendLabel: "Surface (Mha)",
            emptyMessage: "No data available for the selected filters.",
          },
        )
      : blank(),
  {loading: "Loading matrix…", height: 300},
));
```
