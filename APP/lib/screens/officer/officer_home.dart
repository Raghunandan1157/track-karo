import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../api/api_client.dart';
import '../../models/models.dart';
import '../../services/notifier.dart';
import '../../services/session.dart';
import '../../services/tracking_service.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'customer_visit_card.dart';
import 'lunch_card.dart';
import 'task_map_screen.dart';

/// Field officer home: start/end day, tracking state, tasks, lunch, customer capture.
class OfficerHome extends StatefulWidget {
  const OfficerHome({super.key});

  @override
  State<OfficerHome> createState() => _OfficerHomeState();
}

class _OfficerHomeState extends State<OfficerHome> with WidgetsBindingObserver {
  final TrackingService _trk = TrackingService.instance;

  DutyToday? _today;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _trk.checkLocationState();
      _load(silent: true);
    }
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final res = asMap(await Api.instance.get('/duty/today'));
      final today = DutyToday.fromJson(res);
      if (!mounted) return;
      setState(() {
        _today = today;
        _error = null;
        _loading = false;
      });
      await _syncTracking(today);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load your day.';
        _loading = false;
      });
    }
  }

  /// Keep the phone in step with the server: an active day means tracking
  /// must be running (for example after the app was closed and reopened).
  Future<void> _syncTracking(DutyToday today) async {
    if (today.dayActive && !_trk.active) {
      await _trk.start();
    } else if (!today.dayActive && _trk.active) {
      await _trk.stop();
    }
    if (_trk.queued > 0 || _trk.queuedEvents > 0) _trk.flush();

    // Lunch reminder follows the server state.
    final l = today.lunch;
    if (today.dayActive && l.active) {
      final left = l.allowedMin * 60 - lunchUsedSeconds(l, today.fetchedAt);
      Notifier.scheduleLunchOver(Duration(seconds: left));
    } else {
      Notifier.cancel(Notifier.lunchId);
    }
  }

  Future<void> _startDay() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final problem = await _trk.ensurePermissions();
      if (problem != null) {
        if (mounted) await _permissionDialog(problem);
        return;
      }
      if (await _trk.needsAlwaysPermission() && mounted) {
        final go = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Allow location all the time'),
            content: const Text(
                'Track_karo must record your location during your work day, '
                'even when the phone screen is off.\n\n'
                'On the next screen choose "Allow all the time" (Android) '
                'or "Always" (iPhone).'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(c, false),
                  child: const Text('Not now')),
              FilledButton(
                  onPressed: () => Navigator.pop(c, true),
                  child: const Text('Continue')),
            ],
          ),
        );
        if (go == true) await _trk.requestAlwaysPermission();
      }

      Position? p;
      try {
        p = await TrackingService.freshFix(
            timeLimit: const Duration(seconds: 12));
      } catch (_) {
        p = _trk.lastPosition;
      }
      await Api.instance.post('/duty/start', {
        if (p != null) 'lat': p.latitude,
        if (p != null) 'lng': p.longitude,
      });
      await _trk.start();
      showSnack('Day started. Tracking is on.');
      await _load(silent: true);
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _permissionDialog(String message) async {
    await showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Location needed'),
        content: Text(message),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c), child: const Text('Close')),
          FilledButton(
            onPressed: () async {
              Navigator.pop(c);
              if (!await Geolocator.isLocationServiceEnabled()) {
                await Geolocator.openLocationSettings();
              } else {
                await Geolocator.openAppSettings();
              }
            },
            child: const Text('Open settings'),
          ),
        ],
      ),
    );
  }

  Future<void> _endDay() async {
    if (_busy) return;
    final sure = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('End your day?'),
        content: const Text(
            'Tracking will stop. You cannot start again today after ending.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('End Day')),
        ],
      ),
    );
    if (sure != true) return;
    setState(() => _busy = true);
    try {
      await _trk.flush(); // send what is queued before closing the day
      final p = _trk.lastPosition;
      final res = asMap(await Api.instance.post('/duty/end', {
        if (p != null) 'lat': p.latitude,
        if (p != null) 'lng': p.longitude,
      }));
      await _trk.stop();
      Notifier.cancel(Notifier.lunchId);
      final missed = res['missed'] is List
          ? (res['missed'] as List).map((e) => '$e').toList()
          : <String>[];
      if (mounted) await _missedDialog(missed);
      await _load(silent: true);
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _missedDialog(List<String> missed) {
    return showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Day ended'),
        content: missed.isEmpty
            ? const Text('Well done. You visited all assigned locations.')
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('You missed ${missed.length} assigned '
                      '${missed.length == 1 ? 'location' : 'locations'}:',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  for (final m in missed)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(children: [
                        const Icon(Icons.cancel, color: kRed, size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text(m)),
                      ]),
                    ),
                ],
              ),
        actions: [
          FilledButton(
              onPressed: () => Navigator.pop(c), child: const Text('OK')),
        ],
      ),
    );
  }

  Future<void> _confirmLogout() async {
    final active = _today?.dayActive ?? false;
    final sure = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Log out?'),
        content: Text(active
            ? 'Your day is still active. Logging out stops tracking on this phone. End your day first if you are done.'
            : 'You will need your User ID and password to log in again.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Log out')),
        ],
      ),
    );
    if (sure == true) await Session.instance.logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = Session.instance.user;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Track_karo',
                style: TextStyle(fontWeight: FontWeight.w800)),
            if (user != null)
              Text(
                user.branchName.isEmpty
                    ? user.name
                    : '${user.name} - ${user.branchName}',
                style: const TextStyle(fontSize: 13),
              ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : () => _load(),
          ),
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout),
            onPressed: _confirmLogout,
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: ListenableBuilder(
          listenable: _trk,
          builder: (context, _) => _body(),
        ),
      ),
    );
  }

  Widget _body() {
    final today = _today;
    if (today == null) {
      if (_loading) return const Center(child: CircularProgressIndicator());
      return ErrorRetry(
          message: _error ?? 'Could not load your day.', onRetry: _load);
    }
    return Column(children: [
      if (_trk.active && _trk.problem != null) _LocationOffBanner(_trk.problem!),
      if (_error != null) InlineError('$_error Showing last loaded data.'),
      if (_loading) const LinearProgressIndicator(minHeight: 3),
      Expanded(
        child: RefreshIndicator(
          onRefresh: () => _load(silent: true),
          child: ListView(
            padding: const EdgeInsets.only(bottom: 32, top: 6),
            children: [
              _dayCard(today),
              if (today.dayActive)
                LunchCard(
                  lunch: today.lunch,
                  fetchedAt: today.fetchedAt,
                  onChanged: () => _load(silent: true),
                ),
              SectionTitle("Today's tasks",
                  trailing: Text(
                      '${today.assignments.where((a) => a.visited).length}'
                      ' / ${today.assignments.length} visited',
                      style: const TextStyle(
                          color: kGrey, fontWeight: FontWeight.w600))),
              if (today.assignments.isEmpty)
                const EmptyState(
                    icon: Icons.assignment_outlined,
                    text: 'No locations assigned for today.')
              else
                for (final a in today.assignments) _taskTile(a),
              const SectionTitle('Customer visit (optional)'),
              CustomerVisitCard(
                visits: today.customerVisits,
                onCaptured: () => _load(silent: true),
              ),
            ],
          ),
        ),
      ),
    ]);
  }

  Widget _dayCard(DutyToday today) {
    final duty = today.duty;
    final active = today.dayActive;
    final ended = today.dayEnded;
    var distance = duty?.distanceM ?? 0;
    final live = _trk.serverDistanceM;
    if (active && live != null && live > distance) distance = live;

    StatusChip chip;
    if (ended) {
      chip = const StatusChip(
          label: 'Day ended', color: kBlue, icon: Icons.check_circle);
    } else if (!active) {
      chip = const StatusChip(
          label: 'Not started', color: kGrey, icon: Icons.pause_circle);
    } else if (_trk.problem != null) {
      chip = const StatusChip(
          label: 'Location off', color: kRed, icon: Icons.location_off);
    } else if (_trk.active) {
      chip = const StatusChip(
          label: 'Tracking on', color: kGreen, icon: Icons.my_location);
    } else {
      chip = const StatusChip(
          label: 'Tracking stopped', color: kOrange, icon: Icons.warning);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              const Expanded(
                child: Text('My work day',
                    style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: kNavy)),
              ),
              chip,
            ]),
            const SizedBox(height: 14),
            Row(children: [
              _stat(Icons.route, 'Distance today', fmtKm(distance)),
              _stat(Icons.play_circle_outline, 'Day started',
                  fmtTime(duty?.startedAt)),
              if (ended)
                _stat(Icons.stop_circle_outlined, 'Day ended',
                    fmtTime(duty?.endedAt)),
            ]),
            if (active) ...[
              const SizedBox(height: 10),
              Text(
                _trk.queued == 0
                    ? 'All location points sent. Last point ${fmtAgo(_trk.lastPointAt)}.'
                    : '${_trk.queued} location points waiting to be sent'
                        '${_trk.uploadError != null ? ' (${_trk.uploadError})' : ''}.',
                style: TextStyle(
                    fontSize: 13,
                    color: _trk.uploadError != null && _trk.queued > 0
                        ? kOrange
                        : kGrey),
              ),
            ],
            const SizedBox(height: 14),
            if (ended)
              const Text(
                'Your day is finished. See you tomorrow.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: kGrey),
              )
            else if (active)
              FilledButton.icon(
                style: FilledButton.styleFrom(
                    backgroundColor: kRed, minimumSize: const Size(64, 60)),
                onPressed: _busy ? null : _endDay,
                icon: _busy ? _spinner() : const Icon(Icons.stop_circle),
                label: const Text('End Day'),
              )
            else
              FilledButton.icon(
                style: FilledButton.styleFrom(
                    backgroundColor: kGreen, minimumSize: const Size(64, 60)),
                onPressed: _busy ? null : _startDay,
                icon: _busy ? _spinner() : const Icon(Icons.play_circle),
                label: const Text('Start Day'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _spinner() => const SizedBox(
      width: 20,
      height: 20,
      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white));

  Widget _stat(IconData icon, String label, String value) {
    return Expanded(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, size: 16, color: kBlue),
          const SizedBox(width: 4),
          Flexible(
            child: Text(label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: kGrey)),
          ),
        ]),
        const SizedBox(height: 2),
        Text(value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      ]),
    );
  }

  Widget _taskTile(Assignment a) {
    final isCenter = a.kind == 'center';
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: (isCenter ? kBlue : kOrange).withValues(alpha: 0.15),
          child: Icon(isCenter ? Icons.groups : Icons.holiday_village,
              color: isCenter ? kBlue : kOrange),
        ),
        title: Text(a.name.isEmpty ? '(no name)' : a.name,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isCenter ? 'Center' : 'Village',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            if (a.address.isNotEmpty)
              Text(a.address, maxLines: 2, overflow: TextOverflow.ellipsis),
            Text(
              a.visited
                  ? 'Visited ${fmtTime(a.firstEnterAt)} - ${fmtMin(a.timeSpentMin)} spent'
                  : 'Not visited yet',
              style: TextStyle(
                  color: a.visited ? kGreen : kGrey,
                  fontWeight: FontWeight.w600),
            ),
          ],
        ),
        trailing: Icon(
          a.visited ? Icons.check_circle : Icons.radio_button_unchecked,
          color: a.visited ? kGreen : kGrey,
          size: 30,
        ),
        onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => TaskMapScreen(assignment: a))),
      ),
    );
  }
}

/// Red full-width warning while location is off / permission removed.
class _LocationOffBanner extends StatelessWidget {
  const _LocationOffBanner(this.problem);
  final String problem;

  @override
  Widget build(BuildContext context) {
    final permission = problem == 'permission_denied';
    return Material(
      color: kRed,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              const Icon(Icons.location_off, color: Colors.white, size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  permission
                      ? 'Location permission is removed. Your branch manager has been informed.'
                      : 'Location is turned OFF. Your branch manager has been informed.',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                  backgroundColor: Colors.white, foregroundColor: kRed),
              onPressed: () async {
                if (permission) {
                  final p = await Geolocator.requestPermission();
                  if (p == LocationPermission.deniedForever ||
                      p == LocationPermission.denied) {
                    await Geolocator.openAppSettings();
                  }
                } else {
                  await Geolocator.openLocationSettings();
                }
                TrackingService.instance.checkLocationState();
              },
              icon: const Icon(Icons.settings),
              label: Text(permission
                  ? 'Allow location'
                  : 'Open location settings'),
            ),
          ],
        ),
      ),
    );
  }
}
