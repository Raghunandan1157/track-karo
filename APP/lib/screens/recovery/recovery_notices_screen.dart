import 'package:flutter/material.dart';

import '../../models/recovery.dart';
import '../../services/recovery_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'recovery_widgets.dart';

class RecoveryNoticesScreen extends StatefulWidget {
  const RecoveryNoticesScreen({super.key});

  @override
  State<RecoveryNoticesScreen> createState() => _RecoveryNoticesScreenState();
}

class _RecoveryNoticesScreenState extends State<RecoveryNoticesScreen> {
  String? _status;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: RecoveryStore.instance,
      builder: (context, _) {
        final store = RecoveryStore.instance;
        final rows =
            store.notices
                .where((n) => _status == null || n.status == _status)
                .toList()
              ..sort((a, b) => b.issuedAt.compareTo(a.issuedAt));
        return Column(
          children: [
            SizedBox(
              height: 46,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                children: [
                  _chip('All notices', null),
                  _chip('Draft', 'draft'),
                  _chip('Dispatched', 'dispatched'),
                  _chip('Delivered', 'delivered'),
                  _chip('Responded', 'responded'),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
              child: Row(
                children: [
                  Text(
                    '${rows.length} notice${rows.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: kGrey,
                    ),
                  ),
                  const Spacer(),
                  const Text(
                    'Newest first',
                    style: TextStyle(fontSize: 11, color: Color(0xFF8A95A5)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: rows.isEmpty
                  ? const EmptyState(
                      icon: Icons.description_outlined,
                      text: 'No notices match this filter.',
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 2, 12, 24),
                      itemCount: rows.length,
                      itemBuilder: (context, i) {
                        final notice = rows[i];
                        return _NoticeCard(
                          notice: notice,
                          onTap: () => _openPreview(context, notice),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _chip(String label, String? status) {
    final selected = _status == status;
    return Padding(
      padding: const EdgeInsets.only(right: 7),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        showCheckmark: false,
        onSelected: (_) => setState(() => _status = status),
        selectedColor: kTeal.withValues(alpha: 0.15),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: selected ? kTealDark : kGrey,
        ),
        side: BorderSide(
          color: selected
              ? kTeal.withValues(alpha: 0.45)
              : const Color(0xFFDDE3EC),
        ),
        backgroundColor: Colors.white,
      ),
    );
  }

  void _openPreview(BuildContext context, RecoveryNotice notice) {
    showDialog<void>(
      context: context,
      builder: (_) => NoticePreviewDialog(notice: notice),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({required this.notice, required this.onTap});
  final RecoveryNotice notice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = RecoveryStore.instance.caseById(notice.caseId);
    final color = switch (notice.status) {
      'dispatched' => kAmber,
      'delivered' => kGreen,
      'responded' => kBlue,
      _ => kGrey,
    };
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Icon(
                      notice.type == 'summons'
                          ? Icons.gavel
                          : Icons.description_outlined,
                      size: 18,
                      color: color,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notice.typeLabel,
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: kNavy,
                          ),
                        ),
                        Text(
                          '${notice.id} · ${notice.mode}',
                          style: const TextStyle(fontSize: 10.5, color: kGrey),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  RecoveryChip(label: notice.statusLabel, color: color),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      c?.borrower ?? notice.caseId,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Text(
                    notice.caseId,
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontFamily: 'monospace',
                      color: Color(0xFF8A95A5),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.event_outlined, size: 13, color: kGrey),
                  const SizedBox(width: 4),
                  Text(
                    'Issued ${fmtDate(notice.issuedAt)}',
                    style: const TextStyle(fontSize: 10.5, color: kGrey),
                  ),
                  const SizedBox(width: 12),
                  const Icon(Icons.schedule, size: 13, color: kGrey),
                  const SizedBox(width: 4),
                  Text(
                    'Due ${fmtDateShort(notice.dueAt)}',
                    style: const TextStyle(fontSize: 10.5, color: kGrey),
                  ),
                ],
              ),
              if (notice.response.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(
                  'Response: ${notice.response}',
                  style: const TextStyle(fontSize: 11, color: kTealDark),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Notice preview
// ---------------------------------------------------------------------------

class NoticePreviewDialog extends StatefulWidget {
  const NoticePreviewDialog({super.key, required this.notice});
  final RecoveryNotice notice;

  @override
  State<NoticePreviewDialog> createState() => _NoticePreviewDialogState();
}

class _NoticePreviewDialogState extends State<NoticePreviewDialog> {
  @override
  Widget build(BuildContext context) {
    final n = widget.notice;
    final c = RecoveryStore.instance.caseById(n.caseId);
    final amount = n.type == 'demand'
        ? (c?.overdue ?? 0)
        : (c?.outstanding ?? 0);
    final next = n.status == 'draft'
        ? 'Mark dispatched'
        : n.status == 'dispatched'
        ? 'Mark delivered'
        : null;

    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620, maxHeight: 720),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${n.typeLabel} · ${n.id}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: kNavy,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(14),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFDDE3EC)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Image.asset(
                            'assets/hccs-logo.png',
                            width: 150,
                            height: 40,
                            fit: BoxFit.contain,
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Recovery Department',
                                  style: TextStyle(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                    color: kNavy,
                                  ),
                                ),
                                Text(
                                  'Sahyadri Bhavan, Station Road, Pune 411 001',
                                  style: TextStyle(fontSize: 8.5, color: kGrey),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Divider(thickness: 1.5, color: kNavy),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Ref: ${n.id}',
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontFamily: 'monospace',
                              color: kGrey,
                            ),
                          ),
                          Text(
                            fmtDate(n.issuedAt),
                            style: const TextStyle(
                              fontSize: 10.5,
                              color: kGrey,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'To',
                        style: TextStyle(
                          fontSize: 9.5,
                          letterSpacing: .8,
                          color: Color(0xFF8A95A5),
                        ),
                      ),
                      Text(
                        c?.borrower ?? n.caseId,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        'Member No. ${c?.memberNo ?? '-'}\n'
                        '${c?.village ?? ''}${(c?.village ?? '').isEmpty ? '' : ', '}${c?.branch ?? ''} Branch',
                        style: const TextStyle(fontSize: 11, height: 1.5),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Subject: ${n.typeLabel} for recovery of overdue dues',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Dear Sir / Madam,\n\n'
                        '${_noticeParagraph(n, c, amount)}',
                        style: const TextStyle(fontSize: 11.5, height: 1.6),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(9),
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFC5CEDB)),
                        ),
                        child: Column(
                          children: [
                            _letterRow(
                              'Total outstanding',
                              inr(c?.outstanding ?? 0),
                            ),
                            _letterRow('Overdue amount', inr(c?.overdue ?? 0)),
                            _letterRow(
                              'Amount demanded',
                              inr(amount),
                              strong: true,
                            ),
                            _letterRow('Payment deadline', fmtDate(n.dueAt)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Yours faithfully,',
                        style: TextStyle(fontSize: 11.5),
                      ),
                      const SizedBox(height: 26),
                      const Text(
                        'Authorised Officer',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                      const Text(
                        'Recovery Department',
                        style: TextStyle(fontSize: 10.5),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Ref: ${n.ref.isEmpty ? 'Pending dispatch' : n.ref} · ${n.mode}',
                        style: const TextStyle(
                          fontSize: 9,
                          color: Color(0xFF8A95A5),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Close'),
                    ),
                  ),
                  if (next != null) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          RecoveryStore.instance.advanceNotice(n);
                          setState(() {});
                          showSnack('${n.id} marked ${n.status}.');
                        },
                        style: FilledButton.styleFrom(backgroundColor: kTeal),
                        child: Text(next),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _letterRow(String label, String value, {bool strong = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 10.5, color: kGrey),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 11,
              fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
              color: strong ? kNavy : null,
            ),
          ),
        ],
      ),
    );
  }

  String _noticeParagraph(RecoveryNotice n, RecoveryCase? c, double amount) {
    if (n.body.isNotEmpty) return n.body;
    if (n.type == 'legal') {
      return 'Under instructions from the Society and in continuation of the demand notice, '
          'this is a final notice calling upon you to clear the dues of ${inr(amount)} '
          'within 15 days of receipt of this notice.\n\n'
          'Failing compliance, the Society will be constrained to initiate legal proceedings '
          'before the competent authority at your sole risk, cost and consequences.';
    }
    if (n.type == 'summons') {
      return 'You are hereby summoned to appear before the Co-operative Court, Pune, on '
          '${fmtDate(n.dueAt)} in connection with Case No. ${n.ref.isEmpty ? '-' : n.ref} '
          'filed by the Society for recovery of ${inr(amount)}.\n\n'
          'Kindly appear in person or through your authorised representative, failing which '
          'the matter will be proceeded with ex parte.';
    }
    return 'Our records show that an amount of ${inr(amount)} is overdue on your '
        '${c?.loanType ?? 'loan'} account ${c?.loanNo ?? ''}. Despite reminders, the amount '
        'remains unpaid.\n\n'
        'You are hereby called upon to pay the overdue amount within 15 days of receipt of '
        'this notice, together with applicable interest and charges, failing which the Society '
        'shall be compelled to initiate recovery action, including legal proceedings, at your cost.';
  }
}
