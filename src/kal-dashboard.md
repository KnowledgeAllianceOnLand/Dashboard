---
theme: dashboard
title: KAL Dashboard
toc: false
sql:
    energy_transition: https://media.githubusercontent.com/media/KnowledgeAllianceOnLand/KAL-data/refs/heads/main/parquets/energy_transition.parquet?download=true
    iplc: https://media.githubusercontent.com/media/KnowledgeAllianceOnLand/KAL-data/refs/heads/main/parquets/iplc.parquet?download=true
---

# Countries

```js
const countries = await sql`
SELECT country_area, country_code
FROM energy_transition
GROUP BY country_area, country_code
ORDER BY country_area
`;
```

```js
const selectedCountry = view(Inputs.select(countries, {
  label: "Select a country",
  format: (country) => country.country_area
}));
```

```js
{
  const result = html`<div>↻ Loading data…</div>`;
  display(result);

  const countryData = await sql`
    SELECT *
    FROM energy_transition
    WHERE country_code = ${selectedCountry.country_code}
  `;

  result.replaceChildren(Inputs.table(countryData, {select: false}));
}
```
