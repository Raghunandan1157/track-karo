import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../api/api_client.dart';
import '../../models/models.dart';
import '../../services/tracking_service.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Customer visit: type a name, pick an EXISTING customer from the list,
/// then capture the live GPS location against that customer.
/// Free text that is not picked from the list is never accepted.
class CustomerVisitCard extends StatefulWidget {
  const CustomerVisitCard({
    super.key,
    required this.visits,
    required this.onCaptured,
  });

  final List<CustomerVisit> visits;
  final Future<void> Function() onCaptured;

  @override
  State<CustomerVisitCard> createState() => _CustomerVisitCardState();
}

class _CustomerVisitCardState extends State<CustomerVisitCard> {
  final _ctrl = TextEditingController();
  final _focus = FocusNode();
  Timer? _debounce;
  int _searchSeq = 0;

  List<CustomerLite> _results = [];
  bool _searching = false;
  bool _searched = false; // a search for the current text has finished
  String? _searchError;

  CustomerLite? _selected;
  bool _capturing = false;
  String? _captureError;
  CustomerVisit? _lastCaptured;

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    // Any edit cancels the selection: only a picked customer is valid.
    _debounce?.cancel();
    setState(() {
      _selected = null;
      _lastCaptured = null;
      _captureError = null;
      _searched = false;
      _searchError = null;
      if (text.trim().isEmpty) {
        _results = [];
        _searching = false;
      }
    });
    if (text.trim().isEmpty) return;
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(text));
  }

  Future<void> _search(String text) async {
    final q = text.trim();
    if (q.isEmpty) return;
    final seq = ++_searchSeq;
    setState(() => _searching = true);
    try {
      final res =
          asMap(await Api.instance.get('/customers/search', query: {'q': q}));
      if (!mounted || seq != _searchSeq) return;
      setState(() {
        _results =
            asList(res['customers']).map(CustomerLite.fromJson).toList();
        _searching = false;
        _searched = true;
      });
    } on ApiException catch (e) {
      if (!mounted || seq != _searchSeq) return;
      setState(() {
        _results = [];
        _searching = false;
        _searchError = e.message;
      });
    }
  }

  void _pick(CustomerLite c) {
    _debounce?.cancel();
    _searchSeq++;
    _ctrl.text = c.name;
    _focus.unfocus();
    setState(() {
      _selected = c;
      _results = [];
      _searching = false;
      _searched = false;
      _captureError = null;
      _lastCaptured = null;
    });
  }

  void _clear() {
    _debounce?.cancel();
    _searchSeq++;
    _ctrl.clear();
    setState(() {
      _selected = null;
      _results = [];
      _searching = false;
      _searched = false;
      _searchError = null;
      _captureError = null;
    });
  }

  Future<void> _capture() async {
    final c = _selected;
    if (c == null || _capturing) return;
    setState(() {
      _capturing = true;
      _captureError = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw ApiException('Location (GPS) is turned off. Turn it on first.');
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        throw ApiException('Location permission is needed to capture.');
      }
      final Position p;
      try {
        p = await TrackingService.freshFix();
      } catch (_) {
        throw ApiException(
            'Could not get a GPS fix. Go outside or near a window and try again.');
      }
      final res = asMap(await Api.instance.post('/customer-visits', {
        'customer_id': c.id,
        'lat': p.latitude,
        'lng': p.longitude,
        'accuracy': double.parse(p.accuracy.toStringAsFixed(1)),
      }));
      var visit = CustomerVisit.fromJson(asMap(res['visit']));
      if (visit.lat == null) {
        visit = CustomerVisit(
            customerId: c.id,
            customerName: c.name,
            ts: DateTime.now(),
            lat: p.latitude,
            lng: p.longitude);
      }
      if (!mounted) return;
      _ctrl.clear();
      setState(() {
        _lastCaptured = visit;
        _selected = null;
        _results = [];
        _searched = false;
      });
      await widget.onCaptured();
    } on ApiException catch (e) {
      if (mounted) setState(() => _captureError = e.message);
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final typed = _ctrl.text.trim().isNotEmpty;
    final notFound = typed &&
        _selected == null &&
        _searched &&
        !_searching &&
        _results.isEmpty;

    return Column(children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _ctrl,
                focusNode: _focus,
                onChanged: _onChanged,
                textCapitalization: TextCapitalization.words,
                autocorrect: false,
                style: const TextStyle(fontSize: 17),
                decoration: InputDecoration(
                  labelText: 'Customer name',
                  hintText: 'Type to search',
                  prefixIcon: Icon(
                      _selected != null ? Icons.verified : Icons.search,
                      color: _selected != null ? kGreen : null),
                  suffixIcon: _searching
                      ? const Padding(
                          padding: EdgeInsets.all(14),
                          child: SizedBox(
                              width: 18,
                              height: 18,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2)))
                      : typed
                          ? IconButton(
                              tooltip: 'Clear',
                              icon: const Icon(Icons.close),
                              onPressed: _clear)
                          : null,
                ),
              ),
              // Dropdown: narrows with every letter typed.
              if (_selected == null && _results.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  constraints: const BoxConstraints(maxHeight: 260),
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFCFD6E4)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding: EdgeInsets.zero,
                    itemCount: _results.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final c = _results[i];
                      final sub = [c.village, c.phone]
                          .where((s) => s.isNotEmpty)
                          .join(' - ');
                      return ListTile(
                        leading: const Icon(Icons.person, color: kBlue),
                        title: Text(c.name,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: sub.isEmpty ? null : Text(sub),
                        onTap: () => _pick(c),
                      );
                    },
                  ),
                ),
              if (notFound)
                const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Row(children: [
                    Icon(Icons.error_outline, color: kRed),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Customer not found. Ask your branch manager to add this customer.',
                        style: TextStyle(
                            color: kRed, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ]),
                ),
              if (_searchError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Row(children: [
                    Expanded(
                      child: Text('Search failed: $_searchError',
                          style: const TextStyle(color: kOrange)),
                    ),
                    TextButton(
                        onPressed: () => _search(_ctrl.text),
                        child: const Text('Retry')),
                  ]),
                ),
              if (typed &&
                  _selected == null &&
                  !notFound &&
                  _results.isNotEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('Pick the customer from the list.',
                      style: TextStyle(color: kGrey)),
                ),
              if (_selected != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Row(children: [
                    const Icon(Icons.check_circle, color: kGreen, size: 20),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Selected: ${_selected!.name}'
                        '${_selected!.village.isEmpty ? '' : ' (${_selected!.village})'}',
                        style: const TextStyle(
                            color: kGreen, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ]),
                ),
              const SizedBox(height: 14),
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: kBlue),
                onPressed: _selected != null && !_capturing ? _capture : null,
                icon: _capturing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.5, color: Colors.white))
                    : const Icon(Icons.gps_fixed),
                label: Text(_capturing
                    ? 'Getting GPS location...'
                    : 'Capture live location'),
              ),
              if (_captureError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(_captureError!,
                      style: const TextStyle(
                          color: kRed, fontWeight: FontWeight.w600)),
                ),
              if (_lastCaptured != null)
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: kGreen.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: kGreen.withValues(alpha: 0.5)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.check_circle, color: kGreen, size: 30),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Location saved for ${_lastCaptured!.customerName}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800, color: kGreen)),
                          Text(fmtLatLng(
                              _lastCaptured!.lat, _lastCaptured!.lng)),
                        ],
                      ),
                    ),
                  ]),
                ),
            ],
          ),
        ),
      ),
      if (widget.visits.isNotEmpty) ...[
        SectionTitle('Customers captured today (${widget.visits.length})'),
        for (final v in widget.visits)
          Card(
            child: ListTile(
              leading: const Icon(Icons.person_pin_circle, color: kYellow, size: 32),
              title: Text(v.customerName,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text('${fmtTime(v.ts)} - ${fmtLatLng(v.lat, v.lng)}'),
            ),
          ),
      ],
    ]);
  }
}
