import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:track_karo/screens/recovery/recovery_shell.dart';
import 'package:track_karo/theme.dart';

void main() {
  testWidgets('recovery dashboard, case workflow and settlements render', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(430, 932);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(theme: buildTheme(), home: const RecoveryShell()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Recovery overview'), findsOneWidget);
    expect(find.text('Outstanding portfolio'), findsOneWidget);
    expect(find.text('Portfolio by recovery stage'), findsOneWidget);

    await tester.tap(find.text('Cases'));
    await tester.pumpAndSettle();
    expect(find.text('Sunita Deshmukh'), findsOneWidget);

    await tester.tap(find.text('Sunita Deshmukh'));
    await tester.pumpAndSettle();
    expect(find.text('RC-2026-0141'), findsWidgets);

    await tester.scrollUntilVisible(
      find.text('18. Hearing scheduled'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Recovery workflow'), findsOneWidget);
    expect(find.text('Loan & case summary'), findsOneWidget);
    final stageTile = find.text('18. Hearing scheduled');
    await tester.ensureVisible(stageTile);
    await tester.pumpAndSettle();
    await tester.tap(stageTile);
    await tester.pumpAndSettle();
    expect(find.text('Complete stage & continue'), findsOneWidget);

    await tester.enterText(
      find.byType(TextField).first,
      'Hearing completed; next date awaited.',
    );
    await tester.tap(find.text('Complete stage & continue'));
    await tester.pumpAndSettle();
    expect(find.text('19. Hearing completed'), findsWidgets);

    Navigator.of(tester.element(find.byType(Scaffold).last)).pop();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Settlements'));
    await tester.pumpAndSettle();
    expect(find.text('Settlement proposals'), findsOneWidget);
    final settlementsScrollable = find
        .descendant(
          of: find.byKey(const ValueKey('recovery-settlements-list')),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.text('Open settlement calculator'),
      300,
      scrollable: settlementsScrollable,
    );

    await tester.tap(find.text('Open settlement calculator'));
    await tester.pumpAndSettle();
    expect(find.text('Create proposal'), findsOneWidget);

    Navigator.of(tester.element(find.text('Create proposal'))).pop();
    await tester.pumpAndSettle();

    await tester.tap(find.text('Notices'));
    await tester.pumpAndSettle();
    expect(find.text('Legal notice'), findsWidgets);

    await tester.tap(find.text('Legal notice').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('Subject:'), findsOneWidget);
  });
}
