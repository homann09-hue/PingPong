# ADR 0013: Deterministisches Coin Collect

Status: Accepted
Datum: 2026-07-16

## Kontext

Coin-Collect-Spiele benötigen sichtbare Coin-Symbole mit individuellen Werten und ein Collector-Symbol. Weder Coin-Werte noch Auszahlungen dürfen vom Client erzeugt werden.

## Entscheidung

- `coin` ist ein eigener Symboltyp ohne reguläre Payline-Auszahlung.
- `features.coinCollect` definiert Coin-Symbol, Collector-Symbol, Mindestanzahl und die erlaubten ganzzahligen Coin-Multiplikatoren.
- Die Engine prüft Collector und Coin-Anzahl auf dem ausgewerteten Basisraster.
- Jeder sichtbare Coin erhält deterministisch aus dem Spin-RNG einen Wert.
- Positionen, Einzelwerte, Gesamtmultiplikator und Auszahlung werden als `bonus.awarded` mit Modus `coin_collect` in das unveränderliche Spin-Ergebnis geschrieben.
- Flutter präsentiert ausschließlich diese Serverwerte und berechnet keine Coin-Auszahlung neu.
- Jede Aktivierung in einem veröffentlichten Slot erfordert eine neue Konfigurations- und Mathematikversion sowie eine erneute Simulation.

## Konsequenzen

- Replays erzeugen identische Coin-Positionen, Werte und Auszahlungen.
- Coin Collect kann unabhängig von Pick-, Wheel-, Freispiel- und Jackpot-Features konfiguriert werden.
- Coin-Symbole erscheinen nur in Paytables von Slots, deren Reelstrips sie tatsächlich verwenden.
