import test from 'node:test';
import assert from 'node:assert/strict';
import { meetpetsUrl, parseMeetpetsList, parseMeetpetsAnimal } from './meetpets-source.mjs';

const f = (name,value) => `<div class="field field-field-${name}"><div class="field-items"><div class="field-item"><div class="field-label">欄位:</div>${value}</div></div></div>`;
const detail = title => `<body class="anonymous type_pets" id="node-123"><h1>${title}</h1><div class="node">${f('pets-type','狗狗')}${f('county','台北市')}${f('pet-name','測試個案')}${f('pet-habitate','慢熟，需要時間')}${f('pet-limitation','須家人同意')}${f('pets-image','<img src="https://www.meetpets.org.tw/files_meetpets/imagecache/normal/dog.jpg"><img src="https://evil.test/photo.jpg">')}${f('limitation-desc','原故事，聯絡 0912-345-678，或 test@example.test')}${f('tel','0988777666')}${f('contact','不應匯入姓名')}</div>`;
test('Meetpets allowlist rejects foreign URLs, credentials and unbounded query paths',()=>{
  assert.equal(meetpetsUrl('/pets/cat?page=2'),'https://www.meetpets.org.tw/pets/cat?page=2');
  for(const url of ['https://evil.test/content/1','https://u@www.meetpets.org.tw/content/1','/contact','/pets/cat?page=1000','/pets/cat?redirect=foo']) assert.throws(()=>meetpetsUrl(url));
});
test('Meetpets list scopes ids to animal view and pagination to category',()=>{
  const page=parseMeetpetsList('<div class="view-content-pets-dog"><a href="/content/123">animal</a></div><a href="/content/9">policy</a><a href="/pets/dog?page=1">next</a><a href="/pets/cat?page=1">other</a>','https://www.meetpets.org.tw/pets/dog');
  assert.deepEqual(page.ids,['123']);assert.deepEqual(page.pages,['https://www.meetpets.org.tw/pets/dog?page=1']);
  assert.throws(()=>parseMeetpetsList('<h1>temporarily unavailable</h1>','https://www.meetpets.org.tw/pets/dog'));
});
test('Meetpets preserves source behavior and requirements without nearby contacts',()=>{
  const p=parseMeetpetsAnimal(detail('測試個案找家'),'123');
  assert.equal(p.name,'測試個案');assert.deepEqual(p.behavior,['慢熟，需要時間']);assert.equal(p.requirements,'須家人同意');assert.equal(p.photos.length,1);
  assert.ok(!JSON.stringify(p).includes('0988777666'));assert.ok(!JSON.stringify(p).includes('不應匯入姓名'));assert.ok(!p.description.includes('0912'));assert.ok(!p.description.includes('test@example'));
  assert.equal(p.status,'已開放領養');assert.equal(p.region,'台北市');
});
test('Meetpets explicit adopted title hides and changed identity fails closed',()=>{
  assert.equal(parseMeetpetsAnimal(detail('已送出，謝謝大家'),'123').status,'已送養');
  assert.throws(()=>parseMeetpetsAnimal(detail('測試個案'),'999'));
  assert.throws(()=>parseMeetpetsAnimal('<body id="node-123"><h1>記事</h1></body>','123'));
});
