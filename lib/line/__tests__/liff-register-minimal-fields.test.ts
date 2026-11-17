import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const registerClientSource = readFileSync(
  new URL('../../../app/liff/register/register-client.tsx', import.meta.url),
  'utf8',
);
const linePetFieldsSource = readFileSync(
  new URL('../../../app/liff/register/line-pet-fields.tsx', import.meta.url),
  'utf8',
);
const routeSource = readFileSync(
  new URL('../../../app/api/line/liff/register/route.ts', import.meta.url),
  'utf8',
);
const liffCustomerSource = readFileSync(new URL('../liff-customer.ts', import.meta.url), 'utf8');
const sharedPetFieldsSource = readFileSync(
  new URL('../../../components/customers/pet-profile-fields-block.tsx', import.meta.url),
  'utf8',
);

const retiredFields = ['petBreed', 'petAgeYears', 'petBirthday'];

test('LINE LIFF registration renders and submits only the minimal pet fields', () => {
  assert.match(registerClientSource, /<LinePetFields \/>/);
  assert.doesNotMatch(registerClientSource, /PetProfileFieldsBlock/);
  assert.doesNotMatch(linePetFieldsSource, /name="petSpecies"/);
  assert.doesNotMatch(linePetFieldsSource, /name="petSpeciesOther"/);
  assert.match(linePetFieldsSource, /name="petName"/);

  for (const field of retiredFields) {
    assert.equal(registerClientSource.includes(field), false, `register client still uses ${field}`);
    assert.equal(linePetFieldsSource.includes(field), false, `LINE fields still render ${field}`);
  }
});

test('successful LINE registration preserves safe return navigation and opens the official chat inside LINE', () => {
  assert.match(registerClientSource, /returnPath && returnPath\.startsWith\('\/liff\/'\)/);
  assert.match(registerClientSource, /window\.location\.href = returnPath;\s*return;/);
  assert.match(registerClientSource, /liff\.isInClient\(\)/);
  assert.match(registerClientSource, /liff\.openWindow\(\{ url: FURMOSA_OFFICIAL_LINE_CHAT_URL, external: true \}\)/);
  assert.match(registerClientSource, /liff\.getOS\(\)/);
  assert.match(registerClientSource, /os === 'ios' \|\| os === 'android'/);
  assert.match(registerClientSource, /autoCloseScheduledRef\.current/);
  assert.match(registerClientSource, /nextReturnMode === 'line' && !autoCloseScheduledRef\.current/);
  assert.match(registerClientSource, /window\.setTimeout\(returnToOfficialLineChat, 1200\)/);
  assert.match(registerClientSource, /window\.clearTimeout\(autoCloseTimerRef\.current\)/);
});

test('first-time LIFF registration continues in chat with the registered main menu', () => {
  assert.match(routeSource, /if \(result\.isNew\)/);
  assert.match(routeSource, /pushLineMessages\(/);
  assert.match(routeSource, /result\.lineUserId/);
  assert.match(routeSource, /buildMainMenuMessages\(\{/);
  assert.match(routeSource, /registered: true/);
  assert.match(routeSource, /加入完成！已經幫你把 LINE 和匠寵會員連在一起了。想先去哪裡？/);
  assert.match(routeSource, /runAfterReply\(/);
});

test('successful LINE registration keeps official-chat navigation separate from registration', () => {
  const closeButton = registerClientSource.match(
    /<Button\s+[\s\S]*?type="button"[\s\S]*?onClick=\{returnToOfficialLineChat\}[\s\S]*?>\s*回到匠寵 LINE 對話\s*<\/Button>/,
  );
  assert.ok(closeButton, 'manual LINE close button is missing or can submit the form');
  assert.doesNotMatch(closeButton[0], /onSubmit|fetch|\/api\/line\/liff\/register/);
  assert.match(registerClientSource, /FURMOSA_OFFICIAL_LINE_CHAT_URL/);
  assert.match(registerClientSource, /returnMode === 'desktop' \? '_blank' : undefined/);
  assert.match(registerClientSource, /開啟 LINE 匠寵對話/);
  assert.match(registerClientSource, /開啟匠寵官方帳號/);

  const closeHandler = registerClientSource.match(
    /function returnToOfficialLineChat\(\) \{([\s\S]*?)\n  \}/,
  );
  assert.ok(closeHandler, 'LIFF close handler is missing');
  assert.doesNotMatch(closeHandler[1], /fetch|onSubmit|\/api\/line\/liff\/register/);
});

test('official LINE URL is isolated from server-only brand link configuration', () => {
  const officialLineSource = readFileSync(new URL('../official-line.ts', import.meta.url), 'utf8');
  assert.equal(
    officialLineSource.trim(),
    "export const FURMOSA_OFFICIAL_LINE_URL = 'https://line.me/R/ti/p/@902rkfzv';\nexport const FURMOSA_OFFICIAL_LINE_CHAT_URL =\n  'https://line.me/R/oaMessage/%40902rkfzv/';",
  );
  assert.doesNotMatch(registerClientSource, /brand-links/);
  assert.doesNotMatch(officialLineSource, /process\.env|import /);
});

test('LINE registration uses the branded single-column form and a single success state', () => {
  assert.match(registerClientSource, /title="加入匠寵會員"/);
  assert.match(registerClientSource, /約 30 秒/);
  assert.match(registerClientSource, /嗨！先告訴我怎麼稱呼你？/);
  assert.match(registerClientSource, /完成並回到 LINE/);
  assert.match(registerClientSource, /if \(status\.type === 'ok'\) \{\s*return \(/);
  assert.match(registerClientSource, /已加入匠寵會員/);
  assert.match(registerClientSource, /會員資料已更新/);
  assert.match(registerClientSource, /正在帶您回到 LINE…/);
  assert.doesNotMatch(registerClientSource, />已完成</);
  assert.doesNotMatch(registerClientSource, /status\.type === 'ok' \? '已完成'/);
});

test('optional pet name remains mounted in an accessible mobile disclosure without species questions', () => {
  assert.match(linePetFieldsSource, /<details/);
  assert.match(linePetFieldsSource, /<summary/);
  assert.match(linePetFieldsSource, /毛孩資料（選填）/);
  assert.match(linePetFieldsSource, /毛孩名字/);
  assert.match(linePetFieldsSource, /h-12/);
  assert.doesNotMatch(linePetFieldsSource, /種類|PET_SPECIES_OPTIONS|sm:grid-cols-2/);
});

test('LINE registration route accepts legacy extras without reading their values', () => {
  for (const field of retiredFields) {
    assert.equal(routeSource.includes(`body.${field}`), false, `route still reads ${field}`);
    assert.match(routeSource, new RegExp(`${field}: null`));
  }
});

test('existing LINE customer updates preserve retired profile fields', () => {
  const updateMatch = liffCustomerSource.match(
    /await tx\.customer\.update\(\{[\s\S]*?data:\s*\{([\s\S]*?)\n\s*\},\n\s*\}\);/,
  );
  assert.ok(updateMatch, 'could not locate existing customer update data');
  const updateData = updateMatch[1];

  assert.doesNotMatch(updateData, /\.\.\./, 'existing update data must not use object spread');
  for (const field of retiredFields) {
    assert.equal(updateData.includes(field), false, `existing update still writes ${field}`);
  }

  for (const field of ['name', 'phone', 'lineUserId', 'lineDisplay', 'petSpecies', 'petSpeciesOther', 'petName']) {
    assert.match(updateData, new RegExp(`\\b${field}\\b`), `existing update lost ${field}`);
  }
});

test('new LINE customers initialize retired profile fields as null', () => {
  for (const field of retiredFields) {
    assert.match(liffCustomerSource, new RegExp(`${field}: null`));
  }
});

test('shared HQ pet profile component remains available and unchanged in scope', () => {
  assert.match(sharedPetFieldsSource, /name="petAgeYears"/);
  assert.match(sharedPetFieldsSource, /name="petBirthday"/);
});
