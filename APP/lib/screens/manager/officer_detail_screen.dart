import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../api/api_client.dart';
import '../../models/models.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// One officer: route for a day on the map (GET /track) plus tasks and stops.
class OfficerDetailScreen extends StatefulWidget {
  const OfficerDetailScreen({super.key, required this.officer});
  final Officer officer;

  @override
  State<OfficerDetailScreen> createState() => _OfficerDetailScreenState();
}

class _OfficerDetailScreenState extends State<OfficerDetailScreen> {
  final MapController _map = MapController();
  DateTime _day = DateTime.now();
  TrackData? _track;
  String? _error;
  bool _loading = true;
  bool _mapReady = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _map.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = asMap(await Api.instance.get('/track',
          query: {'officer_id': widget.officer.id, 'day': fmtDay(_day)}));
      if (!mounted) return;
      setState(() {
        _track = TrackData.fromJson(res);
        _error = null;
        _loading = false;
      });
      _fit();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  List<LatLng> _allPoints() {
    final t = _track;
    final o = widget.officer;
    return [
      if (t != null) ...t.points.map((p) => LatLng(p.lat, p.lng)),
      if (t != null)
        for (final a in t.assignments)
          if (a.hasPosition) LatLng(a.lat!, a.lng!),
      if ((t == null || t.points.isEmpty) && o.hasPosition)
        LatLng(o.lat!, o.lng!),
    ];
  }

  void _fit() {
    if (!_mapReady) return;
    final pts = _allPoints();
    if (pts.isEmpty) return;
    try {
      if (pts.length == 1) {
        _map.move(pts.first, 15);
      } else {
        _map.fitCamera(CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(pts),
          padding: const EdgeInsets.all(40),
          maxZoom: 17,
        ));
      }
    } catch (_) {}
  }

  Future<void> _pickDay() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (d != null) {
      setState(() => _day = d);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.officer;
    final t = _track;
    final route = t?.points.map((p) => LatLng(p.lat, p.lng)).toList() ?? [];
    final pts = _allPoints();

    return Scaffold(
      appBar: AppBar(
        title: Text(o.name.isEmpty ? 'Officer' : o.name),
        actions: [
          TextButton.icon(
            onPressed: _pickDay,
            icon: const Icon(Icons.calendar_today, color: Colors.white, size: 18),
            label: Text(fmtDay(_day),
                style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Column(children: [
        if (_loading) const LinearProgressIndicator(minHeight: 3),
        if (_error != null) InlineError(_error!),
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.42,
          child: FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: pts.isNotEmpty ? pts.last : kIndiaCenter,
              initialZoom: pts.isNotEmpty ? 14 : 4.5,
              onMapReady: () {
                _mapReady = true;
                _fit();
              },
            ),
            children: [
              osmTiles(),
              if (t != null)
                CircleLayer(circles: [
                  for (final a in t.assignments)
                    if (a.hasPosition)
                      fenceCircle(LatLng(a.lat!, a.lng!), a.radiusM,
                          color: a.visited ? kGreen : kOrange),
                ]),
              if (route.length > 1)
                PolylineLayer(polylines: [
                  Polyline(points: route, strokeWidth: 4, color: kBlue),
                ]),
              MarkerLayer(markers: [
                if (t != null)
                  for (final a in t.assignments)
                    if (a.hasPosition)
                      pinMarker(LatLng(a.lat!, a.lng!),
                          a.visited ? kGreen : kOrange),
                if (t != null)
                  for (final s in t.stops)
                    if (s.lat != null && s.lng != null && s.kind == 'unexplained')
                      pinMarker(LatLng(s.lat!, s.lng!), kRed,
                          icon: Icons.report_problem),
                if (t != null)
                  for (final c in t.customerVisits)
                    if (c.lat != null && c.lng != null)
                      dotMarker(LatLng(c.lat!, c.lng!), kYellow, size: 16),
                if (route.isNotEmpty)
                  dotMarker(route.first, kGreen, size: 16),
                if (route.isNotEmpty)
                  dotMarker(route.last, kBlue, size: 22)
                else if (o.hasPosition)
                  dotMarker(LatLng(o.lat!, o.lng!), kBlue, size: 22),
              ]),
              osmAttribution(),
            ],
          ),
        ),
        Expanded(child: _details(o, t)),
      ]),
    );
  }

  Widget _details(Officer o, TrackData? t) {
    if (t == null) {
      if (_loading) return const SizedBox.shrink();
      return ErrorRetry(
          message: _error ?? 'Could not load the route.', onRetry: _load);
    }
    final unexplained = t.stops.where((s) => s.kind == 'unexplained').toList();
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            StatusChip.officer(o.status),
            StatusChip(
                label: fmtKm(t.distanceM), color: kBlue, icon: Icons.route),
            StatusChip(
                label: '${t.points.length} points',
                color: kGrey,
                icon: Icons.timeline),
            StatusChip(
                label: 'Last seen ${fmtAgo(o.lastPointAt)}',
                color: kGrey,
                icon: Icons.access_time),
          ]),
        ),
        if (t.points.isEmpty)
          const EmptyState(
              icon: Icons.timeline, text: 'No route recorded for this day.'),
        SectionTitle('Tasks (${t.assignments.where((a) => a.visited).length}/${t.assignments.length} visited)'),
        if (t.assignments.isEmpty)
          const EmptyState(
              icon: Icons.assignment_outlined, text: 'No tasks for this day.'),
        for (final a in t.assignments)
          ListTile(
            dense: true,
            leading: Icon(
                a.visited ? Icons.check_circle : Icons.cancel_outlined,
                color: a.visited ? kGreen : kOrange),
            title: Text(a.name,
                style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(
                '${a.kind == 'center' ? 'Center' : 'Village'} - '
                '${a.visited ? 'arrived ${fmtTime(a.firstEnterAt)}, ${fmtMin(a.timeSpentMin)}' : 'not visited'}'),
          ),
        if (unexplained.isNotEmpty) ...[
          SectionTitle('Unexplained stops (${unexplained.length})'),
          for (final s in unexplained)
            ListTile(
              dense: true,
              leading: const Icon(Icons.report_problem, color: kRed),
              title: Text('${fmtTime(s.start)} - ${fmtTime(s.end)}'),
              subtitle: Text(fmtMin(s.minutes)),
              trailing: s.lat == null
                  ? null
                  : IconButton(
                      tooltip: 'Open in Google Maps',
                      icon: const Icon(Icons.open_in_new),
                      onPressed: () => openInGoogleMaps(s.lat!, s.lng!)),
            ),
        ],
        if (t.customerVisits.isNotEmpty) ...[
          SectionTitle('Customers captured (${t.customerVisits.length})'),
          for (final c in t.customerVisits)
            ListTile(
              dense: true,
              leading: const Icon(Icons.person_pin_circle, color: kYellow),
              title: Text(c.customerName),
              subtitle: Text('${fmtTime(c.ts)} - ${fmtLatLng(c.lat, c.lng)}'),
            ),
        ],
      ],
    );
  }
}
