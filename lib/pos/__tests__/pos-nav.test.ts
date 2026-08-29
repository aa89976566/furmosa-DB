import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  POS_HOME_ACTIONS,
  POS_NAV,
  activePosNavId,
  posNavItem,
} from '@/lib/pos/pos-nav';

function pageFileForHref(href: string): string {
  const rel = href.replace(/^\//, '');
  return path.join(process.cwd(), 'app', rel, 'page.tsx');
}

describe('POS_NAV', () => {
  it('uses 首頁 庫存 換罐 查詢 結帳 and puts 結帳 last', () => {
    assert.deepEqual(
      POS_NAV.map((item) => item.label),
      ['首頁', '庫存', '換罐', '查詢', '結帳'],
    );
    assert.equal(POS_NAV[0]?.href, '/pos');
    assert.equal(POS_NAV[1]?.href, '/pos/stock');
    assert.equal(POS_NAV[2]?.href, '/pos/refill');
    assert.equal(POS_NAV[3]?.href, '/pos/records');
    assert.equal(POS_NAV[4]?.href, '/pos/settle');
    assert.equal(activePosNavId('/pos'), 'home');
    assert.equal(activePosNavId('/pos/'), 'home');
    assert.equal(activePosNavId('/pos/login'), null);
    assert.equal(activePosNavId('/pos/stock'), 'stock');
    assert.equal(activePosNavId('/pos/refill/abc'), 'refill');
    assert.equal(activePosNavId('/pos/records'), 'records');
    assert.equal(activePosNavId('/pos/settle'), 'settle');
    assert.equal(activePosNavId('/pos/sell'), null);
    assert.equal(activePosNavId('/pos/restock'), null);
  });

  it('maps every navigation href to a real page', () => {
    for (const item of POS_NAV) {
      const file = pageFileForHref(item.href);
      assert.equal(existsSync(file), true, `缺少頁面：${item.href} → ${file}`);
    }
  });

  it('keeps 首頁 as a real landing page, not a dummy href', () => {
    const home = posNavItem('home');
    const source = readFileSync(pageFileForHref(home.href), 'utf8');
    assert.match(source, /今天要處理什麼/);
    assert.doesNotMatch(source, /redirect\('\/pos\/stock'\)/);
  });
});

describe('POS_HOME_ACTIONS', () => {
  it('uses the same destinations as POS_NAV', () => {
    assert.deepEqual(
      POS_HOME_ACTIONS.map((action) => action.navId),
      ['refill', 'stock', 'records', 'settle'],
    );
    for (const action of POS_HOME_ACTIONS) {
      assert.equal(posNavItem(action.navId).href, POS_NAV.find((item) => item.id === action.navId)?.href);
    }
  });
});

describe('POS chrome uses one navigation definition', () => {
  it('desktop sidebar and mobile bottom nav both map POS_NAV', () => {
    const chrome = readFileSync(path.join(process.cwd(), 'components/pos/inventory-nav.tsx'), 'utf8');
    const alias = readFileSync(path.join(process.cwd(), 'components/pos/bottom-nav.tsx'), 'utf8');
    const shell = readFileSync(path.join(process.cwd(), 'components/pos/pos-shell.tsx'), 'utf8');

    assert.match(chrome, /from '@\/lib\/pos\/pos-nav'/);
    assert.equal((chrome.match(/POS_NAV\.map/g) ?? []).length, 2);
    assert.match(alias, /from '@\/components\/pos\/inventory-nav'/);
    assert.doesNotMatch(alias, /POS_NAV\s*=/);
    assert.match(shell, /InventorySideNav/);
    assert.match(shell, /InventoryBottomNav/);
  });
});
