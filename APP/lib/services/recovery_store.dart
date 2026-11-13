import 'package:flutter/foundation.dart';

import '../models/recovery.dart';

/// In-memory demo store for the Recovery module.
/// No API and no database: every change lasts until the app is restarted.
class RecoveryStore extends ChangeNotifier {
  RecoveryStore._() {
    _seed();
  }

  static final RecoveryStore instance = RecoveryStore._();

  final List<RecoveryCase> cases = [];
  final List<RecoveryNotice> notices = [];
  final List<SettlementProposal> proposals = [];
  final List<PaymentRecord> payments = [];

  // -------------------------------------------------------------------------
  // Seed data
  // -------------------------------------------------------------------------
  void _seed() {
    DateTime now() => DateTime.now();

    RecoveryCase make({
      required String id,
      required String borrower,
      required String memberNo,
      required String phone,
      required String village,
      required String branch,
      required String loanType,
      required String loanNo,
      required double sanctioned,
      required double outstanding,
      required double overdue,
      required int days,
      required int stage,
      required int nextDueIn,
      required String risk,
      required String officer,
      required String nextAction,
      required String note,
      String status = 'active',
      int? closedDaysAgo,
      int? hearingIn,
    }) {
      final start = now().subtract(Duration(days: days));
      final events = <RecoveryEvent>[];
      final upto = status == 'closed' ? stage : stage - 1;
      for (var no = 1; no <= upto; no++) {
        final offset = stage <= 1 ? 0 : (days * (no - 1) / (stage - 1)).round();
        events.add(RecoveryEvent(
          stage: no,
          at: now().subtract(Duration(days: days - offset)),
          by: stageDef(no).owner,
          note: _eventNote(no),
        ));
      }
      final closedAt =
          closedDaysAgo == null ? null : now().subtract(Duration(days: closedDaysAgo));
      return RecoveryCase(
        id: id,
        borrower: borrower,
        memberNo: memberNo,
        phone: phone,
        village: village,
        branch: branch,
        loanType: loanType,
        loanNo: loanNo,
        sanctioned: sanctioned,
        outstanding: outstanding,
        overdue: overdue,
        overdueSince: start,
        stage: stage,
        risk: risk,
        officer: officer,
        nextAction: nextAction,
        nextDue: now().add(Duration(days: nextDueIn)),
        note: note,
        status: status,
        closedAt: closedAt,
        hearingOn: hearingIn == null ? null : now().add(Duration(days: hearingIn)),
        events: events,
        docs: _docsFor(
          days: days,
          stage: stage,
          closed: status == 'closed',
          closedAt: closedAt,
        ),
      );
    }

    cases.addAll([
      make(
        id: 'RC-2026-0143', borrower: 'Rahul Chavan', memberNo: 'C-1187',
        phone: '98220 44120', village: 'Shirur', branch: 'Shirur',
        loanType: 'Crop loan', loanNo: 'CL-2025-0288', sanctioned: 520000,
        outstanding: 468000, overdue: 88000, days: 34, stage: 1, nextDueIn: 1,
        risk: 'medium', officer: 'P. Gaikwad',
        nextAction: 'Confirm overdue classification',
        note: 'Seasonal crop loan; borrower has requested time till the next harvest.',
      ),
      make(
        id: 'RC-2026-0142', borrower: 'Ramesh Patil', memberNo: 'C-1042',
        phone: '98220 12345', village: 'Shirur', branch: 'Shirur',
        loanType: 'Gold loan', loanNo: 'GL-2024-0451', sanctioned: 450000,
        outstanding: 386000, overdue: 92500, days: 458, stage: 9, nextDueIn: 0,
        risk: 'high', officer: 'S. Kulkarni',
        nextAction: 'Confirm demand notice delivery',
        note: 'Demand notice returned once; re-dispatched to the village address.',
      ),
      make(
        id: 'RC-2026-0141', borrower: 'Sunita Deshmukh', memberNo: 'C-0974',
        phone: '99700 21874', village: 'Wagholi', branch: 'Wagholi',
        loanType: 'Cash credit', loanNo: 'CC-2023-0116', sanctioned: 1500000,
        outstanding: 1240000, overdue: 315000, days: 612, stage: 18, nextDueIn: 11,
        risk: 'high', officer: 'A. Pathak',
        nextAction: 'Hearing before the civil judge', hearingIn: 11,
        note: 'Business premises attached; matter listed before the civil judge.',
      ),
      make(
        id: 'RC-2026-0138', borrower: 'Imran Shaikh', memberNo: 'C-0881',
        phone: '98901 55620', village: 'Khed', branch: 'Khed',
        loanType: 'Term loan', loanNo: 'TL-2022-0773', sanctioned: 1000000,
        outstanding: 875000, overdue: 142300, days: 274, stage: 12, nextDueIn: 2,
        risk: 'high', officer: 'S. Kulkarni',
        nextAction: 'Legal review and escalation note',
        note: 'Borrower disputes the interest calculation; legal opinion requested.',
      ),
      make(
        id: 'RC-2026-0135', borrower: 'Vijay Jadhav', memberNo: 'C-1265',
        phone: '97650 33178', village: 'Junnar', branch: 'Junnar',
        loanType: 'Vehicle loan', loanNo: 'VL-2024-0192', sanctioned: 280000,
        outstanding: 215000, overdue: 38400, days: 96, stage: 6, nextDueIn: 3,
        risk: 'medium', officer: 'P. Gaikwad',
        nextAction: 'Schedule personal visit',
        note: 'Telephone follow-ups unanswered; visit the guarantor as well.',
      ),
      make(
        id: 'RC-2026-0131', borrower: 'Kavita More', memberNo: 'C-1340',
        phone: '98230 77415', village: 'Ambegaon', branch: 'Ambegaon',
        loanType: 'Personal loan', loanNo: 'PL-2025-0064', sanctioned: 200000,
        outstanding: 145000, overdue: 27800, days: 61, stage: 11, nextDueIn: 1,
        risk: 'medium', officer: 'P. Gaikwad',
        nextAction: 'Collect payment commitment',
        note: 'Borrower has committed to pay Rs 15,000 per month from December.',
      ),
      make(
        id: 'RC-2026-0127', borrower: 'Suresh Gaikwad', memberNo: 'C-0743',
        phone: '94220 60118', village: 'Baramati', branch: 'Baramati',
        loanType: 'Crop loan', loanNo: 'CL-2023-0441', sanctioned: 650000,
        outstanding: 520000, overdue: 186000, days: 210, stage: 22, nextDueIn: 5,
        risk: 'high', officer: 'A. Pathak',
        nextAction: 'Realize the awarded amount',
        note: 'Award received; bank account attachment in progress.',
      ),
      make(
        id: 'RC-2026-0124', borrower: 'Anita Pawar', memberNo: 'C-0619',
        phone: '99600 48231', village: 'Indapur', branch: 'Indapur',
        loanType: 'Housing loan', loanNo: 'HL-2021-0087', sanctioned: 2200000,
        outstanding: 1860000, overdue: 234500, days: 330, stage: 24, nextDueIn: 4,
        risk: 'high', officer: 'S. Kulkarni',
        nextAction: 'Settlement approval by committee',
        note: 'One-time settlement proposed at 76% of total dues.',
      ),
      make(
        id: 'RC-2026-0119', borrower: 'Pravin Bhosale', memberNo: 'C-1021',
        phone: '98500 11290', village: 'Daund', branch: 'Daund',
        loanType: 'Gold loan', loanNo: 'GL-2023-0210', sanctioned: 460000,
        outstanding: 402000, overdue: 0, days: 180, stage: 27, nextDueIn: 2,
        risk: 'low', officer: 'P. Gaikwad',
        nextAction: 'Confirm full recovery and close',
        note: 'Entire overdue cleared; awaiting closure approval.',
      ),
      make(
        id: 'RC-2026-0115', borrower: 'Farida Ansari', memberNo: 'C-1298',
        phone: '98220 90041', village: 'Wagholi', branch: 'Wagholi',
        loanType: 'Business loan', loanNo: 'BL-2024-0324', sanctioned: 750000,
        outstanding: 680000, overdue: 74200, days: 43, stage: 5, nextDueIn: 0,
        risk: 'medium', officer: 'A. Pathak',
        nextAction: 'Second telephone follow-up',
        note: 'First call connected; borrower asked for a week to arrange funds.',
      ),
      make(
        id: 'RC-2026-0111', borrower: 'Mahesh Kulkarni', memberNo: 'C-0552',
        phone: '94030 22187', village: 'Khed', branch: 'Khed',
        loanType: 'Term loan', loanNo: 'TL-2021-0391', sanctioned: 1200000,
        outstanding: 910000, overdue: 245000, days: 388, stage: 16, nextDueIn: 6,
        risk: 'high', officer: 'S. Kulkarni',
        nextAction: 'Case registration before authority',
        note: 'Filing accepted; awaiting registration number from the court.',
      ),
      make(
        id: 'RC-2026-0108', borrower: 'Nanda Sawant', memberNo: 'C-1174',
        phone: '97640 55213', village: 'Junnar', branch: 'Junnar',
        loanType: 'Cash credit', loanNo: 'CC-2024-0205', sanctioned: 420000,
        outstanding: 355000, overdue: 48600, days: 72, stage: 3, nextDueIn: 1,
        risk: 'medium', officer: 'M. Shaikh',
        nextAction: 'Assign recovery officer',
        note: 'Newly created case; branch recommends the Junnar field officer.',
      ),
      make(
        id: 'RC-2026-0102', borrower: 'Ganesh Shinde', memberNo: 'C-0407',
        phone: '99220 31866', village: 'Baramati', branch: 'Baramati',
        loanType: 'Gold loan', loanNo: 'GL-2022-0148', sanctioned: 320000,
        outstanding: 0, overdue: 0, days: 154, stage: 28, nextDueIn: 0,
        risk: 'low', officer: 'P. Gaikwad',
        nextAction: 'Case closed', status: 'closed', closedDaysAgo: 12,
        note: 'Full recovery completed and no-dues certificate issued.',
      ),
    ]);

    payments.addAll([
      PaymentRecord(id: 'PY-2026-0941', caseId: 'RC-2026-0142', amount: 25000, date: now().subtract(const Duration(days: 4)), mode: 'UPI', ref: 'UPI/4471882', by: 'S. Kulkarni'),
      PaymentRecord(id: 'PY-2026-0938', caseId: 'RC-2026-0131', amount: 12000, date: now().subtract(const Duration(days: 8)), mode: 'Cash', ref: 'BR/Shirur/118', by: 'P. Gaikwad'),
      PaymentRecord(id: 'PY-2026-0927', caseId: 'RC-2026-0127', amount: 150000, date: now().subtract(const Duration(days: 20)), mode: 'NEFT', ref: 'UTR 4471 9002 118', by: 'A. Pathak'),
      PaymentRecord(id: 'PY-2026-0918', caseId: 'RC-2026-0124', amount: 200000, date: now().subtract(const Duration(days: 41)), mode: 'NEFT', ref: 'UTR 3390 7726 004', by: 'S. Kulkarni'),
      PaymentRecord(id: 'PY-2026-0902', caseId: 'RC-2026-0119', amount: 402000, date: now().subtract(const Duration(days: 64)), mode: 'Gold auction', ref: 'AUC/2026/07', by: 'P. Gaikwad'),
      PaymentRecord(id: 'PY-2026-0888', caseId: 'RC-2026-0102', amount: 290000, date: now().subtract(const Duration(days: 76)), mode: 'Gold auction', ref: 'AUC/2026/04', by: 'P. Gaikwad'),
    ]);

    for (final payment in payments) {
      final c = caseById(payment.caseId);
      if (c != null) c.recovered += payment.amount;
    }

    notices.addAll([
      RecoveryNotice(id: 'DN/2026/088', caseId: 'RC-2026-0142', type: 'demand', issuedAt: now().subtract(const Duration(days: 38)), dueAt: now().subtract(const Duration(days: 24)), mode: 'Registered post', ref: 'RP-4471 8820 IN', status: 'delivered', response: 'No response'),
      RecoveryNotice(id: 'LN/2026/031', caseId: 'RC-2026-0141', type: 'legal', issuedAt: now().subtract(const Duration(days: 95)), dueAt: now().subtract(const Duration(days: 80)), mode: 'Registered post', ref: 'RP-3310 7741 IN', status: 'delivered', response: 'Reply received'),
      RecoveryNotice(id: 'DN/2026/079', caseId: 'RC-2026-0138', type: 'demand', issuedAt: now().subtract(const Duration(days: 62)), dueAt: now().subtract(const Duration(days: 47)), mode: 'Speed post', ref: 'SP-1182 4410 IN', status: 'delivered', response: 'Disputed'),
      RecoveryNotice(id: 'DN/2026/074', caseId: 'RC-2026-0135', type: 'demand', issuedAt: now().subtract(const Duration(days: 21)), dueAt: now().add(const Duration(days: 6)), mode: 'Registered post', ref: 'RP-8820 1194 IN', status: 'dispatched'),
      RecoveryNotice(id: 'LN/2026/026', caseId: 'RC-2026-0111', type: 'legal', issuedAt: now().subtract(const Duration(days: 54)), dueAt: now().subtract(const Duration(days: 39)), mode: 'Registered post', ref: 'RP-2290 6631 IN', status: 'responded', response: 'Objection filed'),
      RecoveryNotice(id: 'SM/2026/012', caseId: 'RC-2026-0141', type: 'summons', issuedAt: now().subtract(const Duration(days: 30)), dueAt: now().add(const Duration(days: 11)), mode: 'Court service', ref: 'Case CJ/2026/441', status: 'delivered', response: 'Appearance entered'),
      RecoveryNotice(id: 'DN/2026/091', caseId: 'RC-2026-0127', type: 'demand', issuedAt: now().subtract(const Duration(days: 9)), dueAt: now().add(const Duration(days: 12)), mode: 'Registered post', status: 'draft'),
      RecoveryNotice(id: 'LN/2026/034', caseId: 'RC-2026-0124', type: 'legal', issuedAt: now().subtract(const Duration(days: 6)), dueAt: now().add(const Duration(days: 9)), mode: 'Email + registered post', ref: 'RP-5510 2208 IN', status: 'dispatched'),
    ]);

    final anita = caseById('RC-2026-0124');
    final suresh = caseById('RC-2026-0127');
    final pravin = caseById('RC-2026-0119');
    final sunita = caseById('RC-2026-0141');
    final imran = caseById('RC-2026-0138');
    proposals.addAll([
      if (anita != null)
        SettlementProposal(id: 'ST/2026/014', caseId: anita.id, dues: anita.outstanding, proposed: 1420000, installments: 6, firstDue: now().add(const Duration(days: 15)), by: 'S. Kulkarni', remarks: 'One-time settlement at 76% of dues; six-month schedule.'),
      if (suresh != null)
        SettlementProposal(id: 'ST/2026/012', caseId: suresh.id, dues: suresh.outstanding, proposed: 430000, installments: 3, firstDue: now().add(const Duration(days: 9)), by: 'A. Pathak', status: 'approved', remarks: 'Approved after part realization from the award.'),
      if (pravin != null)
        SettlementProposal(id: 'ST/2026/011', caseId: pravin.id, dues: pravin.outstanding, proposed: 402000, installments: 1, firstDue: now().subtract(const Duration(days: 60)), by: 'P. Gaikwad', status: 'paid', remarks: 'Full and final settlement through gold auction proceeds.'),
      if (sunita != null)
        SettlementProposal(id: 'ST/2026/009', caseId: sunita.id, dues: sunita.outstanding, proposed: 900000, installments: 12, firstDue: now().add(const Duration(days: 20)), by: 'A. Pathak', status: 'rejected', remarks: 'Rejected: waiver exceeds the delegated authority limit.'),
      if (imran != null)
        SettlementProposal(id: 'ST/2026/015', caseId: imran.id, dues: imran.outstanding, proposed: 700000, installments: 4, firstDue: now().add(const Duration(days: 18)), by: 'S. Kulkarni', remarks: 'Borrower proposes 80% of dues; legal opinion pending.'),
    ]);
  }

  static String _eventNote(int no) {
    switch (no) {
      case 1:
        return 'Overdue flagged in the portfolio; ageing and exposure classified.';
      case 2:
        return 'Case file created with KYC and loan documents.';
      case 3:
        return 'Recovery officer assigned based on branch and exposure.';
      case 4:
        return 'Initial contact made on the registered mobile number.';
      case 5:
        return 'Telephone follow-up completed; borrower response recorded.';
      case 6:
        return 'Personal visit to the borrower address completed.';
      case 7:
        return 'Demand notice drafted with outstanding and deadline.';
      case 8:
        return 'Demand notice dispatched by registered post.';
      case 9:
        return 'Delivery confirmation received and placed on file.';
      case 10:
        return 'Borrower response recorded; no acceptable plan offered.';
      case 11:
        return 'Negotiation held; payment commitment recorded.';
      case 12:
        return 'Legal review completed; case escalated to the legal cell.';
      case 13:
        return 'Legal approval granted by the competent authority.';
      case 14:
        return 'Legal notice issued to the borrower and guarantor.';
      case 15:
        return 'Petition filed before the appropriate authority.';
      case 16:
        return 'Case registered and case number recorded.';
      case 17:
        return 'Summons served; procedural steps completed.';
      case 18:
        return 'Hearing scheduled; advocate briefed with the case file.';
      case 19:
        return 'Hearing completed; directions recorded.';
      case 20:
        return 'Order / award received and reviewed by the legal cell.';
      case 21:
        return 'Execution petition filed for enforcement of the award.';
      case 22:
        return 'Amount realized through the legal process and credited.';
      case 23:
        return 'Part payment received and outstanding updated.';
      case 24:
        return 'Settlement proposal prepared with waiver working.';
      case 25:
        return 'Settlement approved by the recovery committee.';
      case 26:
        return 'Settlement payment received as per the approved schedule.';
      case 27:
        return 'Full recovery confirmed; nil-dues working prepared.';
      case 28:
        return 'Case closed and no-dues certificate issued.';
      default:
        return 'Stage completed.';
    }
  }

  static List<RecoveryDocument> _docsFor({
    required int days,
    required int stage,
    required bool closed,
    DateTime? closedAt,
  }) {
    final n = DateTime.now();
    final docs = <RecoveryDocument>[
      RecoveryDocument(name: 'Loan sanction letter', type: 'Loan document', date: n.subtract(Duration(days: days + 120))),
      RecoveryDocument(name: 'KYC and borrower profile', type: 'KYC', date: n.subtract(Duration(days: days + 120))),
      RecoveryDocument(name: 'Recovery case sheet', type: 'Case file', date: n.subtract(Duration(days: days))),
    ];
    if (stage >= 7) {
      docs.add(RecoveryDocument(name: 'Demand notice', type: 'Demand notice', date: n.subtract(Duration(days: (days * 0.55).round()))));
    }
    if (stage >= 14) {
      docs.add(RecoveryDocument(name: 'Legal notice', type: 'Legal notice', date: n.subtract(Duration(days: (days * 0.4).round()))));
    }
    if (stage >= 16) {
      docs.add(RecoveryDocument(name: 'Court filing acknowledgement', type: 'Legal filing', date: n.subtract(Duration(days: (days * 0.3).round()))));
    }
    if (stage >= 20) {
      docs.add(RecoveryDocument(name: 'Certified order / award', type: 'Order', date: n.subtract(Duration(days: (days * 0.2).round()))));
    }
    if (stage >= 24) {
      docs.add(RecoveryDocument(name: 'Settlement proposal and waiver working', type: 'Settlement', date: n.subtract(Duration(days: (days * 0.12).round()))));
    }
    if (closed && closedAt != null) {
      docs.add(RecoveryDocument(name: 'Case closure and no-dues certificate', type: 'Closure', date: closedAt));
    }
    return docs;
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------
  RecoveryCase? caseById(String id) {
    for (final c in cases) {
      if (c.id == id) return c;
    }
    return null;
  }

  List<RecoveryCase> get activeCases => cases.where((c) => c.isActive).toList();

  List<RecoveryCase> get legalCases => cases
      .where((c) => c.isActive && c.stage >= 13 && c.stage <= 22)
      .toList();

  double totalOutstanding([List<RecoveryCase>? list]) =>
      (list ?? activeCases).fold(0.0, (sum, c) => sum + c.outstanding);

  double totalOverdue([List<RecoveryCase>? list]) =>
      (list ?? activeCases).fold(0.0, (sum, c) => sum + c.overdue);

  double get recoveredThisMonth {
    final now = DateTime.now();
    return payments
        .where((p) => p.date.year == now.year && p.date.month == now.month)
        .fold(0.0, (sum, p) => sum + p.amount);
  }

  List<RecoveryCase> get followUps {
    final list = activeCases.toList()
      ..sort((a, b) => a.nextDue.compareTo(b.nextDue));
    return list.take(6).toList();
  }

  List<RecoveryActivity> activityFeed({int limit = 10}) {
    final items = <RecoveryActivity>[];
    for (final c in cases) {
      for (final event in c.events.reversed.take(2)) {
        items.add(RecoveryActivity(
          at: event.at,
          title: '${c.borrower} - ${stageDef(event.stage).title}',
          body: '${c.id} - ${event.by}',
          kind: 'stage',
          caseId: c.id,
        ));
      }
    }
    for (final p in payments) {
      final c = caseById(p.caseId);
      items.add(RecoveryActivity(
        at: p.date,
        title: 'Payment received from ${c?.borrower ?? p.caseId}',
        body: '${inr(p.amount)} - ${p.mode}',
        kind: 'payment',
        caseId: p.caseId,
      ));
    }
    for (final n in notices.where((n) => n.status != 'draft')) {
      final c = caseById(n.caseId);
      items.add(RecoveryActivity(
        at: n.issuedAt,
        title: '${n.typeLabel} ${n.statusLabel.toLowerCase()}',
        body: '${n.id} - ${c?.borrower ?? n.caseId}',
        kind: 'notice',
        caseId: n.caseId,
      ));
    }
    items.sort((a, b) => b.at.compareTo(a.at));
    return items.take(limit).toList();
  }

  int ageingCount(int from, int to) => activeCases
      .where((c) => c.daysOverdue >= from && c.daysOverdue <= to)
      .length;

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  void completeStage(RecoveryCase c, {String? note, DateTime? nextDue}) {
    final current = c.stage;
    final trimmed = note?.trim() ?? '';
    c.events.add(RecoveryEvent(
      stage: current,
      at: DateTime.now(),
      by: 'Recovery manager',
      note: trimmed.isEmpty ? '${stageDef(current).title} completed.' : trimmed,
    ));
    if (current >= 28) {
      c.status = 'closed';
      c.closedAt = DateTime.now();
      c.nextAction = 'Case closed';
    } else {
      c.stage = current + 1;
      c.nextAction = stageDef(c.stage).title;
    }
    c.nextDue = nextDue ?? DateTime.now().add(const Duration(days: 3));
    c.docs
      ..clear()
      ..addAll(_docsFor(
        days: c.daysOverdue,
        stage: c.stage,
        closed: c.isClosed,
        closedAt: c.closedAt,
      ));
    notifyListeners();
  }

  PaymentRecord recordPayment(
    RecoveryCase c, {
    required double amount,
    String mode = 'NEFT',
    String ref = '',
    DateTime? date,
  }) {
    final value = amount < 0 ? 0.0 : amount;
    c.recovered += value;
    c.outstanding = (c.outstanding - value) < 0 ? 0.0 : c.outstanding - value;
    c.overdue = (c.overdue - value) < 0 ? 0.0 : c.overdue - value;
    final payment = PaymentRecord(
      id: 'PY-2026-${(900 + payments.length + 1).toString().padLeft(4, '0')}',
      caseId: c.id,
      amount: value,
      date: date ?? DateTime.now(),
      mode: mode,
      ref: ref.isEmpty ? '-' : ref,
      by: 'Recovery manager',
    );
    payments.insert(0, payment);
    c.events.add(RecoveryEvent(
      stage: c.stage,
      at: payment.date,
      by: 'Recovery manager',
      note: 'Payment of ${inr(value)} received ($mode).',
    ));
    if (c.outstanding <= 0 && c.stage < 27) {
      c.stage = 27;
      c.nextAction = 'Confirm full recovery and close';
    }
    notifyListeners();
    return payment;
  }

  RecoveryNotice draftNotice({
    required String caseId,
    required String type,
    required String mode,
    required DateTime dueAt,
    String ref = '',
    String body = '',
  }) {
    final prefix = type == 'legal' ? 'LN' : (type == 'summons' ? 'SM' : 'DN');
    final next = notices.where((n) => n.type == type).length + 1;
    final notice = RecoveryNotice(
      id: '$prefix/${DateTime.now().year}/${next.toString().padLeft(3, '0')}',
      caseId: caseId,
      type: type,
      issuedAt: DateTime.now(),
      dueAt: dueAt,
      mode: mode,
      ref: ref,
      body: body,
    );
    notices.insert(0, notice);
    notifyListeners();
    return notice;
  }

  void advanceNotice(RecoveryNotice notice) {
    if (notice.status == 'draft') {
      notice.status = 'dispatched';
      if (notice.ref.isEmpty) {
        notice.ref = 'RP-${1000 + notices.length} ${2000 + notices.length} IN';
      }
    } else if (notice.status == 'dispatched') {
      notice.status = 'delivered';
    }
    notifyListeners();
  }

  SettlementProposal addProposal({
    required String caseId,
    required double proposed,
    required int installments,
    required DateTime firstDue,
    String remarks = '',
  }) {
    final c = caseById(caseId);
    final next = proposals.length + 1;
    final proposal = SettlementProposal(
      id: 'ST/${DateTime.now().year}/${(14 + next).toString().padLeft(3, '0')}',
      caseId: caseId,
      dues: c?.outstanding ?? proposed,
      proposed: proposed,
      installments: installments,
      firstDue: firstDue,
      by: 'Recovery manager',
      remarks: remarks,
    );
    proposals.insert(0, proposal);
    notifyListeners();
    return proposal;
  }

  void decideProposal(SettlementProposal proposal, {required bool approve}) {
    proposal.status = approve ? 'approved' : 'rejected';
    notifyListeners();
  }
}
