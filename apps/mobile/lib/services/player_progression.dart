import 'dart:math';

const int playerProgressionMaxLevel = 1000;
const int playerProgressionCurveVersion = 1;

/// Mirrors the public deterministic XP curve owned by the API.
///
/// This function is presentation-only. The server remains authoritative for
/// XP grants, level changes, rewards, and persisted progression state.
int xpRequiredForNextLevel(int level) {
  if (level < 1 || level > playerProgressionMaxLevel) {
    throw RangeError.range(level, 1, playerProgressionMaxLevel, 'level');
  }
  if (level == playerProgressionMaxLevel) return 0;

  final offset = level - 1;
  return max(1, (100 + offset * 25 + offset * offset * 0.35).floor());
}

/// Returns a stable value from 0.0 to 1.0 for the current level progress bar.
double playerLevelProgress({required int level, required int xp}) {
  if (xp < 0) throw RangeError.value(xp, 'xp', 'must not be negative');

  final requiredXp = xpRequiredForNextLevel(level);
  if (requiredXp == 0) return 1;
  return (xp / requiredXp).clamp(0.0, 1.0).toDouble();
}
