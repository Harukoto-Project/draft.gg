//! TS 版と同じ文字列・丸め・並びにそろえる小さな関数。
//! JS の `Math.round` / `toFixed` / `localeCompare` と、Rust の標準の挙動は同点・端数の扱いが違うため、ここで合わせる。

use std::cmp::Ordering;

/// JS の `Math.round`。端数がちょうど .5 のときは、正負にかかわらず大きいほうへ丸める
pub fn js_round(value: f64) -> f64 {
    let floor = value.floor();
    // value - floor は誤差なく求まるので、ちょうど 0.5 の判定も正確
    if value - floor >= 0.5 {
        floor + 1.0
    } else {
        floor
    }
}

/// 0〜1 に切り詰める
pub fn clamp01(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

/// 小数第 4 位に丸める(スコアの出力用)
pub fn round4(value: f64) -> f64 {
    js_round(value * 10_000.0) / 10_000.0
}

/// JS の `Number.prototype.toFixed(1)`。ちょうど真ん中の値(12.25 など)は大きいほうへ丸める
pub fn to_fixed_1(value: f64) -> String {
    if !value.is_finite() {
        return value.to_string();
    }
    let (sign, magnitude) = if value < 0.0 {
        ("-", -value)
    } else {
        ("", value)
    };
    // 浮動小数の正確な十進展開。小数第 2 位が 5 以上なら、真ん中ちょうども含めて繰り上げる
    let exact = format!("{magnitude:.60}");
    let (integer, fraction) = exact.split_once('.').unwrap_or((exact.as_str(), ""));
    let first = fraction.as_bytes().first().copied().unwrap_or(b'0');
    let second = fraction.as_bytes().get(1).copied().unwrap_or(b'0');

    let mut tenths: u128 = format!("{integer}{}", first as char)
        .parse()
        .expect("数字だけの文字列");
    if second >= b'5' {
        tenths += 1;
    }
    format!("{sign}{}.{}", tenths / 10, tenths % 10)
}

/// 率(0〜1)を `55.0%` の形にする
pub fn format_rate(rate: f64) -> String {
    format!("{}%", to_fixed_1(rate * 100.0))
}

/// 試合数を 3 桁区切りの整数にする
pub fn format_games(games: f64) -> String {
    let rounded = js_round(games);
    let digits = format!("{}", rounded.abs() as u128);
    let mut grouped = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(digit);
    }
    if rounded < 0.0 {
        format!("-{grouped}")
    } else {
        grouped
    }
}

/// 日本語の理由に出す数値(ティアなど)。整数なら小数点なし
pub fn format_number(value: f64) -> String {
    format!("{value}")
}

/// チャンピオン ID の並び。JS の `localeCompare`(ICU)のうち、英数字だけの ID で効く部分を再現する:
/// 大文字・小文字を区別せず辞書順、同じなら小文字を先にする。
pub fn compare_ids(a: &str, b: &str) -> Ordering {
    let folded = a
        .bytes()
        .map(|byte| byte.to_ascii_lowercase())
        .cmp(b.bytes().map(|byte| byte.to_ascii_lowercase()));
    if folded != Ordering::Equal {
        return folded;
    }
    // 大文字小文字だけが違う。最初に違う文字で、小文字のほうを先にする
    for (left, right) in a.bytes().zip(b.bytes()) {
        if left != right {
            return if left.is_ascii_lowercase() {
                Ordering::Less
            } else {
                Ordering::Greater
            };
        }
    }
    Ordering::Equal
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_round_は端数がちょうど半分なら大きいほうへ丸める() {
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(0.5), 1.0);
        assert_eq!(js_round(-2.5), -2.0);
        assert_eq!(js_round(2.4), 2.0);
        assert_eq!(js_round(0.499_999_999_999_999_94), 0.0);
    }

    #[test]
    fn clamp01_は範囲に切り詰める() {
        assert_eq!(clamp01(-0.2), 0.0);
        assert_eq!(clamp01(0.4), 0.4);
        assert_eq!(clamp01(1.7), 1.0);
    }

    #[test]
    fn round4_は小数第4位に丸める() {
        assert_eq!(round4(0.989_849_9), 0.9898);
        assert_eq!(round4(0.214_06), 0.2141);
        assert_eq!(round4(0.214_04), 0.2140);
        assert_eq!(round4(1.0), 1.0);
    }

    #[test]
    fn to_fixed_1_は_js_と同じく真ん中の値を大きいほうへ丸める() {
        assert_eq!(to_fixed_1(55.0), "55.0");
        assert_eq!(to_fixed_1(12.25), "12.3"); // Rust の {:.1} は 12.2
        assert_eq!(to_fixed_1(6.25), "6.3");
        assert_eq!(to_fixed_1(0.25), "0.3");
        assert_eq!(to_fixed_1(87.75), "87.8");
        assert_eq!(to_fixed_1(12.24), "12.2");
        assert_eq!(to_fixed_1(99.96), "100.0");
        assert_eq!(to_fixed_1(0.0), "0.0");
        assert_eq!(to_fixed_1(-0.04), "-0.0");
    }

    #[test]
    fn format_rate_は百分率にする() {
        assert_eq!(format_rate(0.55), "55.0%");
        assert_eq!(format_rate(0.6), "60.0%");
        assert_eq!(format_rate(0.0625), "6.3%");
        assert_eq!(format_rate(1.0), "100.0%");
    }

    #[test]
    fn format_games_は三桁区切りにする() {
        assert_eq!(format_games(10_000.0), "10,000");
        assert_eq!(format_games(1_000.0), "1,000");
        assert_eq!(format_games(999.0), "999");
        assert_eq!(format_games(1_234_567.0), "1,234,567");
        assert_eq!(format_games(0.0), "0");
        assert_eq!(format_games(1_000.5), "1,001");
        assert_eq!(format_games(-1_234.0), "-1,234");
    }

    #[test]
    fn format_number_は整数なら小数点を付けない() {
        assert_eq!(format_number(3.0), "3");
        assert_eq!(format_number(1.5), "1.5");
    }

    #[test]
    fn compare_ids_は大文字小文字を区別せず辞書順にする() {
        assert_eq!(compare_ids("Kaisa", "KSante"), Ordering::Less);
        assert_eq!(compare_ids("Kalista", "KSante"), Ordering::Less);
        assert_eq!(compare_ids("KSante", "Kayn"), Ordering::Greater);
        assert_eq!(compare_ids("Vi", "Viego"), Ordering::Less);
        assert_eq!(compare_ids("Ahri", "Akali"), Ordering::Less);
        assert_eq!(compare_ids("Ahri", "Ahri"), Ordering::Equal);
    }

    #[test]
    fn compare_ids_は文字を除いて同じなら小文字を先にする() {
        assert_eq!(compare_ids("aB", "AB"), Ordering::Less);
        assert_eq!(compare_ids("Ab", "AB"), Ordering::Less);
        assert_eq!(compare_ids("AB", "Ab"), Ordering::Greater);
    }

    #[test]
    fn compare_ids_は数字を文字より先にする() {
        assert_eq!(compare_ids("Zed1", "Zeda"), Ordering::Less);
    }
}
