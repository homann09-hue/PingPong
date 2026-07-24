import 'package:flutter/material.dart';

import '../services/player_progression.dart';

/// Shared premium player HUD used by the lobby and every slot cabinet.
class TopHud extends StatelessWidget {
  const TopHud({
    super.key,
    required this.balance,
    required this.level,
    required this.xp,
    this.gems = 320,
    this.loyaltyPoints = 0,
    this.vipTier = 'GOLD',
    this.onWalletTap,
    this.onVipTap,
    this.onNotificationsTap,
    this.onShopTap,
    this.onProfileTap,
  });

  final int balance, level, xp, gems, loyaltyPoints;
  final String vipTier;
  final VoidCallback? onWalletTap;
  final VoidCallback? onVipTap;
  final VoidCallback? onNotificationsTap;
  final VoidCallback? onShopTap;
  final VoidCallback? onProfileTap;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final desktop = constraints.maxWidth >= 900;
      return Container(
        height: desktop ? 90 : 76,
        padding: EdgeInsets.fromLTRB(10, desktop ? 8 : 7, 10, 7),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xff6f087e), Color(0xff2b073f), Color(0xff170626)],
          ),
          border: Border(
            top: BorderSide(color: Color(0xffff58e6), width: 2),
            bottom: BorderSide(color: Color(0xffffd74d), width: 2),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0xaaef35ff),
              blurRadius: 14,
              spreadRadius: 1,
            ),
          ],
        ),
        child: desktop ? _desktopHud() : _compactHud(),
      );
    },
  );

  Widget _desktopHud() => Center(
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: SizedBox(
        width: 1240,
        height: 70,
        child: Row(
          children: [
            _profile(68),
            const SizedBox(width: 10),
            SizedBox(width: 125, child: _levelProgress()),
            const SizedBox(width: 12),
            _currency(
              Icons.monetization_on_rounded,
              _fmt(balance),
              const Color(0xffffd447),
              onWalletTap,
              width: 214,
              large: true,
            ),
            const SizedBox(width: 8),
            _shopButton(),
            const SizedBox(width: 8),
            _dealButton(),
            const SizedBox(width: 8),
            _currency(
              Icons.diamond_rounded,
              _fmt(gems),
              const Color(0xff5cecff),
              onWalletTap,
              width: 130,
              large: true,
            ),
            const SizedBox(width: 8),
            _currency(
              Icons.workspace_premium_rounded,
              '${_fmt(loyaltyPoints)} LP',
              const Color(0xffff86dc),
              onWalletTap,
              width: 145,
              large: true,
            ),
            const SizedBox(width: 8),
            _roundAction(
              Icons.notifications_active_rounded,
              'Benachrichtigungen',
              onNotificationsTap,
            ),
            const SizedBox(width: 8),
            _vip(),
          ],
        ),
      ),
    ),
  );

  Widget _compactHud() => Center(
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: SizedBox(
        width: 610,
        height: 58,
        child: Row(
          children: [
            _profile(58),
            const SizedBox(width: 8),
            SizedBox(width: 82, child: _levelProgress(compact: true)),
            const SizedBox(width: 7),
            _currency(
              Icons.monetization_on_rounded,
              _fmt(balance),
              const Color(0xffffd447),
              onWalletTap,
              width: 132,
            ),
            const SizedBox(width: 6),
            _currency(
              Icons.diamond_rounded,
              _fmt(gems),
              const Color(0xff5cecff),
              onWalletTap,
              width: 90,
            ),
            const SizedBox(width: 6),
            _shopButton(compact: true),
            const SizedBox(width: 6),
            _roundAction(
              Icons.notifications_active_rounded,
              'Benachrichtigungen',
              onNotificationsTap,
              compact: true,
            ),
            const SizedBox(width: 6),
            _vip(compact: true),
          ],
        ),
      ),
    ),
  );

  Widget _profile(double size) => Semantics(
    button: true,
    label: 'Spielerprofil, Level $level',
    child: GestureDetector(
      onTap: onProfileTap,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          children: [
            Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [
                    Color(0xffffef61),
                    Color(0xffff4dd8),
                    Color(0xff42e8ff),
                  ],
                ),
                boxShadow: [
                  BoxShadow(color: Color(0xffff47df), blurRadius: 13),
                ],
              ),
              padding: const EdgeInsets.all(3),
              child: const CircleAvatar(
                backgroundColor: Color(0xff1d0739),
                backgroundImage: AssetImage('assets/ui/player-avatar.png'),
              ),
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 23,
                height: 23,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xff7d23c6),
                  border: Border.all(color: const Color(0xffffdc51), width: 2),
                ),
                child: Text(
                  '$level',
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );

  Widget _levelProgress({bool compact = false}) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'LEVEL $level',
        maxLines: 1,
        style: TextStyle(
          fontSize: compact ? 11 : 14,
          fontWeight: FontWeight.w900,
          shadows: const [Shadow(color: Colors.black, blurRadius: 4)],
        ),
      ),
      const SizedBox(height: 5),
      Container(
        height: compact ? 9 : 12,
        decoration: BoxDecoration(
          color: Colors.black87,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xffffd64a)),
        ),
        clipBehavior: Clip.antiAlias,
        child: LinearProgressIndicator(
          value: playerLevelProgress(level: level, xp: xp),
          backgroundColor: Colors.transparent,
          valueColor: const AlwaysStoppedAnimation(Color(0xffff3ee8)),
        ),
      ),
    ],
  );

  Widget _currency(
    IconData icon,
    String value,
    Color color,
    VoidCallback? onTap, {
    required double width,
    bool large = false,
  }) => SizedBox(
    width: width,
    height: large ? 54 : 48,
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xff16091f), Color(0xff04020a)],
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: color, width: 2),
            boxShadow: [
              BoxShadow(color: color.withValues(alpha: .38), blurRadius: 10),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: large ? 34 : 28,
                height: large ? 34 : 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color,
                  boxShadow: [BoxShadow(color: color, blurRadius: 8)],
                ),
                child: Icon(
                  icon,
                  color: const Color(0xff351025),
                  size: large ? 23 : 19,
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  style: TextStyle(
                    fontSize: large ? 18 : 13,
                    fontWeight: FontWeight.w900,
                    letterSpacing: .2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _shopButton({bool compact = false}) => SizedBox(
    width: compact ? 92 : 132,
    height: compact ? 48 : 58,
    child: FilledButton.icon(
      onPressed: onShopTap,
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xff36c835),
        foregroundColor: Colors.white,
        padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 15),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xffb9ff57), width: 2),
        ),
        elevation: 8,
        shadowColor: const Color(0xff74ff4d),
      ),
      icon: Icon(Icons.shopping_bag_rounded, size: compact ? 18 : 24),
      label: Text(
        compact ? 'SHOP' : 'KAUFEN',
        style: TextStyle(
          fontSize: compact ? 11 : 17,
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
  );

  Widget _dealButton() => SizedBox(
    width: 118,
    height: 58,
    child: FilledButton(
      onPressed: onShopTap,
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xfff03a38),
        foregroundColor: Colors.white,
        padding: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xffff8a64), width: 2),
        ),
        elevation: 8,
        shadowColor: const Color(0xffff4d44),
      ),
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'DEAL',
            style: TextStyle(
              fontSize: 17,
              height: .9,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            '03:59:33',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    ),
  );

  Widget _roundAction(
    IconData icon,
    String label,
    VoidCallback? onTap, {
    bool compact = false,
  }) => Semantics(
    button: true,
    label: label,
    child: IconButton.filled(
      onPressed: onTap,
      tooltip: label,
      style: IconButton.styleFrom(
        fixedSize: Size.square(compact ? 46 : 54),
        backgroundColor: const Color(0xff190b25),
        foregroundColor: const Color(0xffffd74d),
        side: const BorderSide(color: Color(0xffff57df), width: 2),
      ),
      icon: Icon(icon, size: compact ? 22 : 28),
    ),
  );

  Widget _vip({bool compact = false}) => Semantics(
    button: true,
    label: 'VIP $vipTier',
    child: GestureDetector(
      onTap: onVipTap,
      child: Container(
        width: compact ? 54 : 64,
        height: compact ? 52 : 64,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xffad37dc), Color(0xff4d126e)],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xffffdc51), width: 2),
          boxShadow: const [BoxShadow(color: Color(0x88ff42dd), blurRadius: 9)],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'VIP',
              style: TextStyle(
                color: const Color(0xffffe36c),
                fontSize: compact ? 13 : 17,
                fontWeight: FontWeight.w900,
              ),
            ),
            Text(
              vipTier,
              maxLines: 1,
              style: TextStyle(
                fontSize: compact ? 7 : 8,
                color: Colors.white70,
              ),
            ),
          ],
        ),
      ),
    ),
  );

  static String _fmt(int value) => value.toString().replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
}
