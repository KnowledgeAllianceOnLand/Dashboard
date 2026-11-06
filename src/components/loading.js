let stylesInjected = false;

function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.id = "kal-loading-styles";
  style.textContent = `
.kal-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  color: var(--theme-foreground-muted);
  font-size: 0.9rem;
}
.kal-loading::before {
  content: "";
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: kal-spin 0.8s linear infinite;
}
@keyframes kal-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .kal-loading::before { animation-duration: 2.4s; }
}
`;
  document.head.append(style);
}

/**
 * Indicateur de chargement, à afficher pendant qu'une requête ou un calcul tourne.
 *
 * @param message texte affiché à côté du spinner
 * @param options {height} hauteur réservée, pour éviter que la page ne saute ensuite
 */
export function loading(message = "Loading…", {height = 320} = {}) {
  injectStyles();
  const container = document.createElement("div");
  container.className = "kal-loading";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  container.style.height = `${height}px`;
  container.textContent = message;
  return container;
}

/**
 * Affiche un état de chargement puis le rendu du résultat.
 *
 * Le conteneur est renvoyé tout de suite (avec le spinner) et remplacé dès que la
 * promesse est résolue ; si la cellule est réévaluée entre-temps (changement de pays),
 * le conteneur est détaché et le résultat périmé est ignoré.
 *
 * @param promise promesse de données (démarrée par l'appelant)
 * @param render fonction qui transforme les données en élément
 * @param options {loading: texte affiché, height: hauteur réservée}
 */
export function withLoading(promise, render, {loading: message = "Loading…", height = 320} = {}) {
  const container = document.createElement("div");
  container.append(loading(message, {height}));

  const fail = (error) => {
    if (!container.isConnected) return;
    const box = document.createElement("div");
    box.style.cssText = "padding:1rem;border:1px solid var(--theme-red);border-radius:8px;font:400 0.9rem var(--sans-serif);background:color-mix(in srgb, var(--theme-red), transparent 95%)";
    box.textContent = `Error: ${error?.message ?? error}`;
    container.replaceChildren(box);
  };

  promise.then(
    (value) => {
      if (!container.isConnected) return;
      let node;
      try {
        node = render(value);
      } catch (error) {
        fail(error);
        return;
      }
      // `render` doit produire un nœud DOM ; sinon on affiche l'erreur au lieu de laisser
      // tourner le spinner indéfiniment.
      if (node instanceof Node) container.replaceChildren(node);
      else fail(new Error(`withLoading: render() must return a DOM node (got ${typeof node})`));
    },
    fail,
  );

  return container;
}
