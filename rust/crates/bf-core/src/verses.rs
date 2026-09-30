//! Daily memory verses. Mirrors `bible-friend-web/shared/growthVerses.ts`.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct GrowthDailyVerse {
    pub id: &'static str,
    #[serde(rename = "ref")]
    pub reference: &'static str,
    pub text: &'static str,
    pub theme: &'static str,
}

pub const GROWTH_DAILY_VERSES: &[GrowthDailyVerse] = &[
    GrowthDailyVerse {
        id: "john-3-16",
        reference: "요한복음 3:16",
        text: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니",
        theme: "사랑",
    },
    GrowthDailyVerse {
        id: "psalm-23-1",
        reference: "시편 23:1",
        text: "여호와는 나의 목자시니 내게 부족함이 없으리로다",
        theme: "돌보심",
    },
    GrowthDailyVerse {
        id: "phil-4-6",
        reference: "빌립보서 4:6",
        text: "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로",
        theme: "평안",
    },
    GrowthDailyVerse {
        id: "eph-6-16",
        reference: "에베소서 6:16",
        text: "모든 것 위에 믿음의 방패를 가지고",
        theme: "믿음",
    },
];

pub fn growth_daily_verse(id: &str) -> Option<&'static GrowthDailyVerse> {
    GROWTH_DAILY_VERSES.iter().find(|v| v.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_verse_and_serializes_ref_field() {
        let v = growth_daily_verse("psalm-23-1").unwrap();
        assert_eq!(serde_json::to_value(v).unwrap()["ref"], "시편 23:1");
        assert!(growth_daily_verse("nope").is_none());
    }
}
