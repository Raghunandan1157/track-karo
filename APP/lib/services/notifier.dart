import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// Local notifications: lunch-over reminder, manager alerts, location-off warning.
class Notifier {
  Notifier._();
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  static const int lunchId = 1001;
  static const int locationOffId = 1002;

  static const NotificationDetails _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'trackkaro_alerts',
      'Alerts',
      channelDescription: 'Track_karo alerts and reminders',
      importance: Importance.high,
      priority: Priority.high,
      icon: 'ic_stat_track',
    ),
    iOS: DarwinNotificationDetails(
      presentAlert: true,
      presentBanner: true,
      presentSound: true,
    ),
  );

  static Future<void> init() async {
    if (_ready) return;
    try {
      tzdata.initializeTimeZones();
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('ic_stat_track'),
          iOS: DarwinInitializationSettings(
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        ),
      );
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  /// Asks for the notification permission (Android 13+ / iOS).
  static Future<void> requestPermission() async {
    await init();
    try {
      await _plugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      await _plugin
          .resolvePlatformSpecificImplementation<
              IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(alert: true, badge: true, sound: true);
    } catch (_) {}
  }

  static Future<void> show(int id, String title, String body) async {
    await init();
    if (!_ready) return;
    try {
      await _plugin.show(
          id: id, title: title, body: body, notificationDetails: _details);
    } catch (_) {}
  }

  static Future<void> cancel(int id) async {
    if (!_ready) return;
    try {
      await _plugin.cancel(id: id);
    } catch (_) {}
  }

  /// "Lunch time is over" after [after]. Inexact alarm: no exact-alarm
  /// permission needed, may fire a little late in doze mode.
  static Future<void> scheduleLunchOver(Duration after) async {
    await init();
    if (!_ready) return;
    try {
      await _plugin.cancel(id: lunchId);
      if (after.inSeconds <= 0) return;
      await _plugin.zonedSchedule(
        id: lunchId,
        title: 'Lunch time is over',
        body: 'Please end your lunch break and get back to work.',
        scheduledDate: tz.TZDateTime.now(tz.UTC).add(after),
        notificationDetails: _details,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    } catch (_) {}
  }
}
