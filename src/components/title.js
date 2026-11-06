/**
 * Titre de graphique au format de la maquette : italique, discret, souligné d'un filet.
 * Factorisé pour que tous les composants (barplot, matrice…) partagent le même style.
 */
export function titleElement(text) {
  const heading = document.createElement("div");
  heading.textContent = text;
  heading.style.cssText =
    "font-style:italic;font-size:.85rem;color:var(--theme-foreground-muted);border-bottom:2px solid var(--theme-foreground);padding-bottom:4px;margin-bottom:10px";
  return heading;
}
