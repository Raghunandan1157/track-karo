import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../api/api_client.dart';
import '../firebase_config.dart';
import 'notifier.dart';

/// Firebase Cloud Messaging registration, so a branch manager gets
/// "location turned off" alerts even when the app is closed.
/// Completely inactive while [kFirebaseEnabled] is false.
class PushService {
  PushService._();

  static bool _listening = false;
  static String? _sentToken;

  /// Called after login / session restore (any role).
  static Future<void> registerAfterLogin() async {
    if (!kFirebaseEnabled) return; // no Firebase calls at all
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(options: kFirebaseOptions);
      }
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      // The backend expects a classic FCM registration token ({kind:"fcm"}).
      // ignore: deprecated_member_use
      await _send(await messaging.getToken());
      if (!_listening) {
        _listening = true;
        // ignore: deprecated_member_use
        messaging.onTokenRefresh.listen(_send, onError: (_) {});
        // App open: show the push as a local notification.
        FirebaseMessaging.onMessage.listen((m) {
          final n = m.notification;
          if (n != null) {
            Notifier.show(3000 + (m.hashCode % 500), n.title ?? 'Track_karo',
                n.body ?? '');
          }
        });
      }
    } catch (_) {
      // Push is optional; the app works without it.
    }
  }

  static Future<void> _send(String? token) async {
    if (token == null || token.isEmpty || Api.instance.token == null) return;
    if (token == _sentToken) return;
    try {
      await Api.instance.post('/device-token', {'kind': 'fcm', 'token': token});
      _sentToken = token;
    } catch (_) {}
  }
}
