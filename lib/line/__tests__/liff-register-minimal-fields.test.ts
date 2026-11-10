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
  assert.match(linePetFieldsSource, /name="petSpecies"/);
  assert.match(linePetFieldsSource, /name="petSpeciesOther"/);
  assert.match(linePetFieldsSource, /name="petName"/);

  for (const field of retiredFields) {
    assert.equal(registerClientSource.includes(field), false, `register client still uses ${field}`);
    assert.equal(linePetFieldsSource.includes(field), false, `LINE fields still render ${field}`);
  }
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
