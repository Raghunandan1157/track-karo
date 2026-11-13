import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/chat_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'chat_theme.dart';

// ---------------------------------------------------------------- avatars
class ChatAvatar extends StatelessWidget {
  const ChatAvatar({super.key, required this.conversation, this.size = 48});

  final ChatConversation conversation;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = chatColorsOf(context);
    final radius = size / 2;
    Widget core;
    if (conversation.kind == ChatKind.ai) {
      core = Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: aiGradient(dark: Theme.of(context).brightness == Brightness.dark),
        ),
        child: Icon(Icons.auto_awesome, color: Colors.white, size: size * 0.46),
      );
    } else if (conversation.kind == ChatKind.broadcast) {
      core = Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: c.accent,
          shape: BoxShape.circle,
        ),
        child: Icon(Icons.campaign, color: Colors.white, size: size * 0.5),
      );
    } else {
      core = Container(
        alignment: Alignment.center,
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: conversation.color,
          shape: BoxShape.circle,
        ),
        child: Text(
          conversation.initials,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: size * 0.34,
            letterSpacing: 0.2,
          ),
        ),
      );
    }

    final dot = conversation.kind == ChatKind.ai
        ? Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.3,
              height: size * 0.3,
              decoration: BoxDecoration(
                color: c.accent,
                shape: BoxShape.circle,
                border: Border.all(color: c.surface, width: 2),
              ),
              child: Icon(Icons.bolt, size: size * 0.19, color: Colors.white),
            ),
          )
        : conversation.online
            ? Positioned(
                right: 1,
                bottom: 1,
                child: Container(
                  width: size * 0.27,
                  height: size * 0.27,
                  decoration: BoxDecoration(
                    color: c.online,
                    shape: BoxShape.circle,
                    border: Border.all(color: c.surface, width: 2),
                  ),
                ),
              )
            : const SizedBox.shrink();

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [ClipRRect(borderRadius: BorderRadius.circular(radius), child: core), dot],
      ),
    );
  }
}

// ---------------------------------------------------------------- bubbles
class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    this.senderColor,
    this.showAuthor = false,
    this.showAvatar = false,
    this.onLongPress,
    this.onToggleReaction,
    this.onOpenLocation,
  });

  final ChatMessage message;
  final Color? senderColor;
  final bool showAuthor;
  final bool showAvatar;
  final VoidCallback? onLongPress;
  final ValueChanged<String>? onToggleReaction;
  final VoidCallback? onOpenLocation;

  @override
  Widget build(BuildContext context) {
    final c = chatColorsOf(context);
    final fg = message.mine ? c.outgoingText : c.incomingText;
    final muted = message.mine ? c.outgoingText.withValues(alpha: 0.62) : c.faint;
    final maxWidth = math.min(MediaQuery.sizeOf(context).width * 0.78, 520.0);

    final bubble = Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 7),
      decoration: BoxDecoration(
        color: message.mine ? c.outgoing : c.incoming,
        border: message.mine ? null : Border.all(color: c.border),
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(18),
          topRight: const Radius.circular(18),
          bottomLeft: Radius.circular(message.mine ? 18 : 5),
          bottomRight: Radius.circular(message.mine ? 5 : 18),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showAuthor)
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Text(
                message.authorName,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: senderColor ?? c.accent,
                ),
              ),
            ),
          if (message.replyToText != null) _replyQuote(context, fg),
          _content(context, fg, muted),
          if (message.reactions.isNotEmpty) _reactions(context),
          const SizedBox(height: 3),
          Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                DateFormat('h:mm a').format(message.at),
                style: TextStyle(fontSize: 10.5, color: muted),
              ),
              if (message.mine) ...[
                const SizedBox(width: 4),
                _statusIcon(c),
              ],
            ],
          ),
        ],
      ),
    );

    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisAlignment: message.mine ? MainAxisAlignment.end : MainAxisAlignment.start,
      children: [
        if (showAvatar && !message.mine) ...[
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: senderColor, shape: BoxShape.circle),
            child: Text(
              _initials(message.authorName),
              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 6),
        ],
        Flexible(child: bubble),
      ],
    );

    return GestureDetector(
      onLongPress: onLongPress,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          message.mine ? 44 : 10,
          3,
          message.mine ? 10 : 44,
          3,
        ),
        child: row,
      ),
    );
  }

  Widget _content(BuildContext context, Color fg, Color muted) {
    final c = chatColorsOf(context);
    switch (message.kind) {
      case MessageKind.text:
        return Text(
          message.text,
          style: TextStyle(fontSize: 15, height: 1.35, color: fg),
        );
      case MessageKind.image:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 220,
                height: 140,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFFBFD4E8), Color(0xFF7FA3C4)],
                  ),
                ),
                child: Stack(
                  children: [
                    const Center(
                      child: Icon(Icons.landscape, size: 46, color: Colors.white70),
                    ),
                    Positioned(
                      left: 8,
                      right: 8,
                      bottom: 8,
                      child: Text(
                        message.fileName ?? 'Photo',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (message.text.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(message.text, style: TextStyle(fontSize: 15, color: fg)),
              ),
          ],
        );
      case MessageKind.file:
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: message.mine ? Colors.white.withValues(alpha: 0.14) : c.accentSoft,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(Icons.description, color: message.mine ? Colors.white : c.accent, size: 21),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.fileName ?? 'Document',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: fg),
                  ),
                  Text(
                    _fileSize(message.fileSize),
                    style: TextStyle(fontSize: 11.5, color: muted),
                  ),
                ],
              ),
            ),
          ],
        );
      case MessageKind.location:
        return _location(context, fg, muted);
      case MessageKind.voice:
        return _voice(context, muted);
    }
  }

  Widget _replyQuote(BuildContext context, Color fg) {
    final c = chatColorsOf(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: message.mine ? c.accent : c.accent),
              Expanded(
                child: Container(
                  color: message.mine
                      ? Colors.white.withValues(alpha: 0.12)
                      : c.accentSoft,
                  padding: const EdgeInsets.fromLTRB(8, 5, 8, 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        message.replyToAuthor ?? 'Reply',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: message.mine ? Colors.white : c.accent,
                        ),
                      ),
                      Text(
                        message.replyToText ?? '',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.25,
                          color: message.mine ? Colors.white.withValues(alpha: 0.85) : c.muted,
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
  }

  Widget _reactions(BuildContext context) {
    final c = chatColorsOf(context);
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Wrap(
        spacing: 5,
        runSpacing: 4,
        children: [
          for (final r in message.reactions)
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: onToggleReaction == null ? null : () => onToggleReaction!(r.emoji),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: message.mine
                      ? Colors.white.withValues(alpha: r.mine ? 0.28 : 0.14)
                      : (r.mine ? c.accentSoft : c.surfaceAlt),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: message.mine
                        ? Colors.transparent
                        : (r.mine ? c.accent : c.border),
                  ),
                ),
                child: Text(
                  '${r.emoji} ${r.count}',
                  style: TextStyle(
                    fontSize: 12,
                    color: message.mine ? Colors.white : c.text,
                    fontWeight: r.mine ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _statusIcon(ChatColors c) {
    final icon = switch (message.status) {
      MessageStatus.sent => Icons.check,
      MessageStatus.delivered => Icons.done_all,
      MessageStatus.read => Icons.done_all,
    };
    final color = message.status == MessageStatus.read
        ? const Color(0xFF7FC8FF)
        : c.outgoingText.withValues(alpha: 0.55);
    return Icon(icon, size: 14, color: color);
  }

  Widget _location(BuildContext context, Color fg, Color muted) {
    final c = chatColorsOf(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: 220,
            height: 108,
            child: Stack(
              fit: StackFit.expand,
              children: [
                const CustomPaint(painter: _MapGridPainter()),
                Center(
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: kRed,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
                    ),
                    child: const Icon(Icons.location_on, color: Colors.white, size: 20),
                  ),
                ),
                Positioned(
                  left: 8,
                  bottom: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'Live location',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: kNavy),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '${(message.lat ?? 0).toStringAsFixed(4)}, ${(message.lng ?? 0).toStringAsFixed(4)}',
          style: TextStyle(fontSize: 12, color: muted),
        ),
        InkWell(
          onTap: onOpenLocation ??
              () => openInGoogleMaps(message.lat ?? 0, message.lng ?? 0),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.open_in_new, size: 13, color: message.mine ? Colors.white : c.accent),
                const SizedBox(width: 4),
                Text(
                  'Open in Google Maps',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: message.mine ? Colors.white : c.accent,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (message.text.isNotEmpty)
          Text(message.text, style: TextStyle(fontSize: 14, color: fg)),
      ],
    );
  }

  Widget _voice(BuildContext context, Color muted) {
    const heights = [8.0, 14.0, 20.0, 11.0, 24.0, 16.0, 9.0, 18.0, 12.0, 22.0, 10.0, 15.0];
    final seconds = message.voiceSeconds ?? 0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: message.mine ? Colors.white.withValues(alpha: 0.16) : chatColorsOf(context).accentSoft,
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.play_arrow_rounded,
            size: 21,
            color: message.mine ? Colors.white : chatColorsOf(context).accent,
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 26,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < heights.length; i++)
                Container(
                  width: 2.5,
                  height: heights[i],
                  margin: const EdgeInsets.symmetric(horizontal: 1.2),
                  decoration: BoxDecoration(
                    color: (message.mine ? Colors.white : chatColorsOf(context).accent)
                        .withValues(alpha: i < heights.length * 0.4 ? 1 : 0.45),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '0:${seconds.toString().padLeft(2, '0')}',
          style: TextStyle(fontSize: 11.5, color: muted),
        ),
      ],
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}

class _MapGridPainter extends CustomPainter {
  const _MapGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()..color = const Color(0xFFE7EFE4);
    canvas.drawRect(Offset.zero & size, bg);

    final block = Paint()..color = const Color(0xFFD6E4D0);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(12, 12, size.width * 0.32, 30), const Radius.circular(4)),
      block,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
          Rect.fromLTWH(size.width * 0.6, size.height * 0.48, size.width * 0.3, 34), const Radius.circular(4)),
      block,
    );

    final road = Paint()
      ..color = Colors.white
      ..strokeWidth = 7
      ..strokeCap = StrokeCap.round;
    final path = Path()
      ..moveTo(-10, size.height * 0.72)
      ..quadraticBezierTo(size.width * 0.35, size.height * 0.55, size.width * 0.58, size.height * 0.7)
      ..quadraticBezierTo(size.width * 0.82, size.height * 0.86, size.width + 10, size.height * 0.62);
    canvas.drawPath(path, road);

    final thin = Paint()
      ..color = Colors.white.withValues(alpha: 0.8)
      ..strokeWidth = 4;
    canvas.drawLine(Offset(size.width * 0.2, -5), Offset(size.width * 0.2, size.height * 0.4), thin);
    canvas.drawLine(Offset(size.width * 0.2, size.height * 0.4), Offset(size.width * 0.95, size.height * 0.4), thin);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

String _fileSize(int? bytes) {
  if (bytes == null || bytes <= 0) return 'Unknown size';
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

// ---------------------------------------------------------------- typing
class TypingBubble extends StatefulWidget {
  const TypingBubble({super.key});

  @override
  State<TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<TypingBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = chatColorsOf(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 4, 60, 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: c.incoming,
          border: Border.all(color: c.border),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(18),
            bottomLeft: Radius.circular(5),
            bottomRight: Radius.circular(18),
          ),
        ),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < 3; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2.5),
                    child: Transform.translate(
                      offset: Offset(0, -2 * math.sin((_controller.value * 2 * math.pi) + i * 0.9)),
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: c.muted.withValues(alpha: 0.55),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- sheets
const kChatEmojis = [
  '😀', '😂', '😊', '😍', '👍', '👏', '🙏', '🔥',
  '🎉', '❤️', '💯', '✅', '👀', '😮', '😅', '🤝',
  '📍', '🚗', '📞', '📎', '⏰', '💡', '📊', '🙌',
];

const kQuickReactions = ['👍', '❤️', '😂', '😮', '🙏', '🔥'];

Future<void> showEmojiSheet(BuildContext context, ValueChanged<String> onPick) {
  final c = chatColorsOf(context);
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetCtx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Emoji', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: c.text)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final e in kChatEmojis)
                  InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () {
                      Navigator.pop(sheetCtx);
                      onPick(e);
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Text(e, style: const TextStyle(fontSize: 24)),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

Future<void> showReactionSheet(BuildContext context, ValueChanged<String> onPick) {
  final c = chatColorsOf(context);
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetCtx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            for (final e in kQuickReactions)
              InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () {
                  Navigator.pop(sheetCtx);
                  onPick(e);
                },
                child: Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: c.surfaceAlt, shape: BoxShape.circle),
                  child: Text(e, style: const TextStyle(fontSize: 23)),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

Future<void> showMessageActions(
  BuildContext context, {
  required VoidCallback onReply,
  required ValueChanged<String> onReact,
  VoidCallback? onCopy,
}) {
  final c = chatColorsOf(context);
  TextStyle titleStyle = TextStyle(fontWeight: FontWeight.w600, color: c.text);
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetCtx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                for (final e in kQuickReactions)
                  InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () {
                      Navigator.pop(sheetCtx);
                      onReact(e);
                    },
                    child: Container(
                      width: 42,
                      height: 42,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: c.surfaceAlt, shape: BoxShape.circle),
                      child: Text(e, style: const TextStyle(fontSize: 22)),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 20),
          ListTile(
            leading: Icon(Icons.reply, color: c.muted),
            title: Text('Reply', style: titleStyle),
            onTap: () {
              Navigator.pop(sheetCtx);
              onReply();
            },
          ),
          if (onCopy != null)
            ListTile(
              leading: Icon(Icons.copy, color: c.muted),
              title: Text('Copy text', style: titleStyle),
              onTap: () {
                Navigator.pop(sheetCtx);
                onCopy();
              },
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

Future<void> showAttachmentSheet(
  BuildContext context, {
  required VoidCallback onPhoto,
  required VoidCallback onFile,
  required VoidCallback onLocation,
}) {
  final c = chatColorsOf(context);
  Widget option(IconData icon, String label, Color color, VoidCallback onTap) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            color: c.surfaceAlt,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: c.border),
          ),
          child: Column(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 23),
              ),
              const SizedBox(height: 8),
              Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.text)),
            ],
          ),
        ),
      ),
    );
  }

  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetCtx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Share', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: c.text)),
            const SizedBox(height: 14),
            Row(
              children: [
                option(Icons.photo_camera_outlined, 'Photo', kBlue, () {
                  Navigator.pop(sheetCtx);
                  onPhoto();
                }),
                const SizedBox(width: 10),
                option(Icons.attach_file, 'Document', kOrange, () {
                  Navigator.pop(sheetCtx);
                  onFile();
                }),
                const SizedBox(width: 10),
                option(Icons.location_on_outlined, 'Location', kGreen, () {
                  Navigator.pop(sheetCtx);
                  onLocation();
                }),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

String chatDayLabel(DateTime d) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(d.year, d.month, d.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  if (diff < 7) return DateFormat('EEEE').format(d);
  return DateFormat('d MMM yyyy').format(d);
}
