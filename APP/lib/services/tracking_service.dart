import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:battery_plus/battery_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../config.dart';
import 'notifier.dart';
import 'point_queue.dart';

/// Background location tracking for a field officer's work day.
///
/// * Android: geolocator position stream inside its foreground service
///   (persistent notification + wake lock) so it keeps running with the
///   screen off / app in background.
/// * iOS: background location updates (UIBackgroundModes: location).
/// * Points are queued on disk and uploaded every ~30 s, oldest first.
/// * A 60 s heartbeat adds a point while the officer is standing still.
/// * Location service / permission is watched; turning it off raises a
///   `location_off` / `permission_denied` event for the branch manager.
class TrackingService extends ChangeNotifier {
  TrackingService._();
  static final TrackingService instance = TrackingService._();

  final PointQueue queue = PointQueue();
  final Battery _batteryApi = Battery();

  bool _inited = false;
  bool _active = false;
  bool _uploading = false;
  bool _checking = false;
  bool _flushingEvents = false;
  bool _beating = false;

  /// null = fine, otherwise 'location_off' or 'permission_denied'.
  String? problem;
  Position? lastPosition;
  DateTime? lastPointAt;
  DateTime? lastUploadAt;
  String? uploadError;

  /// Distance for today as last reported by the server (POST /locations).
  double? serverDistanceM;

  int? _battery;
  DateTime? _batteryAt;
  List<Map<String, dynamic>> _events = [];
  SharedPreferences? _prefs;

  StreamSubscription<Position>? _posSub;
  StreamSubscription<ServiceStatus>? _svcSub;
  Timer? _uploadTimer;
  Timer? _heartbeatTimer;
  Timer? _guardTimer;

  bool get active => _active;
  int get queued => queue.length;
  int get queuedEvents => _events.length;

  Future<void> init() async {
    if (_inited) return;
    _inited = true;
    await queue.init();
    try {
      _prefs = await SharedPreferences.getInstance();
      problem = _prefs!.getString('trk_problem');
      final raw = _prefs!.getString('trk_events');
      if (raw != null) {
        final list = jsonDecode(raw);
        if (list is List) {
          _events = list
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------- permissions

  /// Asks for location ("Always" where possible) and notification permission.
  /// Returns null when tracking can start, otherwise a message for the user.
  Future<String?> ensurePermissions() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return 'Location (GPS) is turned off. Turn it on and try again.';
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied) {
        return 'Location permission is needed to start your day.';
      }
      if (perm == LocationPermission.deniedForever) {
        return 'Location permission is blocked. Open Settings and allow location for Track_karo.';
      }
      await Notifier.requestPermission();
      return null;
    } catch (e) {
      return 'Could not check location permission. Try again.';
    }
  }

  /// True when only "While using the app" is granted (background not yet).
  Future<bool> needsAlwaysPermission() async {
    try {
      return await Geolocator.checkPermission() == LocationPermission.whileInUse;
    } catch (_) {
      return false;
    }
  }

  /// Second step: upgrade "while in use" to "Always / Allow all the time".
  /// (Android 10+ and iOS only grant background access in a second request.)
  Future<void> requestAlwaysPermission() async {
    try {
      await Geolocator.requestPermission();
    } catch (_) {}
  }

  // ---------------------------------------------------------------- start/stop

  LocationSettings _settings() {
    if (!kIsWeb && Platform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: kDistanceFilterMeters,
        intervalDuration: const Duration(seconds: 10),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Track_karo',
          notificationText: 'Track_karo is tracking your work day',
          notificationChannelName: 'Work day tracking',
          notificationIcon:
              AndroidResource(name: 'ic_stat_track', defType: 'drawable'),
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }
    if (!kIsWeb && Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: kDistanceFilterMeters,
        activityType: ActivityType.otherNavigation,
        pauseLocationUpdatesAutomatically: false,
        allowBackgroundLocationUpdates: true,
        showBackgroundLocationIndicator: true,
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: kDistanceFilterMeters,
    );
  }

  Future<void> start() async {
    await init();
    if (_active) return;
    _active = true;
    serverDistanceM = null;
    _prefs?.setBool('trk_active', true);
    _subscribe();
    try {
      _svcSub = Geolocator.getServiceStatusStream()
          .listen((_) => checkLocationState(), onError: (_) {});
    } catch (_) {}
    _uploadTimer = Timer.periodic(kUploadEvery, (_) => flush());
    _heartbeatTimer = Timer.periodic(kHeartbeatEvery, (_) => _heartbeat());
    _guardTimer =
        Timer.periodic(kLocationCheckEvery, (_) => checkLocationState());
    notifyListeners();
    checkLocationState();
    _heartbeat(force: true);
  }

  /// Stops tracking. [clearQueue] drops unsent points (used on logout).
  Future<void> stop({bool clearQueue = false}) async {
    await init();
    final wasActive = _active;
    _active = false;
    _prefs?.setBool('trk_active', false);
    _uploadTimer?.cancel();
    _heartbeatTimer?.cancel();
    _guardTimer?.cancel();
    _uploadTimer = _heartbeatTimer = _guardTimer = null;
    await _svcSub?.cancel();
    _svcSub = null;
    await _posSub?.cancel(); // also ends the Android foreground service
    _posSub = null;
    if (problem != null) {
      problem = null;
      _prefs?.remove('trk_problem');
      Notifier.cancel(Notifier.locationOffId);
    }
    if (clearQueue) {
      await queue.clear();
      _events = [];
      _saveEvents();
      serverDistanceM = null;
      lastPosition = null;
      lastPointAt = null;
    } else if (wasActive) {
      await queue.saveNow();
    }
    notifyListeners();
  }

  void _subscribe() {
    _posSub?.cancel();
    _posSub = null;
    try {
      _posSub = Geolocator.getPositionStream(locationSettings: _settings())
          .listen(
        _onPosition,
        // The native side keeps the request alive after an error (for example
        // GPS switched off), so keep the subscription and let the guard report.
        onError: (Object e) {
          if (e is PermissionDeniedException ||
              e is PermissionRequestInProgressException) {
            _posSub?.cancel();
            _posSub = null;
          }
          checkLocationState();
        },
        onDone: () => _posSub = null,
        cancelOnError: false,
      );
    } catch (_) {
      _posSub = null;
    }
  }

  // ---------------------------------------------------------------- points

  void _onPosition(Position p) {
    if (!_active) return;
    if (p.accuracy > 200) return; // very poor fix, ignore
    final last = lastPointAt;
    if (last != null &&
        DateTime.now().difference(last) < const Duration(seconds: 3)) {
      lastPosition = p; // too soon after the previous point: do not queue twice
      return;
    }
    _addPoint(p, DateTime.now());
  }

  void _addPoint(Position p, DateTime ts) {
    lastPosition = p;
    lastPointAt = ts;
    _refreshBattery();
    queue.add({
      'ts': ts.toUtc().toIso8601String(),
      'lat': p.latitude,
      'lng': p.longitude,
      'accuracy': _round(p.accuracy),
      'speed': _round(p.speed),
      'heading': _round(p.heading),
      'battery': _battery,
    });
    notifyListeners();
  }

  double? _round(double v) =>
      v.isFinite ? double.parse(v.toStringAsFixed(1)) : null;

  void _refreshBattery() {
    final at = _batteryAt;
    if (at != null && DateTime.now().difference(at).inMinutes < 3) return;
    _batteryAt = DateTime.now();
    _batteryApi.batteryLevel.then((v) => _battery = v).catchError((_) => 0);
  }

  /// Time floor: a standing officer produces no stream points (distance
  /// filter), so add one about once a minute as a heartbeat for the server.
  Future<void> _heartbeat({bool force = false}) async {
    if (!_active || problem != null || _beating) return;
    final last = lastPointAt;
    if (!force &&
        last != null &&
        DateTime.now().difference(last) < const Duration(seconds: 50)) {
      return;
    }
    _beating = true;
    try {
      Position? p;
      try {
        p = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 20),
          ),
        );
      } catch (_) {
        try {
          p = await Geolocator.getLastKnownPosition();
        } catch (_) {}
        p ??= lastPosition;
      }
      if (p == null || !_active || problem != null) return;
      final latest = lastPointAt;
      if (latest != null &&
          DateTime.now().difference(latest) <
              Duration(seconds: force ? 3 : 30)) {
        return; // the stream delivered one meanwhile
      }
      _addPoint(p, DateTime.now());
      if (_posSub == null) _subscribe();
    } finally {
      _beating = false;
    }
  }

  // ---------------------------------------------------------------- upload

  /// Uploads queued points (oldest first, max 500 per request). Points are
  /// removed only after the server answers 200.
  Future<void> flush() async {
    await init();
    await _flushEvents();
    if (_uploading || queue.isEmpty || Api.instance.token == null) return;
    _uploading = true;
    try {
      for (var i = 0; i < 20 && !queue.isEmpty; i++) {
        final batch = queue.peek(kMaxPointsPerUpload);
        final res = await Api.instance.post('/locations', {'points': batch});
        queue.removeUploaded(batch);
        lastUploadAt = DateTime.now();
        uploadError = null;
        if (res is Map && res['distance_m'] != null) {
          final d = res['distance_m'];
          serverDistanceM = d is num ? d.toDouble() : double.tryParse('$d');
        }
      }
    } on ApiException catch (e) {
      uploadError = e.message;
      // A batch the server rejects as invalid would block the queue forever.
      if (e.status == 400 || e.status == 422) {
        queue.removeUploaded(queue.peek(kMaxPointsPerUpload));
      }
    } catch (e) {
      uploadError = 'Upload failed';
    } finally {
      _uploading = false;
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------- location off

  /// Re-checks location service + permission. Called from the service status
  /// stream, on app resume and every 5 s while the day is active.
  Future<void> checkLocationState() async {
    if (!_active || _checking) return;
    _checking = true;
    try {
      final perm = await Geolocator.checkPermission();
      final permOk = perm == LocationPermission.always ||
          perm == LocationPermission.whileInUse;
      final serviceOn = await Geolocator.isLocationServiceEnabled();
      final String? now =
          !permOk ? 'permission_denied' : (!serviceOn ? 'location_off' : null);
      if (now == problem || !_active) return;

      final before = problem;
      problem = now;
      if (now == null) {
        _prefs?.remove('trk_problem');
      } else {
        _prefs?.setString('trk_problem', now);
      }
      notifyListeners();

      if (now != null) {
        _queueEvent(now);
        Notifier.show(
          Notifier.locationOffId,
          'Location is turned off',
          'Turn location back on now. Your branch manager has been informed.',
        );
      } else {
        _queueEvent('location_on');
        Notifier.cancel(Notifier.locationOffId);
        if (_posSub == null || before == 'permission_denied') _subscribe();
        _heartbeat(force: true);
      }
    } catch (_) {
      // ignore; the next tick retries
    } finally {
      _checking = false;
    }
  }

  void _queueEvent(String type) {
    final p = lastPosition;
    _events.add({
      'type': type,
      'ts': DateTime.now().toUtc().toIso8601String(),
      if (p != null) 'lat': p.latitude,
      if (p != null) 'lng': p.longitude,
    });
    if (_events.length > 200) _events.removeRange(0, _events.length - 200);
    _saveEvents();
    _flushEvents();
  }

  void _saveEvents() {
    try {
      _prefs?.setString('trk_events', jsonEncode(_events));
    } catch (_) {}
  }

  /// Sends queued events in order; anything that fails stays queued and is
  /// retried on the next upload tick (every 30 s) and on app resume.
  Future<void> _flushEvents() async {
    if (_flushingEvents || _events.isEmpty || Api.instance.token == null) {
      return;
    }
    _flushingEvents = true;
    try {
      while (_events.isNotEmpty) {
        final ev = _events.first;
        try {
          await Api.instance.post('/events', ev);
        } on ApiException catch (e) {
          if (e.status == null || e.status! >= 500 || e.status == 401) break;
          // 4xx: the server will never accept it; drop it.
        }
        _events.remove(ev);
        _saveEvents();
      }
    } finally {
      _flushingEvents = false;
    }
  }

  /// One fresh high-accuracy fix (used for Start Day, customer capture).
  static Future<Position> freshFix(
      {Duration timeLimit = const Duration(seconds: 30)}) {
    return Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.best,
        timeLimit: timeLimit,
      ),
    );
  }
}
