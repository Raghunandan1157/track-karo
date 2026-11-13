import 'package:flutter/material.dart';

import '../../models/recovery.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'recovery_widgets.dart';

/// UI-only stage configuration: owners and SLAs are shown, active state can be
/// toggled locally and resets when the screen is closed.
class RecoveryStagesScreen extends StatefulWidget {
  const RecoveryStagesScreen({super.key});

  @override
  State<RecoveryStagesScreen> createState() => _RecoveryStagesScreenState();
}

class _RecoveryStagesScreenState extends State<RecoveryStagesScreen> {
  final Map<int, bool> _active = {
    for (final stage in kRecoveryStages) stage.no: true,
  };

  void _reset() {
    setState(() {
      for (final stage in kRecoveryStages) {
        _active[stage.no] = true;
      }
    });
    showSnack('Stage configuration reset to defaults.');
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = _active.values.where((v) => v).length;
    final slaTotal = kRecoveryStages
        .where((s) => _active[s.no] == true)
        .fold(0, (sum, s) => sum + s.sla);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recovery stage setup'),
        actions: [
          TextButton(
            onPressed: _reset,
            child: const Text('Reset',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 14, 12, 28),
        children: [
          RecoveryInfoNote(
            '$activeCount of 28 stages enabled · SLA total $slaTotal days. '
            'Owners and SLAs are UI-only in this demo and reset when the screen closes.',
            icon: Icons.tune,
          ),
          const SizedBox(height: 10),
          for (final group in RecoveryGroup.values)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 5),
              child: ExpansionTile(
                initiallyExpanded: group == RecoveryGroup.preLegal,
                shape: const Border(),
                collapsedShape: const Border(),
                childrenPadding: EdgeInsets.zero,
                tilePadding: const EdgeInsets.symmetric(horizontal: 14),
                title: Row(children: [
                  Container(
                    width: 9,
                    height: 9,
                    decoration:
                        BoxDecoration(color: group.color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(group.label,
                        style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: kNavy)),
                  ),
                  Text('${group.from}-${group.to}',
                      style: const TextStyle(fontSize: 11, color: kGrey)),
                ]),
                children: [
                  for (final stage in kRecoveryStages.where((s) => s.group == group))
                    _StageConfigTile(
                      stage: stage,
                      active: _active[stage.no] ?? true,
                      onChanged: (v) => setState(() => _active[stage.no] = v),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StageConfigTile extends StatelessWidget {
  const _StageConfigTile({
    required this.stage,
    required this.active,
    required this.onChanged,
  });

  final RecoveryStage stage;
  final bool active;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF0F2F6))),
      ),
      child: Row(children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: stage.group.color.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text('${stage.no}',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: stage.group.color)),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(stage.title,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: active ? kNavy : kGrey,
                )),
            const SizedBox(height: 1),
            Text('${stage.owner} · SLA ${stage.sla} d',
                style: const TextStyle(fontSize: 10.5, color: kGrey)),
            Text(stage.evidence,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10, color: Color(0xFF8A95A5))),
          ]),
        ),
        Switch(
          value: active,
          onChanged: onChanged,
        ),
      ]),
    );
  }
}
