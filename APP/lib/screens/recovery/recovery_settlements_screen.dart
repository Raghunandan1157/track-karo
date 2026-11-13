import 'package:flutter/material.dart';

import '../../models/recovery.dart';
import '../../services/recovery_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'recovery_widgets.dart';

class RecoverySettlementsScreen extends StatelessWidget {
  const RecoverySettlementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: RecoveryStore.instance,
      builder: (context, _) {
        final store = RecoveryStore.instance;
        final pending = store.proposals
            .where((p) => p.status == 'pending_approval')
            .toList();
        final pendingAmount = pending.fold(0.0, (s, p) => s + p.proposed);
        final pendingWaiver = pending.fold(0.0, (s, p) => s + p.waiver);
        final approved = store.proposals
            .where((p) => p.status == 'approved' || p.status == 'paid')
            .length;
        final ordered = store.proposals.toList()
          ..sort((a, b) {
            const order = {
              'pending_approval': 0,
              'approved': 1,
              'paid': 2,
              'rejected': 3,
            };
            return (order[a.status] ?? 9).compareTo(order[b.status] ?? 9);
          });

        return ListView(
          key: const ValueKey('recovery-settlements-list'),
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
          children: [
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.55,
              children: [
                RecoveryStatCard(
                  label: 'Pending approvals',
                  value: '${pending.length}',
                  sub: 'Awaiting manager decision',
                  icon: Icons.pending_actions,
                ),
                RecoveryStatCard(
                  label: 'Proposed amount',
                  value: inrCompact(pendingAmount),
                  sub: 'Across pending proposals',
                  icon: Icons.handshake_outlined,
                ),
                RecoveryStatCard(
                  label: 'Waiver offered',
                  value: inrCompact(pendingWaiver),
                  sub: 'Across pending proposals',
                  color: kAmber,
                  icon: Icons.percent,
                ),
                RecoveryStatCard(
                  label: 'Approved / paid',
                  value: '$approved',
                  sub: 'Settlements cleared',
                  color: kGreen,
                  icon: Icons.verified_outlined,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Settlement proposals',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: kNavy,
                    ),
                  ),
                ),
                Text(
                  '${pending.length} pending',
                  style: const TextStyle(fontSize: 11.5, color: kGrey),
                ),
              ],
            ),
            const SizedBox(height: 4),
            for (final proposal in ordered) _ProposalCard(proposal: proposal),
            const SizedBox(height: 6),
            RecoveryInfoNote(
              'Approval limit: recovery manager up to 25% waiver, branch credit committee 25-40%, board above 40%. '
              'Approval here only changes the demo status.',
              icon: Icons.verified_user_outlined,
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: () => showSettlementCalculator(context),
              icon: const Icon(Icons.calculate_outlined),
              label: const Text('Open settlement calculator'),
              style: FilledButton.styleFrom(
                backgroundColor: kTeal,
                minimumSize: const Size(0, 50),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ProposalCard extends StatelessWidget {
  const _ProposalCard({required this.proposal});
  final SettlementProposal proposal;

  @override
  Widget build(BuildContext context) {
    final c = RecoveryStore.instance.caseById(proposal.caseId);
    final pending = proposal.status == 'pending_approval';
    final color = switch (proposal.status) {
      'approved' || 'paid' => kGreen,
      'rejected' => kRed,
      _ => kAmber,
    };
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        proposal.id,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontFamily: 'monospace',
                          color: Color(0xFF8A95A5),
                        ),
                      ),
                      Text(
                        c?.borrower ?? proposal.caseId,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: kNavy,
                        ),
                      ),
                      Text(
                        '${proposal.caseId} · ${proposal.by}',
                        style: const TextStyle(fontSize: 10.5, color: kGrey),
                      ),
                    ],
                  ),
                ),
                RecoveryChip(label: proposal.statusLabel, color: color),
              ],
            ),
            const SizedBox(height: 9),
            Row(
              children: [
                Expanded(
                  child: _Money(
                    label: 'Total dues',
                    value: inr(proposal.dues),
                    color: kNavy,
                  ),
                ),
                Expanded(
                  child: _Money(
                    label: 'Proposed',
                    value: inr(proposal.proposed),
                    color: kTealDark,
                  ),
                ),
                Expanded(
                  child: _Money(
                    label: 'Waiver',
                    value: '${proposal.waiverPct.toStringAsFixed(1)}%',
                    color: kAmber,
                  ),
                ),
                Expanded(
                  child: _Money(
                    label: 'Instalments',
                    value: '${proposal.installments}',
                    color: kNavy,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '${inr(proposal.perInstallment)} per instalment · first due ${fmtDate(proposal.firstDue)}',
              style: const TextStyle(fontSize: 10.5, color: kGrey),
            ),
            if (proposal.remarks.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                proposal.remarks,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF5B6778),
                ),
              ),
            ],
            if (pending) ...[
              const SizedBox(height: 9),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _decide(context, proposal, false),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: kRed,
                        side: const BorderSide(color: Color(0xFFF3B9B3)),
                        minimumSize: const Size(0, 40),
                      ),
                      child: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _decide(context, proposal, true),
                      style: FilledButton.styleFrom(
                        backgroundColor: kTeal,
                        minimumSize: const Size(0, 40),
                      ),
                      child: const Text('Approve'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _decide(
    BuildContext context,
    SettlementProposal p,
    bool approve,
  ) async {
    if (!approve) {
      final sure = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Reject settlement proposal?'),
          content: Text('${p.id} will be marked rejected.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              style: FilledButton.styleFrom(backgroundColor: kRed),
              child: const Text('Reject'),
            ),
          ],
        ),
      );
      if (sure != true) return;
    }
    RecoveryStore.instance.decideProposal(p, approve: approve);
    showSnack(
      approve ? 'Settlement ${p.id} approved.' : 'Settlement ${p.id} rejected.',
    );
  }
}

class _Money extends StatelessWidget {
  const _Money({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: Color(0xFF8A95A5)),
        ),
        const SizedBox(height: 1),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

Future<void> showSettlementCalculator(
  BuildContext context, {
  RecoveryCase? initialCase,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => SettlementCalculatorSheet(initialCase: initialCase),
  );
}

class SettlementCalculatorSheet extends StatefulWidget {
  const SettlementCalculatorSheet({super.key, this.initialCase});
  final RecoveryCase? initialCase;

  @override
  State<SettlementCalculatorSheet> createState() =>
      _SettlementCalculatorSheetState();
}

class _SettlementCalculatorSheetState extends State<SettlementCalculatorSheet> {
  late String _caseId;
  final TextEditingController _proposed = TextEditingController();
  final TextEditingController _installments = TextEditingController(text: '6');
  final TextEditingController _remarks = TextEditingController();

  @override
  void initState() {
    super.initState();
    final store = RecoveryStore.instance;
    final eligible = store.activeCases.where((c) => c.outstanding > 0).toList();
    final initial =
        widget.initialCase ?? (eligible.isNotEmpty ? eligible.first : null);
    _caseId = initial?.id ?? '';
    _setDefaultProposed();
  }

  @override
  void dispose() {
    _proposed.dispose();
    _installments.dispose();
    _remarks.dispose();
    super.dispose();
  }

  void _setDefaultProposed() {
    final c = RecoveryStore.instance.caseById(_caseId);
    if (c == null) {
      _proposed.text = '';
      return;
    }
    final target = (c.outstanding * 0.8 / 1000).round() * 1000;
    _proposed.text = target.toString();
  }

  @override
  Widget build(BuildContext context) {
    final store = RecoveryStore.instance;
    final eligible = store.activeCases.where((c) => c.outstanding > 0).toList();
    final c = store.caseById(_caseId);
    final dues = c?.outstanding ?? 0;
    final proposed = double.tryParse(_proposed.text.trim()) ?? 0;
    final installments = int.tryParse(_installments.text.trim()) ?? 1;
    final waiver = (dues - proposed) < 0 ? 0.0 : dues - proposed;
    final waiverPct = dues <= 0 ? 0.0 : (waiver / dues) * 100;
    final perInstallment = installments <= 0
        ? proposed
        : proposed / installments;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Settlement calculator',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: kNavy,
              ),
            ),
            const SizedBox(height: 2),
            const Text(
              'Compute the waiver before creating the proposal.',
              style: TextStyle(fontSize: 11.5, color: kGrey),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _caseId.isEmpty ? null : _caseId,
              decoration: const InputDecoration(labelText: 'Recovery case'),
              items: [
                for (final item in eligible)
                  DropdownMenuItem(
                    value: item.id,
                    child: Text(
                      '${item.id} · ${item.borrower}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) {
                setState(() {
                  _caseId = v ?? '';
                  _setDefaultProposed();
                });
              },
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _ReadOnlyMoney(
                    label: 'Outstanding on record',
                    value: inr(dues),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _installments,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Instalments'),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _proposed,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Proposed settlement',
                prefixText: '₹ ',
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFD),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE3E7EF)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _Money(
                      label: 'Total dues',
                      value: inr(dues),
                      color: kNavy,
                    ),
                  ),
                  Expanded(
                    child: _Money(
                      label: 'Waiver',
                      value: inr(waiver),
                      color: kAmber,
                    ),
                  ),
                  Expanded(
                    child: _Money(
                      label: 'Waiver %',
                      value: '${waiverPct.toStringAsFixed(1)}%',
                      color: waiverPct > 25 ? kRed : kGreen,
                    ),
                  ),
                  Expanded(
                    child: _Money(
                      label: 'Per instalment',
                      value: inr(perInstallment),
                      color: kTealDark,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _remarks,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Justification / remarks',
                hintText:
                    'Hardship, income position, security cover and negotiation history',
              ),
            ),
            const SizedBox(height: 10),
            RecoveryInfoNote(
              c == null
                  ? 'Select a case to calculate a settlement.'
                  : proposed > dues
                  ? 'Proposed amount is higher than the total dues.'
                  : waiverPct > 25
                  ? 'Waiver above 25% needs committee approval beyond the manager limit.'
                  : 'Waiver of ${waiverPct.toStringAsFixed(1)}% is within the recovery manager approval limit.',
              icon: Icons.info_outline,
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  if (c == null) {
                    showSnack('Select a case.', error: true);
                    return;
                  }
                  if (proposed <= 0) {
                    showSnack(
                      'Enter the proposed settlement amount.',
                      error: true,
                    );
                    return;
                  }
                  if (proposed > dues) {
                    showSnack(
                      'Proposed amount cannot exceed total dues.',
                      error: true,
                    );
                    return;
                  }
                  if (installments < 1 || installments > 36) {
                    showSnack(
                      'Instalments must be between 1 and 36.',
                      error: true,
                    );
                    return;
                  }
                  final proposal = store.addProposal(
                    caseId: c.id,
                    proposed: proposed,
                    installments: installments,
                    firstDue: DateTime.now().add(const Duration(days: 15)),
                    remarks: _remarks.text.trim(),
                  );
                  Navigator.pop(context);
                  showSnack(
                    '${proposal.id} created for ${c.borrower} - ${inr(proposed)}.',
                  );
                },
                style: FilledButton.styleFrom(
                  backgroundColor: kTeal,
                  minimumSize: const Size(0, 50),
                ),
                child: const Text('Create proposal'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReadOnlyMoney extends StatelessWidget {
  const _ReadOnlyMoney({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10.5, color: kGrey)),
        const SizedBox(height: 5),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFD),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFC5CEDB)),
          ),
          child: Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}
