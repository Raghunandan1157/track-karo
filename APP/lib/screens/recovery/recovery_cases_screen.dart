import 'package:flutter/material.dart';

import '../../models/recovery.dart';
import '../../services/recovery_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'recovery_case_detail.dart';
import 'recovery_widgets.dart';

class RecoveryCasesScreen extends StatefulWidget {
  const RecoveryCasesScreen({super.key});

  @override
  State<RecoveryCasesScreen> createState() => _RecoveryCasesScreenState();
}

class _RecoveryCasesScreenState extends State<RecoveryCasesScreen> {
  final TextEditingController _search = TextEditingController();
  RecoveryGroup? _group;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<RecoveryCase> _filtered(RecoveryStore store) {
    final q = _search.text.trim().toLowerCase();
    final list = store.cases.where((c) {
      if (_group != null && c.group != _group) return false;
      if (q.isEmpty) return true;
      final hay =
          '${c.id} ${c.borrower} ${c.memberNo} ${c.loanNo} ${c.village} ${c.officer}'
              .toLowerCase();
      return hay.contains(q);
    }).toList();
    list.sort((a, b) {
      if (a.isActive != b.isActive) return a.isActive ? -1 : 1;
      return b.daysOverdue.compareTo(a.daysOverdue);
    });
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: RecoveryStore.instance,
      builder: (context, _) {
        final store = RecoveryStore.instance;
        final rows = _filtered(store);
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
              child: TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Case, borrower, loan no or village',
                  prefixIcon: const Icon(Icons.search, size: 20),
                  isDense: true,
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          tooltip: 'Clear search',
                          onPressed: () {
                            _search.clear();
                            setState(() {});
                          },
                        ),
                ),
              ),
            ),
            SizedBox(
              height: 46,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                children: [
                  _filterChip('All cases', null),
                  for (final group in RecoveryGroup.values)
                    _filterChip(group.shortLabel, group),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Row(children: [
                Text('${rows.length} case${rows.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600, color: kGrey)),
                const Spacer(),
                const Text('Sorted by ageing',
                    style: TextStyle(fontSize: 11, color: Color(0xFF8A95A5))),
              ]),
            ),
            Expanded(
              child: rows.isEmpty
                  ? const EmptyState(
                      icon: Icons.folder_off_outlined,
                      text: 'No recovery cases match this search.',
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 2, 12, 24),
                      itemCount: rows.length,
                      itemBuilder: (context, i) => _CaseCard(
                        caseItem: rows[i],
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                RecoveryCaseDetailScreen(caseItem: rows[i]),
                          ),
                        ),
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _filterChip(String label, RecoveryGroup? group) {
    final selected = _group == group;
    final color = group?.color ?? kTeal;
    return Padding(
      padding: const EdgeInsets.only(right: 7),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => _group = group),
        showCheckmark: false,
        selectedColor: color.withValues(alpha: 0.16),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: selected ? color : kGrey,
        ),
        side: BorderSide(
          color: selected ? color.withValues(alpha: 0.5) : const Color(0xFFDDE3EC),
        ),
        backgroundColor: Colors.white,
      ),
    );
  }
}

class _CaseCard extends StatelessWidget {
  const _CaseCard({required this.caseItem, required this.onTap});
  final RecoveryCase caseItem;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(13, 11, 12, 11),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(caseItem.borrower,
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w800, color: kNavy)),
                  const SizedBox(height: 1),
                  Text('${caseItem.id} · ${caseItem.branch} branch',
                      style: const TextStyle(
                          fontSize: 10.5,
                          color: Color(0xFF8A95A5),
                          fontFamily: 'monospace')),
                ]),
              ),
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                RecoveryGroupChip(caseItem.group),
                if (caseItem.isClosed) ...[
                  const SizedBox(height: 4),
                  RecoveryChip(label: 'Closed', color: kGrey),
                ],
              ]),
            ]),
            const SizedBox(height: 9),
            Row(children: [
              Expanded(
                child: _Amount(
                  label: 'Outstanding',
                  value: inr(caseItem.outstanding),
                  color: kNavy,
                ),
              ),
              Expanded(
                child: _Amount(
                  label: 'Overdue',
                  value: inr(caseItem.overdue),
                  color: caseItem.overdue > 0 ? kRed : kGrey,
                ),
              ),
              Expanded(
                child: _Amount(
                  label: 'Ageing',
                  value: '${caseItem.daysOverdue} d',
                  color: caseItem.daysOverdue > 180 ? kRed : kGrey,
                ),
              ),
            ]),
            const SizedBox(height: 9),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFD),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFEDF0F5)),
              ),
              child: Row(children: [
                Expanded(
                  child: Text(
                    '${caseItem.stage}. ${caseItem.currentStage.title}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: kTealDark),
                  ),
                ),
                const SizedBox(width: 6),
                Text(caseItem.officer,
                    style: const TextStyle(fontSize: 10.5, color: kGrey)),
              ]),
            ),
            const SizedBox(height: 7),
            Row(children: [
              const Icon(Icons.arrow_forward, size: 13, color: kTeal),
              const SizedBox(width: 4),
              Expanded(
                child: Text(caseItem.nextAction,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF5B6778))),
              ),
              Text(fmtDateShort(caseItem.nextDue),
                  style: const TextStyle(fontSize: 10.5, color: kGrey)),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Amount extends StatelessWidget {
  const _Amount({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF8A95A5))),
      const SizedBox(height: 1),
      FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Text(value,
            style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w700, color: color)),
      ),
    ]);
  }
}
