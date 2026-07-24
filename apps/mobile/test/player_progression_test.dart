import 'package:flutter_test/flutter_test.dart';
import 'package:aurora_mobile/services/player_progression.dart';

void main() {
  group('player progression curve v1', () {
    test('matches the API curve at representative levels', () {
      expect(playerProgressionCurveVersion, 1);
      expect(xpRequiredForNextLevel(1), 100);
      expect(xpRequiredForNextLevel(2), 125);
      expect(xpRequiredForNextLevel(12), 417);
      expect(xpRequiredForNextLevel(playerProgressionMaxLevel), 0);
    });

    test('calculates and clamps current-level progress', () {
      expect(playerLevelProgress(level: 1, xp: 25), 0.25);
      expect(playerLevelProgress(level: 12, xp: 260), closeTo(260 / 417, 0.000001));
      expect(playerLevelProgress(level: 12, xp: 9999), 1);
      expect(playerLevelProgress(level: playerProgressionMaxLevel, xp: 0), 1);
    });

    test('rejects invalid level and XP input', () {
      expect(() => xpRequiredForNextLevel(0), throwsRangeError);
      expect(() => xpRequiredForNextLevel(1001), throwsRangeError);
      expect(() => playerLevelProgress(level: 1, xp: -1), throwsRangeError);
    });
  });
}
