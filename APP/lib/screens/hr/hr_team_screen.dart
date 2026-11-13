import 'package:flutter/material.dart';

import '../../models/hr_models.dart';
import '../../services/hr_store.dart';
import '../../services/session.dart';
import '../../theme.dart';
import '../../widgets/common.dart' show showSnack;
import '../../widgets/hr_widgets.dart';
import 'hr_me_screen.dart';

/// Manager / admin HR tab: team directory, leave approvals and today's status.
class HrTeamScreen extends StatefulWidget {
  const HrTeamScreen({super.key});

  @override
  State<HrTeamScreen> createState() => _HrTeamScreenState();
}

class _HrTeamScreenState extends State<HrTeamScreen> {
  final HrStore _store = HrStore.instance;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _store.ensureSeeded(Session.instance.user);
    _store.addListener(_onStore);
  }

  @override
  void dispose() {
    _store.removeListener(_onStore);
    super.dispose();
  }

  void _onStore() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          Material(
            color: Colors.white,
            child: TabBar(
              labelColor: kNavy,
              unselectedLabelColor: kGrey,
              indicatorColor: kBlue,
              labelStyle: const TextStyle(fontWeight: FontWeight.w700),
              tabs: [
                const Tab(text: 'Team'),
                Tab(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Approvals'),
                      if (_store.pendingLeaves.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        _CountBadge(_store.pendingLeaves.length),
                      ],
                    ],
                  ),
                ),
                const Tab(text: 'Today'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              children: [
                _teamTab(context),
                _approvalsTab(context),
                _todayTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _teamTab(BuildContext context) {
    final list = _store.team
        .where((e) =>
            _query.isEmpty ||
            e.name.toLowerCase().contains(_query.toLowerCase()) ||
            e.code.toLowerCase().contains(_query.toLowerCase()) ||
            e.department.toLowerCase().contains(_query.toLowerCase()))
        .toList();
    return ListView(
      padding: const EdgeInsets.only(bottom: 24, top: 8),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Search name, code or department',
              prefixIcon: Icon(Icons.search),
              isDense: true,
            ),
            onChanged: (v) => setState(() => _query = v.trim()),
          ),
        ),
        Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: ListTile(
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFEAF1FA),
              child: Icon(Icons.badge_outlined, color: kBlue),
            ),
            title: const Text('My HR profile',
                style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Attendance, leave and payslips'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const HrMeScreen()),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: Row(
            children: [
              const Expanded(
                child: Text('Team directory',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: kNavy)),
              ),
              Text('${list.length} people',
                  style: const TextStyle(fontSize: 12.5, color: kGrey)),
            ],
          ),
        ),
        if (list.isEmpty)
          const HrEmpty(text: 'No employees match your search.')
        else
          for (final e in list)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                leading: HrAvatar(e.name, id: e.id),
                title: Text(e.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, color: kNavy)),
                subtitle: Text(
                  '${e.designation} · ${e.branch}',
                  style: const TextStyle(fontSize: 12.5),
                ),
                trailing: HrStatusChip(e.statusLabel, status: e.status, dense: true),
                onTap: () => _openEmployee(context, e),
              ),
            ),
      ],
    );
  }

  Widget _approvalsTab(BuildContext context) {
    final pending = _store.pendingLeaves;
    if (pending.isEmpty) {
      return const Center(
        child: HrEmpty(
          icon: Icons.check_circle_outline,
          text: 'No pending leave requests. The inbox is clear.',
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 24, top: 8),
      itemCount: pending.length,
      itemBuilder: (context, i) {
        final l = pending[i];
        final e = _store.employee(l.employeeId);
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    HrAvatar(e?.name ?? '?', id: e?.id ?? 0, size: 38),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(e?.name ?? '-',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, color: kNavy)),
                          Text(
                            '${l.typeLabel} · ${l.days} day${l.days == 1 ? '' : 's'}',
                            style: const TextStyle(fontSize: 12.5, color: kGrey),
                          ),
                        ],
                      ),
                    ),
                    HrStatusChip(l.statusLabel, status: l.status, dense: true),
                  ],
                ),
                const SizedBox(height: 8),
                Text('${hrDate(l.from)} - ${hrDate(l.to)}',
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
                if (l.reason.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(l.reason,
                        style: const TextStyle(fontSize: 12.5, color: kGrey)),
                  ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () {
                        _store.decideLeave(l.id, false);
                        showSnack('Leave rejected');
                      },
                      child: const Text('Reject',
                          style: TextStyle(color: kRed)),
                    ),
                    const SizedBox(width: 4),
                    FilledButton(
                      onPressed: () {
                        _store.decideLeave(l.id, true);
                        showSnack('Leave approved');
                      },
                      child: const Text('Approve'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _todayTab() {
    final today = DateTime.now();
    final rows = <(HrEmployee, HrAttendance)>[];
    for (final e in _store.team) {
      rows.add((e, _store.attendanceOn(e, today)));
    }
    int count(String status) =>
        rows.where((r) => r.$2.status == status).length;
    final present = rows
        .where((r) => ['present', 'wfh', 'field', 'late'].contains(r.$2.status))
        .length;
    final pct = rows.isEmpty ? 0 : ((present / rows.length) * 100).round();
    return ListView(
      padding: const EdgeInsets.only(bottom: 24, top: 8),
      children: [
        HrCard(
          title: 'Attendance today',
          trailing: HrStatusChip('$pct%', status: 'present'),
          child: Column(
            children: [
              HrProgress(value: pct / 100),
              const SizedBox(height: 12),
              Row(
                children: [
                  _stat('Present', '$present', kGreen),
                  _stat('Late', '${count('late')}', kOrange),
                  _stat('Leave', '${count('leave')}', kBlue),
                  _stat('Absent', '${count('absent')}', kRed),
                ],
              ),
            ],
          ),
        ),
        HrCard(
          title: 'Team status',
          child: Column(
            children: [
              for (final r in rows)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      HrAvatar(r.$1.name, id: r.$1.id, size: 34),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.$1.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600, fontSize: 13.5)),
                            Text(
                              r.$1.workMode == 'field'
                                  ? 'Field · ${r.$1.branch}'
                                  : r.$1.department,
                              style: const TextStyle(fontSize: 11.5, color: kGrey),
                            ),
                          ],
                        ),
                      ),
                      if (r.$2.inTime.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Text(r.$2.inTime,
                              style: const TextStyle(fontSize: 12, color: kGrey)),
                        ),
                      HrStatusChip(r.$2.label, status: r.$2.status, dense: true),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: color)),
          Text(label, style: const TextStyle(fontSize: 11.5, color: kGrey)),
        ],
      ),
    );
  }

  void _openEmployee(BuildContext context, HrEmployee e) {
    final summary = _store.summaryFor(e.id, DateTime.now());
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  HrAvatar(e.name, size: 54, id: e.id),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.name,
                            style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: kNavy)),
                        Text('${e.designation} · ${e.code}',
                            style: const TextStyle(fontSize: 13, color: kGrey)),
                      ],
                    ),
                  ),
                  HrStatusChip(e.statusLabel, status: e.status),
                ],
              ),
              const SizedBox(height: 16),
              HrKv('Branch', e.branch),
              HrKv('Department', e.department),
              HrKv('Reports to', e.managerName),
              HrKv('Phone', e.phone),
              HrKv('Email', e.email),
              HrKv('Joined', hrDate(e.doj)),
              HrKv('Shift', e.shift),
              const Divider(height: 24),
              Text('This month',
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w800, color: kNavy)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _stat('Present', '${summary.present}', kGreen),
                  _stat('Late', '${summary.late}', kOrange),
                  _stat('Leave', '${summary.leave}', kBlue),
                  _stat('Absent', '${summary.absent}', kRed),
                ],
              ),
              const SizedBox(height: 8),
              HrProgress(value: summary.attendancePct / 100),
              const SizedBox(height: 4),
              Text('${summary.attendancePct}% attendance',
                  style: const TextStyle(fontSize: 12, color: kGrey)),
            ],
          ),
        ),
      ),
    );
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge(this.count);

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: kOrange,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '$count',
        style: const TextStyle(
            color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}
