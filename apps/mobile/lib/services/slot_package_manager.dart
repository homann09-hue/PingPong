import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/game_definition.dart';

/// Lifecycle of a slot's locally prepared visual content package.
enum SlotPackageState { available, preparing, ready, failed }

/// Persists installed package versions independently from the UI lifecycle.
abstract interface class SlotPackagePersistence {
  Future<Map<String, int>> readVersions();
  Future<void> writeVersions(Map<String, int> versions);
}

/// Stores installed package versions in the platform's secure storage.
class SecureSlotPackagePersistence implements SlotPackagePersistence {
  SecureSlotPackagePersistence([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'aurora.slot-packages.v1';
  final FlutterSecureStorage _storage;

  @override
  Future<Map<String, int>> readVersions() async {
    final encoded = await _storage.read(key: _key);
    if (encoded == null) return {};
    final value = jsonDecode(encoded);
    if (value is! Map<String, dynamic>) return {};
    return value.map((key, version) => MapEntry(key, (version as num).toInt()));
  }

  @override
  Future<void> writeVersions(Map<String, int> versions) =>
      _storage.write(key: _key, value: jsonEncode(versions));
}

/// Loads and decodes the actual cover/symbol asset bundle before a slot opens.
class SlotPackageManager extends ChangeNotifier {
  SlotPackageManager({SlotPackagePersistence? persistence})
    : _persistence = persistence ?? SecureSlotPackagePersistence();

  final SlotPackagePersistence _persistence;
  final Map<String, int> _installedVersions = {};
  final Map<String, double> _progress = {};
  final Set<String> _failed = {};
  bool _initialized = false;

  bool get initialized => _initialized;
  double progressFor(GameDefinition game) => _progress[game.id] ?? 0;

  SlotPackageState stateFor(GameDefinition game) {
    if (_progress.containsKey(game.id)) return SlotPackageState.preparing;
    if (_failed.contains(game.id)) return SlotPackageState.failed;
    if (game.bundled || _installedVersions[game.id] == game.packageVersion) {
      return SlotPackageState.ready;
    }
    return SlotPackageState.available;
  }

  Future<void> initialize(Iterable<GameDefinition> catalog) async {
    try {
      _installedVersions.addAll(await _persistence.readVersions());
    } on Object {
      // Content remains usable; only the cached ready marker is unavailable.
    }
    for (final game in catalog.where((game) => game.bundled)) {
      _installedVersions[game.id] = game.packageVersion;
    }
    _initialized = true;
    notifyListeners();
  }

  Future<bool> prepare(BuildContext context, GameDefinition game) async {
    if (stateFor(game) == SlotPackageState.ready) return true;
    if (stateFor(game) == SlotPackageState.preparing) return false;
    _failed.remove(game.id);
    _progress[game.id] = 0;
    notifyListeners();
    try {
      final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      final assets = manifest
          .listAssets()
          .where(
            (asset) =>
                asset == game.asset ||
                asset.startsWith('assets/symbols/${game.symbolSet}/'),
          )
          .toList(growable: false);
      if (assets.isEmpty) throw StateError('Slot package contains no assets');
      for (var index = 0; index < assets.length; index++) {
        if (!context.mounted) return false;
        await precacheImage(AssetImage(assets[index]), context);
        _progress[game.id] = (index + 1) / assets.length;
        notifyListeners();
      }
      _installedVersions[game.id] = game.packageVersion;
      try {
        await _persistence.writeVersions(_installedVersions);
      } on Object {
        // Decoded assets are still ready for this session.
      }
      return true;
    } on Object {
      _failed.add(game.id);
      return false;
    } finally {
      _progress.remove(game.id);
      notifyListeners();
    }
  }
}
