import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  summarize,
  escapeHtml as h,
  percent,
  type RecordData,
  type Coverage,
} from "./status-model.ts";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const manifest = JSON.parse(await readFile(new URL("manifest.json", dist), "utf8"));
if (!/^catalogue-[a-f0-9]{64}\.json$/.test(manifest.filename))
  throw new Error("Invalid snapshot filename");
const raw = await readFile(new URL(manifest.filename, dist));
if (createHash("sha256").update(raw).digest("hex") !== manifest.sha256)
  throw new Error("Snapshot checksum mismatch");
const snapshot: { sourceCommit: string; records: RecordData[] } = JSON.parse(raw.toString());
if (
  !/^[a-f0-9]{40}$/.test(snapshot.sourceCommit) ||
  snapshot.sourceCommit !== manifest.sourceCommit
)
  throw new Error("Invalid source revision");
const rows = summarize(snapshot.records);
const n = (value: number) => value.toLocaleString("en-GB");
const languageName = (code: string) =>
  code === "und"
    ? "Not yet localised"
    : (new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code);
const languages = [...new Set(rows.map((r) => r.language))].sort();
const sum = (items: Coverage[], key: "cards" | "finishes" | "illustrators" | "rarities") =>
  items.reduce((total, r) => total + r[key], 0);
const total = sum(rows, "cards");
if (total !== manifest.counts.printing) throw new Error("Printing count differs from manifest");
const bar = (value: number, max: number, label: string) =>
  `<div class="meter-label"><span>${h(label)}</span><span>${n(value)} <span class="muted">/ ${n(max)}</span></span></div><meter min="0" max="${Math.max(1, max)}" value="${value}" aria-label="${h(label)}: ${value} of ${max} printings">${percent(value, max)}%</meter>`;
const revision = snapshot.sourceCommit;
const repo = "https://github.com/cardlattice/cardlattice-data";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Measured coverage of Cardlattice’s independently curated trading card catalogue, by language and set."><title>Catalogue status · Cardlattice</title><link rel="stylesheet" href="./style.css"><script src="./client.js" defer></script></head><body>
<a class="skip" href="#main">Skip to content</a><header><div class="header-inner"><a class="wordmark" href="./" aria-label="Cardlattice catalogue status"><span class="mark" aria-hidden="true">▱</span> cardlattice<span class="dot">.</span></a><span class="header-label">Catalogue status</span><nav aria-label="Project"><a href="https://github.com/cardlattice/cardlattice">Project ↗</a><a href="${repo}">Data ↗</a><label class="theme-label">Theme <select id="theme"><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label></nav></div></header>
<main id="main"><section class="hero"><p class="eyebrow">OPEN DATA. VISIBLE PROGRESS.</p><h1>A clearer picture<br>of the catalogue<span class="dot">.</span></h1><p class="lede">Explore what’s recorded, find what’s missing,<br class="desktop"> and help make open card data better.</p><p class="revision"><span class="status-dot" aria-hidden="true"></span> Built from the repository <span aria-hidden="true">/</span> <a href="${repo}/commit/${revision}">${revision.slice(0, 7)}</a></p></section>
<section class="stats" aria-label="Catalogue totals"><article><p class="eyebrow">KNOWN PRINTINGS</p><strong>${n(total)}</strong><p>Each language and region counted separately</p></article><article><p class="eyebrow">SETS IN THE REPOSITORY</p><strong>${n(new Set(rows.map((r) => r.setId)).size)}</strong><p>Recorded sets, including those awaiting cards</p></article><article class="accent-card"><p class="eyebrow">LANGUAGES WITH CARDS</p><strong>${n(languages.filter((l) => l !== "und" && rows.some((r) => r.language === l && r.cards > 0)).length)}</strong><p>Independent contributions. Shared foundations.</p></article></section>
<section class="section"><div class="section-heading"><div><p class="eyebrow">BY LANGUAGE</p><h2>Small contributions. Real progress.</h2></div><a href="#method">How we count ↘</a></div><p class="muted">Bars show metadata recorded on known printings, not the proportion of every card ever released.</p><div class="languages">${languages
  .filter((l) => l !== "und")
  .map((l) => {
    const items = rows.filter((r) => r.language === l);
    const count = sum(items, "cards");
    return `<article class="language"><div class="language-title"><h3>${h(languageName(l))}</h3><span class="tag">${h(l)}</span></div><p><b>${n(count)}</b> printings <span class="muted">· ${new Set(items.map((r) => r.setId)).size} sets</span></p>${bar(sum(items, "finishes"), count, "Finish recorded")}${bar(sum(items, "illustrators"), count, "Illustrator recorded")}<p class="small muted">${n(count - sum(items, "finishes"))} without a recorded finish</p></article>`;
  })
  .join("")}</div></section>
<section class="section" aria-labelledby="sets-title"><div class="section-heading"><div><p class="eyebrow">EXPLORE THE DATA</p><h2 id="sets-title">Set coverage</h2></div><a href="${repo}/blob/main/CONTRIBUTING.md">Help fill the gaps ↗</a></div>
<form id="filters" class="filters" role="search"><label class="search">Find a set<input id="query" type="search" placeholder="Search by set, game, series or ID…"></label><label>Language<select id="language"><option value="">All languages</option>${languages.map((l) => `<option value="${h(l)}">${h(languageName(l))}</option>`).join("")}</select></label><label>Show<select id="coverage"><option value="">All coverage</option><option value="finishes">Missing finishes</option><option value="illustrators">Missing illustrators</option><option value="empty">No cards yet</option></select></label><label>Sort<select id="sort"><option value="name">Set name</option><option value="cards">Most printings</option><option value="gaps">Most missing finishes</option></select></label><button type="reset">Clear</button></form>
<p id="results" class="small muted" role="status">${rows.length} set / language / region entries</p><div class="table-wrap"><table><caption class="sr-only">Recorded metadata by set, language and region</caption><thead><tr><th scope="col">Set</th><th scope="col">Language / region</th><th scope="col">Printings</th><th scope="col">Finish recorded</th><th scope="col">Illustrator recorded</th><th scope="col">Rarity recorded</th></tr></thead><tbody>${rows.map((r) => `<tr data-language="${h(r.language)}" data-search="${h([r.name, r.setId, r.series, r.game].join(" ").normalize("NFKC").toLowerCase())}" data-name="${h(r.name)}" data-cards="${r.cards}" data-finishes="${r.finishes}" data-illustrators="${r.illustrators}"><th scope="row"><a href="${repo}/blob/${revision}/catalogue/${encodeURIComponent(r.gameId)}/sets/${encodeURIComponent(r.setId.slice(r.gameId.length + 1))}.yaml">${h(r.name)}</a><span class="sub">${h(r.setId)} · ${h(r.series)}</span></th><td>${h(languageName(r.language))}<span class="sub">${h(r.region)}</span></td><td class="number">${n(r.cards)}</td><td>${bar(r.finishes, r.cards, "Finishes")}</td><td>${bar(r.illustrators, r.cards, "Illustrators")}</td><td>${n(r.rarities)} / ${n(r.cards)}</td></tr>`).join("")}</tbody></table></div><p id="empty" hidden>No sets match these filters. Try another language or clear your search.</p><div class="pagination" id="pagination" hidden><label>Entries per page <select id="size"><option>25</option><option>50</option><option>100</option></select></label><span id="page-status"></span><div><button type="button" id="previous">← Previous</button> <button type="button" id="next">Next →</button></div></div><noscript><p>All entries are shown. Enable JavaScript to filter and paginate.</p></noscript></section>
<section id="method" class="method"><p class="eyebrow">MEASURED, NOT ESTIMATED</p><h2>What these numbers mean</h2><div class="method-grid"><p><b>Known records, not a completeness claim.</b> We count compiled printing records once per language and region. Separate finish options do not create extra counts. Sets without records remain visible. We have no verified worldwide target.</p><p><b>Recorded doesn’t mean exhaustive.</b> A finish counts when at least one finish is recorded, including named variants. Illustrator and rarity counts measure nonempty fields. Unset fields may be unknown or not applicable. Artwork rights and image publication are separate; this page measures metadata only.</p></div><p class="small">Generated from the validated snapshot, after inheritance is resolved. No live API or external catalogue is queried. This is catalogue coverage, not service uptime. <a href="./coverage.json">Download coverage JSON</a>.</p></section></main><footer><span class="wordmark">cardlattice<span class="dot">.</span></span><p>Independent. Open source. Free to build on.</p><a href="${repo}/blob/main/CONTRIBUTING.md">Contribute on GitHub ↗</a></footer></body></html>`;
const out = new URL("site/", root);
await mkdir(out, { recursive: true });
await writeFile(new URL("index.html", out), html);
await writeFile(
  new URL("coverage.json", out),
  JSON.stringify({ sourceCommit: revision, snapshotSha256: manifest.sha256, rows }, null, 2) + "\n",
);
for (const file of ["style.css", "client.js"])
  await copyFile(new URL(join("status", file), root), new URL(file, out));
console.log(`Built catalogue status: ${total} printings, ${rows.length} release groups.`);
