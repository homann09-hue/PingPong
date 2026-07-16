import 'package:flutter/material.dart';

class TopHud extends StatelessWidget {
  const TopHud({
    super.key,
    required this.balance,
    required this.level,
    required this.xp,
    this.gems = 320,
    this.loyaltyPoints = 0,
    this.vipTier = 'GOLD',
    this.onVipTap,
    this.onNotificationsTap,
    this.onShopTap,
  });
  final int balance, level, xp, gems, loyaltyPoints;
  final String vipTier;
  final VoidCallback? onVipTap;
  final VoidCallback? onNotificationsTap;
  final VoidCallback? onShopTap;
  @override
  Widget build(BuildContext context) => Container(
    height: 76,
    padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
    decoration: const BoxDecoration(
      gradient: LinearGradient(colors: [Color(0xff160735), Color(0xff32105f)]),
      border: Border(bottom: BorderSide(color: Color(0xffffc52f), width: 2)),
    ),
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: SizedBox(
        width: 550,
        height: 58,
        child: Row(
          children: [
            SizedBox(
              width: 58,
              height: 58,
              child: Stack(
                children: [
                  const CircleAvatar(
                    radius: 28,
                    backgroundColor: Color(0xffffc52f),
                    child: CircleAvatar(
                      radius: 25,
                      backgroundImage: AssetImage(
                        'assets/ui/player-avatar.png',
                      ),
                    ),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: CircleAvatar(
                      radius: 11,
                      backgroundColor: const Color(0xffffc52f),
                      child: CircleAvatar(
                        radius: 9,
                        backgroundColor: const Color(0xff6d2bc4),
                        child: Text(
                          '$level',
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'LEVEL $level',
                    maxLines: 1,
                    overflow: TextOverflow.fade,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: (xp % 1000) / 1000,
                      minHeight: 9,
                      backgroundColor: Colors.black54,
                      color: const Color(0xffd23cff),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _currency(
              Icons.monetization_on,
              _fmt(balance),
              const Color(0xffffcf3a),
            ),
            const SizedBox(width: 5),
            _currency(Icons.diamond, _fmt(gems), const Color(0xff42e3ff)),
            const SizedBox(width: 5),
            _currency(
              Icons.workspace_premium,
              '${_fmt(loyaltyPoints)} LP',
              const Color(0xffff8bd8),
            ),
            IconButton(
              onPressed: onShopTap,
              tooltip: 'Coins kaufen',
              visualDensity: VisualDensity.compact,
              icon: const Icon(Icons.add_circle, color: Color(0xffffd75d)),
            ),
            const SizedBox(width: 5),
            IconButton(
              onPressed: onNotificationsTap,
              tooltip: 'Benachrichtigungen',
              visualDensity: VisualDensity.compact,
              icon: const Icon(
                Icons.notifications_outlined,
                color: Color(0xffffd75d),
              ),
            ),
            const SizedBox(width: 2),
            GestureDetector(
              onTap: onVipTap,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 7),
                decoration: BoxDecoration(
                  color: const Color(0xff6a238f),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xffffd75d)),
                ),
                child: Column(
                  children: [
                    const Text(
                      'VIP',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: Color(0xffffe275),
                      ),
                    ),
                    Text(
                      vipTier,
                      style: const TextStyle(
                        fontSize: 7,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
  static Widget _currency(IconData i, String value, Color c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 8),
    decoration: BoxDecoration(
      color: Colors.black45,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: c.withValues(alpha: .55)),
    ),
    child: Row(
      children: [
        Icon(i, size: 17, color: c),
        const SizedBox(width: 3),
        Text(
          value,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
        ),
      ],
    ),
  );
  static String _fmt(int v) => v.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
}
