const theme = document.querySelector("#theme");
try {
  theme.value = localStorage.getItem("cardlattice-theme") || "auto";
} catch {
  /* Storage can be disabled. */
}

function applyTheme() {
  const value = ["light", "dark"].includes(theme.value) ? theme.value : "auto";
  theme.value = value;
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
theme.closest("label").hidden = false;

const form = document.querySelector("#filters");
const list = document.querySelector("#set-list");
const sets = [...list.querySelectorAll(".set-card")].map((card) => ({
  card,
  rows: [...card.querySelectorAll("tbody tr")],
}));
const query = document.querySelector("#query");
const language = document.querySelector("#language");
const status = document.querySelector("#status");
const sort = document.querySelector("#sort");
const clear = document.querySelector("#clear");
const results = document.querySelector("#results");
const empty = document.querySelector("#empty");
const pagination = document.querySelector("#pagination");
const size = document.querySelector("#size");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const pageStatus = document.querySelector("#page-status");
let page = 0;

function render() {
  const term = query.value.trim().normalize("NFKC").toLowerCase();
  const languageFilter = language.value;
  const statusFilter = status.value;
  const sortOrder = sort.value;
  const missingFilter = ["finishes", "illustrators"].includes(statusFilter);
  const filtered = [];
  for (const { card, rows } of sets) {
    card.hidden = true;
    if (term && !card.dataset.search.includes(term)) continue;
    if (statusFilter && !missingFilter && statusFilter !== card.dataset.status) continue;
    const releases = rows.filter(
      ({ dataset }) =>
        (!languageFilter || dataset.language === languageFilter) &&
        (!missingFilter || Number(dataset[statusFilter]) < Number(dataset.cards)),
    );
    if (releases.length) {
      filtered.push({
        card,
        rows,
        releases,
        cards: releases.reduce((sum, row) => sum + Number(row.dataset.cards), 0),
        gaps: releases.reduce(
          (sum, row) => sum + Number(row.dataset.cards) - Number(row.dataset.finishes),
          0,
        ),
      });
    }
  }
  if (sortOrder !== "default") {
    filtered.sort(
      (a, b) =>
        (sortOrder === "cards" ? b.cards - a.cards : sortOrder === "gaps" ? b.gaps - a.gaps : 0) ||
        a.card.dataset.name.localeCompare(b.card.dataset.name, "en"),
    );
  }

  const limit = Number(size.value);
  page = Math.min(page, Math.max(0, Math.ceil(filtered.length / limit) - 1));
  const start = page * limit;
  for (const { card, rows, releases } of filtered.slice(start, start + limit)) {
    for (const row of rows) row.hidden = !releases.includes(row);
    card.hidden = false;
    list.append(card);
  }

  const found = filtered.length;
  results.textContent = `${found} ${found === 1 ? "set" : "sets"} found`;
  empty.hidden = found > 0;
  clear.hidden = !term && !languageFilter && !statusFilter && sortOrder === "default";
  pagination.hidden = found <= Number(size.options[0].value);
  pageStatus.textContent = `${start + 1}–${Math.min(start + limit, found)} of ${found}`;
  previous.disabled = page === 0;
  next.disabled = start + limit >= found;
}

function resetPage() {
  page = 0;
  render();
}

function changePage(offset) {
  page += offset;
  render();
  list.querySelector(".set-card:not([hidden]) > summary")?.focus();
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", resetPage);
form.addEventListener("reset", () => {
  query.focus();
  setTimeout(resetPage, 0);
});
size.addEventListener("change", resetPage);
previous.addEventListener("click", () => changePage(-1));
next.addEventListener("click", () => changePage(1));
form.hidden = false;
render();
