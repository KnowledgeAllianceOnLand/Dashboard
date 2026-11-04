---
theme: dashboard
title: KAL Dashboard
toc: false
sql:
    energy_transition: https://media.githubusercontent.com/media/KnowledgeAllianceOnLand/KAL-data/refs/heads/main/parquets/energy_transition.parquet?download=true
    iplc: https://media.githubusercontent.com/media/KnowledgeAllianceOnLand/KAL-data/refs/heads/main/parquets/iplc.parquet?download=true
---

# Pays

```js
const countries = await sql`
SELECT country_area, country_code
FROM energy_transition
GROUP BY country_area, country_code
ORDER BY country_area
`;
```

```js
const selectedCountry = Inputs.select(countries, {
  label: "Sélectionner un pays",
  format: (country) => country.country_area
});
```

${selectedCountry}
