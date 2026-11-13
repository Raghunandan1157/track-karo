import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/manager_store.dart';
import '../../theme.dart';
import '../../widgets/common.dart';

(IconData, Color) alertStyle(String type) => switch (type) {
      'location_off' => (Icons.location_off, kRed),
      'no_signal' => (Icons.signal_cellular_connected_no_internet_0_bar,
          Color(0xFF8E24AA)),
      'geofence_missed' => (Icons.wrong_location, kOrange),
      'meeting' => (Icons.groups, kBlue),
      'long_break' => (Icons.timer_off, kOrange),
      _ => (Icons.notifications, kGrey),
    };

/// Alerts tab: newest first, unread highlighted, tap to mark read.
/// New alerts arrive through the live stream.
class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = ManagerStore.instance;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        if (store.alerts.isEmpty && store.alertsError != null) {
          return ErrorRetry(
              message: store.alertsError!, onRetry: store.loadAlerts);
        }
        if (store.alerts.isEmpty && store.loadingAlerts) {
          return const Center(child: CircularProgressIndicator());
        }
        return Column(children: [
          if (store.alertsError != null) InlineError(store.alertsError!),
          Expanded(
            child: RefreshIndicator(
              onRefresh: store.loadAlerts,
              child: store.alerts.isEmpty
                  ? ListView(children: const [
                      SizedBox(height: 80),
                      EmptyState(
                          icon: Icons.notifications_none,
                          text: 'No alerts. All good.'),
                    ])
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      itemCount: store.alerts.length,
                      itemBuilder: (_, i) => _tile(store, store.alerts[i]),
                    ),
            ),
          ),
        ]);
      },
    );
  }

  Widget _tile(ManagerStore store, AlertItem a) {
    final st = alertStyle(a.type);
    final who = [a.officerName, a.branchName].where((s) => s.isNotEmpty).join(' - ');
    return Card(
      color: a.unread ? const Color(0xFFFFF4E5) : Colors.white,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: st.$2.withValues(alpha: 0.15),
          child: Icon(st.$1, color: st.$2),
        ),
        title: Text(a.title.isEmpty ? 'Alert' : a.title,
            style: TextStyle(
                fontWeight: a.unread ? FontWeight.w800 : FontWeight.w600,
                fontSize: 16)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (a.body.isNotEmpty) Text(a.body),
            const SizedBox(height: 2),
            Text(
              [if (who.isNotEmpty) who, fmtDateTime(a.createdAt)].join('  |  '),
              style: const TextStyle(color: kGrey, fontSize: 12.5),
            ),
          ],
        ),
        trailing: a.unread
            ? IconButton(
                tooltip: 'Mark read',
                icon: const Icon(Icons.mark_email_read, color: kNavy),
                onPressed: () => store.markRead(a),
              )
            : const Icon(Icons.done, color: kGrey, size: 20),
        onTap: a.unread ? () => store.markRead(a) : null,
      ),
    );
  }
}
