import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/manager_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';
import 'officer_detail_screen.dart';

/// Team tab: every field officer with status, distance, tasks and last seen.
class TeamScreen extends StatelessWidget {
  const TeamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = ManagerStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final list = [...store.officers]..sort((a, b) {
            final r = _rank(a.status).compareTo(_rank(b.status));
            return r != 0 ? r : a.name.compareTo(b.name);
          });
        if (!store.loadedOnce) {
          if (store.loadingLive) {
            return const Center(child: CircularProgressIndicator());
          }
          return ErrorRetry(
              message: store.liveError ?? 'Could not load your team.',
              onRetry: store.loadLive);
        }
        return Column(children: [
          if (store.liveError != null)
            InlineError('${store.liveError} Showing last loaded data.'),
          Expanded(
            child: RefreshIndicator(
              onRefresh: store.loadOfficers,
              child: list.isEmpty
                  ? ListView(children: const [
                      SizedBox(height: 80),
                      EmptyState(
                          icon: Icons.groups_outlined,
                          text: 'No field officers yet.'),
                    ])
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      itemCount: list.length,
                      itemBuilder: (context, i) => _tile(context, list[i]),
                    ),
            ),
          ),
        ]);
      },
    );
  }

  static int _rank(String s) => switch (s) {
        'location_off' => 0,
        'no_signal' => 1,
        'on_duty' => 2,
        'on_lunch' => 3,
        'day_ended' => 4,
        _ => 5,
      };

  Widget _tile(BuildContext context, Officer o) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => OfficerDetailScreen(officer: o))),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(o.name.isEmpty ? o.userid : o.name,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w800)),
                ),
                StatusChip.officer(o.status),
              ]),
              if (o.branchName.isNotEmpty)
                Text(o.branchName, style: const TextStyle(color: kGrey)),
              const SizedBox(height: 10),
              Row(children: [
                _info(Icons.route, fmtKm(o.distanceM)),
                _info(Icons.assignment_turned_in,
                    '${o.assignmentsVisited}/${o.assignmentsTotal} tasks'),
                _info(Icons.access_time, fmtAgo(o.lastPointAt)),
                if (o.battery != null)
                  _info(Icons.battery_std, '${o.battery}%', flex: 0),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _info(IconData icon, String text, {int flex = 1}) {
    final row = Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 17, color: kBlue),
      const SizedBox(width: 4),
      Flexible(
        child: Text(text,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
    ]);
    return flex == 0 ? row : Expanded(child: row);
  }
}
