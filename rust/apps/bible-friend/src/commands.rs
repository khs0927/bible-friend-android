use bf_core::growth::{
    self, EquipmentId, GrowthActivityType, GrowthMood, GrowthProfile, GrowthReward,
};
use bf_core::safety::{self, ScreenResult};
use bf_core::verses::{GrowthDailyVerse, GROWTH_DAILY_VERSES};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("{0}")]
    Rejected(String),
}

// Tauri commands must return a serializable error; send the message string.
impl Serialize for CommandError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: &'static str,
    platform: &'static str,
    core: &'static str,
}

#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION"),
        platform: std::env::consts::OS,
        core: "bf-core",
    }
}

#[tauri::command]
pub fn screen_child_input(text: String) -> ScreenResult {
    safety::screen_child_input(&text)
}

#[tauri::command]
pub fn sanitize_reply(reply: String) -> String {
    safety::sanitize_reply(&reply)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrowthView {
    profile: GrowthProfile,
    mood: GrowthMood,
    stage_label: &'static str,
}

impl From<GrowthProfile> for GrowthView {
    fn from(profile: GrowthProfile) -> Self {
        Self {
            mood: growth::mood_for_profile(&profile),
            stage_label: profile.stage.label(),
            profile,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityResult {
    #[serde(flatten)]
    view: GrowthView,
    reward: GrowthReward,
    message: &'static str,
}

#[tauri::command]
pub fn growth_initial() -> GrowthView {
    GrowthProfile::default().into()
}

/// Local preview of a reward. The server stays authoritative for persisted
/// growth (idempotency keys, anti-forgery); use this for instant UI feedback.
#[tauri::command]
pub fn growth_apply_activity(
    profile: GrowthProfile,
    activity: GrowthActivityType,
) -> ActivityResult {
    let reward = growth::activity_reward(activity);
    ActivityResult {
        view: growth::apply_reward(&profile, &reward).into(),
        reward,
        message: growth::activity_message(activity),
    }
}

#[tauri::command]
pub fn growth_apply_decay(profile: GrowthProfile, days_missed: i32) -> GrowthView {
    growth::apply_daily_decay(&profile, days_missed).into()
}

#[tauri::command]
pub fn growth_upgrade(
    profile: GrowthProfile,
    equipment: EquipmentId,
) -> Result<GrowthView, CommandError> {
    let check = growth::can_upgrade(&profile, equipment);
    if !check.ok {
        return Err(CommandError::Rejected(check.reason));
    }
    Ok(growth::upgrade_equipment(&profile, equipment).into())
}

#[tauri::command]
pub fn daily_verses() -> &'static [GrowthDailyVerse] {
    GROWTH_DAILY_VERSES
}
