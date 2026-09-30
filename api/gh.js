// Vercel serverless function: /api/gh?p=/users/<name>
// Proxies only 3 whitelisted GitHub routes, adds your token, caches 5 min.
const NAME = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})";
const ROUTES = [
  { re: new RegExp("^/users/(" + NAME + ")$"), url: m => "/users/" + m[1] },
  { re: new RegExp("^/users/(" + NAME + ")/repos$"), url: m => "/users/" + m[1] + "/repos?per_page=100&sort=pushed" },
  { re: new RegExp("^/repos/(" + NAME + ")/(" + NAME + ")$"), url: m => "/repos/" + m[1] + "/" + m[2] }
];

module.exports = async (req, res) => {
  res.setHeader("x-gh-proxy", "1");
  const p = String(req.query.p || "").split("?")[0];
  let target = null;
  for (const r of ROUTES) {
    const m = p.match(r.re);
    if (m) { target = r.url(m); break; }
  }
  if (!target) return res.status(400).json({ error: "bad_path" });

  const headers = { "User-Agent": "github-roast", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;

  try {
    const r = await fetch("https://api.github.com" + target, { headers });
    const body = await r.text();
    if (r.ok || r.status === 404) res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", "application/json");
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: "upstream_failed" });
  }
};
