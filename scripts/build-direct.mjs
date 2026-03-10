import { build } from "esbuild";

const banner = `/* Generated file: js/app.direct.js
 * Source entry: js/app.js
 * Do not edit manually.
 */`;

await build({
  entryPoints: ["js/app.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2019"],
  outfile: "js/app.direct.js",
  legalComments: "none",
  sourcemap: false,
  charset: "utf8",
  banner: { js: banner },
});

console.log("Generated js/app.direct.js from js/app.js");
