import 'package:flutter/material.dart';

import '../../models/recovery.dart';
import '../../theme.dart';

/// Small teal-tinted pill used across the recovery screens.
class RecoveryChip extends StatelessWidget {
  const RecoveryChip({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.11),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.38)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
        ] else ...[
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
        ],
        Text(label,
            style: TextStyle(
                color: color, fontSize: 11.5, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class RecoveryGroupChip extends StatelessWidget {
  const RecoveryGroupChip(this.group, {super.key});
  final RecoveryGroup group;

  @override
  Widget build(BuildContext context) {
    return RecoveryChip(label: group.shortLabel, color: group.color);
  }
}

class RecoveryStatCard extends StatelessWidget {
  const RecoveryStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.sub,
    this.color = kTeal,
    this.icon,
  });

  final String label;
  final String value;
  final String sub;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE3E7EF)),
        boxShadow: const [
          BoxShadow(color: Color(0x0A14285A), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          if (icon != null) ...[
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 15, color: color),
            ),
            const SizedBox(width: 7),
          ],
          Expanded(
            child: Text(label,
                maxLines: 2,
                style: const TextStyle(
                    fontSize: 12, color: kGrey, fontWeight: FontWeight.w600)),
          ),
        ]),
        const SizedBox(height: 9),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value,
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        ),
        const SizedBox(height: 1),
        Text(sub,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 10.5, color: Color(0xFF8A95A5))),
      ]),
    );
  }
}

class RecoveryGroupBar extends StatelessWidget {
  const RecoveryGroupBar({
    super.key,
    required this.group,
    required this.count,
    required this.amount,
    required this.maxCount,
  });

  final RecoveryGroup group;
  final int count;
  final double amount;
  final int maxCount;

  @override
  Widget build(BuildContext context) {
    final fraction = maxCount <= 0 ? 0.0 : count / maxCount;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: group.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Text(group.label,
                style: const TextStyle(
                    fontSize: 13.5, fontWeight: FontWeight.w600, color: kNavy)),
          ),
          Text('$count case${count == 1 ? '' : 's'}',
              style: const TextStyle(fontSize: 11.5, color: kGrey)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: LinearProgressIndicator(
            value: fraction,
            minHeight: 7,
            backgroundColor: const Color(0xFFEDF0F5),
            valueColor: AlwaysStoppedAnimation(group.color),
          ),
        ),
        const SizedBox(height: 4),
        Row(children: [
          Text(inr(amount),
              style: const TextStyle(fontSize: 11, color: Color(0xFF5B6778))),
          const Spacer(),
          Text('stages ${group.from}-${group.to}',
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF8A95A5))),
        ]),
      ]),
    );
  }
}

class KvRow extends StatelessWidget {
  const KvRow(this.label, this.value, {super.key, this.strong = false, this.last = false});
  final String label;
  final String value;
  final bool strong;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        border: last
            ? null
            : const Border(bottom: BorderSide(color: Color(0xFFEDF0F5))),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 118,
          child: Text(label,
              style: const TextStyle(fontSize: 12.5, color: kGrey)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
                color: strong ? kNavy : const Color(0xFF1A2433),
              )),
        ),
      ]),
    );
  }
}

class WorkflowStageTile extends StatelessWidget {
  const WorkflowStageTile({
    super.key,
    required this.caseItem,
    required this.stage,
    required this.onTap,
  });

  final RecoveryCase caseItem;
  final RecoveryStage stage;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final state = stageStateOf(caseItem, stage.no);
    final event = caseItem.lastEventFor(stage.no);
    final Color color;
    final String meta;
    final String stateLabel;
    if (state == StageState.done) {
      color = kGreen;
      meta = event == null
          ? 'Completed'
          : '${fmtDate(event.at)} - ${event.by}';
      stateLabel = 'Done';
    } else if (state == StageState.current) {
      color = kTeal;
      meta = 'In progress - due ${fmtDateShort(caseItem.nextDue)} - ${stage.owner}';
      stateLabel = 'Current';
    } else {
      color = kGrey;
      meta = 'Pending - ${stage.owner} - SLA ${stage.sla} d';
      stateLabel = 'Upcoming';
    }

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: state == StageState.current
              ? kTeal.withValues(alpha: 0.06)
              : Colors.transparent,
          border: const Border(bottom: BorderSide(color: Color(0xFFF0F2F6))),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 30,
            height: 30,
            margin: const EdgeInsets.only(top: 1),
            decoration: BoxDecoration(
              color: state == StageState.upcoming
                  ? Colors.white
                  : color,
              shape: BoxShape.circle,
              border: Border.all(
                color: state == StageState.upcoming
                    ? const Color(0xFFC5CEDB)
                    : color,
                width: 2,
              ),
            ),
            child: Center(
              child: state == StageState.done
                  ? const Icon(Icons.check, size: 15, color: Colors.white)
                  : Text('${stage.no}',
                      style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: state == StageState.current
                              ? Colors.white
                              : kGrey)),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${stage.no}. ${stage.title}',
                  style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: state == StageState.current ? kTealDark : kNavy)),
              const SizedBox(height: 2),
              Text(meta,
                  style: const TextStyle(fontSize: 11, color: kGrey)),
            ]),
          ),
          const SizedBox(width: 8),
          Text(stateLabel,
              style: TextStyle(
                  fontSize: 10.5, fontWeight: FontWeight.w700, color: color)),
        ]),
      ),
    );
  }
}

class RecoveryInfoNote extends StatelessWidget {
  const RecoveryInfoNote(this.text, {super.key, this.icon = Icons.info_outline});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFD),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE3E7EF)),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: kTeal),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF5B6778))),
        ),
      ]),
    );
  }
}
