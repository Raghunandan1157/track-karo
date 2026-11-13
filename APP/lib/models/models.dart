// Plain data classes for the objects in API.md.
// Parsing is deliberately tolerant: numbers may arrive as strings, fields may
// be missing, and nothing here should throw on unexpected data.

double? asDouble(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse('$v');
}

int asInt(dynamic v, [int fallback = 0]) {
  if (v == null) return fallback;
  if (v is num) return v.round();
  return double.tryParse('$v')?.round() ?? fallback;
}

String asStr(dynamic v, [String fallback = '']) =>
    v == null ? fallback : '$v';

bool asBool(dynamic v) => v == true || v == 1 || v == 'true' || v == 't';

DateTime? asTime(dynamic v) {
  if (v == null || '$v'.isEmpty) return null;
  return DateTime.tryParse('$v')?.toLocal();
}

List<Map<String, dynamic>> asList(dynamic v) {
  if (v is! List) return const [];
  return v
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
}

Map<String, dynamic> asMap(dynamic v) =>
    v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

class User {
  User({
    required this.id,
    required this.userid,
    required this.name,
    required this.role,
    this.branchId,
    this.branchName = '',
    this.phone = '',
  });

  final String id;
  final String userid;
  final String name;
  final String role; // admin | branch_manager | field_officer | recovery_manager
  final String? branchId;
  final String branchName;
  final String phone;

  bool get isOfficer => role == 'field_officer';
  bool get isAdmin => role == 'admin';
  bool get isRecoveryManager => role == 'recovery_manager';

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: asStr(j['id']),
        userid: asStr(j['userid']),
        name: asStr(j['name']),
        role: asStr(j['role']),
        branchId: j['branch_id'] == null ? null : asStr(j['branch_id']),
        branchName: asStr(j['branch_name']),
        phone: asStr(j['phone']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'userid': userid,
        'name': name,
        'role': role,
        'branch_id': branchId,
        'branch_name': branchName,
        'phone': phone,
      };
}

class Officer {
  Officer({
    required this.id,
    this.userid = '',
    this.name = '',
    this.phone = '',
    this.branchId,
    this.branchName = '',
    this.status = 'off_duty',
    this.lat,
    this.lng,
    this.lastPointAt,
    this.battery,
    this.distanceM = 0,
    this.startedAt,
    this.endedAt,
    this.assignmentsTotal = 0,
    this.assignmentsVisited = 0,
  });

  final String id;
  String userid;
  String name;
  String phone;
  String? branchId;
  String branchName;
  String status;
  double? lat;
  double? lng;
  DateTime? lastPointAt;
  int? battery;
  double distanceM;
  DateTime? startedAt;
  DateTime? endedAt;
  int assignmentsTotal;
  int assignmentsVisited;

  bool get hasPosition => lat != null && lng != null;

  factory Officer.fromJson(Map<String, dynamic> j) => Officer(
        id: asStr(j['id']),
        userid: asStr(j['userid']),
        name: asStr(j['name']),
        phone: asStr(j['phone']),
        branchId: j['branch_id'] == null ? null : asStr(j['branch_id']),
        branchName: asStr(j['branch_name']),
        status: asStr(j['status'], 'off_duty'),
        lat: asDouble(j['lat']),
        lng: asDouble(j['lng']),
        lastPointAt: asTime(j['last_point_at']),
        battery: j['battery'] == null ? null : asInt(j['battery']),
        distanceM: asDouble(j['distance_m']) ?? 0,
        startedAt: asTime(j['started_at']),
        endedAt: asTime(j['ended_at']),
        assignmentsTotal: asInt(j['assignments_total']),
        assignmentsVisited: asInt(j['assignments_visited']),
      );
}

class Assignment {
  Assignment({
    required this.id,
    this.officerId = '',
    this.officerName = '',
    this.day = '',
    this.name = '',
    this.kind = 'center',
    this.address = '',
    this.lat,
    this.lng,
    this.radiusM = 60,
    this.visited = false,
    this.firstEnterAt,
    this.timeSpentMin = 0,
  });

  final String id;
  final String officerId;
  final String officerName;
  final String day;
  final String name;
  final String kind; // center | village
  final String address;
  final double? lat;
  final double? lng;
  final double radiusM;
  final bool visited;
  final DateTime? firstEnterAt;
  final int timeSpentMin;

  bool get hasPosition => lat != null && lng != null;

  factory Assignment.fromJson(Map<String, dynamic> j) => Assignment(
        id: asStr(j['id']),
        officerId: asStr(j['officer_id']),
        officerName: asStr(j['officer_name']),
        day: asStr(j['day']),
        name: asStr(j['name']),
        kind: asStr(j['kind'], 'center'),
        address: asStr(j['address']),
        lat: asDouble(j['lat']),
        lng: asDouble(j['lng']),
        radiusM: asDouble(j['radius_m']) ?? 60,
        visited: asBool(j['visited']),
        firstEnterAt: asTime(j['first_enter_at']),
        timeSpentMin: asInt(j['time_spent_min']),
      );
}

class CustomerLite {
  CustomerLite({required this.id, this.name = '', this.village = '', this.phone = ''});
  final String id;
  final String name;
  final String village;
  final String phone;

  factory CustomerLite.fromJson(Map<String, dynamic> j) => CustomerLite(
        id: asStr(j['id']),
        name: asStr(j['name']),
        village: asStr(j['village']),
        phone: asStr(j['phone']),
      );
}

class CustomerVisit {
  CustomerVisit({
    this.id = '',
    this.customerId = '',
    this.customerName = '',
    this.ts,
    this.lat,
    this.lng,
  });
  final String id;
  final String customerId;
  final String customerName;
  final DateTime? ts;
  final double? lat;
  final double? lng;

  factory CustomerVisit.fromJson(Map<String, dynamic> j) => CustomerVisit(
        id: asStr(j['id']),
        customerId: asStr(j['customer_id']),
        customerName: asStr(j['customer_name']),
        ts: asTime(j['ts']),
        lat: asDouble(j['lat']),
        lng: asDouble(j['lng']),
      );
}

class Duty {
  Duty({this.startedAt, this.endedAt, this.distanceM = 0, this.locationOn = true});
  final DateTime? startedAt;
  final DateTime? endedAt;
  final double distanceM;
  final bool locationOn;

  bool get active => startedAt != null && endedAt == null;

  factory Duty.fromJson(Map<String, dynamic> j) => Duty(
        startedAt: asTime(j['started_at']),
        endedAt: asTime(j['ended_at']),
        distanceM: asDouble(j['distance_m']) ?? 0,
        locationOn: j['location_on'] == null ? true : asBool(j['location_on']),
      );
}

class Lunch {
  Lunch({this.active = false, this.startedAt, this.minutesToday = 0, this.allowedMin = 60});
  final bool active;
  final DateTime? startedAt;
  final int minutesToday;
  final int allowedMin;

  factory Lunch.fromJson(Map<String, dynamic> j) => Lunch(
        active: asBool(j['active']),
        startedAt: asTime(j['started_at']),
        minutesToday: asInt(j['minutes_today']),
        allowedMin: asInt(j['allowed_min'], 60),
      );
}

class DutyToday {
  DutyToday({
    this.day = '',
    this.duty,
    required this.lunch,
    this.assignments = const [],
    this.customerVisits = const [],
    required this.fetchedAt,
  });
  final String day;
  final Duty? duty;
  final Lunch lunch;
  final List<Assignment> assignments;
  final List<CustomerVisit> customerVisits;
  final DateTime fetchedAt;

  bool get dayActive => duty?.active ?? false;
  bool get dayEnded => duty?.endedAt != null;

  factory DutyToday.fromJson(Map<String, dynamic> j) {
    final settings = asMap(j['settings']);
    final lunchJson = asMap(j['lunch']);
    if (lunchJson['allowed_min'] == null && settings['lunch_allowed_min'] != null) {
      lunchJson['allowed_min'] = settings['lunch_allowed_min'];
    }
    return DutyToday(
      day: asStr(j['day']),
      duty: j['duty'] is Map ? Duty.fromJson(asMap(j['duty'])) : null,
      lunch: Lunch.fromJson(lunchJson),
      assignments: asList(j['assignments']).map(Assignment.fromJson).toList(),
      customerVisits:
          asList(j['customer_visits']).map(CustomerVisit.fromJson).toList(),
      fetchedAt: DateTime.now(),
    );
  }
}

class AlertItem {
  AlertItem({
    required this.id,
    this.type = '',
    this.title = '',
    this.body = '',
    this.officerName = '',
    this.branchName = '',
    this.createdAt,
    this.readAt,
  });
  final String id;
  final String type;
  final String title;
  final String body;
  final String officerName;
  final String branchName;
  final DateTime? createdAt;
  DateTime? readAt;

  bool get unread => readAt == null;

  factory AlertItem.fromJson(Map<String, dynamic> j) => AlertItem(
        id: asStr(j['id']),
        type: asStr(j['type']),
        title: asStr(j['title']),
        body: asStr(j['body']),
        officerName: asStr(j['officer_name']),
        branchName: asStr(j['branch_name']),
        createdAt: asTime(j['created_at']),
        readAt: asTime(j['read_at']),
      );
}

class BranchPin {
  BranchPin({required this.id, this.name = '', this.address = '', this.lat, this.lng, this.managerNames = ''});
  final String id;
  final String name;
  final String address;
  final double? lat;
  final double? lng;
  final String managerNames;

  factory BranchPin.fromJson(Map<String, dynamic> j) {
    final m = j['manager_names'];
    return BranchPin(
      id: asStr(j['id']),
      name: asStr(j['name']),
      address: asStr(j['address']),
      lat: asDouble(j['lat']),
      lng: asDouble(j['lng']),
      managerNames: m is List ? m.join(', ') : asStr(m),
    );
  }
}

class CustomerPin {
  CustomerPin({required this.id, this.name = '', this.village = '', this.lat, this.lng, this.locatedAt});
  final String id;
  String name;
  String village;
  double? lat;
  double? lng;
  DateTime? locatedAt;

  factory CustomerPin.fromJson(Map<String, dynamic> j) => CustomerPin(
        id: asStr(j['id']),
        name: asStr(j['name']),
        village: asStr(j['village']),
        lat: asDouble(j['lat']),
        lng: asDouble(j['lng']),
        locatedAt: asTime(j['located_at']),
      );
}

class TrackPoint {
  TrackPoint(this.lat, this.lng, this.ts);
  final double lat;
  final double lng;
  final DateTime? ts;
}

class TrackStop {
  TrackStop({this.lat, this.lng, this.start, this.end, this.minutes = 0, this.kind = '', this.name = ''});
  final double? lat;
  final double? lng;
  final DateTime? start;
  final DateTime? end;
  final int minutes;
  final String kind;
  final String name;

  factory TrackStop.fromJson(Map<String, dynamic> j) => TrackStop(
        lat: asDouble(j['lat']),
        lng: asDouble(j['lng']),
        start: asTime(j['start'] ?? j['enter_at']),
        end: asTime(j['end'] ?? j['exit_at']),
        minutes: asInt(j['minutes']),
        kind: asStr(j['kind']),
        name: asStr(j['name']),
      );
}

class TrackData {
  TrackData({
    this.day = '',
    this.distanceM = 0,
    this.points = const [],
    this.assignments = const [],
    this.visits = const [],
    this.stops = const [],
    this.customerVisits = const [],
  });
  final String day;
  final double distanceM;
  final List<TrackPoint> points;
  final List<Assignment> assignments;
  final List<TrackStop> visits;
  final List<TrackStop> stops;
  final List<CustomerVisit> customerVisits;

  factory TrackData.fromJson(Map<String, dynamic> j) {
    final pts = <TrackPoint>[];
    for (final p in asList(j['points'])) {
      final la = asDouble(p['lat']), ln = asDouble(p['lng']);
      if (la != null && ln != null) pts.add(TrackPoint(la, ln, asTime(p['ts'])));
    }
    return TrackData(
      day: asStr(j['day']),
      distanceM: asDouble(j['distance_m']) ?? 0,
      points: pts,
      assignments: asList(j['assignments']).map(Assignment.fromJson).toList(),
      visits: asList(j['visits']).map(TrackStop.fromJson).toList(),
      stops: asList(j['stops']).map(TrackStop.fromJson).toList(),
      customerVisits:
          asList(j['customer_visits']).map(CustomerVisit.fromJson).toList(),
    );
  }
}

class VisitDetail {
  VisitDetail({this.name = '', this.kind = '', this.visited = false, this.enterAt, this.exitAt, this.minutes = 0});
  final String name;
  final String kind;
  final bool visited;
  final DateTime? enterAt;
  final DateTime? exitAt;
  final int minutes;

  factory VisitDetail.fromJson(Map<String, dynamic> j) => VisitDetail(
        name: asStr(j['name']),
        kind: asStr(j['kind']),
        visited: asBool(j['visited']),
        enterAt: asTime(j['enter_at']),
        exitAt: asTime(j['exit_at']),
        minutes: asInt(j['minutes']),
      );
}

class DailyReport {
  DailyReport({
    this.officerId = '',
    this.officerName = '',
    this.branchName = '',
    this.startedAt,
    this.endedAt,
    this.dutyMinutes = 0,
    this.distanceKm = 0,
    this.centersAssigned = 0,
    this.centersVisited = 0,
    this.villagesAssigned = 0,
    this.villagesVisited = 0,
    this.visitDetails = const [],
    this.timeAtLocationsMin = 0,
    this.missed = const [],
    this.lunchMinutes = 0,
    this.lunchAllowedMin = 60,
    this.lunchExcessMin = 0,
    this.unexplainedStops = const [],
    this.unexplainedStopMin = 0,
    this.longBreak = false,
    this.customersCaptured = 0,
    this.locationOffCount = 0,
  });

  final String officerId;
  final String officerName;
  final String branchName;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final int dutyMinutes;
  final double distanceKm;
  final int centersAssigned;
  final int centersVisited;
  final int villagesAssigned;
  final int villagesVisited;
  final List<VisitDetail> visitDetails;
  final int timeAtLocationsMin;
  final List<String> missed;
  final int lunchMinutes;
  final int lunchAllowedMin;
  final int lunchExcessMin;
  final List<TrackStop> unexplainedStops;
  final int unexplainedStopMin;
  final bool longBreak;
  final int customersCaptured;
  final int locationOffCount;

  factory DailyReport.fromJson(Map<String, dynamic> j) => DailyReport(
        officerId: asStr(j['officer_id']),
        officerName: asStr(j['officer_name']),
        branchName: asStr(j['branch_name']),
        startedAt: asTime(j['started_at']),
        endedAt: asTime(j['ended_at']),
        dutyMinutes: asInt(j['duty_minutes']),
        distanceKm: asDouble(j['distance_km']) ?? 0,
        centersAssigned: asInt(j['centers_assigned']),
        centersVisited: asInt(j['centers_visited']),
        villagesAssigned: asInt(j['villages_assigned']),
        villagesVisited: asInt(j['villages_visited']),
        visitDetails:
            asList(j['visit_details']).map(VisitDetail.fromJson).toList(),
        timeAtLocationsMin: asInt(j['time_at_locations_min']),
        missed: j['missed'] is List
            ? (j['missed'] as List).map((e) => '$e').toList()
            : const [],
        lunchMinutes: asInt(j['lunch_minutes']),
        lunchAllowedMin: asInt(j['lunch_allowed_min'], 60),
        lunchExcessMin: asInt(j['lunch_excess_min']),
        unexplainedStops:
            asList(j['unexplained_stops']).map(TrackStop.fromJson).toList(),
        unexplainedStopMin: asInt(j['unexplained_stop_min']),
        longBreak: asBool(j['long_break']),
        customersCaptured: asInt(j['customers_captured']),
        locationOffCount: asInt(j['location_off_count']),
      );
}

class PlaceResult {
  PlaceResult({this.name = '', this.address = '', this.lat, this.lng});
  final String name;
  final String address;
  final double? lat;
  final double? lng;

  factory PlaceResult.fromJson(Map<String, dynamic> j) => PlaceResult(
        name: asStr(j['name']),
        address: asStr(j['address']),
        lat: asDouble(j['lat']),
        lng: asDouble(j['lng']),
      );
}
