import 'dart:async';

import 'package:aurora_mobile/services/store_purchase_bridge.dart';
import 'package:aurora_mobile/services/store_purchase_bridge_factory_native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

void main() {
  test(
    'unavailable bridge cannot fabricate products or start a charge',
    () async {
      const bridge = UnavailableStorePurchaseBridge();
      await bridge.initialize();
      expect(bridge.available, isFalse);
      expect(bridge.platform, isNull);
      expect(await bridge.loadProducts(const ['product']), isEmpty);
      await expectLater(
        bridge.purchase('product', accountId: 'account', consumable: true),
        throwsStateError,
      );
      await bridge.dispose();
    },
  );

  test(
    'native bridge disables auto-consume and completes only after proof handling',
    () async {
      final client = _FakeStoreClient();
      final bridge = NativeStorePurchaseBridge(client, 'android');
      await bridge.initialize();
      final products = await bridge.loadProducts(const ['aurora_coin_stack']);
      expect(products.single.localizedPrice, '4,99 €');

      await bridge.purchase(
        'aurora_coin_stack',
        accountId: '00000000-0000-4000-8000-000000000001',
        consumable: true,
      );
      expect(client.autoConsume, isFalse);
      expect(
        client.purchaseParam?.applicationUserName,
        '00000000-0000-4000-8000-000000000001',
      );
      await bridge.purchase(
        'aurora_coin_stack',
        accountId: '00000000-0000-4000-8000-000000000001',
        consumable: false,
      );
      expect(client.nonConsumableCalls, 1);
      await bridge.restore(accountId: '00000000-0000-4000-8000-000000000001');
      expect(client.restoredAccountId, '00000000-0000-4000-8000-000000000001');

      final updateFuture = bridge.updates.firstWhere(
        (update) => update.status == StorePurchaseStatus.purchased,
      );
      final purchase = PurchaseDetails(
        purchaseID: 'transaction-1',
        productID: 'aurora_coin_stack',
        transactionDate: '1',
        status: PurchaseStatus.purchased,
        verificationData: PurchaseVerificationData(
          localVerificationData: 'local',
          serverVerificationData: 'secret-proof',
          source: 'google_play',
        ),
      )..pendingCompletePurchase = true;
      client.controller.add([purchase]);
      final update = await updateFuture;
      expect(update.proof?.transactionId, 'transaction-1');
      expect(client.completed, isEmpty);

      await bridge.complete(update.proof!);
      expect(client.completed, [purchase]);
      await bridge.dispose();
      await client.controller.close();
    },
  );
}

class _FakeStoreClient implements NativeStoreClient {
  final controller = StreamController<List<PurchaseDetails>>.broadcast();
  final completed = <PurchaseDetails>[];
  PurchaseParam? purchaseParam;
  bool? autoConsume;
  int nonConsumableCalls = 0;
  String? restoredAccountId;

  @override
  Stream<List<PurchaseDetails>> get purchaseStream => controller.stream;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Future<ProductDetailsResponse> queryProductDetails(
    Set<String> identifiers,
  ) async => ProductDetailsResponse(
    productDetails: [
      ProductDetails(
        id: 'aurora_coin_stack',
        title: 'Coins',
        description: 'Virtual coins',
        price: '4,99 €',
        rawPrice: 4.99,
        currencyCode: 'EUR',
        currencySymbol: '€',
      ),
    ],
    notFoundIDs: const [],
  );
  @override
  Future<bool> buyConsumable({
    required PurchaseParam purchaseParam,
    required bool autoConsume,
  }) async {
    this.purchaseParam = purchaseParam;
    this.autoConsume = autoConsume;
    return true;
  }

  @override
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam}) async {
    this.purchaseParam = purchaseParam;
    nonConsumableCalls += 1;
    return true;
  }

  @override
  Future<void> completePurchase(PurchaseDetails purchase) async {
    completed.add(purchase);
  }

  @override
  Future<void> restorePurchases({required String applicationUserName}) async {
    restoredAccountId = applicationUserName;
  }
}
