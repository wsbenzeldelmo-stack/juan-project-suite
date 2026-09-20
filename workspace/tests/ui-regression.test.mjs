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


test("client ID is visible but immutable in Edit Client", async () => {
  const html = await read("index.html");
  assert.match(html, /id="editClientCode" readonly aria-readonly="true"/);
  assert.match(html, /editClientCode"\)\.value = formatClientId\(client\)/);
  const editBlock = html.slice(html.indexOf("async function submitEditClient"), html.indexOf("function openProjectDetails", html.indexOf("async function submitEditClient")));
  assert.doesNotMatch(editBlock, /client_code\s*:/);
});

test("In-House Ads editor exposes audience and Online placements", async () => {
  const js = await read("js/general-update.js");
  assert.match(js, /id="adAudience"/);
  assert.match(js, /guest_home_banner/);
  assert.match(js, /guest_shop_banner/);
  assert.match(js, /client_home_banner/);
  assert.match(js, /client_home_popup/);
});

test("Online API supports the full eight-stage tracker", async () => {
  const api = await read("../online/api/suite.js");
  assert.match(api, /'Downpayment Confirmed'/);
  assert.match(api, /'Quality Assessment'/);
  assert.match(api, /'Delivered'/);
  assert.match(api, /delivery_status=stage===7\?'Delivered':'Pending'/);
});


test("Settings tab activation uses collection selectors and initializes content first", async () => {
  const js = await read("js/consistency-pass.js");
  assert.match(js, /\$\$\("\\.jp-settings-nav-item"\)\.forEach/);
  assert.match(js, /\$\$\("\\.jp-settings-segment"\)\.forEach/);
  assert.match(js, /const tabs=\$\$\("\\.jp-settings-nav-item"\)/);
  assert.match(js, /\$\$\("\[data-search-index\]",box\)\.forEach/);
  assert.doesNotMatch(js, /\$\("\\.jp-settings-nav-item"\)\.forEach/);
  assert.doesNotMatch(js, /\$\("\\.jp-settings-segment"\)\.forEach/);
  assert.match(js, /settingsBuilt=true;bindSettingsTabs\(\);try\{bindSettings\(\);\}/);
});
