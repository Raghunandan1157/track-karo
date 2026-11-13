import 'package:flutter/material.dart';

import '../../models/recovery.dart';
import '../../services/recovery_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'recovery_settlements_screen.dart';
import 'recovery_widgets.dart';

class RecoveryCaseDetailScreen extends StatelessWidget {
  const RecoveryCaseDetailScreen({super.key, required this.caseItem});

  final RecoveryCase caseItem;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: RecoveryStore.instance,
      builder: (context, _) {
        final c = caseItem;
        return Scaffold(
          appBar: AppBar(
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  c.id,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                Text(
                  c.borrower,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13),
                ),
              ],
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
            children: [
              _Hero(caseItem: c),
              const SizedBox(height: 2),
              _SectionCard(
                title: 'Loan & case summary',
                child: Column(
                  children: [
                    KvRow(
                      'Loan account',
                      '${c.loanType} · ${c.loanNo}',
                      strong: true,
                    ),
                    KvRow('Sanctioned limit', inr(c.sanctioned)),
                    KvRow('Outstanding', inr(c.outstanding), strong: true),
                    KvRow('Overdue amount', inr(c.overdue)),
                    KvRow(
                      'Overdue since',
                      '${fmtDate(c.overdueSince)} (${c.daysOverdue} d)',
                    ),
                    KvRow('Recovered to date', inr(c.recovered)),
                    KvRow('Next action', c.nextAction),
                    if (c.hearingOn != null)
                      KvRow('Next hearing', fmtDate(c.hearingOn)),
                    if (c.isClosed) KvRow('Closed on', fmtDate(c.closedAt)),
                    KvRow('Case note', c.note, last: true),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              _Actions(caseItem: c),
              const SizedBox(height: 2),
              Card(
                margin: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 13, 14, 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Expanded(
                                child: Text(
                                  'Recovery workflow',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: kNavy,
                                  ),
                                ),
                              ),
                              RecoveryChip(
                                label: 'Stage ${c.stage} of 28',
                                color: c.group.color,
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${c.completedStages} of 28 stages complete · ${(c.progress * 100).round()}%',
                            style: const TextStyle(fontSize: 11, color: kGrey),
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: LinearProgressIndicator(
                              value: c.progress,
                              minHeight: 6,
                              backgroundColor: const Color(0xFFEDF0F5),
                              valueColor: AlwaysStoppedAnimation(c.group.color),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 1),
                    for (final group in RecoveryGroup.values)
                      _StageGroup(
                        caseItem: c,
                        group: group,
                        initiallyExpanded: c.group == group,
                        onTapStage: (stage) =>
                            _showStageSheet(context, c, stage),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              _SectionCard(
                title: 'Activity',
                child: Column(
                  children: [
                    if (c.events.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          'No activity yet. Complete a stage to add an entry.',
                          style: TextStyle(fontSize: 12, color: kGrey),
                        ),
                      )
                    else
                      for (final event in c.events.reversed.take(12))
                        _EventTile(event: event),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              _SectionCard(
                title: 'Documents',
                child: Column(
                  children: [
                    for (final doc in c.docs)
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: kTeal.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.description_outlined,
                            size: 16,
                            color: kTeal,
                          ),
                        ),
                        title: Text(
                          doc.name,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: kNavy,
                          ),
                        ),
                        subtitle: Text(
                          '${doc.type} · ${fmtDate(doc.date)}',
                          style: const TextStyle(fontSize: 10.5, color: kGrey),
                        ),
                        trailing: const Icon(
                          Icons.chevron_right,
                          size: 18,
                          color: Color(0xFF8A95A5),
                        ),
                        onTap: () => showSnack(
                          'Document preview is not wired in this UI-only demo.',
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.caseItem});
  final RecoveryCase caseItem;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [kNavy, Color(0xFF1B3470)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: const [
          BoxShadow(
            color: Color(0x2214285A),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${caseItem.id} · ${caseItem.branch} branch',
            style: const TextStyle(
              fontSize: 10.5,
              color: Color(0xB3FFFFFF),
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 2),
          Text(
            caseItem.borrower,
            style: const TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            [
              caseItem.memberNo,
              caseItem.phone,
              caseItem.village,
            ].where((v) => v.isNotEmpty).join(' · '),
            style: const TextStyle(fontSize: 11.5, color: Color(0xCCFFFFFF)),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _HeroChip(
                label: caseItem.isClosed ? 'Case closed' : 'Active',
                color: caseItem.isClosed ? kGrey : kGreen,
              ),
              _HeroChip(
                label: caseItem.group.shortLabel,
                color: caseItem.group.color,
              ),
              _HeroChip(
                label: '${caseItem.risk} risk',
                color: caseItem.risk == 'high' ? kRed : kOrange,
              ),
              _HeroChip(
                label: '${caseItem.daysOverdue} d overdue',
                color: caseItem.daysOverdue > 180 ? kRed : kAmber,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.24)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({required this.caseItem});
  final RecoveryCase caseItem;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        FilledButton.icon(
          onPressed: () => _recordPayment(context, caseItem),
          icon: const Icon(Icons.currency_rupee, size: 18),
          label: const Text('Record payment'),
          style: FilledButton.styleFrom(
            backgroundColor: kTeal,
            minimumSize: const Size(0, 46),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            textStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        OutlinedButton.icon(
          onPressed: () => _draftNotice(context, caseItem),
          icon: const Icon(Icons.description_outlined, size: 18),
          label: const Text('Draft notice'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 46),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            textStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        OutlinedButton.icon(
          onPressed: () =>
              showSettlementCalculator(context, initialCase: caseItem),
          icon: const Icon(Icons.handshake_outlined, size: 18),
          label: const Text('Settlement'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 46),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            textStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 13, 14, 8),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: kNavy,
              ),
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 10),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _StageGroup extends StatelessWidget {
  const _StageGroup({
    required this.caseItem,
    required this.group,
    required this.initiallyExpanded,
    required this.onTapStage,
  });

  final RecoveryCase caseItem;
  final RecoveryGroup group;
  final bool initiallyExpanded;
  final ValueChanged<RecoveryStage> onTapStage;

  @override
  Widget build(BuildContext context) {
    final stages = kRecoveryStages.where((s) => s.group == group).toList();
    final done = stages
        .where((s) => stageStateOf(caseItem, s.no) == StageState.done)
        .length;
    return ExpansionTile(
      initiallyExpanded: initiallyExpanded,
      shape: const Border(),
      collapsedShape: const Border(),
      tilePadding: const EdgeInsets.symmetric(horizontal: 14),
      childrenPadding: EdgeInsets.zero,
      title: Row(
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
              color: group.color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              group.label,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: kNavy,
              ),
            ),
          ),
          Text(
            '$done / ${stages.length}',
            style: const TextStyle(fontSize: 11, color: kGrey),
          ),
        ],
      ),
      children: [
        for (final stage in stages)
          WorkflowStageTile(
            caseItem: caseItem,
            stage: stage,
            onTap: () => onTapStage(stage),
          ),
      ],
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({required this.event});
  final RecoveryEvent event;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: kTeal.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check, size: 13, color: kTeal),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${event.stage}. ${stageDef(event.stage).title}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: kNavy,
                  ),
                ),
                Text(
                  event.note,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF5B6778),
                  ),
                ),
                Text(
                  '${event.by} · ${fmtDate(event.at)}',
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: Color(0xFF8A95A5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stage sheet
// ---------------------------------------------------------------------------

Future<void> _showStageSheet(
  BuildContext context,
  RecoveryCase c,
  RecoveryStage stage,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _StageSheet(caseItem: c, stage: stage),
  );
}

class _StageSheet extends StatefulWidget {
  const _StageSheet({required this.caseItem, required this.stage});

  final RecoveryCase caseItem;
  final RecoveryStage stage;

  @override
  State<_StageSheet> createState() => _StageSheetState();
}

class _StageSheetState extends State<_StageSheet> {
  final TextEditingController _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.caseItem;
    final stage = widget.stage;
    final state = stageStateOf(c, stage.no);
    final event = c.lastEventFor(stage.no);

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    'Stage ${stage.no} · ${stage.title}',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: kNavy,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                RecoveryChip(
                  label: state == StageState.done
                      ? 'Done'
                      : state == StageState.current
                      ? 'Current'
                      : 'Upcoming',
                  color: state == StageState.done
                      ? kGreen
                      : state == StageState.current
                      ? kTeal
                      : kGrey,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              stage.description,
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF5B6778)),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                RecoveryChip(label: stage.owner, color: kBlue),
                RecoveryChip(label: 'SLA ${stage.sla} days', color: kAmber),
                RecoveryChip(label: stage.evidence, color: kGrey),
              ],
            ),
            if (event != null) ...[
              const SizedBox(height: 12),
              RecoveryInfoNote(
                '${fmtDate(event.at)} · ${event.by}\n${event.note}',
                icon: Icons.history,
              ),
            ],
            const SizedBox(height: 14),
            if (state == StageState.current) ...[
              TextField(
                controller: _note,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Stage note',
                  hintText:
                      'What happened, who was contacted and what was agreed',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    RecoveryStore.instance.completeStage(c, note: _note.text);
                    Navigator.pop(context);
                    showSnack(
                      c.isClosed
                          ? 'Case closed. No-dues position recorded.'
                          : 'Stage ${stage.no} complete. Moved to stage ${c.stage}: ${c.currentStage.title}.',
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: kTeal,
                    minimumSize: const Size(0, 50),
                  ),
                  child: const Text('Complete stage & continue'),
                ),
              ),
            ] else
              RecoveryInfoNote(
                state == StageState.done
                    ? 'This stage is complete. Its evidence is on the case file.'
                    : 'This stage is not active yet. Complete stage ${c.stage} first.',
                icon: state == StageState.done
                    ? Icons.check_circle_outline
                    : Icons.lock_clock,
              ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Payment dialog
// ---------------------------------------------------------------------------

Future<void> _recordPayment(BuildContext context, RecoveryCase c) async {
  final amount = await showDialog<double>(
    context: context,
    builder: (_) => _RecordPaymentDialog(caseItem: c),
  );
  if (amount != null && amount > 0) {
    showSnack('Payment of ${inr(amount)} recorded for ${c.borrower}.');
  }
}

class _RecordPaymentDialog extends StatefulWidget {
  const _RecordPaymentDialog({required this.caseItem});
  final RecoveryCase caseItem;

  @override
  State<_RecordPaymentDialog> createState() => _RecordPaymentDialogState();
}

class _RecordPaymentDialogState extends State<_RecordPaymentDialog> {
  late final TextEditingController _amount;
  final TextEditingController _ref = TextEditingController();
  String _mode = 'NEFT';

  @override
  void initState() {
    super.initState();
    final c = widget.caseItem;
    _amount = TextEditingController(
      text: (c.overdue > 0 ? c.overdue : c.outstanding).toStringAsFixed(0),
    );
  }

  @override
  void dispose() {
    _amount.dispose();
    _ref.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.caseItem;
    return AlertDialog(
      title: const Text('Record recovery payment'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Outstanding on record: ${inr(c.outstanding)}',
              style: const TextStyle(fontSize: 12, color: kGrey),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Amount received',
                prefixText: '₹ ',
              ),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _mode,
              decoration: const InputDecoration(labelText: 'Mode'),
              items: const [
                DropdownMenuItem(value: 'NEFT', child: Text('NEFT')),
                DropdownMenuItem(value: 'UPI', child: Text('UPI')),
                DropdownMenuItem(value: 'Cash', child: Text('Cash')),
                DropdownMenuItem(value: 'Cheque', child: Text('Cheque')),
                DropdownMenuItem(
                  value: 'Gold auction',
                  child: Text('Gold auction'),
                ),
                DropdownMenuItem(
                  value: 'Property sale',
                  child: Text('Property sale'),
                ),
              ],
              onChanged: (v) => setState(() => _mode = v ?? 'NEFT'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _ref,
              decoration: const InputDecoration(
                labelText: 'Reference',
                hintText: 'UTR, receipt or auction reference',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final value = double.tryParse(_amount.text.trim());
            if (value == null || value <= 0) {
              showSnack('Enter a valid payment amount.', error: true);
              return;
            }
            if (value > c.outstanding) {
              showSnack(
                'Payment cannot exceed the outstanding balance.',
                error: true,
              );
              return;
            }
            RecoveryStore.instance.recordPayment(
              c,
              amount: value,
              mode: _mode,
              ref: _ref.text.trim(),
            );
            Navigator.pop(context, value);
          },
          child: const Text('Record payment'),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Notice dialog
// ---------------------------------------------------------------------------

Future<void> _draftNotice(BuildContext context, RecoveryCase c) async {
  final notice = await showDialog<RecoveryNotice>(
    context: context,
    builder: (_) => _DraftNoticeDialog(caseItem: c),
  );
  if (notice != null) {
    showSnack(
      '${notice.typeLabel} ${notice.id} drafted. Open Notices to preview it.',
    );
  }
}

class _DraftNoticeDialog extends StatefulWidget {
  const _DraftNoticeDialog({required this.caseItem});
  final RecoveryCase caseItem;

  @override
  State<_DraftNoticeDialog> createState() => _DraftNoticeDialogState();
}

class _DraftNoticeDialogState extends State<_DraftNoticeDialog> {
  final TextEditingController _ref = TextEditingController();
  String _type = 'demand';

  @override
  void dispose() {
    _ref.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.caseItem;
    return AlertDialog(
      title: const Text('Draft a notice'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '${c.borrower} · ${c.id}',
            style: const TextStyle(fontSize: 12, color: kGrey),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            isExpanded: true,
            initialValue: _type,
            decoration: const InputDecoration(labelText: 'Notice type'),
            items: const [
              DropdownMenuItem(value: 'demand', child: Text('Demand notice')),
              DropdownMenuItem(value: 'legal', child: Text('Legal notice')),
              DropdownMenuItem(value: 'summons', child: Text('Court summons')),
            ],
            onChanged: (v) => setState(() => _type = v ?? 'demand'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _ref,
            decoration: const InputDecoration(
              labelText: 'Postal / case reference',
              hintText: 'Optional',
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'The notice will use the live outstanding and a 15-day deadline.',
            style: TextStyle(fontSize: 11, color: kGrey),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final notice = RecoveryStore.instance.draftNotice(
              caseId: c.id,
              type: _type,
              mode: 'Registered post',
              dueAt: DateTime.now().add(const Duration(days: 15)),
              ref: _ref.text.trim(),
            );
            Navigator.pop(context, notice);
          },
          child: const Text('Create draft'),
        ),
      ],
    );
  }
}
