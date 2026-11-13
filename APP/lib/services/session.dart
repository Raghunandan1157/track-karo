import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../models/models.dart';
import 'manager_store.dart';
import 'push_service.dart';
import 'tracking_service.dart';

/// Logged-in user + token. Token lives in secure storage (falls back to
/// shared_preferences if the keystore is unavailable).
class Session extends ChangeNotifier {
  Session._() {
    Api.instance.onUnauthorized = () => logout(expired: true);
  }
  static final Session instance = Session._();

  static const _kToken = 'tk_token';
  static const _kUser = 'tk_user';
  static const FlutterSecureStorage _secure = FlutterSecureStorage();

  User? user;
  bool restoring = true;
  bool _loggingOut = false;

  /// Set when the session ended because the server answered 401.
  bool expired = false;

  bool get loggedIn => user != null && Api.instance.token != null;

  Future<String?> _read(String key) async {
    try {
      final v = await _secure.read(key: key);
      if (v != null) return v;
    } catch (_) {}
    try {
      return (await SharedPreferences.getInstance()).getString(key);
    } catch (_) {
      return null;
    }
  }

  Future<void> _write(String key, String? value) async {
    var stored = false;
    try {
      if (value == null) {
        await _secure.delete(key: key);
      } else {
        await _secure.write(key: key, value: value);
      }
      stored = true;
    } catch (_) {}
    try {
      final prefs = await SharedPreferences.getInstance();
      if (value == null || stored) {
        await prefs.remove(key);
      } else {
        await prefs.setString(key, value);
      }
    } catch (_) {}
  }

  Future<void> restore() async {
    try {
      final token = await _read(_kToken);
      final rawUser = await _read(_kUser);
      if (token != null && rawUser != null) {
        Api.instance.token = token;
        user = User.fromJson(asMap(jsonDecode(rawUser)));
      }
    } catch (_) {
      user = null;
      Api.instance.token = null;
    }
    restoring = false;
    notifyListeners();
    if (loggedIn) {
      PushService.registerAfterLogin();
      _refreshMe();
    }
  }

  /// Refresh the stored profile (role / branch may have changed).
  Future<void> _refreshMe() async {
    try {
      final res = await Api.instance.get('/me');
      final u = asMap(asMap(res)['user']);
      if (u.isNotEmpty && user != null) {
        user = User.fromJson(u);
        await _write(_kUser, jsonEncode(user!.toJson()));
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> login(String userid, String password) async {
    final res = asMap(await Api.instance
        .post('/login', {'userid': userid.trim(), 'password': password}));
    final token = asStr(res['token']);
    final u = asMap(res['user']);
    if (token.isEmpty || u.isEmpty) {
      throw ApiException('Login failed. Try again.');
    }
    Api.instance.token = token;
    user = User.fromJson(u);
    expired = false;
    await _write(_kToken, token);
    await _write(_kUser, jsonEncode(user!.toJson()));
    notifyListeners();
    PushService.registerAfterLogin();
  }

  Future<void> logout({bool expired = false}) async {
    if (_loggingOut || (user == null && Api.instance.token == null)) return;
    _loggingOut = true;
    try {
      this.expired = expired;
      ManagerStore.instance.reset();
      // Last chance to send what is queued, then stop tracking on this phone.
      if (!expired && TrackingService.instance.active) {
        await TrackingService.instance
            .flush()
            .timeout(const Duration(seconds: 8), onTimeout: () {});
      }
      await TrackingService.instance.stop(clearQueue: true);
      Api.instance.token = null;
      user = null;
      await _write(_kToken, null);
      await _write(_kUser, null);
    } finally {
      _loggingOut = false;
      notifyListeners();
    }
  }
}
