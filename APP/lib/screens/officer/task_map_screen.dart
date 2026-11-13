import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../models/models.dart';
import '../../services/tracking_service.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// One assigned location on the map with its geofence circle, the officer's
/// own position and a Navigate button (Google Maps directions).
class TaskMapScreen extends StatefulWidget {
  const TaskMapScreen({super.key, required this.assignment});
  final Assignment assignment;

  @override
  State<TaskMapScreen> createState() => _TaskMapScreenState();
}

class _TaskMapScreenState extends State<TaskMapScreen> {
  final MapController _map = MapController();
  LatLng? _me;

  @override
  void initState() {
    super.initState();
    TrackingService.instance.addListener(_onTrack);
    _onTrack();
    if (_me == null) _locateOnce();
  }

  @override
  void dispose() {
    TrackingService.instance.removeListener(_onTrack);
    _map.dispose();
    super.dispose();
  }

  void _onTrack() {
    final p = TrackingService.instance.lastPosition;
    if (p != null && mounted) {
      setState(() => _me = LatLng(p.latitude, p.longitude));
    }
  }

  Future<void> _locateOnce() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return;
      }
      final p = await Geolocator.getLastKnownPosition() ??
          await TrackingService.freshFix(timeLimit: const Duration(seconds: 15));
      if (mounted) setState(() => _me = LatLng(p.latitude, p.longitude));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.assignment;
    final target = a.hasPosition ? LatLng(a.lat!, a.lng!) : null;
    double? distance;
    if (target != null && _me != null) {
      distance = Geolocator.distanceBetween(
          _me!.latitude, _me!.longitude, target.latitude, target.longitude);
    }
    final inside = distance != null && distance <= a.radiusM;

    return Scaffold(
      appBar: AppBar(title: Text(a.name.isEmpty ? 'Task' : a.name)),
      body: Column(children: [
        Expanded(
          child: target == null
              ? const EmptyState(
                  icon: Icons.location_off,
                  text: 'This task has no map location.')
              : Stack(children: [
                  FlutterMap(
                    mapController: _map,
                    options: MapOptions(
                      initialCenter: target,
                      initialZoom: 16.5,
                    ),
                    children: [
                      osmTiles(),
                      CircleLayer(circles: [
                        fenceCircle(target, a.radiusM,
                            color: a.visited ? kGreen : kBlue),
                      ]),
                      MarkerLayer(markers: [
                        pinMarker(target, a.visited ? kGreen : kRed),
                        if (_me != null) dotMarker(_me!, kBlue, size: 20),
                      ]),
                      osmAttribution(),
                    ],
                  ),
                  Positioned(
                    right: 12,
                    bottom: 12,
                    child: Column(children: [
                      if (_me != null)
                        FloatingActionButton.small(
                          heroTag: 'me',
                          tooltip: 'My location',
                          backgroundColor: Colors.white,
                          foregroundColor: kBlue,
                          onPressed: () => _map.move(_me!, 16.5),
                          child: const Icon(Icons.my_location),
                        ),
                      const SizedBox(height: 8),
                      FloatingActionButton.small(
                        heroTag: 'target',
                        tooltip: 'Task location',
                        backgroundColor: Colors.white,
                        foregroundColor: kRed,
                        onPressed: () => _map.move(target, 16.5),
                        child: const Icon(Icons.flag),
                      ),
                    ]),
                  ),
                ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(children: [
                  StatusChip(
                    label: a.kind == 'center' ? 'Center' : 'Village',
                    color: a.kind == 'center' ? kBlue : kOrange,
                    icon: a.kind == 'center'
                        ? Icons.groups
                        : Icons.holiday_village,
                  ),
                  const SizedBox(width: 8),
                  StatusChip(
                    label: a.visited ? 'Visited' : 'Not visited',
                    color: a.visited ? kGreen : kGrey,
                    icon: a.visited
                        ? Icons.check_circle
                        : Icons.radio_button_unchecked,
                  ),
                ]),
                if (a.address.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(a.address, style: const TextStyle(fontSize: 15)),
                ],
                const SizedBox(height: 6),
                Text(
                  [
                    'Visit area: ${a.radiusM.round()} m around the pin',
                    if (distance != null)
                      inside
                          ? 'You are inside the visit area'
                          : 'You are ${distance < 1000 ? '${distance.round()} m' : fmtKm(distance)} away',
                    if (a.visited)
                      'Arrived ${fmtTime(a.firstEnterAt)}, ${fmtMin(a.timeSpentMin)} spent',
                  ].join('\n'),
                  style: TextStyle(
                      color: inside ? kGreen : kGrey,
                      fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: target == null
                      ? null
                      : () => openDirections(target.latitude, target.longitude),
                  icon: const Icon(Icons.navigation),
                  label: const Text('Navigate'),
                ),
              ],
            ),
          ),
        ),
      ]),
    );
  }
}
