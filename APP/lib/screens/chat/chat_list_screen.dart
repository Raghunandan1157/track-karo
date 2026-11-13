import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/chat_store.dart';
import 'chat_theme.dart';
import 'chat_thread_screen.dart';
import 'chat_widgets.dart';

/// Conversation list. The AI thread is always first, then groups/broadcast and
/// direct messages sorted by the latest message.
class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final TextEditingController _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  String get _query => _search.text.trim().toLowerCase();

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
              final all = store.conversations;
              final filtered = _query.isEmpty
                  ? all
                  : all
                      .where((x) =>
                          x.name.toLowerCase().contains(_query) ||
                          x.preview.toLowerCase().contains(_query))
                      .toList();
              final pinned = filtered.where((x) => x.pinned).toList();
              final rest = filtered.where((x) => !x.pinned).toList();

              return Container(
                color: c.bg,
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 10, 8, 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _search,
                              onChanged: (_) => setState(() {}),
                              textInputAction: TextInputAction.search,
                              style: TextStyle(fontSize: 14.5, color: c.text),
                              decoration: InputDecoration(
                                hintText: 'Search chats',
                                hintStyle: TextStyle(color: c.faint, fontSize: 14),
                                prefixIcon: Icon(Icons.search, size: 20, color: c.faint),
                                filled: true,
                                fillColor: c.surface,
                                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(24),
                                  borderSide: BorderSide(color: c.border),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(24),
                                  borderSide: BorderSide(color: c.border),
                                ),
                              ),
                            ),
                          ),
                          IconButton(
                            tooltip: store.dark ? 'Switch to light chat' : 'Switch to dark chat',
                            onPressed: () => store.setDark(!store.dark),
                            icon: Icon(
                              store.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                              color: c.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: filtered.isEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.search_off, size: 42, color: c.faint),
                                    const SizedBox(height: 10),
                                    Text(
                                      'No chats match "${_search.text.trim()}"',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(color: c.muted, fontSize: 14.5),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : ListView(
                              padding: const EdgeInsets.only(bottom: 16),
                              children: [
                                if (pinned.isNotEmpty) ...[
                                  _sectionLabel(c, 'Pinned'),
                                  for (final conv in pinned) _ChatRow(conversation: conv),
                                  const SizedBox(height: 6),
                                ],
                                if (rest.isNotEmpty) ...[
                                  _sectionLabel(c, 'All conversations'),
                                  for (final conv in rest) _ChatRow(conversation: conv),
                                ],
                              ],
                            ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _sectionLabel(ChatColors c, String text) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.8,
          color: c.faint,
        ),
      ),
    );
  }
}

class _ChatRow extends StatelessWidget {
  const _ChatRow({required this.conversation});

  final ChatConversation conversation;

  String _timeLabel(DateTime at) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(at.year, at.month, at.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return DateFormat('h:mm a').format(at);
    if (diff == 1) return 'Yesterday';
    if (diff < 7) return DateFormat('EEE').format(at);
    return DateFormat('d MMM').format(at);
  }

  @override
  Widget build(BuildContext context) {
    final c = chatColorsOf(context);
    final store = ChatStore.instance;
    final unread = conversation.unread;

    return Material(
      color: conversation.pinned ? c.pinnedBg.withValues(alpha: 0.55) : Colors.transparent,
      child: InkWell(
        onTap: () {
          store.open(conversation.id);
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ChatThreadScreen(conversationId: conversation.id),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ChatAvatar(conversation: conversation, size: 50),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            conversation.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 15.5,
                              fontWeight: unread > 0 ? FontWeight.w800 : FontWeight.w700,
                              color: c.text,
                            ),
                          ),
                        ),
                        if (conversation.kind == ChatKind.ai) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: c.accentSoft,
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: Text(
                              'AI',
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.4,
                                color: c.accent,
                              ),
                            ),
                          ),
                        ],
                        if (conversation.readOnly)
                          Padding(
                            padding: const EdgeInsets.only(left: 5),
                            child: Icon(Icons.lock_outline, size: 13, color: c.faint),
                          ),
                        const Spacer(),
                        const SizedBox(width: 8),
                        Text(
                          _timeLabel(conversation.lastAt),
                          style: TextStyle(
                            fontSize: 11.5,
                            color: unread > 0 ? c.outgoing : c.faint,
                            fontWeight: unread > 0 ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.preview,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13.5,
                              height: 1.25,
                              fontStyle: conversation.typing ? FontStyle.italic : FontStyle.normal,
                              color: conversation.typing
                                  ? c.accent
                                  : (unread > 0 ? c.text : c.muted),
                              fontWeight: unread > 0 ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                        ),
                        if (unread > 0) ...[
                          const SizedBox(width: 8),
                          Container(
                            constraints: const BoxConstraints(minWidth: 20),
                            height: 20,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: c.outgoing,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              unread > 99 ? '99+' : '$unread',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ] else if (conversation.kind == ChatKind.ai)
                          Padding(
                            padding: const EdgeInsets.only(left: 4),
                            child: Icon(Icons.auto_awesome, size: 15, color: c.accent),
                          )
                        else if (conversation.readOnly)
                          Icon(Icons.campaign_outlined, size: 16, color: c.faint),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
