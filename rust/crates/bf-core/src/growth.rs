//! Growth engine. Mirrors `bible-friend-web/shared/growthDomain.ts`; keep the
//! numbers identical so a profile computed here matches the server's.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrowthStage {
    Seedling,
    Disciple,
    Warrior,
    Servant,
    Crowned,
}

impl GrowthStage {
    pub fn label(self) -> &'static str {
        match self {
            Self::Seedling => "새싹 성경 친구",
            Self::Disciple => "쑥쑥 자라는 제자",
            Self::Warrior => "지혜로운 믿음 용사",
            Self::Servant => "사랑으로 섬기는 제자",
            Self::Crowned => "면류관을 향해 걷는 친구",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrowthMood {
    Joyful,
    Peaceful,
    Hungry,
    Resting,
    Brave,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrowthZone {
    Home,
    Road,
    Wilderness,
    Village,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrowthActivityType {
    ScriptureRead,
    VerseMemorized,
    BibleConversation,
    Prayer,
    ServiceMission,
    WildernessVictory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EquipmentId {
    BeltTruth,
    BreastplateRighteousness,
    ShoesPeace,
    ShieldFaith,
    HelmetSalvation,
    SwordSpirit,
    Crown,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct EquipmentTiers {
    pub belt_truth: u8,
    pub breastplate_righteousness: u8,
    pub shoes_peace: u8,
    pub shield_faith: u8,
    pub helmet_salvation: u8,
    pub sword_spirit: u8,
    pub crown: u8,
}

impl EquipmentTiers {
    pub fn get(&self, id: EquipmentId) -> u8 {
        *self.slot(id)
    }

    fn slot(&self, id: EquipmentId) -> &u8 {
        match id {
            EquipmentId::BeltTruth => &self.belt_truth,
            EquipmentId::BreastplateRighteousness => &self.breastplate_righteousness,
            EquipmentId::ShoesPeace => &self.shoes_peace,
            EquipmentId::ShieldFaith => &self.shield_faith,
            EquipmentId::HelmetSalvation => &self.helmet_salvation,
            EquipmentId::SwordSpirit => &self.sword_spirit,
            EquipmentId::Crown => &self.crown,
        }
    }

    fn slot_mut(&mut self, id: EquipmentId) -> &mut u8 {
        match id {
            EquipmentId::BeltTruth => &mut self.belt_truth,
            EquipmentId::BreastplateRighteousness => &mut self.breastplate_righteousness,
            EquipmentId::ShoesPeace => &mut self.shoes_peace,
            EquipmentId::ShieldFaith => &mut self.shield_faith,
            EquipmentId::HelmetSalvation => &mut self.helmet_salvation,
            EquipmentId::SwordSpirit => &mut self.sword_spirit,
            EquipmentId::Crown => &mut self.crown,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrowthProfile {
    pub stage: GrowthStage,
    pub spirit_food: i32,
    pub faith_xp: i32,
    pub wisdom_xp: i32,
    pub love_xp: i32,
    pub peace: i32,
    pub soul_points: i32,
    pub streak_days: i32,
    pub last_nourished_at: Option<String>,
    pub equipment_tiers: EquipmentTiers,
    pub equipped: Vec<EquipmentId>,
    pub unlocked_zones: Vec<GrowthZone>,
}

impl Default for GrowthProfile {
    fn default() -> Self {
        Self {
            stage: GrowthStage::Seedling,
            spirit_food: 65,
            faith_xp: 0,
            wisdom_xp: 0,
            love_xp: 0,
            peace: 80,
            soul_points: 0,
            streak_days: 0,
            last_nourished_at: None,
            equipment_tiers: EquipmentTiers::default(),
            equipped: Vec::new(),
            unlocked_zones: vec![GrowthZone::Home],
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrowthReward {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spirit_food: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub faith_xp: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wisdom_xp: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub love_xp: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub peace: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub soul_points: Option<i32>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub fill_spirit_food: bool,
}

pub fn activity_reward(activity: GrowthActivityType) -> GrowthReward {
    use GrowthActivityType::*;
    let r = GrowthReward::default();
    match activity {
        ScriptureRead => GrowthReward {
            spirit_food: Some(30),
            wisdom_xp: Some(10),
            faith_xp: Some(5),
            ..r
        },
        VerseMemorized => GrowthReward {
            fill_spirit_food: true,
            faith_xp: Some(25),
            wisdom_xp: Some(8),
            ..r
        },
        BibleConversation => GrowthReward {
            spirit_food: Some(5),
            wisdom_xp: Some(3),
            ..r
        },
        Prayer => GrowthReward {
            peace: Some(20),
            faith_xp: Some(3),
            ..r
        },
        ServiceMission => GrowthReward {
            love_xp: Some(15),
            soul_points: Some(10),
            faith_xp: Some(5),
            ..r
        },
        WildernessVictory => GrowthReward {
            faith_xp: Some(20),
            soul_points: Some(10),
            wisdom_xp: Some(5),
            ..r
        },
    }
}

pub fn activity_message(activity: GrowthActivityType) -> &'static str {
    use GrowthActivityType::*;
    match activity {
        ScriptureRead => "말씀 한 끼를 맛있게 먹었어요! 지혜와 믿음이 자라나요.",
        VerseMemorized => "말씀을 마음에 꼭 담았어요! 오늘 영혼의 식사가 든든하게 채워졌어요.",
        BibleConversation => "성경 친구와 말씀을 더 깊이 알아갔어요.",
        Prayer => "기도하며 마음에 평안이 차올랐어요.",
        ServiceMission => "사랑을 나누니 영혼 포인트와 사랑 경험이 자랐어요.",
        WildernessVictory => "두려움보다 말씀을 선택했어요. 믿음이 더 단단해졌어요!",
    }
}

fn clamp100(value: i32) -> i32 {
    value.clamp(0, 100)
}

pub fn calculate_stage(faith_xp: i32, wisdom_xp: i32, love_xp: i32) -> GrowthStage {
    match (faith_xp, wisdom_xp, love_xp) {
        (f, w, l) if f >= 900 && w >= 500 && l >= 350 => GrowthStage::Crowned,
        (f, w, l) if f >= 500 && w >= 260 && l >= 180 => GrowthStage::Servant,
        (f, w, l) if f >= 240 && w >= 120 && l >= 50 => GrowthStage::Warrior,
        (f, w, _) if f >= 80 && w >= 40 => GrowthStage::Disciple,
        _ => GrowthStage::Seedling,
    }
}

pub fn unlocked_zones_for_stage(stage: GrowthStage) -> Vec<GrowthZone> {
    use GrowthZone::*;
    match stage {
        GrowthStage::Crowned | GrowthStage::Servant => vec![Home, Road, Wilderness, Village],
        GrowthStage::Warrior => vec![Home, Road, Wilderness],
        GrowthStage::Disciple => vec![Home, Road],
        GrowthStage::Seedling => vec![Home],
    }
}

pub fn mood_for_profile(profile: &GrowthProfile) -> GrowthMood {
    if profile.spirit_food <= 0 {
        return GrowthMood::Resting;
    }
    if profile.spirit_food < 30 {
        return GrowthMood::Hungry;
    }
    if profile.peace >= 85 {
        return GrowthMood::Peaceful;
    }
    match profile.stage {
        GrowthStage::Warrior | GrowthStage::Servant | GrowthStage::Crowned => GrowthMood::Brave,
        _ => GrowthMood::Joyful,
    }
}

pub fn apply_reward(profile: &GrowthProfile, reward: &GrowthReward) -> GrowthProfile {
    let mut next = profile.clone();
    next.spirit_food = if reward.fill_spirit_food {
        100
    } else {
        clamp100(profile.spirit_food + reward.spirit_food.unwrap_or(0))
    };
    next.faith_xp = (profile.faith_xp + reward.faith_xp.unwrap_or(0)).max(0);
    next.wisdom_xp = (profile.wisdom_xp + reward.wisdom_xp.unwrap_or(0)).max(0);
    next.love_xp = (profile.love_xp + reward.love_xp.unwrap_or(0)).max(0);
    next.peace = clamp100(profile.peace + reward.peace.unwrap_or(0));
    next.soul_points = (profile.soul_points + reward.soul_points.unwrap_or(0)).max(0);
    next.stage = calculate_stage(next.faith_xp, next.wisdom_xp, next.love_xp);
    next.unlocked_zones = unlocked_zones_for_stage(next.stage);
    next
}

pub fn apply_daily_decay(profile: &GrowthProfile, days_missed: i32) -> GrowthProfile {
    if days_missed <= 0 {
        return profile.clone();
    }
    GrowthProfile {
        spirit_food: clamp100(profile.spirit_food - (days_missed * 20).min(60)),
        peace: clamp100(profile.peace - (days_missed * 5).min(20)),
        ..profile.clone()
    }
}

pub fn upgrade_cost(id: EquipmentId, current_tier: u8) -> i32 {
    let idx = usize::from(current_tier.saturating_add(1).min(5));
    if id == EquipmentId::Crown {
        [0, 120, 180, 260, 360, 500][idx]
    } else {
        [0, 20, 45, 80, 130, 200][idx]
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UpgradeCheck {
    pub ok: bool,
    pub reason: String,
    pub cost: i32,
}

pub fn can_upgrade(profile: &GrowthProfile, id: EquipmentId) -> UpgradeCheck {
    let tier = profile.equipment_tiers.get(id);
    if tier >= 5 {
        return UpgradeCheck {
            ok: false,
            reason: "이미 최고 단계예요.".into(),
            cost: 0,
        };
    }
    let cost = upgrade_cost(id, tier);
    if id == EquipmentId::Crown && profile.stage != GrowthStage::Crowned {
        return UpgradeCheck {
            ok: false,
            reason: "면류관은 오랜 말씀·믿음·사랑의 여정을 거친 뒤 열려요.".into(),
            cost,
        };
    }
    if profile.soul_points < cost {
        return UpgradeCheck {
            ok: false,
            reason: format!("영혼 포인트가 {} 더 필요해요.", cost - profile.soul_points),
            cost,
        };
    }
    UpgradeCheck {
        ok: true,
        reason: "업그레이드할 수 있어요!".into(),
        cost,
    }
}

pub fn upgrade_equipment(profile: &GrowthProfile, id: EquipmentId) -> GrowthProfile {
    let check = can_upgrade(profile, id);
    if !check.ok {
        return profile.clone();
    }
    let mut next = profile.clone();
    next.soul_points -= check.cost;
    let slot = next.equipment_tiers.slot_mut(id);
    *slot = (*slot + 1).min(5);
    if !next.equipped.contains(&id) {
        next.equipped.push(id);
    }
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_profile_matches_web_defaults() {
        let json = serde_json::to_value(GrowthProfile::default()).unwrap();
        assert_eq!(json["stage"], "seedling");
        assert_eq!(json["spiritFood"], 65);
        assert_eq!(json["peace"], 80);
        assert_eq!(json["equipmentTiers"]["belt_truth"], 0);
        assert_eq!(json["unlockedZones"], serde_json::json!(["home"]));
    }

    #[test]
    fn memorizing_fills_food_and_promotes_stage() {
        let mut p = GrowthProfile {
            faith_xp: 60,
            wisdom_xp: 35,
            spirit_food: 10,
            ..Default::default()
        };
        p = apply_reward(&p, &activity_reward(GrowthActivityType::VerseMemorized));
        assert_eq!(p.spirit_food, 100);
        assert_eq!(p.stage, GrowthStage::Disciple);
        assert_eq!(p.unlocked_zones, vec![GrowthZone::Home, GrowthZone::Road]);
    }

    #[test]
    fn rewards_clamp_food_and_peace() {
        let p = GrowthProfile {
            spirit_food: 90,
            peace: 95,
            ..Default::default()
        };
        let p = apply_reward(
            &p,
            &GrowthReward {
                spirit_food: Some(30),
                peace: Some(20),
                ..Default::default()
            },
        );
        assert_eq!((p.spirit_food, p.peace), (100, 100));
    }

    #[test]
    fn decay_is_capped() {
        let p = apply_daily_decay(
            &GrowthProfile {
                spirit_food: 100,
                peace: 100,
                ..Default::default()
            },
            10,
        );
        assert_eq!((p.spirit_food, p.peace), (40, 80));
        assert_eq!(apply_daily_decay(&p, 0), p);
    }

    #[test]
    fn mood_follows_food_then_peace_then_stage() {
        let base = GrowthProfile {
            peace: 50,
            ..Default::default()
        };
        assert_eq!(
            mood_for_profile(&GrowthProfile {
                spirit_food: 0,
                ..base.clone()
            }),
            GrowthMood::Resting
        );
        assert_eq!(
            mood_for_profile(&GrowthProfile {
                spirit_food: 29,
                ..base.clone()
            }),
            GrowthMood::Hungry
        );
        assert_eq!(
            mood_for_profile(&GrowthProfile {
                peace: 85,
                ..base.clone()
            }),
            GrowthMood::Peaceful
        );
        assert_eq!(
            mood_for_profile(&GrowthProfile {
                stage: GrowthStage::Warrior,
                ..base.clone()
            }),
            GrowthMood::Brave
        );
        assert_eq!(mood_for_profile(&base), GrowthMood::Joyful);
    }

    #[test]
    fn upgrade_spends_points_and_equips_once() {
        let p = GrowthProfile {
            soul_points: 100,
            ..Default::default()
        };
        let p = upgrade_equipment(&p, EquipmentId::ShieldFaith);
        assert_eq!(p.soul_points, 80);
        let p = upgrade_equipment(&p, EquipmentId::ShieldFaith);
        assert_eq!(p.soul_points, 35);
        assert_eq!(p.equipment_tiers.shield_faith, 2);
        assert_eq!(p.equipped, vec![EquipmentId::ShieldFaith]);
    }

    #[test]
    fn crown_requires_crowned_stage_and_max_tier_blocks() {
        let p = GrowthProfile {
            soul_points: 1000,
            ..Default::default()
        };
        assert!(!can_upgrade(&p, EquipmentId::Crown).ok);
        assert_eq!(can_upgrade(&p, EquipmentId::Crown).cost, 120);
        let mut maxed = p.clone();
        maxed.equipment_tiers.belt_truth = 5;
        assert_eq!(
            can_upgrade(&maxed, EquipmentId::BeltTruth),
            UpgradeCheck {
                ok: false,
                reason: "이미 최고 단계예요.".into(),
                cost: 0
            }
        );
        let poor = GrowthProfile::default();
        assert_eq!(
            can_upgrade(&poor, EquipmentId::BeltTruth).reason,
            "영혼 포인트가 20 더 필요해요."
        );
    }

    #[test]
    fn deserializes_web_profile_json() {
        let json = r#"{"stage":"warrior","spiritFood":50,"faithXp":300,"wisdomXp":130,"loveXp":60,"peace":70,
            "soulPoints":12,"streakDays":3,"lastNourishedAt":null,
            "equipmentTiers":{"belt_truth":1,"breastplate_righteousness":0,"shoes_peace":0,"shield_faith":2,"helmet_salvation":0,"sword_spirit":0,"crown":0},
            "equipped":["belt_truth","shield_faith"],"unlockedZones":["home","road","wilderness"]}"#;
        let p: GrowthProfile = serde_json::from_str(json).unwrap();
        assert_eq!(p.stage, GrowthStage::Warrior);
        assert_eq!(p.equipment_tiers.get(EquipmentId::ShieldFaith), 2);
        assert_eq!(mood_for_profile(&p), GrowthMood::Brave);
    }
}
