import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../api/api_client.dart';
import '../config.dart';

class SseEvent {
  SseEvent(this.event, this.data);
  final String event;
  final Map<String, dynamic> data;
}

/// Server-Sent Events client for `GET /stream?token=` built on a streamed
/// `package:http` response. Reconnects when the server closes the stream
/// (about every 4 minutes) or the network drops. Call [stop] when the app
/// goes to background and [start] when it returns.
class SseClient {
  final StreamController<SseEvent> _events =
      StreamController<SseEvent>.broadcast();
  Stream<SseEvent> get events => _events.stream;

  final ValueNotifier<bool> connected = ValueNotifier<bool>(false);

  http.Client? _client;
  StreamSubscription<String>? _sub;
  Timer? _retryTimer;
  Timer? _watchdog;
  bool _wanted = false;
  int _failures = 0;
  int _generation = 0;

  void start() {
    if (_wanted) return;
    _wanted = true;
    _failures = 0;
    _connect();
  }

  void stop() {
    _wanted = false;
    _generation++;
    _close();
  }

  void _close() {
    _retryTimer?.cancel();
    _retryTimer = null;
    _watchdog?.cancel();
    _watchdog = null;
    _sub?.cancel();
    _sub = null;
    _client?.close();
    _client = null;
    connected.value = false;
  }

  void _scheduleReconnect({required bool afterError}) {
    _close();
    if (!_wanted) return;
    if (afterError) _failures++;
    // Normal server close: reconnect at once. Errors: back off up to 30 s.
    final wait = afterError
        ? Duration(seconds: [2, 4, 8, 15, 30][(_failures - 1).clamp(0, 4)])
        : const Duration(milliseconds: 500);
    _retryTimer = Timer(wait, _connect);
  }

  /// The server pings regularly; silence for 90 s means a dead socket.
  void _armWatchdog(int gen) {
    _watchdog?.cancel();
    _watchdog = Timer(const Duration(seconds: 90), () {
      if (gen == _generation && _wanted) _scheduleReconnect(afterError: true);
    });
  }

  Future<void> _connect() async {
    final token = Api.instance.token;
    if (!_wanted || token == null) return;
    final gen = ++_generation;
    final client = http.Client();
    _client = client;
    try {
      final uri = Uri.parse('$kApiBase/stream')
          .replace(queryParameters: {'token': token});
      final req = http.Request('GET', uri)
        ..headers['Accept'] = 'text/event-stream'
        ..headers['Cache-Control'] = 'no-cache';
      final res = await client.send(req).timeout(const Duration(seconds: 25));
      if (gen != _generation || !_wanted) {
        client.close();
        return;
      }
      if (res.statusCode == 401) {
        _wanted = false;
        _close();
        Api.instance.onUnauthorized?.call();
        return;
      }
      if (res.statusCode != 200) {
        _scheduleReconnect(afterError: true);
        return;
      }
      _failures = 0;
      connected.value = true;
      _armWatchdog(gen);

      var event = 'message';
      final data = StringBuffer();
      _sub = res.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(
        (line) {
          if (gen != _generation) return;
          _armWatchdog(gen);
          if (line.isEmpty) {
            // blank line = end of one event
            if (data.isNotEmpty) _dispatch(event, data.toString());
            event = 'message';
            data.clear();
          } else if (line.startsWith(':')) {
            // comment / keep-alive
          } else if (line.startsWith('event:')) {
            event = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            if (data.isNotEmpty) data.write('\n');
            data.write(line.substring(5).trimLeft());
          }
        },
        onDone: () {
          if (gen == _generation) _scheduleReconnect(afterError: false);
        },
        onError: (_) {
          if (gen == _generation) _scheduleReconnect(afterError: true);
        },
        cancelOnError: true,
      );
    } catch (_) {
      if (gen == _generation) _scheduleReconnect(afterError: true);
    }
  }

  void _dispatch(String event, String raw) {
    if (event == 'ping') return;
    try {
      final j = jsonDecode(raw);
      if (j is Map) _events.add(SseEvent(event, Map<String, dynamic>.from(j)));
    } catch (_) {
      // ignore malformed event
    }
  }
}
