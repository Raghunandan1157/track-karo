import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../api/api_client.dart';
import '../../models/models.dart';
import '../../services/manager_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Assign tasks (geofences): pick officer + day, choose a point by place
/// search, Google Maps link or long-press on the map, set the radius, save.
class AssignScreen extends StatefulWidget {
  const AssignScreen({super.key});

  @override
  State<AssignScreen> createState() => _AssignScreenState();
}

class _AssignScreenState extends State<AssignScreen> {
  final ManagerStore _store = ManagerStore.instance;
  final MapController _map = MapController();
  final _name = TextEditingController();
  final _address = TextEditingController();
  final _search = TextEditingController();
  final _link = TextEditingController();
  final _radius = TextEditingController(text: '60');

  String? _officerId;
  DateTime _day = DateTime.now();
  String _kind = 'center';
  LatLng? _point;
  bool _mapReady = false;
  bool _mapTouch = false; // stop the page scrolling while a finger is on the map

  List<PlaceResult> _places = [];
  bool _searching = false;
  String? _searchMsg;
  bool _resolving = false;
  bool _saving = false;

  List<Assignment> _assignments = [];
  bool _loadingList = false;
  String? _listError;

  @override
  void dispose() {
    _map.dispose();
    _name.dispose();
    _address.dispose();
    _search.dispose();
    _link.dispose();
    _radius.dispose();
    super.dispose();
  }

  double get _radiusM {
    final r = double.tryParse(_radius.text.trim()) ?? 60;
    return r.clamp(10, 5000).toDouble();
  }

  Future<void> _loadList() async {
    final id = _officerId;
    if (id == null) return;
    setState(() => _loadingList = true);
    try {
      final res = asMap(await Api.instance.get('/assignments',
          query: {'day': fmtDay(_day), 'officer_id': id}));
      if (!mounted) return;
      setState(() {
        _assignments =
            asList(res['assignments']).map(Assignment.fromJson).toList();
        _listError = null;
        _loadingList = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _listError = e.message;
        _loadingList = false;
      });
    }
  }

  void _setPoint(LatLng p, {double zoom = 16}) {
    setState(() => _point = p);
    if (_mapReady) {
      try {
        _map.move(p, zoom);
      } catch (_) {}
    }
  }

  Future<void> _doSearch() async {
    final q = _search.text.trim();
    if (q.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _searching = true;
      _searchMsg = null;
      _places = [];
    });
    try {
      final res = asMap(await Api.instance.get('/geocode', query: {'q': q}));
      final list = asList(res['results'])
          .map(PlaceResult.fromJson)
          .where((p) => p.lat != null && p.lng != null)
          .toList();
      if (!mounted) return;
      setState(() {
        _places = list;
        _searching = false;
        _searchMsg = list.isEmpty ? 'No place found. Try another name.' : null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _searchMsg = e.message;
      });
    }
  }

  void _pickPlace(PlaceResult p) {
    if (_name.text.trim().isEmpty) _name.text = p.name;
    _address.text = p.address.isEmpty ? p.name : p.address;
    setState(() => _places = []);
    _setPoint(LatLng(p.lat!, p.lng!));
  }

  Future<void> _resolveLink() async {
    final url = _link.text.trim();
    if (url.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() => _resolving = true);
    try {
      final res = asMap(await Api.instance.post('/resolve-link', {'url': url}));
      final lat = asDouble(res['lat']), lng = asDouble(res['lng']);
      if (lat == null || lng == null) {
        throw ApiException('Could not read a location from this link.');
      }
      final name = asStr(res['name']);
      if (name.isNotEmpty && _name.text.trim().isEmpty) _name.text = name;
      if (name.isNotEmpty && _address.text.trim().isEmpty) _address.text = name;
      _setPoint(LatLng(lat, lng));
      showSnack('Location taken from the link.');
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  Future<void> _save() async {
    final id = _officerId;
    final p = _point;
    if (id == null) return showSnack('Choose a field officer first.', error: true);
    if (_name.text.trim().isEmpty) {
      return showSnack('Enter a name for this location.', error: true);
    }
    if (p == null) {
      return showSnack('Choose the location: search, paste a link, or long-press on the map.',
          error: true);
    }
    FocusScope.of(context).unfocus();
    setState(() => _saving = true);
    try {
      await Api.instance.post('/assignments', {
        'officer_id': id,
        'day': fmtDay(_day),
        'name': _name.text.trim(),
        'kind': _kind,
        if (_address.text.trim().isNotEmpty) 'address': _address.text.trim(),
        'lat': p.latitude,
        'lng': p.longitude,
        'radius_m': _radiusM.round(),
      });
      showSnack('Task assigned.');
      _name.clear();
      _address.clear();
      _search.clear();
      _link.clear();
      if (mounted) setState(() => _point = null);
      await _loadList();
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(Assignment a) async {
    final sure = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Delete this task?'),
        content: Text(a.name),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel')),
          FilledButton(
              style: FilledButton.styleFrom(backgroundColor: kRed),
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (sure != true) return;
    try {
      await Api.instance.delete('/assignments/${a.id}');
      if (mounted) {
        setState(() => _assignments.removeWhere((x) => x.id == a.id));
      }
    } on ApiException catch (e) {
      showSnack(e.message, error: true);
    }
  }

  Future<void> _pickDay() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: now.subtract(const Duration(days: 60)),
      lastDate: now.add(const Duration(days: 60)),
    );
    if (d != null) {
      setState(() => _day = d);
      _loadList();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _store,
      builder: (context, _) {
        final officers = [..._store.officers]
          ..sort((a, b) => a.name.compareTo(b.name));
        if (_officerId != null && !officers.any((o) => o.id == _officerId)) {
          _officerId = null;
        }
        return ListView(
          physics: _mapTouch ? const NeverScrollableScrollPhysics() : null,
          padding: const EdgeInsets.only(bottom: 40, top: 8),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _officerId,
                    isExpanded: true,
                    decoration:
                        const InputDecoration(labelText: 'Field officer'),
                    hint: Text(officers.isEmpty
                        ? (_store.loadingLive ? 'Loading...' : 'No officers')
                        : 'Choose officer'),
                    items: [
                      for (final o in officers)
                        DropdownMenuItem(
                            value: o.id,
                            child: Text(o.name.isEmpty ? o.userid : o.name,
                                overflow: TextOverflow.ellipsis)),
                    ],
                    onChanged: (v) {
                      setState(() {
                        _officerId = v;
                        _assignments = [];
                      });
                      _loadList();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: _pickDay,
                  icon: const Icon(Icons.calendar_today, size: 18),
                  label: Text(fmtDay(_day) == fmtDay(DateTime.now())
                      ? 'Today'
                      : fmtDay(_day)),
                ),
              ]),
            ),
            if (officers.isEmpty && !_store.loadingLive)
              Padding(
                padding: const EdgeInsets.all(12),
                child: OutlinedButton.icon(
                  onPressed: _store.loadOfficers,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Reload officers'),
                ),
              ),
            const SectionTitle('Add a location'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      decoration: const InputDecoration(
                          labelText: 'Location name',
                          hintText: 'Example: Hosur Center 3'),
                    ),
                    const SizedBox(height: 12),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(
                            value: 'center',
                            icon: Icon(Icons.groups),
                            label: Text('Center')),
                        ButtonSegment(
                            value: 'village',
                            icon: Icon(Icons.holiday_village),
                            label: Text('Village')),
                      ],
                      selected: {_kind},
                      onSelectionChanged: (s) =>
                          setState(() => _kind = s.first),
                    ),
                    const SizedBox(height: 16),
                    const Text('1. Search a place',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Row(children: [
                      Expanded(
                        child: TextField(
                          controller: _search,
                          textInputAction: TextInputAction.search,
                          onSubmitted: (_) => _doSearch(),
                          decoration: const InputDecoration(
                              hintText: 'Village, town or landmark',
                              prefixIcon: Icon(Icons.search)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _searching ? null : _doSearch,
                        child: _searching
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.5, color: Colors.white))
                            : const Text('Search'),
                      ),
                    ]),
                    if (_searchMsg != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(_searchMsg!,
                            style: const TextStyle(color: kOrange)),
                      ),
                    if (_places.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(top: 6),
                        constraints: const BoxConstraints(maxHeight: 230),
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFCFD6E4)),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: ListView.separated(
                          shrinkWrap: true,
                          padding: EdgeInsets.zero,
                          itemCount: _places.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (_, i) {
                            final p = _places[i];
                            return ListTile(
                              dense: true,
                              leading: const Icon(Icons.place, color: kRed),
                              title: Text(p.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700)),
                              subtitle: p.address.isEmpty
                                  ? null
                                  : Text(p.address,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis),
                              onTap: () => _pickPlace(p),
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: 14),
                    const Text('2. Or paste a Google Maps link',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Row(children: [
                      Expanded(
                        child: TextField(
                          controller: _link,
                          keyboardType: TextInputType.url,
                          autocorrect: false,
                          decoration: const InputDecoration(
                              hintText: 'https://maps.app.goo.gl/...',
                              prefixIcon: Icon(Icons.link)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _resolving ? null : _resolveLink,
                        child: _resolving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.5, color: Colors.white))
                            : const Text('Use link'),
                      ),
                    ]),
                    const SizedBox(height: 14),
                    const Text('3. Or press and hold on the map to drop the pin',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    _mapBox(),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: Text(
                          _point == null
                              ? 'No location chosen yet'
                              : 'Pin: ${fmtLatLng(_point!.latitude, _point!.longitude)}',
                          style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: _point == null ? kGrey : kNavy),
                        ),
                      ),
                      if (_point != null)
                        TextButton.icon(
                          onPressed: () => openInGoogleMaps(
                              _point!.latitude, _point!.longitude),
                          icon: const Icon(Icons.open_in_new, size: 18),
                          label: const Text('Open in Google Maps'),
                        ),
                    ]),
                    const SizedBox(height: 8),
                    Row(children: [
                      SizedBox(
                        width: 150,
                        child: TextField(
                          controller: _radius,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              labelText: 'Radius', suffixText: 'm'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                            'The officer must come inside this circle for the visit to count.',
                            style: TextStyle(color: kGrey, fontSize: 13)),
                      ),
                    ]),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _address,
                      decoration: const InputDecoration(
                          labelText: 'Address (optional)'),
                    ),
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.5, color: Colors.white))
                          : const Icon(Icons.save),
                      label: const Text('Save task'),
                    ),
                  ],
                ),
              ),
            ),
            SectionTitle(
              'Tasks on ${fmtDayNice(_day)}',
              trailing: _officerId == null
                  ? null
                  : IconButton(
                      tooltip: 'Reload',
                      onPressed: _loadingList ? null : _loadList,
                      icon: const Icon(Icons.refresh)),
            ),
            if (_officerId == null)
              const EmptyState(
                  icon: Icons.person_search,
                  text: 'Choose a field officer to see their tasks.')
            else if (_loadingList)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_listError != null)
              ErrorRetry(message: _listError!, onRetry: _loadList)
            else if (_assignments.isEmpty)
              const EmptyState(
                  icon: Icons.assignment_outlined,
                  text: 'No tasks assigned for this day.')
            else
              for (final a in _assignments)
                Card(
                  child: ListTile(
                    leading: Icon(
                        a.kind == 'center'
                            ? Icons.groups
                            : Icons.holiday_village,
                        color: a.kind == 'center' ? kBlue : kOrange),
                    title: Text(a.name,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text([
                      '${a.kind == 'center' ? 'Center' : 'Village'} - ${a.radiusM.round()} m'
                          '${a.visited ? ' - visited' : ''}',
                      if (a.address.isNotEmpty) a.address,
                    ].join('\n')),
                    isThreeLine: a.address.isNotEmpty,
                    onTap: a.hasPosition
                        ? () => _setPoint(LatLng(a.lat!, a.lng!))
                        : null,
                    trailing: IconButton(
                      tooltip: 'Delete',
                      icon: const Icon(Icons.delete_outline, color: kRed),
                      onPressed: () => _delete(a),
                    ),
                  ),
                ),
          ],
        );
      },
    );
  }

  Widget _mapBox() {
    final p = _point;
    return Listener(
      onPointerDown: (_) => setState(() => _mapTouch = true),
      onPointerUp: (_) => setState(() => _mapTouch = false),
      onPointerCancel: (_) => setState(() => _mapTouch = false),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          height: 300,
          child: FlutterMap(
            mapController: _map,
            options: MapOptions(
              initialCenter: _initialCenter(),
              initialZoom: _initialCenter() == kIndiaCenter ? 4.5 : 13,
              onMapReady: () => _mapReady = true,
              onLongPress: (_, latlng) {
                setState(() => _point = latlng);
              },
            ),
            children: [
              osmTiles(),
              CircleLayer(circles: [
                for (final a in _assignments)
                  if (a.hasPosition)
                    fenceCircle(LatLng(a.lat!, a.lng!), a.radiusM,
                        color: kGrey),
                if (p != null) fenceCircle(p, _radiusM, color: kBlue),
              ]),
              MarkerLayer(markers: [
                for (final a in _assignments)
                  if (a.hasPosition)
                    dotMarker(LatLng(a.lat!, a.lng!), kGrey, size: 12),
                if (p != null) pinMarker(p, kRed),
              ]),
              osmAttribution(),
            ],
          ),
        ),
      ),
    );
  }

  /// Start the map near the manager's own branch / team when known.
  LatLng _initialCenter() {
    for (final b in _store.branches) {
      if (b.lat != null && b.lng != null) return LatLng(b.lat!, b.lng!);
    }
    for (final o in _store.officers) {
      if (o.hasPosition) return LatLng(o.lat!, o.lng!);
    }
    return kIndiaCenter;
  }
}
