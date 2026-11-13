import 'dart:async';

import 'package:flutter/material.dart';

import 'session.dart';

/// Chat kinds. The AI thread is always pinned to the top of the list.
enum ChatKind { ai, direct, group, broadcast }

enum MessageKind { text, image, file, location, voice }

enum MessageStatus { sent, delivered, read }

class ChatReaction {
  ChatReaction(this.emoji, this.count, {this.mine = false});

  final String emoji;
  int count;
  bool mine;
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.mine,
    required this.at,
    this.kind = MessageKind.text,
    this.text = '',
    this.status = MessageStatus.read,
    this.replyToAuthor,
    this.replyToText,
    this.fileName,
    this.fileSize,
    this.voiceSeconds,
    this.lat,
    this.lng,
    List<ChatReaction>? reactions,
  }) : reactions = reactions ?? [];

  final String id;
  final String conversationId;
  final String authorId;
  final String authorName;
  final bool mine;
  final DateTime at;
  final MessageKind kind;
  final String text;
  final String? replyToAuthor;
  final String? replyToText;
  final String? fileName;
  final int? fileSize;
  final int? voiceSeconds;
  final double? lat;
  final double? lng;
  final List<ChatReaction> reactions;
  MessageStatus status;
}

class ChatConversation {
  ChatConversation({
    required this.id,
    required this.name,
    required this.kind,
    required this.color,
    required this.createdAt,
    this.subtitle = '',
    this.members = const [],
    this.pinned = false,
    this.readOnly = false,
    this.online = false,
    this.unread = 0,
    this.typing = false,
    List<ChatMessage>? messages,
  }) : messages = messages ?? [];

  final String id;
  final String name;
  final ChatKind kind;
  final Color color;
  final DateTime createdAt;
  final List<String> members;
  final bool pinned;
  final bool readOnly;

  String subtitle;
  bool online;
  int unread;
  bool typing;
  final List<ChatMessage> messages;

  ChatMessage? get lastMessage => messages.isEmpty ? null : messages.last;

  DateTime get lastAt => lastMessage?.at ?? createdAt;

  String get preview {
    if (typing) return 'typing...';
    final m = lastMessage;
    if (m == null) return 'No messages yet';
    final body = switch (m.kind) {
      MessageKind.text => m.text,
      MessageKind.image => 'Photo',
      MessageKind.file => m.fileName ?? 'Document',
      MessageKind.location => 'Shared a live location',
      MessageKind.voice => 'Voice note - ${m.voiceSeconds ?? 0}s',
    };
    return m.mine ? 'You: $body' : body;
  }

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      final p = parts.first;
      return (p.length == 1 ? p : p.substring(0, 2)).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}

/// In-memory chat store with seeded demo data. No API calls yet - swapping in
/// the real endpoints means replacing the seed with fetches and keeping the
/// same public methods the screens call.
class ChatStore extends ChangeNotifier {
  ChatStore._() {
    _seed();
  }

  static final ChatStore instance = ChatStore._();

  final List<ChatConversation> _conversations = [];

  bool _dark = false;
  String _activeId = 'ai';
  int _seq = 1000;

  bool get dark => _dark;

  String get activeId => _activeId;

  int get unreadTotal =>
      _conversations.where((c) => c.id != _activeId).fold(0, (sum, c) => sum + c.unread);

  List<ChatConversation> get conversations {
    final pinned = _conversations.where((c) => c.pinned).toList();
    final rest = _conversations.where((c) => !c.pinned).toList()
      ..sort((a, b) => b.lastAt.compareTo(a.lastAt));
    return [...pinned, ...rest];
  }

  ChatConversation? byId(String id) {
    for (final c in _conversations) {
      if (c.id == id) return c;
    }
    return null;
  }

  ChatConversation get active => byId(_activeId) ?? _conversations.first;

  void setDark(bool value) {
    if (_dark == value) return;
    _dark = value;
    notifyListeners();
  }

  void toggleDark() => setDark(!_dark);

  void open(String id) {
    final c = byId(id);
    if (c == null) return;
    _activeId = id;
    c.unread = 0;
    notifyListeners();
  }

  void markAllRead() {
    for (final c in _conversations) {
      c.unread = 0;
    }
    notifyListeners();
  }

  // ---------------------------------------------------------------- sending
  void sendText(String text, {ChatMessage? replyTo}) {
    final body = text.trim();
    final c = active;
    if (body.isEmpty || c.readOnly) return;
    _append(
      c,
      ChatMessage(
        id: _id(),
        conversationId: c.id,
        authorId: 'me',
        authorName: 'You',
        mine: true,
        at: DateTime.now(),
        text: body,
        status: MessageStatus.sent,
        replyToAuthor: replyTo?.authorName,
        replyToText: replyTo == null ? null : _replyPreview(replyTo),
      ),
    );
  }

  void sendImage({String? name}) {
    final c = active;
    if (c.readOnly) return;
    _append(
      c,
      ChatMessage(
        id: _id(),
        conversationId: c.id,
        authorId: 'me',
        authorName: 'You',
        mine: true,
        at: DateTime.now(),
        kind: MessageKind.image,
        fileName: name ?? 'IMG_2418.jpg',
        status: MessageStatus.sent,
      ),
    );
  }

  void sendFile({String? name, int? size}) {
    final c = active;
    if (c.readOnly) return;
    _append(
      c,
      ChatMessage(
        id: _id(),
        conversationId: c.id,
        authorId: 'me',
        authorName: 'You',
        mine: true,
        at: DateTime.now(),
        kind: MessageKind.file,
        fileName: name ?? 'Visit-report.pdf',
        fileSize: size ?? 248000,
        status: MessageStatus.sent,
      ),
    );
  }

  void sendLocation({double lat = 18.5204, double lng = 73.8567}) {
    final c = active;
    if (c.readOnly) return;
    _append(
      c,
      ChatMessage(
        id: _id(),
        conversationId: c.id,
        authorId: 'me',
        authorName: 'You',
        mine: true,
        at: DateTime.now(),
        kind: MessageKind.location,
        lat: lat,
        lng: lng,
        status: MessageStatus.sent,
      ),
    );
  }

  void sendVoice(int seconds) {
    final c = active;
    if (c.readOnly) return;
    _append(
      c,
      ChatMessage(
        id: _id(),
        conversationId: c.id,
        authorId: 'me',
        authorName: 'You',
        mine: true,
        at: DateTime.now(),
        kind: MessageKind.voice,
        voiceSeconds: seconds.clamp(1, 600).toInt(),
        status: MessageStatus.sent,
      ),
    );
  }

  void toggleReaction(ChatMessage message, String emoji) {
    ChatReaction? found;
    for (final r in message.reactions) {
      if (r.emoji == emoji) found = r;
    }
    if (found == null) {
      message.reactions.add(ChatReaction(emoji, 1, mine: true));
    } else if (found.mine) {
      found.count -= 1;
      found.mine = false;
      if (found.count <= 0) message.reactions.remove(found);
    } else {
      found.count += 1;
      found.mine = true;
    }
    notifyListeners();
  }

  void _append(ChatConversation c, ChatMessage m) {
    c.messages.add(m);
    c.typing = false;
    c.unread = 0;
    notifyListeners();
    _tick(c, m.id);
    _autoReply(c);
  }

  /// sent -> delivered -> read ticks.
  void _tick(ChatConversation c, String id) {
    Future.delayed(const Duration(milliseconds: 700), () {
      for (final m in c.messages) {
        if (m.id == id && m.status == MessageStatus.sent) {
          m.status = MessageStatus.delivered;
          notifyListeners();
          return;
        }
      }
    });
    Future.delayed(const Duration(milliseconds: 1800), () {
      for (final m in c.messages) {
        if (m.id == id && m.status != MessageStatus.read) {
          m.status = MessageStatus.read;
          notifyListeners();
          return;
        }
      }
    });
  }

  /// Demo-only reply so the typing indicator and read receipts are visible
  /// before the real API exists. Broadcast channels never answer.
  void _autoReply(ChatConversation c) {
    if (c.readOnly) return;
    Future.delayed(const Duration(milliseconds: 900), () {
      if (byId(c.id) == null) return;
      c.typing = true;
      notifyListeners();
    });
    Future.delayed(const Duration(milliseconds: 2900), () {
      if (byId(c.id) == null) return;
      c.typing = false;
      final now = DateTime.now();
      final String text;
      final String author;
      final String authorId;
      if (c.kind == ChatKind.ai) {
        author = 'AI Assistant';
        authorId = 'ai';
        text = [
          'Preview data only for now - once the API is connected I will answer from live tracking, attendance and visit data.',
          'I can see 4 officers on duty in Pune Central. Two have a location gap longer than 20 minutes; want the names?',
          'Today: 6 customer visits completed, 1 marked missed. Tomorrow\u2019s assignments are still unapproved.',
        ][_seq % 3];
      } else if (c.kind == ChatKind.group) {
        author = c.members.isEmpty ? 'Team member' : c.members.first;
        authorId = author;
        text = ['Noted, I will update after the next visit.', 'Sure, sharing the details in a bit.', 'Reached the customer, marking the task now.'][_seq % 3];
      } else if (c.kind == ChatKind.direct) {
        author = c.name;
        authorId = c.id;
        text = ['Got it, thanks.', 'I will check and get back to you.', 'Done - updated the task status.'][_seq % 3];
      } else {
        return;
      }
      c.messages.add(ChatMessage(
        id: _id(),
        conversationId: c.id,
        authorId: authorId,
        authorName: author,
        mine: false,
        at: now,
        text: text,
        status: MessageStatus.read,
      ));
      if (c.id != _activeId) c.unread += 1;
      notifyListeners();
    });
  }

  String _replyPreview(ChatMessage m) => chatMessagePreview(m);

  String _id() => 'm${_seq++}';

  // ------------------------------------------------------------------ seed
  void _seed() {
    final me = Session.instance.user;
    final firstName = (me?.name ?? '').trim().split(RegExp(r'\s+')).first;
    final greetingName = firstName.isEmpty ? 'there' : firstName;
    final isOfficer = me?.isOfficer ?? true;
    final now = DateTime.now();

    ChatMessage msg(
      String convId, {
      required String author,
      required String text,
      bool mine = false,
      Duration ago = Duration.zero,
      MessageKind kind = MessageKind.text,
      String? replyToAuthor,
      String? replyToText,
      String? fileName,
      int? fileSize,
      int? voiceSeconds,
      double? lat,
      double? lng,
      List<ChatReaction>? reactions,
      MessageStatus status = MessageStatus.read,
    }) {
      return ChatMessage(
        id: _id(),
        conversationId: convId,
        authorId: mine ? 'me' : author,
        authorName: author,
        mine: mine,
        at: now.subtract(ago),
        kind: kind,
        text: text,
        fileName: fileName,
        fileSize: fileSize,
        voiceSeconds: voiceSeconds,
        lat: lat,
        lng: lng,
        reactions: reactions,
        status: status,
        replyToAuthor: replyToAuthor,
        replyToText: replyToText,
      );
    }

    // 1. AI - always pinned first.
    final ai = ChatConversation(
      id: 'ai',
      name: 'AI Assistant',
      kind: ChatKind.ai,
      color: const Color(0xFF2F6DB5),
      subtitle: 'Always available - preview mode',
      pinned: true,
      createdAt: now.subtract(const Duration(days: 30)),
      messages: [
        msg('ai',
            author: 'AI Assistant',
            text: 'Hi $greetingName, I am your Track_karo assistant. Ask me about attendance, routes, tasks or customer visits.',
            ago: const Duration(hours: 3)),
        msg('ai',
            author: 'AI Assistant',
            text: 'You can also send a location or a photo, and I will pull up the related visit.',
            ago: const Duration(hours: 3, minutes: -4)),
        msg('ai',
            author: 'You',
            text: 'How is the Pune Central team doing today?',
            mine: true,
            ago: const Duration(minutes: 26)),
        msg('ai',
            author: 'AI Assistant',
            text: '4 of 5 officers are on duty. Ramesh has covered 12.4 km and 6 customers; Imran has been at one stop for 42 minutes. Want the full breakdown?',
            ago: const Duration(minutes: 25),
            reactions: [ChatReaction('👍', 1, mine: true)]),
      ],
    );

    // 2. Branch group.
    final group = ChatConversation(
      id: 'group-branch',
      name: 'Pune Central team',
      kind: ChatKind.group,
      color: const Color(0xFF2F6DB5),
      subtitle: '5 members',
      members: const ['Ramesh Patil', 'Sneha Kulkarni', 'Aarti Jadhav', 'Imran Shaikh'],
      unread: 2,
      createdAt: now.subtract(const Duration(days: 120)),
      messages: [
        msg('group-branch',
            author: 'Ramesh Patil',
            text: 'Reached the Wagholi customer. Will share the visit in 10 minutes.',
            ago: const Duration(hours: 1, minutes: 10)),
        msg('group-branch',
            author: 'Sneha Kulkarni',
            text: 'Traffic near Kharadi bypass - adding about 15 minutes to my route.',
            ago: const Duration(minutes: 42)),
        msg('group-branch',
            author: 'You',
            text: 'Noted. Update the task status when you reach.',
            mine: true,
            ago: const Duration(minutes: 36)),
        msg('group-branch',
            author: 'Aarti Jadhav',
            text: 'Morning collection sheet is in the branch folder. Two signatures are pending.',
            ago: const Duration(minutes: 12)),
        msg('group-branch',
            author: 'Imran Shaikh',
            text: 'Lunch break, back in 20.',
            ago: const Duration(minutes: 8)),
      ],
    );

    // 3. Read-only broadcast.
    final broadcast = ChatConversation(
      id: 'broadcast',
      name: 'Announcements',
      kind: ChatKind.broadcast,
      color: const Color(0xFFE08A2B),
      subtitle: 'Admin announcements - read only',
      readOnly: true,
      createdAt: now.subtract(const Duration(days: 200)),
      messages: [
        msg('broadcast',
            author: 'Vikram Rao',
            text: 'Office closed on Friday for maintenance. Field visits move to Saturday.',
            ago: const Duration(days: 1, hours: 3)),
        msg('broadcast',
            author: 'Vikram Rao',
            text: 'Submit expense bills before 5 PM today.',
            ago: const Duration(days: 1, hours: 1)),
      ],
    );

    // 4. Direct messages.
    final ramesh = ChatConversation(
      id: 'dm-ramesh',
      name: 'Ramesh Patil',
      kind: ChatKind.direct,
      color: const Color(0xFF1E8E4E),
      subtitle: 'Field officer',
      online: true,
      unread: 1,
      createdAt: now.subtract(const Duration(days: 60)),
      messages: [
        msg('dm-ramesh',
            author: 'Ramesh Patil',
            text: 'Sir, the customer is not available at Undri. Should I mark it as missed?',
            ago: const Duration(hours: 2, minutes: 20)),
        msg('dm-ramesh',
            author: 'You',
            text: 'Try once more after lunch, then mark it missed.',
            mine: true,
            ago: const Duration(hours: 2, minutes: 12)),
        msg('dm-ramesh',
            author: 'Ramesh Patil',
            text: 'Done. Marked as missed and moved to Hadapsar.',
            ago: const Duration(minutes: 15)),
      ],
    );

    final sneha = ChatConversation(
      id: 'dm-sneha',
      name: 'Sneha Kulkarni',
      kind: ChatKind.direct,
      color: const Color(0xFF6D3FC0),
      subtitle: 'Field officer',
      online: true,
      unread: 0,
      createdAt: now.subtract(const Duration(days: 45)),
      messages: [
        msg('dm-sneha',
            author: 'Sneha Kulkarni',
            text: 'Tomorrow I will start from the Kharadi side, the Mundhwa route is blocked.',
            ago: const Duration(days: 1, hours: 4)),
        msg('dm-sneha',
            author: 'You',
            text: 'Fine, I will adjust the first two tasks.',
            mine: true,
            ago: const Duration(days: 1, hours: 3)),
      ],
    );

    final imran = ChatConversation(
      id: 'dm-imran',
      name: 'Imran Shaikh',
      kind: ChatKind.direct,
      color: const Color(0xFFB26A00),
      subtitle: 'Field officer - last seen 20 min ago',
      createdAt: now.subtract(const Duration(days: 30)),
      messages: [
        msg('dm-imran',
            author: 'Imran Shaikh',
            text: 'Sharing my current location for the visit log.',
            ago: const Duration(hours: 5)),
        msg('dm-imran',
            author: 'Imran Shaikh',
            text: '',
            kind: MessageKind.location,
            lat: 18.5513,
            lng: 73.9380,
            ago: const Duration(hours: 5),
            reactions: [ChatReaction('📍', 1)]),
        msg('dm-imran',
            author: 'You',
            text: 'Got it, the geofence matched. Mark the visit complete.',
            mine: true,
            ago: const Duration(hours: 4, minutes: 50)),
      ],
    );

    final manager = ChatConversation(
      id: 'dm-manager',
      name: isOfficer ? 'Neha Deshmukh' : 'Vikram Rao',
      kind: ChatKind.direct,
      color: const Color(0xFF14285A),
      subtitle: isOfficer ? 'Branch manager' : 'Admin',
      createdAt: now.subtract(const Duration(days: 90)),
      messages: [
        msg('dm-manager',
            author: isOfficer ? 'Neha Deshmukh' : 'Vikram Rao',
            text: 'Please review the visit reports before 6 PM.',
            ago: const Duration(hours: 7)),
        msg('dm-manager',
            author: 'You',
            text: 'On it. I will send the summary once the last officer ends the day.',
            mine: true,
            ago: const Duration(hours: 6, minutes: 40)),
      ],
    );

    final aarti = ChatConversation(
      id: 'dm-aarti',
      name: 'Aarti Jadhav',
      kind: ChatKind.direct,
      color: const Color(0xFFB23A6B),
      subtitle: 'Field officer',
      createdAt: now.subtract(const Duration(days: 20)),
      messages: [
        msg('dm-aarti',
            author: 'Aarti Jadhav',
            text: 'Sent the collection sheet to the branch email.',
            ago: const Duration(days: 2, hours: 2)),
        msg('dm-aarti',
            author: 'Aarti Jadhav',
            text: '',
            kind: MessageKind.file,
            fileName: 'collection-12-nov.xlsx',
            fileSize: 184000,
            ago: const Duration(days: 2, hours: 2)),
      ],
    );

    _conversations.addAll([ai, group, broadcast, ramesh, sneha, imran, manager, aarti]);
  }
}

/// One-line preview of a message, used by the reply bar and the chat list.
String chatMessagePreview(ChatMessage m) => switch (m.kind) {
      MessageKind.text => m.text,
      MessageKind.image => 'Photo',
      MessageKind.file => m.fileName ?? 'Document',
      MessageKind.location => 'Shared a live location',
      MessageKind.voice => 'Voice note - ${m.voiceSeconds ?? 0}s',
    };

