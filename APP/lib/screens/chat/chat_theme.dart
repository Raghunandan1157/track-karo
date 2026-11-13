import 'package:flutter/material.dart';

import '../../theme.dart';

/// Palette for the chat surfaces. The chat has its own light/dark switch, so it
/// does not reuse the app's white scaffold colours directly.
class ChatColors {
  const ChatColors({
    required this.bg,
    required this.surface,
    required this.surfaceAlt,
    required this.border,
    required this.text,
    required this.muted,
    required this.faint,
    required this.outgoing,
    required this.outgoingText,
    required this.incoming,
    required this.incomingText,
    required this.accent,
    required this.accentSoft,
    required this.online,
    required this.pinnedBg,
  });

  final Color bg;
  final Color surface;
  final Color surfaceAlt;
  final Color border;
  final Color text;
  final Color muted;
  final Color faint;
  final Color outgoing;
  final Color outgoingText;
  final Color incoming;
  final Color incomingText;
  final Color accent;
  final Color accentSoft;
  final Color online;
  final Color pinnedBg;

  static const light = ChatColors(
    bg: Color(0xFFF2F6FC),
    surface: Colors.white,
    surfaceAlt: Color(0xFFF7F9FD),
    border: Color(0xFFE1E7F0),
    text: Color(0xFF1A2433),
    muted: Color(0xFF5B6778),
    faint: Color(0xFF8A95A5),
    outgoing: kNavy,
    outgoingText: Colors.white,
    incoming: Colors.white,
    incomingText: Color(0xFF1A2433),
    accent: kOrange,
    accentSoft: Color(0xFFFCF1E4),
    online: kGreen,
    pinnedBg: Color(0xFFEAF1FA),
  );

  static const dark = ChatColors(
    bg: Color(0xFF0B1220),
    surface: Color(0xFF131C2E),
    surfaceAlt: Color(0xFF182236),
    border: Color(0xFF26334A),
    text: Color(0xFFE8EDF7),
    muted: Color(0xFFA3B0C6),
    faint: Color(0xFF74839B),
    outgoing: Color(0xFF2F6DB5),
    outgoingText: Colors.white,
    incoming: Color(0xFF1B2740),
    incomingText: Color(0xFFE8EDF7),
    accent: Color(0xFFF2A64B),
    accentSoft: Color(0xFF33270F),
    online: Color(0xFF4ADE80),
    pinnedBg: Color(0xFF1B2A44),
  );
}

ChatColors chatColorsOf(BuildContext context) =>
    Theme.of(context).brightness == Brightness.dark ? ChatColors.dark : ChatColors.light;

ThemeData buildChatTheme(bool dark) {
  final c = dark ? ChatColors.dark : ChatColors.light;
  final base = ColorScheme.fromSeed(
    seedColor: kNavy,
    brightness: dark ? Brightness.dark : Brightness.light,
  ).copyWith(
    primary: dark ? kBlue : kNavy,
    secondary: kBlue,
    tertiary: kOrange,
    surface: c.surface,
    error: kRed,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: dark ? Brightness.dark : Brightness.light,
    colorScheme: base,
    scaffoldBackgroundColor: c.bg,
    appBarTheme: AppBarTheme(
      backgroundColor: c.surface,
      foregroundColor: c.text,
      surfaceTintColor: c.surface,
      elevation: 0,
      scrolledUnderElevation: 0.5,
    ),
    dividerColor: c.border,
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide(color: c.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide(color: c.border),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      isDense: true,
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
  );
}

/// Small helper used by avatars, pins and highlighted rows.
LinearGradient aiGradient({bool dark = false}) => LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: dark
          ? const [Color(0xFF3B82F6), Color(0xFF1D4ED8)]
          : const [Color(0xFF2F6DB5), Color(0xFF14285A)],
    );
