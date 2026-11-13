import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../theme.dart';

/// Used for snack bars / banners from services (no BuildContext needed).
final GlobalKey<ScaffoldMessengerState> messengerKey =
    GlobalKey<ScaffoldMessengerState>();

const LatLng kIndiaCenter = LatLng(20.5937, 78.9629);

String fmtTime(DateTime? t) => t == null ? '--' : DateFormat('h:mm a').format(t);

String fmtDateTime(DateTime? t) =>
    t == null ? '--' : DateFormat('d MMM, h:mm a').format(t);

String fmtDay(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String fmtDayNice(DateTime d) => DateFormat('EEE, d MMM yyyy').format(d);

String fmtKm(double meters) => '${(meters / 1000).toStringAsFixed(1)} km';

String fmtMin(int minutes) {
  if (minutes < 60) return '$minutes min';
  final h = minutes ~/ 60, m = minutes % 60;
  return m == 0 ? '$h h' : '$h h $m min';
}

String fmtAgo(DateTime? t) {
  if (t == null) return 'never';
  final d = DateTime.now().difference(t);
  if (d.inSeconds < 60) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  return DateFormat('d MMM, h:mm a').format(t);
}

String fmtLatLng(double? lat, double? lng) => lat == null || lng == null
    ? '--'
    : '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}';

(String, Color) statusStyle(String status) {
  switch (status) {
    case 'on_duty':
      return ('On duty', kGreen);
    case 'on_lunch':
      return ('On lunch', kOrange);
    case 'location_off':
      return ('Location off', kRed);
    case 'no_signal':
      return ('No signal', Color(0xFF8E24AA));
    case 'day_ended':
      return ('Day ended', kBlue);
    default:
      return ('Off duty', kGrey);
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.color, this.icon});
  factory StatusChip.officer(String status) {
    final s = statusStyle(status);
    return StatusChip(label: s.$1, color: s.$2);
  }
  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 4),
        ] else ...[
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
        ],
        Text(label,
            style: TextStyle(
                color: color, fontWeight: FontWeight.w700, fontSize: 13)),
      ]),
    );
  }
}

/// Error with a retry button; used by every screen that loads data.
class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.cloud_off, size: 48, color: kGrey),
          const SizedBox(height: 12),
          Text(message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Try again'),
          ),
        ]),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 44, color: kGrey),
        const SizedBox(height: 10),
        Text(text,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, color: kGrey)),
      ]),
    );
  }
}

/// Thin inline error strip shown above stale data.
class InlineError extends StatelessWidget {
  const InlineError(this.message, {super.key});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFFFFF3E0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(children: [
        const Icon(Icons.wifi_off, size: 18, color: kOrange),
        const SizedBox(width: 8),
        Expanded(child: Text(message, style: const TextStyle(fontSize: 13))),
      ]),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 12, 4),
      child: Row(children: [
        Expanded(
          child: Text(text,
              style: const TextStyle(
                  fontSize: 17, fontWeight: FontWeight.w800, color: kNavy)),
        ),
        ?trailing,
      ]),
    );
  }
}

void showSnack(String text, {bool error = false}) {
  messengerKey.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(text),
      backgroundColor: error ? kRed : null,
    ));
}

// ---------- Map helpers (OpenStreetMap tiles, no API key) ----------

TileLayer osmTiles() => TileLayer(
      urlTemplate: kTileUrl,
      userAgentPackageName: kTileUserAgent,
      maxZoom: 19,
    );

Widget osmAttribution() => const SimpleAttributionWidget(
      source: Text('OpenStreetMap contributors'),
    );

Marker dotMarker(LatLng p, Color color,
    {double size = 18, VoidCallback? onTap, String? label}) {
  final dot = Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 2.5),
      boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 3)],
    ),
  );
  return Marker(
    point: p,
    width: 44,
    height: 44,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Center(child: dot),
    ),
  );
}

Marker pinMarker(LatLng p, Color color, {IconData icon = Icons.location_on, VoidCallback? onTap}) {
  return Marker(
    point: p,
    width: 44,
    height: 44,
    alignment: Alignment.topCenter,
    child: GestureDetector(
      onTap: onTap,
      child: Icon(icon, color: color, size: 40, shadows: const [
        Shadow(color: Colors.black38, blurRadius: 4),
      ]),
    ),
  );
}

CircleMarker fenceCircle(LatLng p, double radiusM, {Color color = kBlue}) =>
    CircleMarker(
      point: p,
      radius: radiusM,
      useRadiusInMeter: true,
      color: color.withValues(alpha: 0.18),
      borderColor: color,
      borderStrokeWidth: 2,
    );

Future<void> openDirections(double lat, double lng) => _open(
    'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');

Future<void> openInGoogleMaps(double lat, double lng) =>
    _open('https://www.google.com/maps/search/?api=1&query=$lat,$lng');

Future<void> _open(String url) async {
  try {
    final ok = await launchUrl(Uri.parse(url),
        mode: LaunchMode.externalApplication);
    if (!ok) showSnack('Could not open Google Maps.', error: true);
  } catch (_) {
    showSnack('Could not open Google Maps.', error: true);
  }
}
