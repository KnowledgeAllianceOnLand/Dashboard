// See https://observablehq.com/framework/config for documentation.
export default {
  // The app’s title; used in the sidebar and webpage titles.
  title: "KAL Dashboard",

  // GitHub Pages serves this project under the repository name.
  base: "/Dashboard/",

  duckdb: {
    // Un seul bundle wasm est livré : le MVP (compatible tous navigateurs).
    // Sans cela, le site embarque mvp + eh (≈ 73 Mo) et l'extension spatiale en double (≈ 44 Mo).
    platforms: {eh: false},
    extensions: ["spatial"]
  },

  // The pages and sections in the sidebar. If you don’t specify this option,
  // all pages will be listed in alphabetical order. Listing pages explicitly
  // lets you organize them into sections and have unlisted pages.
  // Les deux pages sont listées au même niveau ; le lien d'accueil que Framework ajoute
  // automatiquement (libellé = titre de l'appli) est masqué par la règle CSS de `head`.
  pages: [
    {name: "Renewable Energy", path: "/"},
    {name: "Transition Mines", path: "/mines"},
  ],

  // Thème personnalisé « bleu » (voir src/theme-blue.css) : construit sur les
  // styles par défaut, en clair (base `air`). L'option `style` prend le pas sur
  // `theme` et s'applique à toutes les pages.
  style: "theme-blue.css",

  // Pas de menu latéral : la sélection de page se fait dans le header.
  sidebar: false,

  // Header général : barre fixe en haut de page (pleine largeur), avec logo,
  // nom de la plateforme et sélecteur de page (menu déroulant) à droite.
  // Le header est une fonction appelée par page ({title, data, path}) pour
  // présélectionner la page courante : en interne, l'accueil a le chemin
  // "/index" et les autres pages leur chemin ("/mines"). Style dans theme-blue.css.
  header: ({path}) => {
    const selected = (p) =>
      path === p || (p === "/" && path === "/index") ? " selected" : "";
    return `<div class="kal-brand">
      <svg class="kal-logo" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <defs>
          <linearGradient id="kal-logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#4d9dbb"/>
            <stop offset="1" stop-color="#1c5fa8"/>
          </linearGradient>
        </defs>
        <rect width="30" height="30" rx="8" fill="url(#kal-logo-gradient)"/>
        <g fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round">
          <circle cx="15" cy="15" r="8"/>
          <ellipse cx="15" cy="15" rx="3.6" ry="8"/>
          <path d="M7.6 11.6h14.8M7.6 18.4h14.8"/>
        </g>
      </svg>
      <span class="kal-brand-name">Knowledge Alliance on Land</span>
    </div>
    <select class="kal-page-select" aria-label="Select page" onchange="location.href = this.value">
      <option value="./"${selected("/")}>Renewable Energy</option>
      <option value="./mines"${selected("/mines")}>Transition Mines</option>
    </select>`;
  },

  // Footer général : remplace le « Built with Observable » par défaut
  // (la navigation précédent/suivant générée par Framework est masquée en CSS).
  footer: `<div class="kal-footer">
      <div class="kal-footer-col">
        <span class="kal-footer-brand">Knowledge Alliance on Land</span>
      </div>
      <div class="kal-footer-col kal-footer-right">
        <a href="https://observablehq.com/framework/" target="_blank" rel="noopener noreferrer">Built with Observable Framework</a>
        <span class="kal-footer-muted">© ${new Date().getFullYear()} KAL</span>
      </div>
    </div>`,

  // Content to add to the head of the page, e.g. for a favicon:
  head: '<link rel="icon" href="observable.png" type="image/png" sizes="32x32">',

  // The path to the source root.
  root: "src",

  // Some additional configuration options and their defaults:
  // theme: "default", // try "light", "dark", "slate", etc.
  // header: "", // what to show in the header (HTML)
  // footer: "Built with Observable.", // what to show in the footer (HTML)
  // sidebar: true, // whether to show the sidebar
  // toc: true, // whether to show the table of contents
  // pager: true, // whether to show previous & next links in the footer
  // output: "dist", // path to the output root for build
  // search: true, // activate search
  // linkify: true, // convert URLs in Markdown to links
  // typographer: false, // smart quotes and other typographic improvements
  // preserveExtension: false, // drop .html from URLs
  // preserveIndex: false, // drop /index from URLs
};
