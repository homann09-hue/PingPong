import 'store_purchase_bridge.dart';
import 'store_purchase_bridge_factory_stub.dart'
    if (dart.library.io) 'store_purchase_bridge_factory_native.dart'
    as implementation;

StorePurchaseBridge createStorePurchaseBridge() =>
    implementation.createStorePurchaseBridge();
