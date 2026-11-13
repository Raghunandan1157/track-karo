import 'package:flutter/material.dart';

import '../../services/chat_store.dart';
import '../../theme.dart';
import '../chat/chat_list_screen.dart';
import '../chat/chat_theme.dart';
import 'officer_home.dart';

/// Officer home + chat with a bottom navigation bar. OfficerHome keeps its own
/// app bar and scroll position; the chat tab has its own themed scaffold.
class OfficerShell extends StatefulWidget {
  const OfficerShell({super.key});

  @override
  State<OfficerShell> createState() => _OfficerShellState();
}

class _OfficerShellState extends State<OfficerShell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final store = ChatStore.instance;
    return Scaffold(
      body: IndexedStack(
        index: _tab,
        children: const [
          OfficerHome(),
          _ChatTab(),
        ],
      ),
      bottomNavigationBar: ListenableBuilder(
        listenable: store,
        builder: (context, _) {
          final unread = store.unreadTotal;
          return NavigationBar(
            selectedIndex: _tab,
            onDestinationSelected: (i) => setState(() => _tab = i),
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home, color: kNavy),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: unread > 0,
                  label: Text(unread > 99 ? '99+' : '$unread'),
                  child: const Icon(Icons.chat_bubble_outline),
                ),
                selectedIcon: Badge(
                  isLabelVisible: unread > 0,
                  label: Text(unread > 99 ? '99+' : '$unread'),
                  child: const Icon(Icons.chat_bubble, color: kNavy),
                ),
                label: 'Chat',
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ChatTab extends StatelessWidget {
  const _ChatTab();

  @override
  Widget build(BuildContext context) {
    final store = ChatStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        return Theme(
          data: buildChatTheme(store.dark),
          child: Builder(
            builder: (context) {
              final c = chatColorsOf(context);
              return Scaffold(
                appBar: AppBar(
                  title: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Chat',
                        style: TextStyle(fontWeight: FontWeight.w800, color: c.text),
                      ),
                      Text(
                        'AI assistant and team',
                        style: TextStyle(fontSize: 12, color: c.muted, fontWeight: FontWeight.w400),
                      ),
                    ],
                  ),
                  actions: [
                    IconButton(
                      tooltip: 'Mark all read',
                      onPressed: store.unreadTotal == 0 ? null : store.markAllRead,
                      icon: Icon(Icons.done_all, color: store.unreadTotal == 0 ? c.faint : c.text),
                    ),
                  ],
                ),
                body: const ChatListScreen(),
              );
            },
          ),
        );
      },
    );
  }
}
