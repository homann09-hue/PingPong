import 'dart:async';
import 'dart:io';

import 'package:in_app_purchase/in_app_purchase.dart';

import 'store_purchase_bridge.dart';

StorePurchaseBridge createStorePurchaseBridge() {
  if (!Platform.isIOS && !Platform.isAndroid) {
    return const UnavailableStorePurchaseBridge();
  }
  return NativeStorePurchaseBridge(
    PluginStoreClient(InAppPurchase.instance),
    Platform.isIOS ? 'ios' : 'android',
  );
}

abstract interface class NativeStoreClient {
  Stream<List<PurchaseDetails>> get purchaseStream;
  Future<bool> isAvailable();
  Future<ProductDetailsResponse> queryProductDetails(Set<String> identifiers);
  Future<bool> buyConsumable({
    required PurchaseParam purchaseParam,
    required bool autoConsume,
  });
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam});
  Future<void> completePurchase(PurchaseDetails purchase);
  Future<void> restorePurchases({required String applicationUserName});
}

class PluginStoreClient implements NativeStoreClient {
  const PluginStoreClient(this._store);
  final InAppPurchase _store;
  @override
  Stream<List<PurchaseDetails>> get purchaseStream => _store.purchaseStream;
  @override
  Future<bool> isAvailable() => _store.isAvailable();
  @override
  Future<ProductDetailsResponse> queryProductDetails(Set<String> identifiers) =>
      _store.queryProductDetails(identifiers);
  @override
  Future<bool> buyConsumable({
    required PurchaseParam purchaseParam,
    required bool autoConsume,
  }) => _store.buyConsumable(
    purchaseParam: purchaseParam,
    autoConsume: autoConsume,
  );
  @override
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam}) =>
      _store.buyNonConsumable(purchaseParam: purchaseParam);
  @override
  Future<void> completePurchase(PurchaseDetails purchase) =>
      _store.completePurchase(purchase);
  @override
  Future<void> restorePurchases({required String applicationUserName}) =>
      _store.restorePurchases(applicationUserName: applicationUserName);
}

class NativeStorePurchaseBridge implements StorePurchaseBridge {
  NativeStorePurchaseBridge(this._store, this.platform);

  final NativeStoreClient _store;
  @override
  final String platform;
  final _controller = StreamController<StorePurchaseUpdate>.broadcast();
  final _products = <String, ProductDetails>{};
  final _purchases = <String, PurchaseDetails>{};
  StreamSubscription<List<PurchaseDetails>>? _subscription;
  bool _available = false;
  bool _disposed = false;

  @override
  bool get available => _available;
  @override
  Stream<StorePurchaseUpdate> get updates => _controller.stream;

  @override
  Future<void> initialize() async {
    if (_disposed) throw StateError('Store bridge is disposed');
    _subscription ??= _store.purchaseStream.listen(
      _handlePurchases,
      onError: (Object error) {
        if (!_controller.isClosed) {
          _controller.add(
            const StorePurchaseUpdate(
              productId: '',
              status: StorePurchaseStatus.error,
              errorCode: 'PURCHASE_STREAM_ERROR',
            ),
          );
        }
      },
    );
    _available = await _store.isAvailable();
  }

  @override
  Future<List<StoreProductDetails>> loadProducts(
    List<String> productIds,
  ) async {
    if (!_available) return const [];
    final response = await _store.queryProductDetails(productIds.toSet());
    if (response.error != null) {
      throw StateError('Store catalog unavailable: ${response.error!.code}');
    }
    _products
      ..clear()
      ..addEntries(
        response.productDetails.map((product) => MapEntry(product.id, product)),
      );
    return response.productDetails
        .map(
          (product) => StoreProductDetails(
            productId: product.id,
            localizedPrice: product.price,
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<void> purchase(
    String productId, {
    required String accountId,
    required bool consumable,
  }) async {
    if (!_available) throw StateError('Platform store is unavailable');
    final product = _products[productId];
    if (product == null) {
      throw StateError('Product is not available in the platform store');
    }
    final parameter = PurchaseParam(
      productDetails: product,
      applicationUserName: accountId,
    );
    final launched = consumable
        ? await _store.buyConsumable(
            purchaseParam: parameter,
            autoConsume: false,
          )
        : await _store.buyNonConsumable(purchaseParam: parameter);
    if (!launched) throw StateError('Platform purchase sheet was not launched');
  }

  @override
  Future<void> restore({required String accountId}) async {
    if (!_available) throw StateError('Platform store is unavailable');
    await _store.restorePurchases(applicationUserName: accountId);
  }

  @override
  Future<void> complete(StorePurchaseProof proof) async {
    final purchase = _purchases[proof.transactionId];
    if (purchase == null) {
      throw StateError('Purchase completion context is unavailable');
    }
    if (purchase.pendingCompletePurchase) {
      await _store.completePurchase(purchase);
    }
    _purchases.remove(proof.transactionId);
  }

  void _handlePurchases(List<PurchaseDetails> purchases) {
    for (final purchase in purchases) {
      final status = switch (purchase.status) {
        PurchaseStatus.pending => StorePurchaseStatus.pending,
        PurchaseStatus.purchased => StorePurchaseStatus.purchased,
        PurchaseStatus.restored => StorePurchaseStatus.restored,
        PurchaseStatus.canceled => StorePurchaseStatus.canceled,
        PurchaseStatus.error => StorePurchaseStatus.error,
      };
      StorePurchaseProof? proof;
      if (status == StorePurchaseStatus.purchased ||
          status == StorePurchaseStatus.restored) {
        final transactionId = purchase.purchaseID;
        final token = purchase.verificationData.serverVerificationData;
        if (transactionId == null || transactionId.isEmpty || token.isEmpty) {
          _controller.add(
            StorePurchaseUpdate(
              productId: purchase.productID,
              status: StorePurchaseStatus.error,
              errorCode: 'PURCHASE_PROOF_INCOMPLETE',
            ),
          );
          continue;
        }
        proof = StorePurchaseProof(
          platform: platform,
          productId: purchase.productID,
          transactionId: transactionId,
          verificationToken: token,
        );
        _purchases[transactionId] = purchase;
      }
      _controller.add(
        StorePurchaseUpdate(
          productId: purchase.productID,
          status: status,
          proof: proof,
          errorCode: purchase.error?.code,
        ),
      );
    }
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await _subscription?.cancel();
    await _controller.close();
    _products.clear();
    _purchases.clear();
  }
}
