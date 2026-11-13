import 'package:flutter/material.dart';

import '../../models/recovery.dart';
import '../../services/recovery_store.dart';
import '../../theme.dart';
import 'recovery_case_detail.dart';
import 'recovery_widgets.dart';

class RecoveryDashboardScreen extends StatelessWidget {
  const RecoveryDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: RecoveryStore.instance,
      builder: (context, _) {
        final store = RecoveryStore.instance;
        final active = store.activeCases;
        final closed = store.cases.where((c) => c.isClosed).length;
        return ListView(
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
                  label: 'Outstanding portfolio',
                  value: inrCompact(store.totalOutstanding()),
                  sub: '${active.length} active cases',
                  icon: Icons.account_balance_wallet_outlined,
                ),
                RecoveryStatCard(
                  label: 'Overdue amount',
                  value: inrCompact(store.totalOverdue()),
                  sub: 'Past due across active cases',
                  color: kAmber,
                  icon: Icons.schedule,
                ),
                RecoveryStatCard(
                  label: 'Legal cases',
                  value: '${store.legalCases.length}',
                  sub: 'Stages 13 to 22',
                  color: kPurple,
                  icon: Icons.gavel,
                ),
                RecoveryStatCard(
                  label: 'Recovered this month',
                  value: inrCompact(store.recoveredThisMonth),
                  sub: 'Payments credited',
                  color: kGreen,
                  icon: Icons.trending_up,
                ),
                RecoveryStatCard(
                  label: 'Active cases',
                  value: '${active.length}',
                  sub: 'Pre-legal, legal and final',
                  icon: Icons.folder_open,
                ),
                RecoveryStatCard(
                  label: 'Cases closed',
                  value: '$closed',
                  sub: 'After full recovery',
                  color: kGrey,
                  icon: Icons.task_alt,
                ),
              ],
            ),
            const SizedBox(height: 12),
            _Panel(
              title: 'Portfolio by recovery stage',
              subtitle: 'Case count and exposure by stage group',
              child: Column(
                children: [
                  for (final group in RecoveryGroup.values)
                    RecoveryGroupBar(
                      group: group,
                      count: active.where((c) => c.group == group).length,
                      amount: store.totalOutstanding(
                        active.where((c) => c.group == group).toList(),
                      ),
                      maxCount: active.isEmpty
                          ? 1
                          : active
                              .map((c) =>
                                  active.where((x) => x.group == c.group).length)
                              .reduce((a, b) => a > b ? a : b),
                    ),
                  RecoveryInfoNote(
                    '${active.length} of ${store.cases.length} cases are active. '
                    'Use the stage guide to see owners and SLAs for all 28 stages.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            _Panel(
              title: 'Ageing of overdue accounts',
              subtitle: 'Days since the account became overdue',
              child: _AgeingList(store: store),
            ),
            const SizedBox(height: 4),
            _Panel(
              title: "Today's follow-ups",
              subtitle: 'Next action due first',
              child: Column(
                children: [
                  for (final c in store.followUps)
                    _FollowUpTile(
                      caseItem: c,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => RecoveryCaseDetailScreen(caseItem: c),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            _Panel(
              title: 'Recent recovery activity',
              subtitle: 'Stage updates, payments and notices',
              child: Column(
                children: [
                  for (final item in store.activityFeed(limit: 8))
                    _ActivityTile(item: item),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 13, 12, 11),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: kNavy)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle!,
                        style: const TextStyle(fontSize: 11, color: kGrey)),
                  ],
                ]),
              ),
            ]),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _AgeingList extends StatelessWidget {
  const _AgeingList({required this.store});
  final RecoveryStore store;

  static const _buckets = <(String, int, int)>[
    ('0-30 days', 0, 30),
    ('31-60 days', 31, 60),
    ('61-90 days', 61, 90),
    ('91-180 days', 91, 180),
    ('181-365 days', 181, 365),
    ('Above 365 days', 366, 100000),
  ];

  @override
  Widget build(BuildContext context) {
    final counts = [
      for (final b in _buckets) store.ageingCount(b.$2, b.$3),
    ];
    final maxCount = counts.isEmpty
        ? 1
        : counts.reduce((a, b) => a > b ? a : b);
    return Column(
      children: [
        for (var i = 0; i < _buckets.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 11),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                    child: Text(_buckets[i].$1,
                        style: const TextStyle(fontSize: 12.5)),
                  ),
                  Text('${counts[i]} cases',
                      style: const TextStyle(fontSize: 11, color: kGrey)),
                ]),
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: LinearProgressIndicator(
                    value: maxCount == 0 ? 0 : counts[i] / maxCount,
                    minHeight: 6,
                    backgroundColor: const Color(0xFFEDF0F5),
                    valueColor: const AlwaysStoppedAnimation(kTeal),
                  ),
                ),
              ],
            ),
          ),
        RecoveryInfoNote(
          '${store.activeCases.where((c) => c.daysOverdue > 180).length} accounts are more than 180 days overdue and need escalation review.',
          icon: Icons.warning_amber_rounded,
        ),
      ],
    );
  }
}

class _FollowUpTile extends StatelessWidget {
  const _FollowUpTile({required this.caseItem, required this.onTap});
  final RecoveryCase caseItem;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final diff = daysBetween(DateTime.now(), caseItem.nextDue);
    final overdue = caseItem.nextDue.isBefore(DateTime.now());
    final due = caseItem.nextDue.year == DateTime.now().year &&
            caseItem.nextDue.month == DateTime.now().month &&
            caseItem.nextDue.day == DateTime.now().day
        ? 'Due today'
        : overdue
            ? '${diff.abs()} d overdue'
            : 'Due ${fmtDateShort(caseItem.nextDue)}';
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: caseItem.group.color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(caseItem.borrower,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w700, color: kNavy)),
              Text(caseItem.nextAction,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, color: kGrey)),
            ]),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            RecoveryGroupChip(caseItem.group),
            const SizedBox(height: 3),
            Text(due,
                style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: overdue ? kRed : kGrey)),
          ]),
        ]),
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.item});
  final RecoveryActivity item;

  @override
  Widget build(BuildContext context) {
    final color = item.kind == 'payment'
        ? kGreen
        : item.kind == 'notice'
            ? kOrange
            : kTeal;
    final icon = item.kind == 'payment'
        ? Icons.currency_rupee
        : item.kind == 'notice'
            ? Icons.description_outlined
            : Icons.check_circle_outline;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.title,
                style: const TextStyle(
                    fontSize: 12.5, fontWeight: FontWeight.w600, color: kNavy)),
            Text(item.body,
                style: const TextStyle(fontSize: 11, color: kGrey)),
          ]),
        ),
        const SizedBox(width: 6),
        Text(fmtDateShort(item.at),
            style: const TextStyle(fontSize: 10.5, color: Color(0xFF8A95A5))),
      ]),
    );
  }
}
