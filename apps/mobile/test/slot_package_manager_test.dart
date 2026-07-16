import 'package:aurora_mobile/models/game_definition.dart';
import 'package:aurora_mobile/services/slot_package_manager.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('slot packages honor bundled, current and stale versions', () async {
    final manager = SlotPackageManager(
      persistence: _SlotPackagePersistence({'pirate-bay': 2, 'neon-nights': 1}),
    );
    await manager.initialize(games);

    expect(manager.stateFor(games[0]), SlotPackageState.ready);
    expect(manager.stateFor(games[3]), SlotPackageState.ready);
    expect(manager.stateFor(games[4]), SlotPackageState.available);
    manager.dispose();
  });
}

class _SlotPackagePersistence implements SlotPackagePersistence {
  _SlotPackagePersistence(this.versions);

  final Map<String, int> versions;

  @override
  Future<Map<String, int>> readVersions() async => Map.of(versions);

  @override
  Future<void> writeVersions(Map<String, int> versions) async {
    this.versions
      ..clear()
      ..addAll(versions);
  }
}
