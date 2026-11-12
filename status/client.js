const theme = document.querySelector("#theme");
try {
  theme.value = localStorage.getItem("cardlattice-theme") || "auto";
} catch {
  /* Storage can be disabled. */
}
function applyTheme() {
  const value = ["light", "dark"].includes(theme.value) ? theme.value : "auto";
  if (value === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
  try {
    localStorage.setItem("cardlattice-theme", value);
  } catch {
    /* Theme still works in memory. */
  }
}
applyTheme();
theme.addEventListener("change", applyTheme);
const form = document.querySelector("#filters");
const rows = [...document.querySelectorAll("tbody tr")];
const query = document.querySelector("#query");
const language = document.querySelector("#language");
const coverage = document.querySelector("#coverage");
const sort = document.querySelector("#sort");
const size = document.querySelector("#size");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
let page = 0;
function render() {
  const term = query.value.trim().normalize("NFKC").toLowerCase();
  const filtered = rows
    .filter((row) => {
      const d = row.dataset;
      return (
        (!term || d.search.includes(term)) &&
        (!language.value || d.language === language.value) &&
        (!coverage.value ||
          (coverage.value === "empty" ? +d.cards === 0 : +d[coverage.value] < +d.cards))
      );
    })
    .sort((a, b) =>
      sort.value === "cards"
        ? +b.dataset.cards - +a.dataset.cards
        : sort.value === "gaps"
          ? +b.dataset.cards - +b.dataset.finishes - (+a.dataset.cards - +a.dataset.finishes)
          : a.dataset.name.localeCompare(b.dataset.name),
    );
  const limit = Number(size.value);
  page = Math.min(page, Math.max(0, Math.ceil(filtered.length / limit) - 1));
  for (const row of rows) row.hidden = true;
  const body = document.querySelector("tbody");
  for (const row of filtered.slice(page * limit, (page + 1) * limit)) {
    row.hidden = false;
    body.append(row);
  }
  document.querySelector("#results").textContent =
    `${filtered.length} set / language / region entries · ${filtered.reduce((sum, r) => sum + Number(r.dataset.cards), 0).toLocaleString("en-GB")} printings`;
  document.querySelector("#empty").hidden = filtered.length !== 0;
  document.querySelector(".table-wrap").hidden = filtered.length === 0;
  document.querySelector("#page-status").textContent = filtered.length
    ? `${page * limit + 1}–${Math.min((page + 1) * limit, filtered.length)} of ${filtered.length}`
    : "0 entries";
  previous.disabled = page === 0;
  next.disabled = (page + 1) * limit >= filtered.length;
}
form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", () => {
  page = 0;
  render();
});
form.addEventListener("reset", () => {
  page = 0;
  setTimeout(render, 0);
});
size.addEventListener("change", () => {
  page = 0;
  render();
});
previous.addEventListener("click", () => {
  page--;
  render();
});
next.addEventListener("click", () => {
  page++;
  render();
});
document.querySelector("#pagination").hidden = false;
render();
