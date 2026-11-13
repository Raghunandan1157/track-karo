import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../models/models.dart';
import '../widgets/common.dart';
import 'notifier.dart';
import 'sse_client.dart';

/// Shared live state for the branch manager / admin screens.
/// Lists are loaded once and then kept up to date by the SSE stream
/// (no timer polling). The stream is closed while the app is in background.
class ManagerStore extends ChangeNotifier {
  ManagerStore._();
  static final ManagerStore instance = ManagerStore._();

  final SseClient sse = SseClient();
  StreamSubscription<SseEvent>? _sub;
  bool _started = false;

  List<Officer> officers = [];
  List<BranchPin> branches = [];
  List<CustomerPin> customers = [];
  List<AlertItem> alerts = [];
  int unread = 0;

  bool loadingLive = false;
  bool loadingAlerts = false;
  String? liveError;
  String? alertsError;
  bool loadedOnce = false;

  int _alertNotifId = 2000;

  void start() {
    if (_started) return;
    _started = true;
    _sub = sse.events.listen(_onEvent);
    sse.start();
    loadAll();
  }

  /// App went to background: close the stream to keep server costs low.
  void pause() {
    if (_started) sse.stop();
  }

  /// App is visible again: reopen the stream and reload once (events were
  /// missed while the stream was closed).
  void resume() {
    if (!_started) return;
    sse.start();
    loadAll();
  }

  void reset() {
    sse.stop();
    _sub?.cancel();
    _sub = null;
    _started = false;
    officers = [];
    branches = [];
    customers = [];
    alerts = [];
    unread = 0;
    liveError = alertsError = null;
    loadedOnce = false;
  }

  Future<void> loadAll() async {
    await Future.wait([loadLive(), loadAlerts()]);
  }

  /// GET /live gives officers + branch offices + located customers in one call.
  Future<void> loadLive() async {
    loadingLive = true;
    notifyListeners();
    try {
      final res = asMap(await Api.instance.get('/live'));
      officers = asList(res['officers']).map(Officer.fromJson).toList();
      branches = asList(res['branches']).map(BranchPin.fromJson).toList();
      customers = asList(res['customers']).map(CustomerPin.fromJson).toList();
      liveError = null;
      loadedOnce = true;
    } on ApiException catch (e) {
      liveError = e.message;
      // /live failed: still try the plain officer list for the Team tab.
      try {
        final res = asMap(await Api.instance.get('/officers'));
        officers = asList(res['officers']).map(Officer.fromJson).toList();
        loadedOnce = true;
      } catch (_) {}
    } catch (_) {
      liveError = 'Could not load data.';
    }
    loadingLive = false;
    notifyListeners();
  }

  /// GET /officers (Team tab pull-to-refresh).
  Future<void> loadOfficers() async {
    loadingLive = true;
    notifyListeners();
    try {
      final res = asMap(await Api.instance.get('/officers'));
      officers = asList(res['officers']).map(Officer.fromJson).toList();
      liveError = null;
      loadedOnce = true;
    } on ApiException catch (e) {
      liveError = e.message;
    } catch (_) {
      liveError = 'Could not load officers.';
    }
    loadingLive = false;
    notifyListeners();
  }

  Future<void> loadAlerts() async {
    loadingAlerts = true;
    notifyListeners();
    try {
      final res = asMap(
          await Api.instance.get('/alerts', query: {'limit': 50}));
      alerts = asList(res['alerts']).map(AlertItem.fromJson).toList();
      unread = res['unread_count'] == null
          ? alerts.where((a) => a.unread).length
          : asInt(res['unread_count']);
      alertsError = null;
    } on ApiException catch (e) {
      alertsError = e.message;
    } catch (_) {
      alertsError = 'Could not load alerts.';
    }
    loadingAlerts = false;
    notifyListeners();
  }

  Future<void> markRead(AlertItem a) async {
    if (!a.unread) return;
    a.readAt = DateTime.now();
    if (unread > 0) unread--;
    notifyListeners();
    try {
      await Api.instance.post('/alerts/${a.id}/read');
    } on ApiException catch (e) {
      a.readAt = null;
      unread++;
      notifyListeners();
      showSnack(e.message, error: true);
    }
  }

  Future<void> markAllRead() async {
    try {
      await Api.instance.post('/alerts/read-all');
      final now = DateTime.now();
      for (final a in alerts) {
        a.readAt ??= now;
      }
      unread = 0;
      notifyListeners();
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    }
  }

  void _onEvent(SseEvent e) {
    switch (e.event) {
      case 'location':
        _applyLocation(e.data);
      case 'customer':
        _applyCustomer(e.data);
      case 'alert':
        _applyAlert(e.data);
    }
  }

  void _applyLocation(Map<String, dynamic> d) {
    final id = asStr(d['officer_id']);
    if (id.isEmpty) return;
    var o = officers.where((x) => x.id == id).firstOrNull;
    if (o == null) {
      o = Officer(id: id, name: asStr(d['name']));
      officers = [...officers, o];
    }
    if (asStr(d['name']).isNotEmpty) o.name = asStr(d['name']);
    o.lat = asDouble(d['lat']) ?? o.lat;
    o.lng = asDouble(d['lng']) ?? o.lng;
    o.lastPointAt = asTime(d['ts']) ?? o.lastPointAt;
    if (d['status'] != null) o.status = asStr(d['status']);
    if (d['distance_m'] != null) o.distanceM = asDouble(d['distance_m']) ?? o.distanceM;
    if (d['branch_id'] != null) o.branchId = asStr(d['branch_id']);
    notifyListeners();
  }

  void _applyCustomer(Map<String, dynamic> d) {
    final c = CustomerPin.fromJson(d);
    if (c.id.isEmpty || c.lat == null || c.lng == null) return;
    final i = customers.indexWhere((x) => x.id == c.id);
    if (i >= 0) {
      customers[i] = c;
    } else {
      customers = [...customers, c];
    }
    notifyListeners();
  }

  void _applyAlert(Map<String, dynamic> d) {
    final a = AlertItem.fromJson(d);
    if (a.id.isEmpty || alerts.any((x) => x.id == a.id)) return;
    alerts = [a, ...alerts];
    if (a.unread) unread++;
    notifyListeners();

    final title = a.title.isEmpty ? 'New alert' : a.title;
    Notifier.show(_alertNotifId++, title, a.body);
    if (_alertNotifId > 2500) _alertNotifId = 2000;
    _banner(title, a.body);
  }

  void _banner(String title, String body) {
    final m = messengerKey.currentState;
    if (m == null) return;
    m.clearMaterialBanners();
    m.showMaterialBanner(MaterialBanner(
      backgroundColor: const Color(0xFFFFEBEE),
      leading: const Icon(Icons.notifications_active, color: Color(0xFFC62828)),
      content: Text(body.isEmpty ? title : '$title\n$body',
          maxLines: 3, overflow: TextOverflow.ellipsis),
      actions: [
        TextButton(
          onPressed: m.hideCurrentMaterialBanner,
          child: const Text('OK'),
        ),
      ],
    ));
    Timer(const Duration(seconds: 7), () {
      try {
        m.hideCurrentMaterialBanner();
      } catch (_) {}
    });
  }
}
