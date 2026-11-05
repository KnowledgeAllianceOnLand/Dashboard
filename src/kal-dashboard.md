---
theme: dashboard
title: KAL Dashboard
toc: false
sql:
    energy_transition: data/energy_transition.parquet
    energy_transition_geo: data/energy_transition_geo.parquet
---

# Countries

```js
const countries = await sql`
  SELECT country_name, country_code
  FROM energy_transition
  GROUP BY country_name, country_code
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
{
  const result = html`<div>↻ Loading data…</div>`;
  display(result);

  // Select country + geometry as geoJSON
  const countryDataIPLC = await sql`
    SELECT * EXCLUDE (geom),
      ST_AsGeoJSON(geom) AS geom_json
    FROM energy_transition_geo
    WHERE ID IN (
        SELECT unnest(id_l)
        FROM energy_transition
        WHERE country_code = ${selectedCountry.country_code}
    );
  `;

  // Plot table
  result.replaceChildren(
    Inputs.table(countryDataIPLC, {
      title: "Energy Transition Projects",
      columns: ["ID", "dataset", "country_code", "iplc_overlap"],
      select: false,
    })
  );

  // Prep data for map
  const countryDataGeoJSON = {
    type: "FeatureCollection",
    features: Array.from(countryDataIPLC).map(({ geom_json, ...properties }) => ({
      type: "Feature",
      geometry: JSON.parse(geom_json),
      properties
    }))
  };

  display(
    Plot.plot({
      projection: {
        type: "mercator",
        domain: countryDataGeoJSON,
      },
      height: 400,
      marks: [
        Plot.geo(countryDataGeoJSON, {
          stroke: (d) => d.properties.intersects_iplc ? "crimson" : "steelblue",
          fill: (d) => d.properties.intersects_iplc ? "crimson" : "steelblue",
          r: 3.5,
        })
      ]
    })
  );

  // Prep data for barplot
  const statsOverlapIPLC = await sql`
    SELECT dataset_l, COUNT(*) as count
    FROM energy_transition
    WHERE country_code = ${selectedCountry.country_code}
    GROUP BY dataset_l
  `;

  Inputs.table(statsOverlapIPLC, {
    select: false,
  });

  display(
    Plot.plot({
      marks: [
        Plot.ruleX([0]),
        Plot.barX(countryDataGeoJSON, {
          x: "count", y: "dataset"
        })
      ]
    })
  )

}
```