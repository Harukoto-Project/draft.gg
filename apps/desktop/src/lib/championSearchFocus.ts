/**
 * チャンピオン検索欄へのフォーカス要求。
 * 検索欄はドラフト画面の中にあり、読み込み中や別の画面では存在しない。
 * 無いときは「要求あり」だけ覚えておき、検索欄が現れた時点でフォーカスする。
 */
let input: HTMLInputElement | null = null;
let pending = false;

function focusInput(el: HTMLInputElement) {
  el.focus();
  el.select();
}

/** 検索欄の ref。マウント時に渡し、アンマウント時は null が来る */
export function registerChampionSearch(el: HTMLInputElement | null): void {
  input = el;
  if (el && pending) {
    pending = false;
    focusInput(el);
  }
}

/** 検索欄にフォーカスする。まだ無ければ、現れたときにフォーカスする。いま存在すれば true */
export function requestChampionSearchFocus(): boolean {
  if (input) {
    pending = false;
    focusInput(input);
    return true;
  }
  pending = true;
  return false;
}
