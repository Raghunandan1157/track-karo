import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../models/models.dart';
import '../../services/manager_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'officer_detail_screen.dart';

/// Live map: officers BLUE, branch offices RED, customers YELLOW.
/// Kept live by the SSE stream (no polling).
class LiveMapScreen extends StatefulWidget {
  const LiveMapScreen({super.key});

  @override
  State<LiveMapScreen> createState() => _LiveMapScreenState();
}

class _LiveMapScreenState extends State<LiveMapScreen> {
  final ManagerStore _store = ManagerStore.instance;
  final MapController _map = MapController();
  bool _mapReady = false;
  bool _fitted = false;

  @override
  void initState() {
    super.initState();
    _store.addListener(_maybeFit);
  }

  @override
  void dispose() {
    _store.removeListener(_maybeFit);
    _map.dispose();
    super.dispose();
  }

  List<LatLng> _points({bool withCustomers = false}) => [
        for (final o in _store.officers)
          if (o.hasPosition) LatLng(o.lat!, o.lng!),
        for (final b in _store.branches)
          if (b.lat != null && b.lng != null) LatLng(b.lat!, b.lng!),
        if (withCustomers)
          for (final c in _store.customers)
            if (c.lat != null && c.lng != null) LatLng(c.lat!, c.lng!),
      ];

  void _maybeFit() {
    if (!_fitted) _fit();
  }

  void _fit() {
    if (!_mapReady) return;
    var pts = _points();
    if (pts.isEmpty) pts = _points(withCustomers: true);
    if (pts.isEmpty) return;
    try {
      if (pts.length == 1) {
        _map.move(pts.first, 14);
      } else {
        _map.fitCamera(CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(pts),
          padding: const EdgeInsets.all(50),
          maxZoom: 16,
        ));
      }
      _fitted = true;
    } catch (_) {}
  }

  void _sheet(Widget child) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: child,
        ),
      ),
    );
  }

  void _showOfficer(Officer o) {
    _sheet(Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(children: [
          Expanded(
            child: Text(o.name,
                style:
                    const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          ),
          StatusChip.officer(o.status),
        ]),
        const SizedBox(height: 8),
        Text('Field officer${o.branchName.isEmpty ? '' : ' - ${o.branchName}'}'),
        Text('Distance today: ${fmtKm(o.distanceM)}'),
        Text('Tasks: ${o.assignmentsVisited}/${o.assignmentsTotal} visited'),
        Text('Last seen: ${fmtAgo(o.lastPointAt)}'),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () {
            Navigator.pop(context);
            Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => OfficerDetailScreen(officer: o)));
          },
          icon: const Icon(Icons.route),
          label: const Text("See today's route"),
        ),
      ],
    ));
  }

  void _showPlace(String title, String kind, List<String> lines, double lat,
      double lng) {
    _sheet(Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(kind, style: const TextStyle(color: kGrey)),
        for (final l in lines)
          if (l.isNotEmpty) Text(l),
        Text(fmtLatLng(lat, lng), style: const TextStyle(color: kGrey)),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => openInGoogleMaps(lat, lng),
          icon: const Icon(Icons.open_in_new),
          label: const Text('Open in Google Maps'),
        ),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _store,
      builder: (context, _) {
        final hasAny = _points(withCustomers: true).isNotEmpty;
        return Stack(children: [
          FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: kIndiaCenter,
              initialZoom: 4.5,
              onMapReady: () {
                _mapReady = true;
                _fit();
              },
            ),
            children: [
              osmTiles(),
              MarkerLayer(markers: [
                for (final c in _store.customers)
                  if (c.lat != null && c.lng != null)
                    dotMarker(LatLng(c.lat!, c.lng!), kYellow,
                        size: 15,
                        onTap: () => _showPlace(
                            c.name,
                            'Customer',
                            [
                              c.village,
                              if (c.locatedAt != null)
                                'Located ${fmtDateTime(c.locatedAt)}',
                            ],
                            c.lat!,
                            c.lng!)),
                for (final b in _store.branches)
                  if (b.lat != null && b.lng != null)
                    dotMarker(LatLng(b.lat!, b.lng!), kRed,
                        size: 20,
                        onTap: () => _showPlace(
                            b.name,
                            'Branch office',
                            [
                              b.address,
                              if (b.managerNames.isNotEmpty)
                                'Manager: ${b.managerNames}',
                            ],
                            b.lat!,
                            b.lng!)),
                for (final o in _store.officers)
                  if (o.hasPosition)
                    dotMarker(LatLng(o.lat!, o.lng!), const Color(0xFF1E6FF0),
                        size: 20, onTap: () => _showOfficer(o)),
              ]),
              osmAttribution(),
            ],
          ),
          // Legend + live state
          Positioned(
            left: 10,
            top: 10,
            child: Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _legend(const Color(0xFF1E6FF0), 'Field officers'),
                    _legend(kRed, 'Branch offices'),
                    _legend(kYellow, 'Customers'),
                    const SizedBox(height: 4),
                    ValueListenableBuilder<bool>(
                      valueListenable: _store.sse.connected,
                      builder: (_, live, _) => Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(live ? Icons.sensors : Icons.sensors_off,
                                size: 16, color: live ? kGreen : kGrey),
                            const SizedBox(width: 6),
                            Text(live ? 'Live' : 'Connecting...',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: live ? kGreen : kGrey)),
                          ]),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            right: 12,
            bottom: 28,
            child: Column(children: [
              FloatingActionButton.small(
                heroTag: 'live-fit',
                tooltip: 'Show everyone',
                backgroundColor: Colors.white,
                foregroundColor: kNavy,
                onPressed: _fit,
                child: const Icon(Icons.zoom_out_map),
              ),
              const SizedBox(height: 8),
              FloatingActionButton.small(
                heroTag: 'live-reload',
                tooltip: 'Reload',
                backgroundColor: Colors.white,
                foregroundColor: kNavy,
                onPressed: _store.loadingLive ? null : _store.loadLive,
                child: const Icon(Icons.refresh),
              ),
            ]),
          ),
          if (_store.loadingLive)
            const Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(minHeight: 3)),
          if (_store.liveError != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: InlineError(_store.liveError!),
            )
          else if (!hasAny && !_store.loadingLive)
            const Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: InlineError('Nothing to show on the map yet.'),
            ),
        ]);
      },
    );
  }

  Widget _legend(Color c, String label) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(
              color: c,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.black26),
            ),
          ),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        ]),
      );
}
