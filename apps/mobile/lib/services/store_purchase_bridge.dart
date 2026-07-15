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

/// Port implemented by the production StoreKit/Play Billing adapter.
abstract interface class StorePurchaseBridge {
  bool get available;
  Future<List<StoreProductDetails>> loadProducts(List<String> productIds);
  Future<StorePurchaseProof> purchase(String productId);
}

/// Safe default for web, tests, and native builds without a configured store adapter.
class UnavailableStorePurchaseBridge implements StorePurchaseBridge {
  const UnavailableStorePurchaseBridge();
  @override
  bool get available => false;
  @override
  Future<List<StoreProductDetails>> loadProducts(
    List<String> productIds,
  ) async => const [];
  @override
  Future<StorePurchaseProof> purchase(String productId) =>
      Future.error(StateError('Platform store is not configured'));
}
