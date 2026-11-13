import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/hr_models.dart';
import '../../services/hr_store.dart';
import '../../services/session.dart';
import '../../theme.dart';
import '../../widgets/common.dart' show showSnack;
import '../../widgets/hr_widgets.dart';

/// Employee self-service: my profile, attendance, leave and payslips.
class HrMeScreen extends StatefulWidget {
  const HrMeScreen({super.key});

  @override
  State<HrMeScreen> createState() => _HrMeScreenState();
}

class _HrMeScreenState extends State<HrMeScreen> {
  final HrStore _store = HrStore.instance;
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);

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

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta, 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    final me = _store.me;
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('My HR',
                  style: TextStyle(fontWeight: FontWeight.w800)),
              Text(
                me == null ? 'Employee self-service' : '${me.name} · ${me.code}',
                style: const TextStyle(fontSize: 13),
              ),
            ],
          ),
          bottom: const TabBar(
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: kOrange,
            indicatorWeight: 3,
            tabs: [
              Tab(text: 'Profile'),
              Tab(text: 'Attendance'),
              Tab(text: 'Leave'),
              Tab(text: 'Payslips'),
            ],
          ),
        ),
        body: me == null
            ? const Center(child: Text('No employee profile linked to this login.'))
            : TabBarView(
                children: [
                  _ProfileTab(store: _store, me: me),
                  _AttendanceTab(
                    store: _store,
                    me: me,
                    month: _month,
                    onShift: _shiftMonth,
                  ),
                  _LeaveTab(store: _store, me: me),
                  _PayslipsTab(store: _store, me: me),
                ],
              ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------
class _ProfileTab extends StatelessWidget {
  const _ProfileTab({required this.store, required this.me});

  final HrStore store;
  final HrEmployee me;

  @override
  Widget build(BuildContext context) {
    final docs = store.documentsFor(me.id);
    return ListView(
      padding: const EdgeInsets.only(bottom: 28, top: 8),
      children: [
        Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                HrAvatar(me.name, size: 62, id: me.id),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        me.name,
                        style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            color: kNavy),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${me.designation} · ${me.department}',
                        style: const TextStyle(fontSize: 13.5, color: kGrey),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          HrStatusChip(me.statusLabel, status: me.status),
                          HrStatusChip(me.code, status: 'week_off'),
                          HrStatusChip(me.branch, status: 'leave'),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        HrCard(
          title: 'Employment',
          child: Column(
            children: [
              HrKv('Branch', me.branch),
              HrKv('Department', me.department),
              HrKv('Reports to', me.managerName),
              HrKv('Date of joining', hrDate(me.doj)),
              HrKv('Employment type', me.employmentLabel),
              HrKv('Work mode', me.workMode == 'field' ? 'Field' : me.workMode == 'hybrid' ? 'Hybrid' : 'Office'),
              HrKv('Shift', me.shift),
            ],
          ),
        ),
        HrCard(
          title: 'Contact & emergency',
          child: Column(
            children: [
              HrKv('Work email', me.email),
              HrKv('Phone', me.phone),
              HrKv('Address', me.address),
              HrKv('Date of birth', hrDate(me.dob)),
              HrKv('Blood group', me.bloodGroup),
              HrKv('Emergency', me.emergencyName),
              HrKv('Emergency phone', me.emergencyPhone),
            ],
          ),
        ),
        HrCard(
          title: 'Payroll & bank',
          child: Column(
            children: [
              HrKv('Annual CTC', HrStore.money(me.ctc)),
              HrKv('Monthly gross', HrStore.money(me.ctc / 12)),
              HrKv('PAN', me.pan),
              HrKv('UAN', me.uan),
              HrKv('Bank', '${me.bankName} XXXX${me.bankLast4}'),
              HrKv('IFSC', me.ifsc),
            ],
          ),
        ),
        HrCard(
          title: 'Documents',
          child: docs.isEmpty
              ? const HrEmpty(text: 'No documents on file.')
              : Column(
                  children: [
                    for (final d in docs)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            const Icon(Icons.description_outlined,
                                size: 20, color: kBlue),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(d.typeLabel,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                  Text(
                                    d.expiresOn.isEmpty
                                        ? d.number
                                        : '${d.number} · expires ${hrDate(d.expiresOn)}',
                                    style: const TextStyle(
                                        fontSize: 12, color: kGrey),
                                  ),
                                ],
                              ),
                            ),
                            HrStatusChip(d.statusLabel, status: d.status, dense: true),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

// -----------------------------------------------------------------------------
// Attendance
// -----------------------------------------------------------------------------
class _AttendanceTab extends StatelessWidget {
  const _AttendanceTab({
    required this.store,
    required this.me,
    required this.month,
    required this.onShift,
  });

  final HrStore store;
  final HrEmployee me;
  final DateTime month;
  final void Function(int delta) onShift;

  @override
  Widget build(BuildContext context) {
    final summary = store.summaryFor(me.id, month);
    final days = store.attendanceForMonth(me.id, month);
    final isCurrent = DateFormat('yyyy-MM').format(month) ==
        DateFormat('yyyy-MM').format(DateTime.now());
    return ListView(
      padding: const EdgeInsets.only(bottom: 28, top: 8),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              IconButton(
                tooltip: 'Previous month',
                onPressed: () => onShift(-1),
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Text(
                  hrMonth(month),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800, color: kNavy),
                ),
              ),
              IconButton(
                tooltip: 'Next month',
                onPressed: isCurrent ? null : () => onShift(1),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ),
        HrCard(
          title: 'Summary',
          trailing: HrStatusChip('${summary.attendancePct}%', status: 'present'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              HrProgress(value: summary.attendancePct / 100),
              const SizedBox(height: 14),
              Row(
                children: [
                  _stat('Working', '${summary.working}', kGrey),
                  _stat('Present', '${summary.present}', kGreen),
                  _stat('Late', '${summary.late}', kOrange),
                  _stat('Leave', '${summary.leave}', kBlue),
                  _stat('Absent', '${summary.absent}', kRed),
                ],
              ),
              if (summary.otMin > 0) ...[
                const SizedBox(height: 10),
                Text('Overtime: ${hrDuration(summary.otMin)}',
                    style: const TextStyle(fontSize: 13, color: kGrey)),
              ],
            ],
          ),
        ),
        if (days.isEmpty)
          const HrEmpty(text: 'No attendance recorded for this month.')
        else
          HrCard(
            title: 'Daily register',
            child: Column(
              children: [
                for (final a in days.take(16))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 74,
                          child: Text(
                            hrDate(a.date),
                            style: const TextStyle(fontSize: 13, color: kNavy),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            a.status == 'present' ||
                                    a.status == 'absent' ||
                                    a.status == 'leave'
                                ? (a.inTime.isEmpty
                                    ? '—'
                                    : '${a.inTime} - ${a.outTime}')
                                : '${a.inTime} - ${a.outTime}',
                            style: const TextStyle(fontSize: 13, color: kGrey),
                          ),
                        ),
                        if (a.workedMin > 0)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Text(
                              hrDuration(a.workedMin),
                              style: const TextStyle(fontSize: 12, color: kGrey),
                            ),
                          ),
                        HrStatusChip(a.label, status: a.status, dense: true),
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
          Text(label,
              style: const TextStyle(fontSize: 11.5, color: kGrey)),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Leave
// -----------------------------------------------------------------------------
class _LeaveTab extends StatelessWidget {
  const _LeaveTab({required this.store, required this.me});

  final HrStore store;
  final HrEmployee me;

  @override
  Widget build(BuildContext context) {
    final balances = store.balances(me.id);
    final mine = store.myLeaves(me.id);
    return ListView(
      padding: const EdgeInsets.only(bottom: 28, top: 8),
      children: [
        HrCard(
          title: 'Leave balance',
          child: Column(
            children: [
              for (final b in balances) ...[
                Row(
                  children: [
                    SizedBox(
                      width: 70,
                      child: Text(b.label,
                          style: const TextStyle(fontSize: 13.5)),
                    ),
                    Expanded(
                      child: HrProgress(
                        value: b.total == 0 ? 0 : b.used / b.total,
                        color: b.left <= 2 ? kOrange : kBlue,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text('${b.left}/${b.total}',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: kNavy)),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => _openApply(context),
                  icon: const Icon(Icons.add),
                  label: const Text('Apply for leave'),
                ),
              ),
            ],
          ),
        ),
        HrCard(
          title: 'My requests',
          child: mine.isEmpty
              ? const HrEmpty(text: 'You have not applied for leave yet.')
              : Column(
                  children: [
                    for (final l in mine)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(l.typeLabel,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: kNavy)),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${hrDate(l.from)} - ${hrDate(l.to)} · ${l.days} day${l.days == 1 ? '' : 's'}',
                                    style: const TextStyle(
                                        fontSize: 12.5, color: kGrey),
                                  ),
                                  if (l.reason.isNotEmpty)
                                    Text(l.reason,
                                        style: const TextStyle(
                                            fontSize: 12.5, color: Color(0xFF1A2433))),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                HrStatusChip(l.statusLabel,
                                    status: l.status, dense: true),
                                if (l.status == 'pending')
                                  TextButton(
                                    onPressed: () {
                                      store.cancelLeave(l.id);
                                      showSnack('Leave request cancelled');
                                    },
                                    child: const Text('Cancel',
                                        style: TextStyle(fontSize: 12)),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }

  Future<void> _openApply(BuildContext context) async {
    final reasonCtrl = TextEditingController();
    var type = 'casual';
    var from = DateTime.now().add(const Duration(days: 1));
    var to = from;
    String? error;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setLocal) {
          Future<void> pickDate(bool isFrom) async {
            final picked = await showDatePicker(
              context: dialogContext,
              initialDate: isFrom ? from : to,
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 180)),
            );
            if (picked == null) return;
            setLocal(() {
              if (isFrom) {
                from = picked;
                if (to.isBefore(from)) to = from;
              } else {
                to = picked;
              }
              error = null;
            });
          }

          Future<void> submit() async {
            if (reasonCtrl.text.trim().isEmpty) {
              setLocal(() => error = 'Enter a short reason.');
              return;
            }
            store.applyLeave(
              employeeId: me.id,
              type: type,
              from: from,
              to: to,
              reason: reasonCtrl.text,
            );
            Navigator.pop(dialogContext);
            showSnack('Leave request submitted');
          }

          return AlertDialog(
            title: const Text('Apply for leave'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: type,
                    decoration: const InputDecoration(labelText: 'Leave type'),
                    items: const [
                      DropdownMenuItem(value: 'casual', child: Text('Casual leave')),
                      DropdownMenuItem(value: 'sick', child: Text('Sick leave')),
                      DropdownMenuItem(value: 'earned', child: Text('Earned leave')),
                      DropdownMenuItem(value: 'comp_off', child: Text('Comp off')),
                    ],
                    onChanged: (v) => setLocal(() => type = v ?? 'casual'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => pickDate(true),
                          child: Text('From\n${DateFormat('d MMM').format(from)}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12.5)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => pickDate(false),
                          child: Text('To\n${DateFormat('d MMM').format(to)}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12.5)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: reasonCtrl,
                    maxLength: 120,
                    decoration: const InputDecoration(labelText: 'Reason'),
                    onChanged: (_) => setLocal(() => error = null),
                  ),
                  if (error != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(error!,
                          style: const TextStyle(color: kRed, fontSize: 12.5)),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(onPressed: submit, child: const Text('Submit')),
            ],
          );
        },
      ),
    );
    reasonCtrl.dispose();
  }
}

// -----------------------------------------------------------------------------
// Payslips
// -----------------------------------------------------------------------------
class _PayslipsTab extends StatelessWidget {
  const _PayslipsTab({required this.store, required this.me});

  final HrStore store;
  final HrEmployee me;

  @override
  Widget build(BuildContext context) {
    final slips = store.payslips(me.id);
    return ListView(
      padding: const EdgeInsets.only(bottom: 28, top: 8),
      children: [
        HrCard(
          title: 'Salary',
          child: Column(
            children: [
              HrKv('Annual CTC', HrStore.money(me.ctc)),
              HrKv('Monthly gross', HrStore.money(me.ctc / 12)),
              HrKv('Bank', '${me.bankName} XXXX${me.bankLast4}'),
              const SizedBox(height: 4),
              const Text(
                'Payslips are demo documents; PF, ESI, PT and TDS are computed from the CTC.',
                style: TextStyle(fontSize: 12, color: kGrey),
              ),
            ],
          ),
        ),
        HrCard(
          title: 'Payslip history',
          child: Column(
            children: [
              for (final s in slips)
                InkWell(
                  onTap: () => _openPayslip(context, s),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEAF1FA),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.receipt_long, color: kBlue),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(s.monthLabel,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700, color: kNavy)),
                              Text('${s.daysPaid} days paid',
                                  style: const TextStyle(
                                      fontSize: 12.5, color: kGrey)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(HrStore.money(s.net),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800, color: kNavy)),
                            const SizedBox(height: 3),
                            HrStatusChip(s.statusLabel,
                                status: s.status, dense: true),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  void _openPayslip(BuildContext context, HrPayslip s) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Payslip · ${s.monthLabel}',
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w800, color: kNavy)),
              Text('${me.name} · ${me.code}',
                  style: const TextStyle(fontSize: 13, color: kGrey)),
              const SizedBox(height: 14),
              _moneyRow('Basic', s.basic),
              _moneyRow('HRA', s.hra),
              _moneyRow('Conveyance', s.conveyance),
              _moneyRow('Special allowance', s.special),
              const Divider(height: 20),
              _moneyRow('Gross earnings', s.gross, bold: true),
              const SizedBox(height: 10),
              _moneyRow('Employee PF', -s.pf),
              if (s.esi > 0) _moneyRow('ESI', -s.esi),
              _moneyRow('Professional tax', -s.professionalTax),
              _moneyRow('TDS', -s.tds),
              if (s.lopAmount > 0) _moneyRow('Loss of pay', -s.lopAmount),
              const Divider(height: 20),
              _moneyRow('Net pay', s.net, bold: true, highlight: true),
              const SizedBox(height: 10),
              Text(
                'Net pay is credited to ${me.bankName} XXXX${me.bankLast4}.',
                style: const TextStyle(fontSize: 12, color: kGrey),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _moneyRow(String label, double value,
      {bool bold = false, bool highlight = false}) {
    final negative = value < 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: TextStyle(
                    fontSize: highlight ? 15 : 13.5,
                    fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
          ),
          Text(
            '${negative ? '-' : ''}${HrStore.money(value.abs())}',
            style: TextStyle(
              fontSize: highlight ? 16 : 13.5,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
              color: highlight
                  ? kGreen
                  : negative
                      ? kRed
                      : const Color(0xFF1A2433),
            ),
          ),
        ],
      ),
    );
  }
}
