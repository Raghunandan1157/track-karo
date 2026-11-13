import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

// ---------------------------------------------------------------------------
// Stage definitions for the 28-stage recovery workflow.
// ---------------------------------------------------------------------------

enum RecoveryGroup { preLegal, legal, finalRecovery }

extension RecoveryGroupInfo on RecoveryGroup {
  String get label => switch (this) {
        RecoveryGroup.preLegal => 'Pre-Legal Recovery',
        RecoveryGroup.legal => 'Legal Recovery',
        RecoveryGroup.finalRecovery => 'Final Recovery',
      };

  String get shortLabel => switch (this) {
        RecoveryGroup.preLegal => 'Pre-legal',
        RecoveryGroup.legal => 'Legal',
        RecoveryGroup.finalRecovery => 'Final',
      };

  int get from => switch (this) {
        RecoveryGroup.preLegal => 1,
        RecoveryGroup.legal => 13,
        RecoveryGroup.finalRecovery => 23,
      };

  int get to => switch (this) {
        RecoveryGroup.preLegal => 12,
        RecoveryGroup.legal => 22,
        RecoveryGroup.finalRecovery => 28,
      };

  Color get color => switch (this) {
        RecoveryGroup.preLegal => const Color(0xFFB26A00),
        RecoveryGroup.legal => const Color(0xFF6D3FC0),
        RecoveryGroup.finalRecovery => const Color(0xFF1E8E4E),
      };
}

class RecoveryStage {
  const RecoveryStage({
    required this.no,
    required this.title,
    required this.group,
    required this.owner,
    required this.sla,
    required this.evidence,
    required this.description,
  });

  final int no;
  final String title;
  final RecoveryGroup group;
  final String owner;
  final int sla;
  final String evidence;
  final String description;
}

const List<RecoveryStage> kRecoveryStages = [
  RecoveryStage(no: 1, title: 'Overdue identification', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 1, evidence: 'Overdue report, loan ledger', description: 'Identify accounts that have crossed the due date and classify them by ageing and exposure.'),
  RecoveryStage(no: 2, title: 'Case creation', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 1, evidence: 'Case file, KYC and loan documents', description: 'Open a recovery case with borrower, loan and overdue details.'),
  RecoveryStage(no: 3, title: 'Recovery officer assignment', group: RecoveryGroup.preLegal, owner: 'Recovery manager', sla: 1, evidence: 'Assignment order', description: 'Assign the case to a recovery officer based on branch, exposure and workload.'),
  RecoveryStage(no: 4, title: 'Initial customer contact', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 2, evidence: 'Contact log (call/SMS/letter)', description: 'Make first contact with the borrower and explain the consequences of default.'),
  RecoveryStage(no: 5, title: 'Telephone follow-up', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 3, evidence: 'Call log with date and outcome', description: 'Follow up by telephone and record the response and next contact date.'),
  RecoveryStage(no: 6, title: 'Personal visit', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 5, evidence: 'Visit report, geo-tagged photo', description: 'Visit the borrower or guarantor at the address on record.'),
  RecoveryStage(no: 7, title: 'Demand notice preparation', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 3, evidence: 'Draft demand notice', description: 'Prepare a demand notice with outstanding, overdue amount, deadline and payment instructions.'),
  RecoveryStage(no: 8, title: 'Notice dispatch', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 2, evidence: 'Postal receipt / dispatch register', description: 'Dispatch the demand notice and record the tracking reference.'),
  RecoveryStage(no: 9, title: 'Notice delivery confirmation', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 5, evidence: 'Acknowledgement / delivery tracking', description: 'Confirm delivery and retain the acknowledgement on file.'),
  RecoveryStage(no: 10, title: 'Borrower response', group: RecoveryGroup.preLegal, owner: 'Recovery officer', sla: 7, evidence: 'Written or recorded response', description: 'Record the reply, objection or request and decide whether negotiation is possible.'),
  RecoveryStage(no: 11, title: 'Payment commitment or negotiation', group: RecoveryGroup.preLegal, owner: 'Recovery manager', sla: 5, evidence: 'Commitment letter / negotiation note', description: 'Agree a payment plan or settlement discussion with dates and approvals.'),
  RecoveryStage(no: 12, title: 'Legal review and escalation', group: RecoveryGroup.preLegal, owner: 'Recovery manager', sla: 3, evidence: 'Escalation note, legal checklist', description: 'Review for legal action and escalate to the legal cell with supporting documents.'),
  RecoveryStage(no: 13, title: 'Legal approval', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 5, evidence: 'Legal opinion / approval note', description: 'Obtain approval to initiate legal or statutory proceedings.'),
  RecoveryStage(no: 14, title: 'Legal notice or statutory process', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 7, evidence: 'Legal notice, statutory form', description: 'Issue the legal notice or start the applicable statutory process.'),
  RecoveryStage(no: 15, title: 'Filing before the appropriate authority', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 15, evidence: 'Filing receipt, plaint / application', description: 'File before the appropriate court, tribunal or authority.'),
  RecoveryStage(no: 16, title: 'Case registration', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 7, evidence: 'Case number / registration order', description: 'Record the case number, forum, bench and next date.'),
  RecoveryStage(no: 17, title: 'Notice or summons proceedings', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 15, evidence: 'Summons, service affidavit', description: 'Serve summons and complete procedural steps before the hearing.'),
  RecoveryStage(no: 18, title: 'Hearing scheduled', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 10, evidence: 'Cause list / hearing notice', description: 'Track the hearing date, brief the advocate and prepare the file.'),
  RecoveryStage(no: 19, title: 'Hearing completed', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 5, evidence: 'Hearing minutes / advocate note', description: 'Record proceedings, adjournments and directions after the hearing.'),
  RecoveryStage(no: 20, title: 'Order or award received', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 10, evidence: 'Certified order / award copy', description: 'Receive and review the order or award and communicate it to the recovery team.'),
  RecoveryStage(no: 21, title: 'Execution or enforcement proceedings', group: RecoveryGroup.legal, owner: 'Legal officer', sla: 30, evidence: 'Execution petition, attachment order', description: 'Start execution or enforcement where the borrower does not comply.'),
  RecoveryStage(no: 22, title: 'Recovery realization', group: RecoveryGroup.legal, owner: 'Recovery manager', sla: 15, evidence: 'Receipt, bank credit advice', description: 'Realize the amount through the legal process and update the ledger.'),
  RecoveryStage(no: 23, title: 'Partial recovery', group: RecoveryGroup.finalRecovery, owner: 'Recovery officer', sla: 1, evidence: 'Payment receipt', description: 'Record a part payment and update outstanding and overdue balances.'),
  RecoveryStage(no: 24, title: 'Settlement proposal', group: RecoveryGroup.finalRecovery, owner: 'Recovery officer', sla: 5, evidence: 'Settlement proposal, waiver working', description: 'Prepare a one-time settlement or instalment proposal with justification.'),
  RecoveryStage(no: 25, title: 'Settlement approval', group: RecoveryGroup.finalRecovery, owner: 'Recovery manager', sla: 3, evidence: 'Approval note / committee resolution', description: 'Obtain approval for the settlement terms.'),
  RecoveryStage(no: 26, title: 'Settlement payment', group: RecoveryGroup.finalRecovery, owner: 'Recovery officer', sla: 5, evidence: 'Payment receipt, cleared instrument', description: 'Collect the settlement amount and confirm the credit.'),
  RecoveryStage(no: 27, title: 'Full recovery', group: RecoveryGroup.finalRecovery, owner: 'Recovery officer', sla: 1, evidence: 'Final receipt, nil-dues working', description: 'Confirm that principal, interest and charges are fully recovered.'),
  RecoveryStage(no: 28, title: 'Case closure', group: RecoveryGroup.finalRecovery, owner: 'Recovery manager', sla: 2, evidence: 'Closure note, no-dues certificate', description: 'Close the case, issue the no-dues position and archive the documents.'),
];

RecoveryStage stageDef(int no) =>
    kRecoveryStages[(no < 1 ? 1 : (no > 28 ? 28 : no)) - 1];

RecoveryGroup groupOfStage(int no) => stageDef(no).group;

enum StageState { done, current, upcoming }

StageState stageStateOf(RecoveryCase c, int no) {
  if (c.status == 'closed' || no < c.stage) return StageState.done;
  if (no == c.stage) return StageState.current;
  return StageState.upcoming;
}

// ---------------------------------------------------------------------------
// Domain models
// ---------------------------------------------------------------------------

class RecoveryEvent {
  RecoveryEvent({
    required this.stage,
    required this.at,
    required this.by,
    required this.note,
  });

  final int stage;
  final DateTime at;
  final String by;
  final String note;
}

class RecoveryDocument {
  const RecoveryDocument({required this.name, required this.type, required this.date});
  final String name;
  final String type;
  final DateTime date;
}

class RecoveryCase {
  RecoveryCase({
    required this.id,
    required this.borrower,
    required this.memberNo,
    required this.phone,
    required this.village,
    required this.branch,
    required this.loanType,
    required this.loanNo,
    required this.sanctioned,
    required this.outstanding,
    required this.overdue,
    required this.overdueSince,
    required this.stage,
    required this.risk,
    required this.officer,
    required this.nextAction,
    required this.nextDue,
    required this.note,
    this.status = 'active',
    this.recovered = 0.0,
    this.closedAt,
    this.hearingOn,
    List<RecoveryEvent>? events,
    List<RecoveryDocument>? docs,
  })  : events = events ?? <RecoveryEvent>[],
        docs = docs ?? <RecoveryDocument>[];

  final String id;
  String borrower;
  String memberNo;
  String phone;
  String village;
  String branch;
  String loanType;
  String loanNo;
  double sanctioned;
  double outstanding;
  double overdue;
  DateTime overdueSince;
  int stage;
  String risk;
  String officer;
  String nextAction;
  DateTime nextDue;
  String note;
  String status;
  double recovered;
  DateTime? closedAt;
  DateTime? hearingOn;
  final List<RecoveryEvent> events;
  final List<RecoveryDocument> docs;

  bool get isActive => status == 'active';
  bool get isClosed => status == 'closed';

  int get daysOverdue {
    if (overdue <= 0) return 0;
    return daysBetween(overdueSince, closedAt ?? DateTime.now());
  }

  int get completedStages => isClosed ? 28 : stage - 1;
  double get progress => completedStages / 28;

  RecoveryGroup get group => groupOfStage(stage);
  RecoveryStage get currentStage => stageDef(stage);

  RecoveryEvent? lastEventFor(int no) {
    for (final event in events.reversed) {
      if (event.stage == no) return event;
    }
    return null;
  }

  DateTime get lastActivity => events.isEmpty ? overdueSince : events.last.at;
}

class RecoveryNotice {
  RecoveryNotice({
    required this.id,
    required this.caseId,
    required this.type,
    required this.issuedAt,
    required this.dueAt,
    required this.mode,
    this.ref = '',
    this.status = 'draft',
    this.response = '',
    this.body = '',
  });

  final String id;
  final String caseId;
  final String type; // demand | legal | summons
  final DateTime issuedAt;
  final DateTime dueAt;
  final String mode;
  String ref;
  String status; // draft | dispatched | delivered | responded
  String response;
  final String body;

  String get typeLabel => switch (type) {
        'legal' => 'Legal notice',
        'summons' => 'Court summons',
        _ => 'Demand notice',
      };

  String get statusLabel => switch (status) {
        'dispatched' => 'Dispatched',
        'delivered' => 'Delivered',
        'responded' => 'Responded',
        _ => 'Draft',
      };
}

class SettlementProposal {
  SettlementProposal({
    required this.id,
    required this.caseId,
    required this.dues,
    required this.proposed,
    required this.installments,
    required this.firstDue,
    required this.by,
    this.status = 'pending_approval',
    this.remarks = '',
  });

  final String id;
  final String caseId;
  final double dues;
  final double proposed;
  final int installments;
  final DateTime firstDue;
  final String by;
  String status; // pending_approval | approved | rejected | paid
  final String remarks;

  double get waiver => (dues - proposed) < 0 ? 0.0 : dues - proposed;
  double get waiverPct => dues <= 0 ? 0.0 : (waiver / dues) * 100;
  double get perInstallment => installments <= 0 ? proposed : proposed / installments;

  String get statusLabel => switch (status) {
        'approved' => 'Approved',
        'rejected' => 'Rejected',
        'paid' => 'Paid',
        _ => 'Pending approval',
      };
}

class PaymentRecord {
  PaymentRecord({
    required this.id,
    required this.caseId,
    required this.amount,
    required this.date,
    required this.mode,
    required this.ref,
    required this.by,
  });

  final String id;
  final String caseId;
  final double amount;
  final DateTime date;
  final String mode;
  final String ref;
  final String by;
}

class RecoveryActivity {
  const RecoveryActivity({
    required this.at,
    required this.title,
    required this.body,
    required this.kind,
    required this.caseId,
  });

  final DateTime at;
  final String title;
  final String body;
  final String kind; // stage | payment | notice
  final String caseId;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

final NumberFormat _inr = NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 0,
);

String inr(num value) => _inr.format(value);

String inrCompact(num value) {
  final v = value.toDouble();
  if (v.abs() >= 10000000) return '₹${(v / 10000000).toStringAsFixed(2)} Cr';
  if (v.abs() >= 100000) return '₹${(v / 100000).toStringAsFixed(2)} L';
  return inr(v);
}

String fmtDate(DateTime? d) => d == null ? '-' : DateFormat('d MMM yyyy').format(d);
String fmtDateShort(DateTime? d) => d == null ? '-' : DateFormat('d MMM').format(d);

int daysBetween(DateTime from, DateTime to) {
  final a = DateTime(from.year, from.month, from.day);
  final b = DateTime(to.year, to.month, to.day);
  return b.difference(a).inDays;
}
