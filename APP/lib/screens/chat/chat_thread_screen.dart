import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/chat_store.dart';
import 'chat_composer.dart';
import 'chat_theme.dart';
import 'chat_widgets.dart';

class ChatThreadScreen extends StatefulWidget {
  const ChatThreadScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  State<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends State<ChatThreadScreen> {
  ChatMessage? _replyTo;

  ChatConversation? get _conversation => ChatStore.instance.byId(widget.conversationId);

  void _openActions(ChatConversation conversation, ChatMessage message) {
    showMessageActions(
      context,
      onReply: () => setState(() => _replyTo = message),
      onReact: (emoji) => ChatStore.instance.toggleReaction(message, emoji),
      onCopy: message.text.isEmpty
          ? null
          : () async {
              await Clipboard.setData(ClipboardData(text: message.text));
              if (!mounted) return;
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(const SnackBar(content: Text('Message copied')));
            },
    );
  }

  void _showInfo(ChatConversation conversation) {
    final c = chatColorsOf(context);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetCtx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  ChatAvatar(conversation: conversation, size: 56),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          conversation.name,
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.text),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          conversation.subtitle,
                          style: TextStyle(fontSize: 13, color: c.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              if (conversation.members.isNotEmpty) ...[
                Text(
                  'Members',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: c.faint),
                ),
                const SizedBox(height: 8),
                for (final m in conversation.members)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Container(
                          width: 26,
                          height: 26,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: c.pinnedBg, shape: BoxShape.circle),
                          child: Text(
                            m.substring(0, 1).toUpperCase(),
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: c.muted),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(m, style: TextStyle(fontSize: 14, color: c.text)),
                      ],
                    ),
                  ),
                const SizedBox(height: 12),
              ],
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: c.surfaceAlt,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: c.border),
                ),
                child: Row(
                  children: [
                    Icon(Icons.construction_outlined, size: 18, color: c.accent),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Preview build: messages are stored in memory until the chat API is connected.',
                        style: TextStyle(fontSize: 12.5, height: 1.3, color: c.muted),
                      ),
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

  @override
  Widget build(BuildContext context) {
    final store = ChatStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final conversation = _conversation;
        return Theme(
          data: buildChatTheme(store.dark),
          child: Builder(
            builder: (context) {
              final c = chatColorsOf(context);
              if (conversation == null) {
                return Scaffold(
                  appBar: AppBar(leading: const BackButton()),
                  body: Center(child: Text('Conversation unavailable', style: TextStyle(color: c.muted))),
                );
              }
              return Scaffold(
                appBar: AppBar(
                  leading: const BackButton(),
                  titleSpacing: 0,
                  title: Row(
                    children: [
                      ChatAvatar(conversation: conversation, size: 38),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              conversation.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: c.text,
                              ),
                            ),
                            Text(
                              conversation.typing ? 'typing...' : conversation.subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 11.5,
                                color: conversation.typing ? c.accent : c.muted,
                                fontStyle: conversation.typing ? FontStyle.italic : FontStyle.normal,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  actions: [
                    IconButton(
                      tooltip: store.dark ? 'Switch to light chat' : 'Switch to dark chat',
                      onPressed: () => store.setDark(!store.dark),
                      icon: Icon(store.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
                    ),
                    IconButton(
                      tooltip: 'Chat info',
                      onPressed: () => _showInfo(conversation),
                      icon: const Icon(Icons.info_outline),
                    ),
                  ],
                ),
                body: Container(
                  color: c.bg,
                  child: Column(
                    children: [
                      Expanded(child: _messageList(context, conversation)),
                      ChatComposer(
                        conversation: conversation,
                        replyTo: _replyTo,
                        onCancelReply: () => setState(() => _replyTo = null),
                        onSent: () => setState(() => _replyTo = null),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _messageList(BuildContext context, ChatConversation conversation) {
    final c = chatColorsOf(context);
    final items = <Widget>[];
    DateTime? lastDay;
    String? lastAuthor;

    for (final m in conversation.messages) {
      final day = DateTime(m.at.year, m.at.month, m.at.day);
      if (lastDay == null || day != lastDay) {
        items.add(_DaySeparator(label: chatDayLabel(m.at), colors: c));
        lastDay = day;
        lastAuthor = null;
      }
      final newAuthor = lastAuthor != m.authorName;
      final grouped = conversation.kind == ChatKind.group || conversation.kind == ChatKind.broadcast;
      items.add(
        MessageBubble(
          message: m,
          senderColor: conversation.kind == ChatKind.ai ? c.accent : conversation.color,
          showAuthor: grouped && !m.mine && newAuthor,
          showAvatar: !m.mine && conversation.kind != ChatKind.ai && newAuthor,
          onLongPress: () => _openActions(conversation, m),
          onToggleReaction: (emoji) => ChatStore.instance.toggleReaction(m, emoji),
        ),
      );
      lastAuthor = m.authorName;
    }

    if (conversation.typing) items.add(const TypingBubble());

    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.chat_bubble_outline, size: 46, color: c.faint),
              const SizedBox(height: 10),
              Text(
                'No messages yet. Say hello to ${conversation.name}.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: c.muted),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      reverse: true,
      padding: const EdgeInsets.symmetric(vertical: 10),
      itemCount: items.length,
      itemBuilder: (context, index) => items[items.length - 1 - index],
    );
  }
}

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.label, required this.colors});

  final String label;
  final ChatColors colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: colors.border),
          ),
          child: Text(
            label,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colors.muted),
          ),
        ),
      ),
    );
  }
}
