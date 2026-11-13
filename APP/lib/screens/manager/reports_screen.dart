import 'package:flutter/material.dart';

import '../../api/api_client.dart';
import '../../models/models.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

/// Reports tab: one card per field officer for the chosen day.
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  DateTime _day = DateTime.now();
  List<DailyReport>? _reports;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = asMap(await Api.instance
          .get('/reports/daily', query: {'day': fmtDay(_day)}));
      if (!mounted) return;
      setState(() {
        _reports = asList(res['reports']).map(DailyReport.fromJson).toList();
        _error = null;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _pickDay() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (d != null) {
      setState(() {
        _day = d;
        _reports = null;
      });
      _load();
    }
  }

  void _shift(int days) {
    final d = _day.add(Duration(days: days));
    if (d.isAfter(DateTime.now())) return;
    setState(() {
      _day = d;
      _reports = null;
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final reports = _reports;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 2),
        child: Row(children: [
          IconButton(
              tooltip: 'Previous day',
              onPressed: () => _shift(-1),
              icon: const Icon(Icons.chevron_left, size: 30)),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _pickDay,
              icon: const Icon(Icons.calendar_today, size: 18),
              label: Text(fmtDayNice(_day)),
            ),
          ),
          IconButton(
              tooltip: 'Next day',
              onPressed: fmtDay(_day) == fmtDay(DateTime.now())
                  ? null
                  : () => _shift(1),
              icon: const Icon(Icons.chevron_right, size: 30)),
        ]),
      ),
      if (_loading) const LinearProgressIndicator(minHeight: 3),
      Expanded(
        child: reports == null
            ? (_loading
                ? const SizedBox.shrink()
                : ErrorRetry(
                    message: _error ?? 'Could not load the report.',
                    onRetry: _load))
            : RefreshIndicator(
                onRefresh: _load,
                child: reports.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 80),
                        EmptyState(
                            icon: Icons.bar_chart,
                            text: 'No report for this day.'),
                      ])
                    : ListView.builder(
                        padding: const EdgeInsets.only(bottom: 24),
                        itemCount: reports.length,
                        itemBuilder: (_, i) => _card(reports[i]),
                      ),
              ),
      ),
    ]);
  }

  Widget _card(DailyReport r) {
    final lunchOver = r.lunchExcessMin > 0 || r.lunchMinutes > r.lunchAllowedMin;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ReportDetailScreen(report: r, day: _day))),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(r.officerName,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w800)),
                ),
                if (r.longBreak)
                  const StatusChip(
                      label: 'Long break', color: kRed, icon: Icons.timer_off),
                const Icon(Icons.chevron_right, color: kGrey),
              ]),
              Text(
                [
                  if (r.branchName.isNotEmpty) r.branchName,
                  r.startedAt == null
                      ? 'Did not start the day'
                      : '${fmtTime(r.startedAt)} to ${r.endedAt == null ? 'not ended' : fmtTime(r.endedAt)}',
                ].join(' - '),
                style: const TextStyle(color: kGrey),
              ),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 8, children: [
                _metric(Icons.route, 'Distance',
                    '${r.distanceKm.toStringAsFixed(1)} km'),
                _metric(Icons.groups, 'Centers',
                    '${r.centersVisited}/${r.centersAssigned}',
                    bad: r.centersVisited < r.centersAssigned),
                _metric(Icons.holiday_village, 'Villages',
                    '${r.villagesVisited}/${r.villagesAssigned}',
                    bad: r.villagesVisited < r.villagesAssigned),
                _metric(Icons.timer, 'At locations',
                    fmtMin(r.timeAtLocationsMin)),
                _metric(Icons.restaurant, 'Lunch',
                    '${r.lunchMinutes}/${r.lunchAllowedMin} min'
                    '${r.lunchExcessMin > 0 ? ' (+${r.lunchExcessMin})' : ''}',
                    bad: lunchOver),
                _metric(Icons.report_problem, 'Unexplained stops',
                    '${r.unexplainedStops.length} (${fmtMin(r.unexplainedStopMin)})',
                    bad: r.unexplainedStops.isNotEmpty),
                _metric(Icons.person_pin_circle, 'Customers',
                    '${r.customersCaptured}'),
                if (r.locationOffCount > 0)
                  _metric(Icons.location_off, 'Location off',
                      '${r.locationOffCount} times',
                      bad: true),
              ]),
              if (r.missed.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text('Missed: ${r.missed.join(', ')}',
                    style: const TextStyle(
                        color: kRed, fontWeight: FontWeight.w700)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _metric(IconData icon, String label, String value, {bool bad = false}) {
    final c = bad ? kRed : kNavy;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: bad ? const Color(0xFFFFEBEE) : const Color(0xFFF2F5FA),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 17, color: c),
        const SizedBox(width: 6),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11.5, color: kGrey)),
          Text(value,
              style: TextStyle(fontWeight: FontWeight.w800, color: c)),
        ]),
      ]),
    );
  }
}

class ReportDetailScreen extends StatelessWidget {
  const ReportDetailScreen({super.key, required this.report, required this.day});
  final DailyReport report;
  final DateTime day;

  @override
  Widget build(BuildContext context) {
    final r = report;
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(r.officerName,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          Text(fmtDayNice(day), style: const TextStyle(fontSize: 13)),
        ]),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          const SectionTitle('Summary'),
          _row('Day', r.startedAt == null
              ? 'Did not start'
              : '${fmtTime(r.startedAt)} to ${r.endedAt == null ? 'not ended' : fmtTime(r.endedAt)} (${fmtMin(r.dutyMinutes)})'),
          _row('Distance', '${r.distanceKm.toStringAsFixed(1)} km'),
          _row('Centers', '${r.centersVisited} of ${r.centersAssigned} visited'),
          _row('Villages', '${r.villagesVisited} of ${r.villagesAssigned} visited'),
          _row('Time at locations', fmtMin(r.timeAtLocationsMin)),
          _row('Lunch',
              '${r.lunchMinutes} min (allowed ${r.lunchAllowedMin})'
              '${r.lunchExcessMin > 0 ? ', ${r.lunchExcessMin} min extra' : ''}',
              bad: r.lunchExcessMin > 0),
          _row('Long break', r.longBreak ? 'Yes' : 'No', bad: r.longBreak),
          _row('Customers captured', '${r.customersCaptured}'),
          _row('Location turned off', '${r.locationOffCount} times',
              bad: r.locationOffCount > 0),
          SectionTitle('Visits (${r.visitDetails.length})'),
          if (r.visitDetails.isEmpty)
            const EmptyState(
                icon: Icons.assignment_outlined,
                text: 'No locations were assigned.'),
          for (final v in r.visitDetails)
            ListTile(
              leading: Icon(v.visited ? Icons.check_circle : Icons.cancel,
                  color: v.visited ? kGreen : kRed),
              title: Text(v.name,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(
                  '${v.kind == 'center' ? 'Center' : 'Village'} - '
                  '${v.visited ? '${fmtTime(v.enterAt)} to ${fmtTime(v.exitAt)}, ${fmtMin(v.minutes)}' : 'Missed'}'),
            ),
          SectionTitle(
              'Unexplained stops (${r.unexplainedStops.length}, ${fmtMin(r.unexplainedStopMin)})'),
          if (r.unexplainedStops.isEmpty)
            const EmptyState(
                icon: Icons.thumb_up_alt_outlined,
                text: 'No unexplained stops.'),
          for (final s in r.unexplainedStops)
            ListTile(
              leading: const Icon(Icons.report_problem, color: kRed),
              title: Text('${fmtTime(s.start)} to ${fmtTime(s.end)}'),
              subtitle: Text('${fmtMin(s.minutes)} - ${fmtLatLng(s.lat, s.lng)}'),
              trailing: s.lat == null || s.lng == null
                  ? null
                  : IconButton(
                      tooltip: 'Open in Google Maps',
                      icon: const Icon(Icons.open_in_new),
                      onPressed: () => openInGoogleMaps(s.lat!, s.lng!)),
            ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool bad = false}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
              width: 150,
              child: Text(label, style: const TextStyle(color: kGrey))),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    fontWeight: FontWeight.w700, color: bad ? kRed : null)),
          ),
        ]),
      );
}
