import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme.dart';

String hrDate(String ymd) {
  if (ymd.isEmpty) return '-';
  final d = DateTime.tryParse(ymd);
  return d == null ? ymd : DateFormat('d MMM yyyy').format(d);
}

String hrShortDate(String ymd) {
  if (ymd.isEmpty) return '-';
  final d = DateTime.tryParse(ymd);
  return d == null ? ymd : DateFormat('d MMM').format(d);
}

String hrMonth(DateTime d) => DateFormat('MMMM yyyy').format(d);

String hrDuration(int minutes) {
  if (minutes <= 0) return '-';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return h == 0 ? '${m}m' : (m == 0 ? '${h}h' : '${h}h ${m}m');
}

Color hrStatusColor(String status) {
  switch (status) {
    case 'active':
    case 'present':
    case 'approved':
    case 'valid':
    case 'paid':
    case 'completed':
    case 'hired':
    case 'open':
      return kGreen;
    case 'probation':
    case 'pending':
    case 'late':
    case 'expiring':
    case 'draft':
    case 'notice':
      return kOrange;
    case 'inactive':
    case 'rejected':
    case 'absent':
    case 'expired':
      return kRed;
    case 'leave':
    case 'interview':
    case 'self_done':
    case 'processed':
    case 'offer':
      return kBlue;
    case 'wfh':
      return const Color(0xFF0E7490);
    case 'field':
      return const Color(0xFF4D6B12);
    case 'week_off':
    case 'cancelled':
    case 'closed':
    case 'scheduled':
      return kGrey;
    default:
      return kGrey;
  }
}

class HrStatusChip extends StatelessWidget {
  const HrStatusChip(this.label, {super.key, required this.status, this.dense = false});

  final String label;
  final String status;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final color = hrStatusColor(status);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 7 : 9, vertical: dense ? 2 : 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: .45)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: dense ? 11 : 12.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class HrAvatar extends StatelessWidget {
  const HrAvatar(this.name, {super.key, this.size = 44, this.id = 0});

  final String name;
  final double size;
  final int id;

  static const _colours = [
    Color(0xFF2F6DB5),
    Color(0xFF1E8E4E),
    Color(0xFFB26A00),
    Color(0xFF6D3FC0),
    Color(0xFFC62828),
    Color(0xFF0E7490),
  ];

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final initials = parts.isEmpty
        ? '?'
        : (parts.first.isEmpty ? '?' : parts.first[0]) +
            (parts.length > 1 && parts.last.isNotEmpty ? parts.last[0] : '');
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: _colours[id % _colours.length],
      child: Text(
        initials.toUpperCase(),
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: size * .34,
        ),
      ),
    );
  }
}

class HrCard extends StatelessWidget {
  const HrCard({super.key, required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: kNavy,
                    ),
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class HrKv extends StatelessWidget {
  const HrKv(this.label, this.value, {super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13.5, color: kGrey),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(fontSize: 14, color: Color(0xFF1A2433)),
            ),
          ),
        ],
      ),
    );
  }
}

class HrProgress extends StatelessWidget {
  const HrProgress({super.key, required this.value, this.color = kBlue, this.height = 8});

  final double value;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: LinearProgressIndicator(
        value: value.clamp(0.0, 1.0).toDouble(),
        minHeight: height,
        backgroundColor: const Color(0xFFE9EDF4),
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );
  }
}

class HrEmpty extends StatelessWidget {
  const HrEmpty({super.key, required this.text, this.icon = Icons.inbox_outlined});

  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 16),
      child: Column(
        children: [
          Icon(icon, size: 40, color: kGrey),
          const SizedBox(height: 8),
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: kGrey),
          ),
        ],
      ),
    );
  }
}

class HrStars extends StatelessWidget {
  const HrStars(this.rating, {super.key, this.size = 17});

  final int rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(
        5,
        (i) => Icon(
          i < rating ? Icons.star : Icons.star_border,
          size: size,
          color: kOrange,
        ),
      ),
    );
  }
}
