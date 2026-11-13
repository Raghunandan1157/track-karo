import 'package:flutter/material.dart';

import '../../services/session.dart';
import '../../theme.dart';
import 'recovery_cases_screen.dart';
import 'recovery_dashboard_screen.dart';
import 'recovery_notices_screen.dart';
import 'recovery_settlements_screen.dart';
import 'recovery_stages_screen.dart';

/// Recovery manager desk: overview, cases, settlements and notices.
class RecoveryShell extends StatefulWidget {
  const RecoveryShell({super.key});

  @override
  State<RecoveryShell> createState() => _RecoveryShellState();
}

class _RecoveryShellState extends State<RecoveryShell> {
  int _tab = 0;

  static const _titles = [
    'Recovery overview',
    'Recovery cases',
    'Settlements',
    'Notices',
  ];

  Future<void> _logout() async {
    final sure = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Log out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (sure == true) await Session.instance.logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = Session.instance.user;
    final subtitle = user == null
        ? ''
        : '${user.name} - Recovery manager'
              '${user.branchName.isEmpty ? '' : ' - ${user.branchName}'}';
    return Scaffold(
      appBar: AppBar(
        leadingWidth: 56,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12),
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 10),
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: Image.asset('assets/hccs-mark.png', fit: BoxFit.contain),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _titles[_tab],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13),
            ),
          ],
        ),
        actions: [
          if (_tab == 0)
            IconButton(
              tooltip: 'Stage setup',
              icon: const Icon(Icons.tune),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const RecoveryStagesScreen()),
              ),
            ),
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: IndexedStack(
        index: _tab,
        children: const [
          RecoveryDashboardScreen(),
          RecoveryCasesScreen(),
          RecoverySettlementsScreen(),
          RecoveryNoticesScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: Colors.white,
        indicatorColor: kTeal.withValues(alpha: 0.14),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            selectedIcon: Icon(Icons.insights, color: kTealDark),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.folder_open_outlined),
            selectedIcon: Icon(Icons.folder, color: kTealDark),
            label: 'Cases',
          ),
          NavigationDestination(
            icon: Icon(Icons.handshake_outlined),
            selectedIcon: Icon(Icons.handshake, color: kTealDark),
            label: 'Settlements',
          ),
          NavigationDestination(
            icon: Icon(Icons.description_outlined),
            selectedIcon: Icon(Icons.description, color: kTealDark),
            label: 'Notices',
          ),
        ],
      ),
    );
  }
}
