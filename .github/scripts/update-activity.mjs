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

const y = (i) => 68 + 28 * i;
const text = (x, i, s, fill = "#EDEDED") => `<text x="${x}" y="${y(i)}" fill="${fill}">${esc(s)}</text>`;

function render(commits, langs) {
  const out = [text(16, 0, "$", "#00FF41"), text(38, 0, "git log -5"), text(420, 0, "$", "#00FF41"), text(442, 0, "langs --bytes")];
  commits.forEach((c, i) => out.push(text(16, i + 1, c.sha, "#8B8B8B"), text(112, i + 1, cut(c.msg, 22))));
  langs.forEach((l, i) => {
    const row = i + 1;
    out.push(
      text(420, row, cut(l.name, 10)),
      `<rect x="550" y="${y(row) - 12}" width="130" height="12" fill="#222222"/>`,
      `<rect x="550" y="${y(row) - 12}" width="${(l.pct * 1.3).toFixed(1)}" height="12" fill="#EDEDED"/>`,
      text(692, row, `${l.pct}%`, "#8B8B8B"),
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 232" width="800" height="232" role="img" aria-labelledby="t">
  <title id="t">${esc(`Last ${commits.length} public commits and top languages by bytes for ${user}.`)}</title>
  <style>text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:20px}</style>
  <rect width="800" height="232" fill="#0A0A0A"/>
  <rect x="0.5" y="0.5" width="799" height="231" fill="none" stroke="#222222"/>
  <path d="M0 40.5H800M400.5 41V232" stroke="#222222"/>
  <text x="16" y="27" fill="#8B8B8B">${esc(user)}@dev: ~/activity</text>
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
