export type HarnessView = 'preview' | 'lab';
export type HarnessScenario = 'populated' | 'empty' | 'no_matches';
export type HarnessScroll = 'none' | 'end';

export type HarnessParams = {
  view: HarnessView;
  scenario: HarnessScenario;
  search: string;
  scroll: HarnessScroll;
};

export const HARNESS_NO_MATCH_QUERY = 'zzz-no-such-fixture';

type HarnessDefaults = {
  view?: string;
  scenario?: string;
  q?: string;
  scroll?: string;
};

export type LastRowMeasure = {
  overflowX: boolean;
  lastRow: 'PASS' | 'FAIL' | 'N/A';
  reason: string;
  lastBottom?: number;
  navTop?: number;
  navHeight?: number;
  lastHeight?: number;
  innerWidth: number;
  innerHeight: number;
};

declare global {
  interface Window {
    __QUERY_BOARD_HARNESS_DEFAULTS__?: HarnessDefaults;
    __measureQueryBoard?: () => LastRowMeasure;
  }
}

function pick(url: URLSearchParams, defaults: HarnessDefaults, key: 'view' | 'scenario' | 'q' | 'scroll') {
  const fromUrl = url.get(key === 'q' ? 'q' : key);
  if (fromUrl && fromUrl.trim()) return fromUrl.trim();
  const fromEnv = defaults[key];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return '';
}

export function readHarnessParams(search = typeof location === 'undefined' ? '' : location.search): HarnessParams {
  const url = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const defaults = typeof window === 'undefined' ? {} : window.__QUERY_BOARD_HARNESS_DEFAULTS__ ?? {};
  const viewRaw = pick(url, defaults, 'view') || 'preview';
  const scenarioRaw = pick(url, defaults, 'scenario') || 'populated';
  const scenario: HarnessScenario = scenarioRaw === 'empty' || scenarioRaw === 'no_matches' ? scenarioRaw : 'populated';
  let query = pick(url, defaults, 'q');
  if (scenario === 'no_matches' && !query) query = HARNESS_NO_MATCH_QUERY;
  const scroll: HarnessScroll = pick(url, defaults, 'scroll') === 'end' ? 'end' : 'none';
  return {
    view: viewRaw === 'lab' ? 'lab' : 'preview',
    scenario,
    search: query,
    scroll,
  };
}

function isVisibleBox(node: Element): boolean {
  const style = window.getComputedStyle(node);
  const box = node.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && box.height > 0 && box.width > 0;
}

/** 量測最後一筆與可見底部導航。元素不存在、隱藏或寬高為 0 時不得判 PASS。 */
export function measureQueryBoardLastRow(): LastRowMeasure {
  const innerWidth = window.innerWidth;
  const innerHeight = window.innerHeight;
  const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const nav = [...document.querySelectorAll('nav[aria-label="店家導航"]')].find((node) => {
    const style = window.getComputedStyle(node);
    return style.position === 'fixed' && isVisibleBox(node);
  });
  if (!nav) {
    return {
      overflowX,
      lastRow: 'N/A',
      reason: '沒有可見的固定底部導航（桌機為 N/A）',
      innerWidth,
      innerHeight,
    };
  }

  window.scrollTo(0, document.documentElement.scrollHeight);

  const last = [...document.querySelectorAll('ul.space-y-3.md\\:hidden li')].at(-1);
  if (!last || !isVisibleBox(last)) {
    return {
      overflowX,
      lastRow: 'N/A',
      reason: '找不到可見的手機最後一張卡片（隱藏或寬高為 0，不得判 PASS）',
      innerWidth,
      innerHeight,
    };
  }

  const lastBox = last.getBoundingClientRect();
  const navBox = nav.getBoundingClientRect();
  if (!isVisibleBox(nav) || navBox.height <= 0) {
    return {
      overflowX,
      lastRow: 'N/A',
      reason: '底部導航隱藏或高度為 0，不得判 PASS',
      innerWidth,
      innerHeight,
    };
  }

  const covered = lastBox.bottom > navBox.top + 1;
  return {
    overflowX,
    lastRow: covered ? 'FAIL' : 'PASS',
    reason: covered
      ? `最後一筆底部 ${Math.round(lastBox.bottom)} 被導航頂部 ${Math.round(navBox.top)} 遮住`
      : `最後一筆底部 ${Math.round(lastBox.bottom)}，導航頂部 ${Math.round(navBox.top)}，間距 ${Math.round(navBox.top - lastBox.bottom)}px`,
    lastBottom: Math.round(lastBox.bottom),
    navTop: Math.round(navBox.top),
    navHeight: Math.round(navBox.height),
    lastHeight: Math.round(lastBox.height),
    innerWidth,
    innerHeight,
  };
}
