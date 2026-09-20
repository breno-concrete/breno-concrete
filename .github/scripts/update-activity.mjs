// Regenerates assets/activity.svg from public GitHub data. Any API failure keeps the previous file.
import { writeFileSync } from "node:fs";

const user = process.env.GITHUB_REPOSITORY_OWNER;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "update-activity",
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
};
const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function recentCommits() {
  const q = encodeURIComponent(`author:${user} is:public`);
  const { items } = await api(`/search/commits?q=${q}&sort=author-date&order=desc&per_page=5`);
  return items.map((c) => ({ sha: c.sha.slice(0, 7), msg: c.commit.message.split("\n")[0] }));
}

async function topLanguages() {
  const repos = (await api(`/users/${user}/repos?type=owner&per_page=100`)).filter((r) => !r.fork);
  const bytes = {};
  for (const r of repos) {
    for (const [lang, n] of Object.entries(await api(`/repos/${user}/${r.name}/languages`))) {
      bytes[lang] = (bytes[lang] || 0) + n;
    }
  }
  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(bytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, n]) => ({ name, pct: Math.round((n * 100) / total) }));
}

const y = (i) => 72 + 29 * i;
const text = (x, i, s, fill = "#EDEDED") => `<text x="${x}" y="${y(i)}" fill="${fill}">${esc(s)}</text>`;

function render(commits, langs) {
  const out = [text(16, 0, "$", "#00FF41"), text(42, 0, "git log --oneline -5")];
  commits.forEach((c, i) => out.push(text(16, i + 1, c.sha, "#8B8B8B"), text(122, i + 1, cut(c.msg, 36))));
  out.push(text(16, 6, "$", "#00FF41"), text(42, 6, "langs --by-bytes"));
  langs.forEach((l, i) => {
    const row = i + 7;
    out.push(
      text(16, row, l.name),
      `<rect x="180" y="${y(row) - 14}" width="320" height="14" fill="#222222"/>`,
      `<rect x="180" y="${y(row) - 14}" width="${(l.pct * 3.2).toFixed(1)}" height="14" fill="#EDEDED"/>`,
      text(520, row, `${l.pct}%`, "#8B8B8B"),
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 384" width="800" height="384" role="img" aria-labelledby="t">
  <title id="t">${esc(`Last ${commits.length} public commits and top languages by bytes for ${user}.`)}</title>
  <style>text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:22px}</style>
  <rect width="800" height="384" fill="#0A0A0A"/>
  <rect x="0.5" y="0.5" width="799" height="383" fill="none" stroke="#222222"/>
  <path d="M0 40.5H800" stroke="#222222"/>
  ${text(16, -1.4, `${user}@dev: ~/activity`, "#8B8B8B")}
  ${out.join("\n  ")}
</svg>
`;
}

try {
  const [commits, langs] = await Promise.all([recentCommits(), topLanguages()]);
  writeFileSync("assets/activity.svg", render(commits, langs));
  console.log("activity.svg updated");
} catch (err) {
  console.warn(`keeping previous activity.svg: ${err.message}`);
}
