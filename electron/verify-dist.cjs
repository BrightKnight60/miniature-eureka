const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const indexPath = path.join(distDir, "index.html");

function fail(message) {
  console.error(`[verify-dist] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(distDir)) fail("dist directory is missing. Run npm run build first.");
if (!fs.existsSync(indexPath)) fail("dist/index.html is missing.");

const indexHtml = fs.readFileSync(indexPath, "utf8");

const jsMatch = indexHtml.match(/<script[^>]*src="\.\/assets\/([^"]+\.js)"/i);
const cssMatch = indexHtml.match(/<link[^>]*href="\.\/assets\/([^"]+\.css)"/i);
if (!jsMatch) fail("Could not find bundled JS asset reference in dist/index.html.");
if (!cssMatch) fail("Could not find bundled CSS asset reference in dist/index.html.");

const jsAsset = path.join(distDir, "assets", jsMatch[1]);
const cssAsset = path.join(distDir, "assets", cssMatch[1]);
if (!fs.existsSync(jsAsset)) fail(`Referenced JS asset missing: ${jsAsset}`);
if (!fs.existsSync(cssAsset)) fail(`Referenced CSS asset missing: ${cssAsset}`);

const jsStats = fs.statSync(jsAsset);
const cssStats = fs.statSync(cssAsset);
if (jsStats.size === 0) fail("JS asset is empty.");
if (cssStats.size === 0) fail("CSS asset is empty.");

console.log("[verify-dist] OK");
console.log(`[verify-dist] JS: ${path.basename(jsAsset)} (${jsStats.size} bytes)`);
console.log(`[verify-dist] CSS: ${path.basename(cssAsset)} (${cssStats.size} bytes)`);
