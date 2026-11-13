import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../models/models.dart';
import '../../services/notifier.dart';
import '../../services/tracking_service.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Lunch seconds used today at this moment.
/// `minutes_today` may or may not include the running break, so while a break
/// is running we take the larger of the two at fetch time and count on from there.
int lunchUsedSeconds(Lunch l, DateTime fetchedAt) {
  final base = l.minutesToday * 60;
  if (!l.active || l.startedAt == null) return base;
  final atFetch = fetchedAt.difference(l.startedAt!).inSeconds;
  final sinceFetch = DateTime.now().difference(fetchedAt).inSeconds;
  return (atFetch > base ? atFetch : base) + (sinceFetch < 0 ? 0 : sinceFetch);
}

class LunchCard extends StatefulWidget {
  const LunchCard({
    super.key,
    required this.lunch,
    required this.fetchedAt,
    required this.onChanged,
  });

  final Lunch lunch;
  final DateTime fetchedAt;
  final Future<void> Function() onChanged;

  @override
  State<LunchCard> createState() => _LunchCardState();
}

class _LunchCardState extends State<LunchCard> {
  Timer? _tick;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && widget.lunch.active) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() => _busy = true);
    try {
      final p = TrackingService.instance.lastPosition;
      await Api.instance.post('/breaks/start', {
        if (p != null) 'lat': p.latitude,
        if (p != null) 'lng': p.longitude,
      });
      final left =
          widget.lunch.allowedMin * 60 - widget.lunch.minutesToday * 60;
      await Notifier.scheduleLunchOver(Duration(seconds: left));
      await widget.onChanged();
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _end() async {
    setState(() => _busy = true);
    try {
      await Api.instance.post('/breaks/end', {});
      await Notifier.cancel(Notifier.lunchId);
      await widget.onChanged();
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _clock(int seconds) {
    final s = seconds < 0 ? 0 : seconds;
    final h = s ~/ 3600, m = (s % 3600) ~/ 60, sec = s % 60;
    String two(int v) => v.toString().padLeft(2, '0');
    return h > 0 ? '$h:${two(m)}:${two(sec)}' : '${two(m)}:${two(sec)}';
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.lunch;
    final used = lunchUsedSeconds(l, widget.fetchedAt);
    final allowed = l.allowedMin * 60;
    final over = used > allowed;
    final color = over ? kRed : (l.active ? kOrange : kNavy);

    return Card(
      color: over ? const Color(0xFFFFEBEE) : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Icon(Icons.restaurant, color: color),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Lunch break',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: kNavy)),
              ),
              Text('Allowed: ${l.allowedMin} min',
                  style: const TextStyle(
                      color: kGrey, fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 10),
            if (l.active) ...[
              Text(
                _clock(used),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 44,
                  fontWeight: FontWeight.w800,
                  color: color,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              Text(
                over
                    ? 'Lunch time is over by ${fmtMin(((used - allowed) / 60).ceil())}. End lunch now.'
                    : 'On lunch since ${fmtTime(l.startedAt)} - ${fmtMin(((allowed - used) / 60).ceil())} left',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: over ? kRed : kGrey,
                    fontWeight: over ? FontWeight.w800 : FontWeight.w500,
                    fontSize: 15),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                    backgroundColor: over ? kRed : kOrange),
                onPressed: _busy ? null : _end,
                icon: const Icon(Icons.check),
                label: const Text('End lunch'),
              ),
            ] else ...[
              Text(
                'Used today: ${fmtMin(l.minutesToday)} of ${l.allowedMin} min',
                style: TextStyle(
                    fontSize: 15,
                    color: over ? kRed : kGrey,
                    fontWeight: over ? FontWeight.w800 : FontWeight.w500),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy ? null : _start,
                icon: const Icon(Icons.restaurant),
                label: const Text('Start lunch'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
