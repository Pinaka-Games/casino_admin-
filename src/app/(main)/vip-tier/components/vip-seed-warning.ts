// Both VIP pages send `force=true`, which VipSeederService.seed on the backend
// uses to overwrite every default tier — keep this text in step with it.
export const VIP_FORCE_SEED_WARNING = {
  title: "Run force seed?",
  description:
    "This resets every default VIP tier to its seed values. Changes made from the admin panel will be overwritten:",
  effects: [
    "XP required and badge",
    "VIP benefits and tier rewards (cashback, bonuses, VIP spins)",
    "Inactive default tiers are switched back on",
    "Old level 1 / 2 tier rows are deleted and their players moved to the matching tier",
  ],
  note: "This cannot be undone. Players' XP is not changed, but if XP thresholds change their tier can move on their next XP gain.",
  destructive: true,
  confirmLabel: "Run Seed (Force)",
};
