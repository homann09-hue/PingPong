enum StorePurchaseStatus { pending, purchased, restored, canceled, error }

/// Localized product metadata supplied by StoreKit or Google Play Billing.
class StoreProductDetails {
  const StoreProductDetails({
    required this.productId,
    required this.localizedPrice,
  });
  final String productId;
  final String localizedPrice;
}

/// Opaque provider proof passed to the authoritative API and never persisted locally.
class StorePurchaseProof {
  const StorePurchaseProof({
    required this.platform,
    required this.productId,
    required this.transactionId,
    required this.verificationToken,
  });
  final String platform, productId, transactionId, verificationToken;
}

class StorePurchaseUpdate {
  const StorePurchaseUpdate({
    required this.productId,
    required this.status,
    this.proof,
    this.errorCode,
  });
  final String productId;
  final StorePurchaseStatus status;
  final StorePurchaseProof? proof;
  final String? errorCode;
}

/// Port implemented by the production StoreKit/Play Billing adapter.
abstract interface class StorePurchaseBridge {
  String? get platform;
  bool get available;
  Stream<StorePurchaseUpdate> get updates;
  Future<void> initialize();
  Future<List<StoreProductDetails>> loadProducts(List<String> productIds);
  Future<void> purchase(
    String productId, {
    required String accountId,
    required bool consumable,
  });
  Future<void> restore({required String accountId});
  Future<void> complete(StorePurchaseProof proof);
  Future<void> dispose();
}

/// Safe default for web, tests, and unsupported native targets.
class UnavailableStorePurchaseBridge implements StorePurchaseBridge {
  const UnavailableStorePurchaseBridge();
  @override
  String? get platform => null;
  @override
  bool get available => false;
  @override
  Stream<StorePurchaseUpdate> get updates => const Stream.empty();
  @override
  Future<void> initialize() async {}
  @override
  Future<List<StoreProductDetails>> loadProducts(
    List<String> productIds,
  ) async => const [];
  @override
  Future<void> purchase(
    String productId, {
    required String accountId,
    required bool consumable,
  }) => Future.error(StateError('Platform store is not configured'));
  @override
  Future<void> restore({required String accountId}) async {}
  @override
  Future<void> complete(StorePurchaseProof proof) async {}
  @override
  Future<void> dispose() async {}
}
