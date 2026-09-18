#!/usr/bin/env node
/**
 * Start the Vite preview server so Playwright E2E tests can hit real rendered pages.
 * The preview server serves the `dist/` build artifact on port 5174.
 */
const { execSync } = require("child_process");
const http = require("http");

const PORT = process.env.PORT || 5174;
const DIST = `${__dirname}/dist`;

if (!require("fs").existsSync(`${DIST}/index.html`)) {
  console.error("dist/index.html not found. Run `npm run build` first.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let path = req.url === "/" ? "/index.html" : req.url;
  const full = `${DIST}${path}`;
  const stat = require("fs").existsSync(full);
  if (!stat) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  require("fs").createReadStream(full).pipe(res);
});

server.listen(PORT, () => {
  console.log(`preview server listening on http://localhost:${PORT}`);
});
