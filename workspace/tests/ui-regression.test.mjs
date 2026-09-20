import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global sidebar keeps breathable navigation spacing", async () => {
  const css = await read("css/consistency-pass.css");
  assert.match(css, /\.sidebar \.nav-item\{[^}]*min-height:42px!important/);
  assert.match(css, /\.sidebar \.nav-menu\{[^}]*gap:4px!important/);
  assert.match(css, /\.sidebar \.nav-section-label\{[^}]*margin-top:14px!important/);
});

test("client recent-project table contains all six columns", async () => {
  const css = await read("css/consistency-pass.css");
  assert.match(css, /\.jp-client-recent table\{[^}]*table-layout:fixed!important/);
  assert.match(css, /\.jp-client-recent th:nth-child\(6\)\{width:12%\}/);
  assert.match(css, /\.jp-client-recent th,.jp-client-recent td\{[^}]*overflow:hidden!important/);
});

test("Settings uses persistent segmented navigation", async () => {
  const js = await read("js/consistency-pass.js");
  const css = await read("css/consistency-pass.css");
  assert.match(js, /id="jpSettingsSegments"/);
  assert.match(js, /bindSettingsTabs\(\)/);
  assert.match(js, /SETTINGS_TAB_KEY/);
  assert.match(css, /\.jp-settings-layout\{[^}]*grid-template-columns:260px minmax\(0,1fr\)/);
  assert.match(css, /\.jp-settings-segment\{display:none\}/);
  assert.match(css, /\.jp-settings-segment\.active\{display:block\}/);
});

test("command center is floating, dismissible, and non-modal", async () => {
  const css = await read("css/consistency-pass.css");
  const js = await read("js/keyboard-shortcuts.js");
  assert.match(css, /\.jp-command-overlay\{[^}]*pointer-events:none!important/);
  assert.match(css, /\.jp-command-overlay\{[^}]*background:transparent!important/);
  assert.match(css, /\.jp-command-overlay\{[^}]*backdrop-filter:none!important/);
  assert.match(js, /id="jpCommandClose"/);
  assert.match(js, /aria-modal="false"/);
  assert.doesNotMatch(js, /function nav\(view\)\{closePalette\(\);/);
  assert.match(js, /then\(function\(\)\{closePalette\(\);\}\)/);
  assert.match(css, /\.jp-command-helper\{display:none!important\}/);
  assert.match(js, /if\(palette\)\{if\(e\.key==="Escape"\)\{e\.preventDefault\(\);closePalette\(\);return;\}/);
});

test("repeated command-center opens cannot leave stacked overlays", async () => {
  const js = await read("js/keyboard-shortcuts.js");
  assert.match(js, /paletteRequest=0/);
  assert.match(js, /document\.querySelectorAll\("\.jp-command-overlay"\)\.forEach/);
  assert.match(js, /var request=\+\+paletteRequest/);
  assert.match(js, /if\(request!==paletteRequest\)return/);
});
