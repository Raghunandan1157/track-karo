import 'package:flutter/material.dart';

import 'screens/login_screen.dart';
import 'screens/manager/manager_shell.dart';
import 'screens/officer/officer_shell.dart';
import 'services/notifier.dart';
import 'services/session.dart';
import 'services/tracking_service.dart';
import 'theme.dart';
import 'widgets/common.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Notifier.init();
  await TrackingService.instance.init();
  Session.instance.restore();
  runApp(const TrackKaroApp());
}

class TrackKaroApp extends StatefulWidget {
  const TrackKaroApp({super.key});

  @override
  State<TrackKaroApp> createState() => _TrackKaroAppState();
}

class _TrackKaroAppState extends State<TrackKaroApp> {
  bool _wasLoggedIn = false;

  @override
  void initState() {
    super.initState();
    Session.instance.addListener(_onSession);
  }

  @override
  void dispose() {
    Session.instance.removeListener(_onSession);
    super.dispose();
  }

  void _onSession() {
    final s = Session.instance;
    if (_wasLoggedIn && !s.loggedIn) {
      // Logged out (or 401): drop any pushed screens and banners.
      navigatorKey.currentState?.popUntil((r) => r.isFirst);
      messengerKey.currentState?.clearMaterialBanners();
      if (s.expired) showSnack('Your login has expired. Please log in again.');
    }
    _wasLoggedIn = s.loggedIn;
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Track_karo',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: messengerKey,
      home: ListenableBuilder(
        listenable: Session.instance,
        builder: (context, _) {
          final s = Session.instance;
          if (s.restoring) return const _Splash();
          if (!s.loggedIn) return const LoginScreen();
          final u = s.user!;
          if (u.isOfficer) return OfficerShell(key: ValueKey('fo-${u.id}'));
          return ManagerShell(key: ValueKey('bm-${u.id}'));
        },
      ),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Image.asset('assets/logo.png', width: 240),
          const SizedBox(height: 24),
          const CircularProgressIndicator(),
        ]),
      ),
    );
  }
}
