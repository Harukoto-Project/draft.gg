/** チャンピオン名の検索。日本語名・英語名・ローマ字のいずれかに部分一致する。 */

const YOUON: Record<string, Partial<Record<string, string>>> = {
  き: { ゃ: "kya", ゅ: "kyu", ょ: "kyo" },
  し: { ゃ: "sha", ゅ: "shu", ょ: "sho" },
  ち: { ゃ: "cha", ゅ: "chu", ょ: "cho" },
  に: { ゃ: "nya", ゅ: "nyu", ょ: "nyo" },
  ひ: { ゃ: "hya", ゅ: "hyu", ょ: "hyo" },
  み: { ゃ: "mya", ゅ: "myu", ょ: "myo" },
  り: { ゃ: "rya", ゅ: "ryu", ょ: "ryo" },
  ぎ: { ゃ: "gya", ゅ: "gyu", ょ: "gyo" },
  じ: { ゃ: "ja", ゅ: "ju", ょ: "jo" },
  び: { ゃ: "bya", ゅ: "byu", ょ: "byo" },
  ぴ: { ゃ: "pya", ゅ: "pyu", ょ: "pyo" },
  ふ: { ぁ: "fa", ぃ: "fi", ぅ: "fu", ぇ: "fe", ぉ: "fo" },
  て: { ぃ: "ti", ゅ: "tyu" },
  で: { ぃ: "di", ゅ: "dyu" },
  う: { ぃ: "wi", ぇ: "we", ぉ: "wo" },
  と: { ぅ: "tu" },
  ど: { ぅ: "du" },
  ゔ: { ぁ: "va", ぃ: "vi", ぇ: "ve", ぉ: "vo" },
};

const KANA: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  を: "o",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
  ゃ: "ya",
  ゅ: "yu",
  ょ: "yo",
  ゎ: "wa",
  ゔ: "vu",
};

export interface ChampionName {
  id: string;
  nameJa: string;
  nameEn: string;
}

export function championMatchesQuery(champion: ChampionName, query: string): boolean {
  const needle = compact(query);
  if (needle.length === 0) return true;

  const haystacks = [
    compact(champion.nameJa),
    compact(champion.nameEn),
    compact(champion.id),
    toRomaji(champion.nameJa, true),
    toRomaji(champion.nameJa, false),
  ];
  return haystacks.some((haystack) => haystack.includes(needle));
}

function toRomaji(input: string, longVowel: boolean): string {
  const text = toHiragana(compact(input));
  let result = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (char === undefined) break;

    if (char === "っ") {
      const next = readSyllable(text, index + 1);
      if (!next) {
        index += 1;
        continue;
      }
      result += doubleConsonant(next.romaji);
      index += 1 + next.consumed;
      continue;
    }

    if (char === "ー") {
      if (longVowel) {
        const vowel = lastVowel(result);
        if (vowel) result += vowel;
      }
      index += 1;
      continue;
    }

    const syllable = readSyllable(text, index);
    if (!syllable) {
      if (/[a-z0-9]/i.test(char)) result += char.toLowerCase();
      index += 1;
      continue;
    }

    result += syllable.romaji;
    index += syllable.consumed;
  }

  return result;
}

function readSyllable(text: string, index: number): { romaji: string; consumed: number } | null {
  const char = text[index];
  if (char === undefined) return null;

  const next = text[index + 1];
  const youon = next ? YOUON[char]?.[next] : undefined;
  if (youon) return { romaji: youon, consumed: 2 };

  const romaji = KANA[char];
  if (!romaji) return null;
  return { romaji, consumed: 1 };
}

function doubleConsonant(romaji: string): string {
  if (romaji.startsWith("ch")) return `t${romaji}`;
  const first = romaji[0];
  if (first && /[bcdfghjklmnpqrstvwxyz]/.test(first)) return `${first}${romaji}`;
  return romaji;
}

function lastVowel(romaji: string): string | null {
  for (let index = romaji.length - 1; index >= 0; index -= 1) {
    const char = romaji[index];
    if (char && "aeiou".includes(char)) return char;
  }
  return null;
}

const ROMAN_NUMERALS: Record<string, string> = {
  Ⅰ: "1",
  Ⅱ: "2",
  Ⅲ: "3",
  Ⅳ: "4",
  Ⅴ: "5",
  Ⅵ: "6",
  Ⅶ: "7",
  Ⅷ: "8",
  Ⅸ: "9",
  Ⅹ: "10",
};

/**
 * 比較用の形にそろえる。空白・記号(中黒、ハイフン、アポストロフィ、＝、＆)を落とし、
 * ローマ数字を算用数字に、カタカナをひらがなに、英字を小文字にする。
 */
function compact(input: string): string {
  const numerals = input.replace(/[Ⅰ-Ⅹ]/g, (char) => ROMAN_NUMERALS[char] ?? char);
  const normalized = numerals.normalize("NFKC").replace(/[\s・･·\-.'’=&]/g, "");
  return toHiragana(normalized.toLowerCase());
}

function toHiragana(input: string): string {
  let result = "";
  for (const char of input) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCodePoint(code - 0x60);
      continue;
    }
    result += char;
  }
  return result;
}
