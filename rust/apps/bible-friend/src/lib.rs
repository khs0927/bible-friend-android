//! Tauri shell. The UI is the bible-friend-web React client; Rust owns the
//! domain logic (`bf-core`) and anything native, exposed as IPC commands the
//! web client can call via `window.__TAURI__.core.invoke`.

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::screen_child_input,
            commands::sanitize_reply,
            commands::growth_initial,
            commands::growth_apply_activity,
            commands::growth_apply_decay,
            commands::growth_upgrade,
            commands::daily_verses,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Bible Friend");
}
