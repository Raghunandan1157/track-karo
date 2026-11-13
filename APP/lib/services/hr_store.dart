import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import '../models/hr_models.dart';
import '../models/models.dart';

/// HRMS demo store for the app.
///
/// There is no server yet: the data below is generated once per app session.
/// Every screen reads from this store, so swapping it for real API calls later
/// only touches this file. The sample data mirrors the web HR module.
class HrStore extends ChangeNotifier {
  HrStore._();
  static final HrStore instance = HrStore._();

  final List<HrEmployee> _employees = [];
  final List<HrLeave> _leaves = [];
  final Map<int, List<HrDocument>> _documents = {};

  int? _meId;
  bool _seeded = false;

  static final NumberFormat _inr = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  bool get isSeeded => _seeded;
  List<HrEmployee> get employees => List.unmodifiable(_employees);
  List<HrLeave> get leaves => List.unmodifiable(_leaves);

  HrEmployee? employee(int? id) {
    for (final e in _employees) {
      if (e.id == id) return e;
    }
    return null;
  }

  HrEmployee? get me => employee(_meId);

  List<HrEmployee> get team =>
      _employees.where((e) => e.status != 'inactive').toList()
        ..sort((a, b) => a.name.compareTo(b.name));

  List<HrLeave> get pendingLeaves {
    final list = _leaves.where((l) => l.status == 'pending').toList()
      ..sort((a, b) => b.appliedAt.compareTo(a.appliedAt));
    return list;
  }

  List<HrLeave> myLeaves(int id) {
    final list = _leaves.where((l) => l.employeeId == id).toList()
      ..sort((a, b) => b.from.compareTo(a.from));
    return list;
  }

  int get myPendingCount =>
      _leaves.where((l) => l.employeeId == _meId && l.status == 'pending').length;

  static String money(num value) => _inr.format(value);

  static String shortMoney(num value) {
    final n = value.toDouble();
    if (n >= 10000000) return '${(n / 10000000).toStringAsFixed(2)} Cr';
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(1)} L';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(0)} K';
    return n.toStringAsFixed(0);
  }

  // ---------------------------------------------------------------------------
  // Seed
  // ---------------------------------------------------------------------------
  void ensureSeeded(User? user) {
    if (_seeded) return;
    _seeded = true;

    final branch = user?.branchName.isNotEmpty == true
        ? user!.branchName
        : 'Head Office - Bengaluru';

    void add(
      String name,
      String designation,
      String department,
      double ctc,
      String doj, {
      required String phone,
      String status = 'active',
      String manager = 'Raghunandan S',
      String workMode = 'office',
      String shift = 'General (09:30 - 18:30)',
      String blood = 'O+',
      String branchName = '',
      String type = 'full_time',
    }) {
      final id = _employees.length + 1;
      final parts = name.toLowerCase().split(RegExp(r'\s+'));
      final email =
          '${parts.first}.${parts.length > 1 ? parts.last : 'user'}@trackkaro.in';
      _employees.add(HrEmployee(
        id: id,
        code: 'TK-${id.toString().padLeft(4, '0')}',
        name: name,
        designation: designation,
        department: department,
        branch: branchName.isEmpty ? branch : branchName,
        email: email,
        phone: phone,
        doj: doj,
        status: status,
        employmentType: type,
        ctc: ctc,
        shift: shift,
        workMode: workMode,
        managerName: manager,
        dob: '${1985 + (id % 12)}-${((id % 12) + 1).toString().padLeft(2, '0')}-${((id % 25) + 1).toString().padLeft(2, '0')}',
        bloodGroup: blood,
        emergencyName: 'Ravi ${parts.last}',
        emergencyPhone: '98765000${(id + 10).toString().padLeft(2, '0')}',
        pan: 'ABCPX${(1234 + id).toString()}F',
        uan: '10123456${(7800 + id).toString()}',
        bankName: id % 2 == 0 ? 'HDFC Bank' : 'State Bank of India',
        bankLast4: '${(4000 + id * 7)}',
        ifsc: 'HDFC000${(1200 + id)}',
        address: '${id + 10}, MG Road, ${branchName.isEmpty ? branch : branchName}',
      ));
    }

    const salesHead = 'Lakshmi Prasad';
    add('Raghunandan S', 'Managing Director', 'Technology', 4800000, '2019-04-01',
        phone: '9845001001', manager: '', blood: 'B+');
    add('Ganesh R', 'HR Manager', 'Human Resources', 1200000, '2020-06-15',
        phone: '9845001002', blood: 'O+');
    add('Priya Menon', 'HR Executive', 'Human Resources', 620000, '2023-02-01',
        phone: '9845001003', manager: 'Ganesh R', blood: 'A+');
    add('Sandeep Kulkarni', 'Engineering Manager', 'Technology', 2400000,
        '2021-09-06',
        phone: '9845001004', blood: 'AB+', workMode: 'hybrid');
    add('Meera Nair', 'Software Engineer', 'Technology', 1100000, '2023-07-17',
        phone: '9845001005',
        manager: 'Sandeep Kulkarni',
        blood: 'O-',
        workMode: 'hybrid');
    add('Divya Hegde', 'Credit Head', 'Credit & Risk', 1800000, '2020-11-02',
        phone: '9845001006', blood: 'A-');
    add('Ananya Bhat', 'Operations Head', 'Branch Operations', 1600000,
        '2021-05-24', phone: '9845001007', blood: 'B-');
    add('Suresh Patil', 'Collections Head', 'Collections', 1400000,
        '2020-02-17', phone: '9845001008', blood: 'O+');
    add(salesHead, 'Sales Head', 'Sales', 2000000, '2019-10-07',
        phone: '9845001009', blood: 'A+');
    add('Chandra Shekhar', 'Branch Manager', 'Branch Operations', 1100000,
        '2020-09-01',
        phone: '9845001010',
        manager: 'Ananya Bhat',
        branchName: 'Mysuru Branch',
        blood: 'B+');
    add('Nandini Rao', 'Senior Field Officer', 'Field Operations', 420000,
        '2022-03-14',
        phone: '9845001011',
        manager: 'Chandra Shekhar',
        branchName: 'Mysuru Branch',
        workMode: 'field',
        shift: 'Field (09:00 - 18:00)',
        blood: 'O-');
    add('Vinay M', 'Field Officer', 'Field Operations', 330000, '2023-06-19',
        phone: '9845001012',
        manager: 'Chandra Shekhar',
        branchName: 'Mysuru Branch',
        workMode: 'field',
        shift: 'Field (09:00 - 18:00)',
        blood: 'A+');
    add('Sowmya K', 'Collections Officer', 'Collections', 384000, '2024-04-08',
        phone: '9845001013',
        manager: 'Suresh Patil',
        branchName: 'Mysuru Branch',
        blood: 'AB-');
    add('Ashwini D', 'Field Officer', 'Field Operations', 324000, '2023-09-04',
        phone: '9845001014',
        manager: 'Chandra Shekhar',
        branchName: 'Hubballi Branch',
        workMode: 'field',
        shift: 'Field (09:00 - 18:00)',
        blood: 'B+');
    add('Irfan Ali', 'Field Officer', 'Field Operations', 312000, '2024-11-25',
        phone: '9845001015',
        manager: 'Chandra Shekhar',
        branchName: 'Hubballi Branch',
        workMode: 'field',
        shift: 'Field (09:00 - 18:00)',
        blood: 'O+');
    add('Shilpa H', 'Field Officer', 'Field Operations', 300000, '2025-05-26',
        phone: '9845001016',
        manager: 'Chandra Shekhar',
        branchName: 'Belagavi Branch',
        workMode: 'field',
        shift: 'Field (09:00 - 18:00)',
        blood: 'A-');
    add('Rohan D', 'Software Engineer', 'Technology', 900000, '2026-10-01',
        phone: '9845001017',
        manager: 'Sandeep Kulkarni',
        status: 'probation',
        workMode: 'hybrid');

    // The signed-in user always has a profile, even if the demo list above
    // does not know their name.
    final match = _employees.where((e) => e.name == user?.name).toList();
    if (match.isNotEmpty) {
      _meId = match.first.id;
    } else if (user != null) {
      final id = _employees.length + 1;
      _employees.add(HrEmployee(
        id: id,
        code: 'TK-${id.toString().padLeft(4, '0')}',
        name: user.name.isEmpty ? user.userid : user.name,
        designation: user.isOfficer
            ? 'Field Officer'
            : user.isAdmin
                ? 'Administrator'
                : 'Branch Manager',
        department: user.isOfficer ? 'Field Operations' : 'Branch Operations',
        branch: branch,
        email: '${user.userid.toLowerCase()}@trackkaro.in',
        phone: user.phone.isEmpty ? '9845001099' : user.phone,
        doj: '2022-04-11',
        status: 'active',
        employmentType: 'full_time',
        ctc: user.isOfficer ? 360000 : 900000,
        shift: user.isOfficer ? 'Field (09:00 - 18:00)' : 'General (09:30 - 18:30)',
        workMode: user.isOfficer ? 'field' : 'office',
        managerName: 'Ganesh R',
        dob: '1993-08-19',
        bloodGroup: 'O+',
        emergencyName: 'Family contact',
        emergencyPhone: '9876500123',
        pan: 'ABCPX9876F',
        uan: '101234569999',
        bankName: 'HDFC Bank',
        bankLast4: '4412',
        ifsc: 'HDFC0001234',
        address: 'Bengaluru, Karnataka',
      ));
      _meId = id;
    } else {
      _meId = 2;
    }

    // Documents for everyone.
    for (final e in _employees) {
      final docs = <HrDocument>[
        HrDocument(type: 'aadhaar', number: 'XXXX XXXX 4821'),
        HrDocument(type: 'pan', number: e.pan),
        HrDocument(type: 'offer', number: 'OL/${e.doj.substring(0, 4)}/${e.id}'),
        HrDocument(
          type: 'contract',
          number: 'CT/${e.doj.substring(0, 4)}/${e.id}',
          expiresOn: '2027-03-31',
        ),
      ];
      if (e.department == 'Field Operations') {
        docs.add(HrDocument(
          type: 'licence',
          number: 'KA01 2026${e.id.toString().padLeft(6, '0')}',
          expiresOn: '2026-12-05',
          status: 'expiring',
        ));
      }
      if (e.id % 6 != 0) {
        docs.add(HrDocument(
          type: 'insurance',
          number: 'HI/2026/${(700 + e.id)}',
          expiresOn: e.id % 4 == 0 ? '2026-10-31' : '2027-03-31',
          status: e.id % 4 == 0 ? 'expired' : 'valid',
        ));
      }
      _documents[e.id] = docs;
    }

    // Leave requests (team inbox + my own history).
    final now = DateTime.now();
    String d(int offset) =>
        DateFormat('yyyy-MM-dd').format(now.add(Duration(days: offset)));

    _leaves.addAll([
      HrLeave(
        id: 1,
        employeeId: 11,
        type: 'casual',
        from: d(4),
        to: d(5),
        days: 2,
        reason: 'Family function in Mysuru',
        status: 'pending',
        appliedAt: now.subtract(const Duration(hours: 6)).toIso8601String(),
        contact: '9845001011',
      ),
      HrLeave(
        id: 2,
        employeeId: 12,
        type: 'sick',
        from: d(1),
        to: d(1),
        days: 1,
        reason: 'Fever, doctor advised rest',
        status: 'pending',
        appliedAt: now.subtract(const Duration(hours: 20)).toIso8601String(),
        contact: '9845001012',
      ),
      HrLeave(
        id: 3,
        employeeId: 14,
        type: 'earned',
        from: d(12),
        to: d(15),
        days: 4,
        reason: 'Travelling home for Deepavali',
        status: 'pending',
        appliedAt: now.subtract(const Duration(days: 1)).toIso8601String(),
        contact: '9845001014',
      ),
      HrLeave(
        id: 4,
        employeeId: 15,
        type: 'casual',
        from: d(-18),
        to: d(-18),
        days: 1,
        reason: 'Personal work',
        status: 'approved',
        appliedAt: now.subtract(const Duration(days: 22)).toIso8601String(),
        contact: '9845001015',
      ),
      HrLeave(
        id: 5,
        employeeId: 13,
        type: 'comp_off',
        from: d(-6),
        to: d(-6),
        days: 1,
        reason: 'Comp off for month-end closing',
        status: 'approved',
        appliedAt: now.subtract(const Duration(days: 9)).toIso8601String(),
        contact: '9845001013',
      ),
      HrLeave(
        id: 6,
        employeeId: 10,
        type: 'casual',
        from: d(-25),
        to: d(-24),
        days: 2,
        reason: 'Child school event',
        status: 'rejected',
        appliedAt: now.subtract(const Duration(days: 30)).toIso8601String(),
        contact: '9845001010',
      ),
    ]);

    final mine = _meId ?? 2;
    if (!_leaves.any((l) => l.employeeId == mine)) {
      _leaves.add(HrLeave(
        id: _leaves.length + 1,
        employeeId: mine,
        type: 'casual',
        from: d(-35),
        to: d(-35),
        days: 1,
        reason: 'Personal work',
        status: 'approved',
        appliedAt: now.subtract(const Duration(days: 38)).toIso8601String(),
        contact: me?.phone ?? '',
      ));
    }
    _leaves.sort((a, b) => a.id.compareTo(b.id));
  }

  void reset() {
    _employees.clear();
    _leaves.clear();
    _documents.clear();
    _meId = null;
    _seeded = false;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Attendance (deterministic, same person/date always gets the same status)
  // ---------------------------------------------------------------------------
  static int _hash(String s) {
    var h = 2166136261;
    for (final unit in s.codeUnits) {
      h ^= unit;
      h = (h * 16777619) & 0x7fffffff;
    }
    return h;
  }

  static String ymd(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  HrAttendance attendanceOn(HrEmployee e, DateTime date) {
    final today = DateTime.now();
    final day = DateTime(date.year, date.month, date.day);
    if (day.isAfter(DateTime(today.year, today.month, today.day))) {
      return const HrAttendance(date: '', status: 'scheduled');
    }
    if (day.weekday == DateTime.sunday) {
      return HrAttendance(date: ymd(day), status: 'week_off');
    }
    final approved = _leaves.any((l) =>
        l.employeeId == e.id &&
        l.status == 'approved' &&
        l.from.compareTo(ymd(day)) <= 0 &&
        l.to.compareTo(ymd(day)) >= 0);
    if (approved) {
      return HrAttendance(date: ymd(day), status: 'leave');
    }
    final r = _hash('${e.id}:${ymd(day)}') % 100;
    String status = 'present';
    if (r < 3) {
      status = 'absent';
    } else if (r < 7) {
      status = 'half_day';
    } else if (r < 14) {
      status = e.workMode == 'field' ? 'field' : 'wfh';
    } else if (r < 33) {
      status = 'late';
    }
    if (status == 'absent') {
      return HrAttendance(date: ymd(day), status: status);
    }
    final graceMin = status == 'late' ? 12 + (r % 30) : 4;
    final startMinutes = 9 * 60 + 30 + graceMin;
    final worked = status == 'half_day' ? 240 : 540 + (r % 40);
    String hm(int minutes) =>
        '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';
    return HrAttendance(
      date: ymd(day),
      status: status,
      inTime: hm(startMinutes),
      outTime: hm(startMinutes + worked),
      workedMin: worked,
      otMin: r % 11 == 0 ? 60 : 0,
    );
  }

  List<HrAttendance> attendanceForMonth(int empId, DateTime month) {
    final e = employee(empId);
    if (e == null) return const [];
    final today = DateTime.now();
    final first = DateTime(month.year, month.month, 1);
    final last = DateTime(month.year, month.month + 1, 0);
    final end = last.isAfter(today) ? DateTime(today.year, today.month, today.day) : last;
    final out = <HrAttendance>[];
    for (var d = first;
        !d.isAfter(end);
        d = d.add(const Duration(days: 1))) {
      final a = attendanceOn(e, DateTime(d.year, d.month, d.day));
      if (a.status == 'week_off' || a.status == 'scheduled') continue;
      out.add(a);
    }
    return out.reversed.toList();
  }

  HrMonthSummary summaryFor(int empId, DateTime month) {
    final list = attendanceForMonth(empId, month);
    var working = 0, present = 0, late = 0, half = 0, leave = 0, absent = 0, ot = 0;
    for (final a in list) {
      if (a.status == 'week_off') continue;
      working++;
      switch (a.status) {
        case 'present':
        case 'wfh':
        case 'field':
          present++;
          break;
        case 'late':
          present++;
          late++;
          break;
        case 'half_day':
          half++;
          break;
        case 'leave':
          leave++;
          break;
        case 'absent':
          absent++;
          break;
      }
      ot += a.otMin;
    }
    return HrMonthSummary(
      working: working,
      present: present,
      late: late,
      halfDay: half,
      leave: leave,
      absent: absent,
      otMin: ot,
    );
  }

  // ---------------------------------------------------------------------------
  // Leave
  // ---------------------------------------------------------------------------
  List<HrLeaveBalance> balances(int empId) {
    final year = DateTime.now().year.toString();
    final approved = _leaves.where((l) =>
        l.employeeId == empId &&
        l.status == 'approved' &&
        l.from.startsWith(year));
    int used(String type) => approved
        .where((l) => l.type == type)
        .fold(0, (sum, l) => sum + l.days);
    return [
      HrLeaveBalance(type: 'casual', label: 'Casual', total: 12, used: used('casual')),
      HrLeaveBalance(type: 'sick', label: 'Sick', total: 10, used: used('sick')),
      HrLeaveBalance(type: 'earned', label: 'Earned', total: 15, used: used('earned')),
    ];
  }

  HrLeave applyLeave({
    required int employeeId,
    required String type,
    required DateTime from,
    required DateTime to,
    required String reason,
  }) {
    final days = to.difference(from).inDays + 1;
    final leave = HrLeave(
      id: (_leaves.isEmpty ? 0 : _leaves.map((l) => l.id).reduce((a, b) => a > b ? a : b)) + 1,
      employeeId: employeeId,
      type: type,
      from: ymd(from),
      to: ymd(to),
      days: days,
      reason: reason.trim(),
      status: 'pending',
      appliedAt: DateTime.now().toIso8601String(),
      contact: employee(employeeId)?.phone ?? '',
    );
    _leaves.add(leave);
    notifyListeners();
    return leave;
  }

  void decideLeave(int id, bool approve) {
    final i = _leaves.indexWhere((l) => l.id == id);
    if (i < 0) return;
    _leaves[i] = _leaves[i].copyWith(status: approve ? 'approved' : 'rejected');
    notifyListeners();
  }

  void cancelLeave(int id) {
    final i = _leaves.indexWhere((l) => l.id == id);
    if (i < 0) return;
    _leaves[i] = _leaves[i].copyWith(status: 'cancelled');
    notifyListeners();
  }

  List<HrDocument> documentsFor(int empId) => _documents[empId] ?? const [];

  // ---------------------------------------------------------------------------
  // Payroll
  // ---------------------------------------------------------------------------
  _HrSalary _salary(HrEmployee e) {
    final monthly = e.ctc / 12;
    final basic = (monthly * .4).roundToDouble();
    final hra = (monthly * .2).roundToDouble();
    final conveyance = (monthly * .05).roundToDouble();
    final special = (monthly - basic - hra - conveyance).clamp(0, monthly).toDouble();
    final pf = (basic * .12).roundToDouble();
    final esi = monthly <= 21000 ? (monthly * .0075).roundToDouble() : 0.0;
    final annual = e.ctc;
    var tax = 0.0;
    final taxable = (annual - 75000).clamp(0, double.infinity).toDouble();
    if (taxable > 300000) tax += (taxable - 300000).clamp(0, 400000) * .05;
    if (taxable > 700000) tax += (taxable - 700000).clamp(0, 300000) * .10;
    if (taxable > 1000000) tax += (taxable - 1000000).clamp(0, 200000) * .15;
    if (taxable > 1200000) tax += (taxable - 1200000).clamp(0, 300000) * .20;
    if (taxable > 1500000) tax += (taxable - 1500000).clamp(0, 1000000) * .30;
    final tds = (tax / 12).roundToDouble();
    return _HrSalary(
      basic: basic,
      hra: hra,
      conveyance: conveyance,
      special: special,
      pf: pf,
      esi: esi,
      pt: 200,
      tds: tds,
      gross: basic + hra + conveyance + special,
    );
  }

  List<HrPayslip> payslips(int empId, {int count = 6}) {
    final e = employee(empId);
    if (e == null) return const [];
    final s = _salary(e);
    final now = DateTime.now();
    final out = <HrPayslip>[];
    for (var i = 0; i < count; i++) {
      final month = DateTime(now.year, now.month - i, 1);
      final summary = i == 0 ? summaryFor(empId, month) : null;
      final days = DateTime(month.year, month.month + 1, 0).day;
      final lopDays = summary == null ? 0.0 : summary.absent + summary.halfDay * .5;
      final lop = (s.gross / days * lopDays).roundToDouble();
      final deductions = s.pf + s.esi + s.pt + s.tds;
      final gross = (s.gross - lop).clamp(0, s.gross).toDouble();
      out.add(HrPayslip(
        month: DateFormat('yyyy-MM').format(month),
        monthLabel: DateFormat('MMMM yyyy').format(month),
        status: i == 0 ? 'draft' : 'paid',
        daysPaid: (days - lopDays).round(),
        basic: s.basic,
        hra: s.hra,
        conveyance: s.conveyance,
        special: s.special,
        pf: s.pf,
        esi: s.esi,
        professionalTax: s.pt,
        tds: s.tds,
        lopAmount: lop,
        gross: gross,
        deductions: deductions,
        net: gross - deductions,
      ));
    }
    return out;
  }
}

class _HrSalary {
  const _HrSalary({
    required this.basic,
    required this.hra,
    required this.conveyance,
    required this.special,
    required this.pf,
    required this.esi,
    required this.pt,
    required this.tds,
    required this.gross,
  });

  final double basic;
  final double hra;
  final double conveyance;
  final double special;
  final double pf;
  final double esi;
  final double pt;
  final double tds;
  final double gross;
}
