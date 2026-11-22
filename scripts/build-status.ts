import { readFile, writeFile, mkdir, copyFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  summarize,
  escapeHtml as h,
  percent,
  type RecordData,
  type Coverage,
} from "./status-model.ts";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const out = new URL("site/", root);
const siteData = new URL("data/", out);
let source = dist;
if (process.argv.includes("--dev") && !existsSync(new URL("manifest.json", dist))) {
  if (existsSync(new URL("manifest.json", siteData))) source = siteData;
  else {
    source = new URL("https://status.cardlattice.com/data/");
    console.log("Downloading the published catalogue for the local preview…");
  }
}

async function readSnapshotFile(name: string) {
  const url = new URL(name, source);
  if (url.protocol === "file:") return readFile(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${name} (HTTP ${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

const manifestBytes = await readSnapshotFile("manifest.json");
const manifest = JSON.parse(manifestBytes.toString());
if (!/^catalogue-[a-f0-9]{64}\.json$/.test(manifest.filename))
  throw new Error("Invalid snapshot filename");
const raw = await readSnapshotFile(manifest.filename);
if (createHash("sha256").update(raw).digest("hex") !== manifest.sha256)
  throw new Error("Snapshot checksum mismatch");
const snapshot: { sourceCommit: string; records: RecordData[] } = JSON.parse(raw.toString());
if (
  !/^[a-f0-9]{40}$/.test(snapshot.sourceCommit) ||
  snapshot.sourceCommit !== manifest.sourceCommit
)
  throw new Error("Invalid source revision");

const rows = summarize(snapshot.records);
const sets = new Map<string, Coverage[]>(
  snapshot.records.filter((record) => record.metadata.kind === "set").map(({ id }) => [id, []]),
);
for (const row of rows) sets.get(row.setId)!.push(row);
const total = rows.reduce((count, row) => count + row.cards, 0);
if (total !== manifest.counts.printing) throw new Error("Printing count differs from manifest");

const numbers = new Intl.NumberFormat("en-GB");
const n = (value: number) => numbers.format(value);
const progressPercent = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const languageName = (code: string) =>
  code === "und" ? "Not yet localised" : (languageNames.of(code) ?? code);
const releaseLanguages = (releases: Coverage[]) =>
  new Set(releases.map((row) => row.language).filter((language) => language !== "und"));
const languages = [...new Set(rows.map((row) => row.language))].sort((a, b) =>
  languageName(a).localeCompare(languageName(b), "en"),
);

const revision = snapshot.sourceCommit;
const repo = "https://github.com/cardlattice/cardlattice-data";
const guide = `${repo}/blob/main/CONTRIBUTING.md`;
const statusLabels = { empty: "Not Started", partial: "In Progress", done: "Done" };
const groups = [...sets.values()].map((releases) => {
  const status: keyof typeof statusLabels = releases.every((row) => row.cards === 0)
    ? "empty"
    : releases.every(
          (row) =>
            row.cards === row.finishes &&
            row.cards === row.illustrators &&
            row.cards === row.rarities,
        )
      ? "done"
      : "partial";
  return { releases, status };
});
const pageSizes = [25, 50, 100];
const [initialPageSize] = pageSizes;
const hasMorePages = groups.length > initialPageSize;

const iconPaths = {
  globe:
    '<circle cx="8" cy="8" r="6.5"/><ellipse cx="8" cy="8" rx="2.8" ry="6.5"/><path d="M1.5 8h13"/>',
  check: '<path d="m2.5 8 3.5 3.5 7.5-7.5"/>',
  sort: '<path d="M4.5 2.5v11m-3-3 3 3 3-3m4-8v11m-3-8 3-3 3 3"/>',
  chevron: '<path d="m4 6 4 4 4-4"/>',
  external: '<path d="M8.5 3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V8m-3-6h4v4m0-4L7 9"/>',
};
const icon = (name: keyof typeof iconPaths) =>
  `<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
const github = `<svg class="icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 8 0Z"/></svg>`;
const wordmark = `<span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 7.25 9.5-4.75 9.5 4.75L12 12 2.5 7.25Zm0 5L12 17l9.5-4.75m-19 5L12 22l9.5-4.75"/></svg></span><span>cardlattice<span class="wordmark-period">.</span></span>`;

const flags = new Set(["AU", "CN", "JP", "KR", "NL", "US"]);
const defaultRegions: Record<string, string> = {
  en: "US",
  ja: "JP",
  ko: "KR",
  nl: "NL",
  "zh-Hans": "CN",
};
function releaseLabel(row: Coverage, releases: Coverage[]) {
  const region = row.region === "global" ? "Global" : (regionNames.of(row.region) ?? row.region);
  const showRegion =
    releases.some((other) => other !== row && other.language === row.language) ||
    (row.region !== "global" && row.region !== defaultRegions[row.language]);
  const flagRegion = /^en(?:-|$)/i.test(row.language) ? "US" : row.region;
  const flag = flags.has(flagRegion)
    ? `<img class="flag" src="./assets/flags/${flagRegion.toLowerCase()}.svg" width="20" height="20" loading="lazy" alt="">`
    : `<span class="flag-placeholder">${icon("globe")}</span>`;
  return `<span class="release-language">${flag}<span>${h(languageName(row.language))}<span class="${showRegion ? "release-region" : "sr-only"}"> · ${h(region)}</span></span></span>`;
}

function recorded(value: number, cards: number, withRing = true) {
  const ring = withRing
    ? `<svg class="coverage-ring ${value === cards && cards > 0 ? "complete" : ""}" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5"/><circle class="coverage-value" cx="6" cy="6" r="5" pathLength="100" stroke-dasharray="${percent(value, cards)} 100" transform="rotate(-90 6 6)"/></svg>`
    : "";
  return `<span class="recorded">${ring}<span>${n(value)}<span class="secondary">/${n(cards)}</span></span></span>`;
}

function renderSet({ releases, status }: (typeof groups)[number], index: number) {
  const [set] = releases;
  const languageCount = releaseLanguages(releases).size;
  const searchText = [set.name, set.setId, set.series, set.game]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
  const folder = `catalogue/${encodeURIComponent(set.gameId)}`;
  const slug = encodeURIComponent(set.setId.slice(set.gameId.length + 1));
  return `<details class="set-card"${index >= initialPageSize ? " data-later-page" : ""} data-name="${h(set.name)}" data-search="${h(searchText)}" data-status="${status}">
    <summary>
      <span class="set-title">
        <span class="set-name">${h(set.name)}</span>
        <span class="set-id secondary">${h(set.setId)}</span>
        <span class="set-languages secondary">${icon("globe")}${n(languageCount)} ${languageCount === 1 ? "Language" : "Languages"}</span>
      </span>
      <span class="set-status"><span class="badge ${status}">${statusLabels[status]}</span><span class="set-chevron">${icon("chevron")}</span></span>
    </summary>
    <div class="release-panel">
      <div class="release-table" role="region" aria-label="${h(set.name)} coverage table" tabindex="0">
        <table>
          <caption class="sr-only">Recorded metadata for ${h(set.name)} by language and region</caption>
          <colgroup><col class="language-col"><col class="printings-col"><col class="finishes-col"><col class="illustrator-col"><col class="rarity-col"><col class="link-col"></colgroup>
          <thead><tr><th scope="col">Language</th><th scope="col">Printings</th><th scope="col">Finishes recorded</th><th scope="col">Illustrator recorded</th><th scope="col">Rarity recorded</th><th scope="col"><span class="sr-only">Source</span></th></tr></thead>
          <tbody>${releases
            .map((row) => {
              const source = row.cards
                ? `${repo}/tree/${revision}/${folder}/cards/${slug}/${encodeURIComponent(row.language)}/${encodeURIComponent(row.region)}`
                : `${repo}/blob/${revision}/${folder}/sets/${slug}.yaml`;
              return `<tr data-language="${h(row.language)}" data-cards="${row.cards}" data-finishes="${row.finishes}" data-illustrators="${row.illustrators}">
                <th scope="row">${releaseLabel(row, releases)}</th><td class="printings">${n(row.cards)}</td>
                <td>${recorded(row.finishes, row.cards)}</td><td>${recorded(row.illustrators, row.cards)}</td><td>${recorded(row.rarities, row.cards, false)}</td>
                <td class="source"><a href="${source}" aria-label="View ${h(set.name)} · ${h(languageName(row.language))} · ${h(row.region)} source on GitHub">${icon("external")}</a></td>
              </tr>`;
            })
            .join("")}</tbody>
        </table>
      </div>
    </div>
  </details>`;
}

const progress = (["empty", "partial", "done"] as const).map((status) => ({
  status,
  count: groups.filter((group) => group.status === status).length,
}));

// Start reserving space before the body can paint, without waiting for a script request.
const client = (await readFile(new URL("status/client.js", root), "utf8")).replaceAll(
  /<\/script/gi,
  (tag) => tag.replace("/", "\\/"),
);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Measured coverage of Cardlattice’s independently curated trading card catalogue, by language and set.">
  <title>Catalogue Progress · Cardlattice</title>
  <link rel="preload" href="./assets/InterVariable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="./style.css">
  <script>
    document.documentElement.dataset.initializingDashboard = "";
    document.addEventListener("DOMContentLoaded", () => {
      try {
${client}
      } finally {
        delete document.documentElement.dataset.initializingDashboard;
      }
    }, { once: true });
  </script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="container page-header">
    <a class="wordmark" href="https://cardlattice.com" target="_blank" rel="noopener" aria-label="Cardlattice home">${wordmark}</a>
    <nav class="header-actions" aria-label="Project">
      <div class="header-buttons">
        <a class="header-button commit-button" href="${repo}/commit/${revision}" target="_blank" rel="noopener"><span class="commit-dot" aria-hidden="true"></span>Last commit: ${revision.slice(0, 7)}</a>
        <a class="header-button primary-button" href="${guide}" target="_blank" rel="noopener">Contribution Guide</a>
      </div>
      <a class="github-link" href="${repo}" target="_blank" rel="noopener" aria-label="Cardlattice data on GitHub">${github}</a>
    </nav>
  </header>
  <main id="main" class="container">
    <section class="intro" aria-labelledby="page-title">
      <h1 id="page-title">Catalogue Progress</h1>
      <p>Explore what’s recorded, find what’s missing, and help make open card data better.</p>
    </section>
    <dl class="stats" aria-label="Catalogue totals">
      <div><dt>Known Printings</dt><dd>${n(total)}</dd></div>
      <div><dt>Sets in the repository</dt><dd>${n(sets.size)}</dd></div>
      <div><dt>Languages with cards</dt><dd>${n(releaseLanguages(rows.filter((row) => row.cards > 0)).size)}</dd></div>
    </dl>
    <section class="progress" aria-labelledby="progress-title">
      <div class="progress-heading">
        <h2 id="progress-title">Progress</h2>
        <ul class="progress-legend">${progress
          .map(
            ({ status, count }) =>
              `<li class="${status}">${progressPercent.format(groups.length ? count / groups.length : 0)} ${statusLabels[status].toLowerCase()}</li>`,
          )
          .join("")}</ul>
      </div>
      <div class="progress-bar" aria-hidden="true">${[...progress]
        .reverse()
        .filter(({ count }) => count > 0)
        .map(({ status, count }) => `<span class="${status}" style="--count: ${count}"></span>`)
        .join("")}</div>
    </section>
    <section class="sets" aria-labelledby="sets-title">
      <h2 id="sets-title" class="sr-only">Set coverage</h2>
      <form id="filters" class="filters" role="search" inert>
        <input id="query" type="search" aria-label="Find a set, game, series or ID" placeholder="Find a set, game, series or ID">
        <label class="filter">${icon("globe")}<span class="sr-only">Language</span><select id="language"><option value="">Language</option>${languages.map((language) => `<option value="${h(language)}">${h(languageName(language))}</option>`).join("")}</select>${icon("chevron")}</label>
        <label class="filter">${icon("check")}<span class="sr-only">Status</span><select id="status"><option value="">Status</option>${Object.entries(
          statusLabels,
        )
          .map(([key, label]) => `<option value="${key}">${label}</option>`)
          .join(
            "",
          )}<option value="finishes">Missing finishes</option><option value="illustrators">Missing illustrators</option></select>${icon("chevron")}</label>
        <label class="filter">${icon("sort")}<span class="sr-only">Sort by</span><select id="sort"><option value="default">Sort By</option><option value="name">Set name</option><option value="cards">Most printings</option><option value="gaps">Most missing finishes</option></select>${icon("chevron")}</label>
        <button type="reset" id="clear" hidden>Clear filters</button>
      </form>
      <p id="results" class="sr-only" role="status"></p>
      <div id="set-list">${groups.map(renderSet).join("")}</div>
      <p id="empty"${groups.length ? " hidden" : ""}>${groups.length ? "No sets match these filters." : "No sets are recorded yet."}</p>
      <div class="pagination" id="pagination"${hasMorePages ? " data-enhanced-control" : ""} hidden>
        <label>Sets per page <select id="size">${pageSizes.map((size) => `<option>${size}</option>`).join("")}</select></label>
        <span id="page-status">${hasMorePages ? `1–${initialPageSize} of ${groups.length}` : ""}</span>
        <div><button type="button" id="previous" disabled>Previous</button> <button type="button" id="next">Next</button></div>
      </div>
    </section>
  </main>
  <footer class="container page-footer">
    <details class="method">
      <summary>How progress is measured</summary>
      <p>Progress is the share of sets at each status. A set is not started if it has no printings, in progress if any known printing lacks a finish, illustrator or rarity, and done when every known printing has all three recorded.</p>
      <p>Counts cover known printings in each language and region. A printing counts once even if it has multiple finish options.</p>
    </details>
    <div class="footer-links">
      <a href="https://cardlattice.com">Browse catalogue</a>
      <a href="./coverage.json">Coverage JSON</a>
      <label class="theme-label" data-enhanced-control hidden>Theme <select id="theme"><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    </div>
  </footer>
</body>
</html>
`;
await mkdir(out, { recursive: true });
await writeFile(new URL("index.html", out), html);
await writeFile(
  new URL("coverage.json", out),
  JSON.stringify({ sourceCommit: revision, snapshotSha256: manifest.sha256, rows }, null, 2) + "\n",
);
for (const file of ["style.css", "_headers"])
  await copyFile(new URL(`status/${file}`, root), new URL(file, out));
await cp(new URL("status/assets/", root), new URL("assets/", out), { recursive: true });
// Publish the exact verified snapshot for browser-only catalogue clients.
if (source !== siteData) {
  await mkdir(siteData, { recursive: true });
  await writeFile(new URL(manifest.filename, siteData), raw);
  await writeFile(new URL("manifest.json", siteData), manifestBytes);
}
console.log(`Built catalogue status: ${total} printings, ${rows.length} release groups.`);
