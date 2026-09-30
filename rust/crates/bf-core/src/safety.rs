//! Child-safety screening. Mirrors `packages/core/src/safety.ts`; the Edge
//! Functions remain the enforcement point, this copy lets the shell pre-screen
//! input and sanitize replies with identical rules.

use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;
use unicode_normalization::UnicodeNormalization;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SafetyCategory {
    Ok,
    PersonalInfo,
    SelfHarm,
    Abuse,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenResult {
    pub category: SafetyCategory,
    /// A canned, pre-approved reply. When present the model must not be called.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canned_reply: Option<&'static str>,
}

pub const SAFE_REPLY_PERSONAL_INFO: &str = "알려줘서 고마워! 그런데 전화번호나 주소, 학교 같은 소중한 개인 정보는 성경 친구에게도 말하지 않는 게 안전해. 그 대신 오늘 궁금한 성경 이야기를 들려줄래? 😊";
pub const SAFE_REPLY_SELF_HARM: &str = "지금 마음이 많이 힘들구나. 그렇게 느끼는 너는 정말 소중한 사람이야. 이 이야기는 꼭 엄마, 아빠나 믿을 수 있는 어른에게 지금 바로 말해 주면 좋겠어. 어른에게 말하기 어렵다면 청소년상담전화 1388에 전화할 수 있어. 하나님은 힘든 마음을 가진 너를 꼭 안아 주셔. 💛";
pub const SAFE_REPLY_ABUSE: &str = "그런 일이 있었다면 너의 잘못이 아니야. 꼭 믿을 수 있는 어른(부모님, 선생님)에게 말해 줘. 위험하다고 느껴지면 112나 아동보호 상담 1391에 도움을 요청할 수 있어. 하나님은 언제나 너를 지켜 주고 싶어 하셔. 💛";

fn re(pattern: &str) -> Regex {
    Regex::new(pattern).expect("static safety regex")
}

static PERSONAL_INFO: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        re(r"01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}"), // mobile numbers
        re(r"\d{6}[-\s]?[1-4]\d{6}"),                // resident registration numbers
        re(r"[\w.+-]+@[\w-]+\.[\w.]+"),              // e-mail addresses
        re(r"\d+\s*동\s*\d+\s*호"),                  // apartment unit
    ]
});
static SELF_HARM: LazyLock<Regex> =
    LazyLock::new(|| re(r"죽고\s*싶|자살|자해|사라지고\s*싶|살기\s*싫|없어지고\s*싶"));
static ABUSE: LazyLock<Regex> =
    LazyLock::new(|| re(r"때려|때리|맞았|맞아|학대|괴롭혀|괴롭힘|만지지\s*말|비밀로\s*하라"));
static ABUSE_ACTOR: LazyLock<Regex> =
    LazyLock::new(|| re(r"누가|아빠|엄마|선생님|형|오빠|언니|누나|어른|친구"));

pub fn screen_child_input(text: &str) -> ScreenResult {
    let normalized: String = text.nfc().collect();
    let hit = |category, reply| ScreenResult {
        category,
        canned_reply: Some(reply),
    };
    if SELF_HARM.is_match(&normalized) {
        return hit(SafetyCategory::SelfHarm, SAFE_REPLY_SELF_HARM);
    }
    if ABUSE.is_match(&normalized) && ABUSE_ACTOR.is_match(&normalized) {
        return hit(SafetyCategory::Abuse, SAFE_REPLY_ABUSE);
    }
    if PERSONAL_INFO.iter().any(|r| r.is_match(&normalized)) {
        return hit(SafetyCategory::PersonalInfo, SAFE_REPLY_PERSONAL_INFO);
    }
    ScreenResult {
        category: SafetyCategory::Ok,
        canned_reply: None,
    }
}

const MAX_REPLY_CHARS: usize = 700;

static LINK: LazyLock<Regex> = LazyLock::new(|| re(r"https?://\S+"));
static BOLD: LazyLock<Regex> = LazyLock::new(|| re(r"\*\*(.+?)\*\*"));
static HEADING: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^#+\s*"));
static BLANK_RUN: LazyLock<Regex> = LazyLock::new(|| re(r"\n{3,}"));

/// Strips links/markdown noise and bounds the length of a model reply.
pub fn sanitize_reply(reply: &str) -> String {
    let text = LINK.replace_all(reply, "");
    let text = BOLD.replace_all(&text, "$1");
    let text = HEADING.replace_all(&text, "");
    let text = BLANK_RUN.replace_all(&text, "\n\n");
    let text = text.trim();

    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= MAX_REPLY_CHARS {
        return text.to_string();
    }
    let cut = &chars[..MAX_REPLY_CHARS];
    let last_stop = cut
        .iter()
        .rposition(|c| matches!(c, '.' | '!' | '?' | '요'));
    match last_stop {
        Some(i) if i > MAX_REPLY_CHARS / 2 => cut[..=i].iter().collect(),
        _ => cut.iter().collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn screens_categories_in_priority_order() {
        assert_eq!(
            screen_child_input("요즘 죽고 싶어").category,
            SafetyCategory::SelfHarm
        );
        assert_eq!(
            screen_child_input("아빠가 때려요").category,
            SafetyCategory::Abuse
        );
        assert_eq!(
            screen_child_input("공을 때려요").category,
            SafetyCategory::Ok
        );
        assert_eq!(
            screen_child_input("내 번호는 010-1234-5678").category,
            SafetyCategory::PersonalInfo
        );
        assert_eq!(
            screen_child_input("우리집 101동 202호").category,
            SafetyCategory::PersonalInfo
        );
        let ok = screen_child_input("다윗은 왜 용감했어?");
        assert_eq!(
            ok,
            ScreenResult {
                category: SafetyCategory::Ok,
                canned_reply: None
            }
        );
    }

    #[test]
    fn sanitizes_links_and_markdown() {
        let out =
            sanitize_reply("## 제목\n**다윗**은 용감했어요.\n\n\n\n보기: https://example.com 끝");
        assert_eq!(out, "제목\n다윗은 용감했어요.\n\n보기:  끝");
    }

    #[test]
    fn truncates_at_sentence_boundary() {
        let long = "가나다라마바사아자.".repeat(100);
        let out = sanitize_reply(&long);
        assert!(out.chars().count() <= MAX_REPLY_CHARS);
        assert!(out.ends_with('.'));
    }
}
