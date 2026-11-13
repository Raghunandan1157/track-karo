import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/chat_store.dart';
import '../../theme.dart';
import 'chat_theme.dart';
import 'chat_widgets.dart';

/// Message input: attach, emoji, send, and a hold-free voice recording mode.
/// Everything is local for now - the store is where the API will be wired in.
class ChatComposer extends StatefulWidget {
  const ChatComposer({
    super.key,
    required this.conversation,
    this.replyTo,
    this.onCancelReply,
    this.onSent,
  });

  final ChatConversation conversation;
  final ChatMessage? replyTo;
  final VoidCallback? onCancelReply;
  final VoidCallback? onSent;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focus = FocusNode();
  Timer? _recordTimer;
  int _recordSeconds = 0;
  bool _recording = false;

  @override
  void dispose() {
    _recordTimer?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  bool get _hasText => _controller.text.trim().isNotEmpty;

  void _startRecording() {
    setState(() {
      _recording = true;
      _recordSeconds = 0;
    });
    _recordTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _recordSeconds += 1);
      if (_recordSeconds >= 120) _finishRecording(send: true);
    });
  }

  void _cancelRecording() {
    _recordTimer?.cancel();
    setState(() {
      _recording = false;
      _recordSeconds = 0;
    });
  }

  void _finishRecording({required bool send}) {
    _recordTimer?.cancel();
    final seconds = _recordSeconds < 1 ? 1 : _recordSeconds;
    setState(() {
      _recording = false;
      _recordSeconds = 0;
    });
    if (send) ChatStore.instance.sendVoice(seconds);
  }

  void _send() {
    final text = _controller.text;
    if (text.trim().isEmpty) return;
    ChatStore.instance.sendText(text, replyTo: widget.replyTo);
    _controller.clear();
    widget.onSent?.call();
    setState(() {});
    _focus.requestFocus();
  }

  void _insertEmoji(String emoji) {
    final value = _controller.value;
    final text = value.text;
    final start = value.selection.start < 0 ? text.length : value.selection.start;
    final end = value.selection.end < 0 ? text.length : value.selection.end;
    _controller.value = TextEditingValue(
      text: text.replaceRange(start, end, emoji),
      selection: TextSelection.collapsed(offset: start + emoji.length),
    );
    setState(() {});
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final c = chatColorsOf(context);
    if (widget.conversation.readOnly) {
      return Container(
        decoration: BoxDecoration(
          color: c.surface,
          border: Border(top: BorderSide(color: c.border)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Row(
              children: [
                Icon(Icons.lock_outline, size: 18, color: c.faint),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Only admins can post in this channel',
                    style: TextStyle(color: c.muted, fontSize: 13.5),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 8, 8, 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.replyTo != null) _replyBar(context, widget.replyTo!),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Attach',
                    onPressed: () => showAttachmentSheet(
                      context,
                      onPhoto: () => ChatStore.instance.sendImage(),
                      onFile: () => ChatStore.instance.sendFile(),
                      onLocation: () => ChatStore.instance.sendLocation(),
                    ),
                    icon: Icon(Icons.add_circle_outline, color: c.muted),
                  ),
                  Expanded(
                    child: _recording
                        ? _recordingBar(context)
                        : TextField(
                            controller: _controller,
                            focusNode: _focus,
                            minLines: 1,
                            maxLines: 5,
                            textCapitalization: TextCapitalization.sentences,
                            keyboardType: TextInputType.multiline,
                            onChanged: (_) => setState(() {}),
                            style: TextStyle(fontSize: 15, color: c.text),
                            decoration: InputDecoration(
                              hintText: 'Message ${widget.conversation.name}',
                              hintStyle: TextStyle(color: c.faint, fontSize: 14.5),
                              filled: true,
                              fillColor: c.surfaceAlt,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(22),
                                borderSide: BorderSide(color: c.border),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(22),
                                borderSide: BorderSide(color: c.border),
                              ),
                            ),
                          ),
                  ),
                  if (!_recording) ...[
                    IconButton(
                      tooltip: 'Emoji',
                      onPressed: () => showEmojiSheet(context, _insertEmoji),
                      icon: Icon(Icons.emoji_emotions_outlined, color: c.muted),
                    ),
                    _sendButton(context),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sendButton(BuildContext context) {
    final c = chatColorsOf(context);
    if (!_hasText) {
      return IconButton(
        tooltip: 'Record a voice note',
        onPressed: _startRecording,
        icon: Icon(Icons.mic_none, color: c.muted),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 2),
      child: Material(
        color: c.outgoing,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: _send,
          child: const SizedBox(
            width: 44,
            height: 44,
            child: Icon(Icons.send_rounded, color: Colors.white, size: 21),
          ),
        ),
      ),
    );
  }

  Widget _replyBar(BuildContext context, ChatMessage reply) {
    final c = chatColorsOf(context);
    return Container(
      margin: const EdgeInsets.fromLTRB(8, 0, 8, 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(9),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 3, color: c.accent),
              Expanded(
                child: Container(
                  color: c.surfaceAlt,
                  padding: const EdgeInsets.fromLTRB(10, 5, 6, 5),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Replying to ${reply.authorName}',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: c.accent,
                              ),
                            ),
                            Text(
                              chatMessagePreview(reply),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12.5, color: c.muted),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        visualDensity: VisualDensity.compact,
                        tooltip: 'Cancel reply',
                        onPressed: widget.onCancelReply,
                        icon: Icon(Icons.close, size: 18, color: c.muted),
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

  Widget _recordingBar(BuildContext context) {
    final c = chatColorsOf(context);
    return Container(
      height: 46,
      padding: const EdgeInsets.only(left: 14, right: 2),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: c.accent.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: const BoxDecoration(color: kRed, shape: BoxShape.circle),
          ),
          const SizedBox(width: 9),
          Text(
            '0:${_recordSeconds.toString().padLeft(2, '0')}',
            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.text),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Recording',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12.5, color: c.muted),
            ),
          ),
          IconButton(
            tooltip: 'Cancel',
            visualDensity: VisualDensity.compact,
            onPressed: _cancelRecording,
            icon: const Icon(Icons.close, size: 19, color: kRed),
          ),
          IconButton(
            tooltip: 'Send voice note',
            visualDensity: VisualDensity.compact,
            onPressed: () => _finishRecording(send: true),
            icon: Icon(Icons.send_rounded, color: c.outgoing, size: 20),
          ),
        ],
      ),
    );
  }
}
