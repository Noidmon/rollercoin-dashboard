// Mapeia image_path (caminho relativo, ex: "rollercoin/items/bonus_power_3.webp")
// para o caminho LOCAL em public/rc-icons/, depois de sincronizado.
// Preenchido manualmente via scripts/sync-rc-icons.js sempre que novos ícones aparecem.
// Reusar esse MESMO padrão (manifesto + script de sync) quando formos baixar
// os +8000 mineradores no futuro -- não usar R2 pra isso, só public/ como aqui.

export const ASSET_MANIFEST: Record<string, string> = {
  "rollercoin/events/progression-event/bronze-iii-progression/bronze-iii-progression_image.webp": "/rc-icons/bronze-iii-progression_image.webp",
  "rollercoin/events/progression-event/road-to-five-stars/road-to-five-stars_event.webp": "/rc-icons/road-to-five-stars_event.webp",
  "rollercoin/events/progression-event/road-to-five-stars/road-to-five-stars_image.webp": "/rc-icons/road-to-five-stars_image.webp",
  "rollercoin/icons/sellable_disabled.webp": "/rc-icons/sellable_disabled.webp",
  "rollercoin/items/12h_booster.gif": "/rc-icons/12h_booster.gif",
  "rollercoin/items/3h_booster.gif": "/rc-icons/3h_booster.gif",
  "rollercoin/items/ancient_key.webp": "/rc-icons/ancient_key.webp",
  "rollercoin/items/bad_luck_chest.webp": "/rc-icons/bad_luck_chest.webp",
  "rollercoin/items/battery.webp": "/rc-icons/battery.webp",
  "rollercoin/items/bonus_power_3.webp": "/rc-icons/bonus_power_3.webp",
  "rollercoin/items/captain_chest.webp": "/rc-icons/captain_chest.webp",
  "rollercoin/items/forbidden_key.webp": "/rc-icons/forbidden_key.webp",
  "rollercoin/items/lucky_keybox.webp": "/rc-icons/lucky_keybox.webp",
  "rollercoin/items/mega_parts_case.webp": "/rc-icons/mega_parts_case.webp",
  "rollercoin/items/rst_2.webp": "/rc-icons/rst_2.webp",
  "rollercoin/items/ships_boy_chest.webp": "/rc-icons/ships_boy_chest.webp",
  "rollercoin/items/speedup.gif": "/rc-icons/speedup.gif",
  "rollercoin/levels/level_1.webp": "/rc-icons/level_1.webp",
  "rollercoin/levels/level_2.webp": "/rc-icons/level_2.webp",
  "rollercoin/levels/level_3.webp": "/rc-icons/level_3.webp",
  "rollercoin/levels/level_4.webp": "/rc-icons/level_4.webp",
  "rollercoin/levels/level_5.webp": "/rc-icons/level_5.webp",
  "rollercoin/levels/level_6.webp": "/rc-icons/level_6.webp",
  "rollercoin/parts/fan_common.webp": "/rc-icons/fan_common.webp",
  "rollercoin/racks/jet_black_rack_6.webp": "/rc-icons/jet_black_rack_6.webp",
}
