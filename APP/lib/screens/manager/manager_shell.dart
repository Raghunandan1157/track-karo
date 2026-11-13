import 'package:flutter/material.dart';

import '../../services/chat_store.dart';
import '../../services/manager_store.dart';
import '../../services/notifier.dart';
import '../../services/session.dart';
import '../../services/hr_store.dart';
import '../../theme.dart';
import '../chat/chat_list_screen.dart';
import '../hr/hr_team_screen.dart';
import 'alerts_screen.dart';
import 'assign_screen.dart';
import 'live_map_screen.dart';
import 'reports_screen.dart';
import 'team_screen.dart';

/// Branch manager / admin home with bottom navigation.
/// Admin uses the same screens; the server returns all branches for admin.
class ManagerShell extends StatefulWidget {
  const ManagerShell({super.key});

  @override
  State<ManagerShell> createState() => _ManagerShellState();
}

class _ManagerShellState extends State<ManagerShell>
    with WidgetsBindingObserver {
  final ManagerStore _store = ManagerStore.instance;
  int _tab = 0;
  bool _paused = false;

  static const _titles = ['Team', 'Live map', 'Assign tasks', 'Alerts', 'Chat', 'Reports', 'HR'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _store.start();
    HrStore.instance.ensureSeeded(Session.instance.user);
    Notifier.requestPermission();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      // Background: close the live stream.
      if (!_paused) {
        _paused = true;
        _store.pause();
      }
    } else if (state == AppLifecycleState.resumed && _paused) {
      _paused = false;
      _store.resume();
    }
  }

  Future<void> _logout() async {
    final sure = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Log out?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Log out')),
        ],
      ),
    );
    if (sure == true) await Session.instance.logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = Session.instance.user;
    final sub = user == null
        ? ''
        : user.isAdmin
            ? '${user.name} - Admin (all branches)'
            : '${user.name} - ${user.branchName.isEmpty ? 'Branch manager' : user.branchName}';
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_titles[_tab],
                style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(sub, style: const TextStyle(fontSize: 13)),
          ],
        ),
        actions: [
          if (_tab == 3)
            ListenableBuilder(
              listenable: _store,
              builder: (_, _) => TextButton(
                onPressed: _store.unread == 0 ? null : _store.markAllRead,
                child: Text('Mark all read',
                    style: TextStyle(
                        color: _store.unread == 0
                            ? Colors.white38
                            : Colors.white)),
              ),
            ),
          if (_tab == 4)
            ListenableBuilder(
              listenable: ChatStore.instance,
              builder: (_, _) {
                final unread = ChatStore.instance.unreadTotal;
                return TextButton(
                  onPressed: unread == 0 ? null : ChatStore.instance.markAllRead,
                  child: Text('Mark all read',
                      style: TextStyle(
                          color: unread == 0 ? Colors.white38 : Colors.white)),
                );
              },
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
          TeamScreen(),
          LiveMapScreen(),
          AssignScreen(),
          AlertsScreen(),
          ChatListScreen(),
          ReportsScreen(),
          HrTeamScreen(),
        ],
      ),
      bottomNavigationBar: ListenableBuilder(
        listenable: Listenable.merge([_store, ChatStore.instance, HrStore.instance]),
        builder: (_, _) => NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (i) => setState(() => _tab = i),
          destinations: [
            const NavigationDestination(
                icon: Icon(Icons.groups_outlined),
                selectedIcon: Icon(Icons.groups, color: kNavy),
                label: 'Team'),
            const NavigationDestination(
                icon: Icon(Icons.map_outlined),
                selectedIcon: Icon(Icons.map, color: kNavy),
                label: 'Map'),
            const NavigationDestination(
                icon: Icon(Icons.add_location_alt_outlined),
                selectedIcon: Icon(Icons.add_location_alt, color: kNavy),
                label: 'Assign'),
            NavigationDestination(
                icon: Badge(
                  isLabelVisible: _store.unread > 0,
                  label: Text(_store.unread > 99 ? '99+' : '${_store.unread}'),
                  child: const Icon(Icons.notifications_outlined),
                ),
                selectedIcon: Badge(
                  isLabelVisible: _store.unread > 0,
                  label: Text(_store.unread > 99 ? '99+' : '${_store.unread}'),
                  child: const Icon(Icons.notifications, color: kNavy),
                ),
                label: 'Alerts'),
            NavigationDestination(
                icon: Badge(
                  isLabelVisible: ChatStore.instance.unreadTotal > 0,
                  label: Text(ChatStore.instance.unreadTotal > 99
                      ? '99+'
                      : '${ChatStore.instance.unreadTotal}'),
                  child: const Icon(Icons.chat_bubble_outline),
                ),
                selectedIcon: Badge(
                  isLabelVisible: ChatStore.instance.unreadTotal > 0,
                  label: Text(ChatStore.instance.unreadTotal > 99
                      ? '99+'
                      : '${ChatStore.instance.unreadTotal}'),
                  child: const Icon(Icons.chat_bubble, color: kNavy),
                ),
                label: 'Chat'),
            const NavigationDestination(
                icon: Icon(Icons.bar_chart_outlined),
                selectedIcon: Icon(Icons.bar_chart, color: kNavy),
                label: 'Reports'),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: HrStore.instance.pendingLeaves.isNotEmpty,
                label: Text(HrStore.instance.pendingLeaves.length > 99
                    ? '99+'
                    : '${HrStore.instance.pendingLeaves.length}'),
                child: const Icon(Icons.badge_outlined),
              ),
              selectedIcon: Badge(
                isLabelVisible: HrStore.instance.pendingLeaves.isNotEmpty,
                label: Text(HrStore.instance.pendingLeaves.length > 99
                    ? '99+'
                    : '${HrStore.instance.pendingLeaves.length}'),
                child: const Icon(Icons.badge, color: kNavy),
              ),
              label: 'HR',
            ),
          ],
        ),
      ),
    );
  }
}
