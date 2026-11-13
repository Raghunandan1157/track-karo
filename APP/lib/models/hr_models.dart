/// HRMS models for the mobile app (demo data - no server).
class HrEmployee {
  const HrEmployee({
    required this.id,
    required this.code,
    required this.name,
    required this.designation,
    required this.department,
    required this.branch,
    required this.email,
    required this.phone,
    required this.doj,
    required this.status,
    required this.employmentType,
    required this.ctc,
    required this.shift,
    required this.workMode,
    this.managerName = '',
    this.dob = '',
    this.bloodGroup = '',
    this.emergencyName = '',
    this.emergencyPhone = '',
    this.pan = '',
    this.uan = '',
    this.bankName = '',
    this.bankLast4 = '',
    this.ifsc = '',
    this.address = '',
  });

  final int id;
  final String code;
  final String name;
  final String designation;
  final String department;
  final String branch;
  final String email;
  final String phone;
  final String doj;
  final String status;
  final String employmentType;
  final double ctc;
  final String shift;
  final String workMode;
  final String managerName;
  final String dob;
  final String bloodGroup;
  final String emergencyName;
  final String emergencyPhone;
  final String pan;
  final String uan;
  final String bankName;
  final String bankLast4;
  final String ifsc;
  final String address;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  String get statusLabel {
    switch (status) {
      case 'probation':
        return 'Probation';
      case 'notice':
        return 'Notice period';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Active';
    }
  }

  String get employmentLabel {
    switch (employmentType) {
      case 'part_time':
        return 'Part time';
      case 'contract':
        return 'Contract';
      case 'intern':
        return 'Intern';
      default:
        return 'Full time';
    }
  }

  HrEmployee copyWith({String? status}) => HrEmployee(
        id: id,
        code: code,
        name: name,
        designation: designation,
        department: department,
        branch: branch,
        email: email,
        phone: phone,
        doj: doj,
        status: status ?? this.status,
        employmentType: employmentType,
        ctc: ctc,
        shift: shift,
        workMode: workMode,
        managerName: managerName,
        dob: dob,
        bloodGroup: bloodGroup,
        emergencyName: emergencyName,
        emergencyPhone: emergencyPhone,
        pan: pan,
        uan: uan,
        bankName: bankName,
        bankLast4: bankLast4,
        ifsc: ifsc,
        address: address,
      );
}

class HrAttendance {
  const HrAttendance({
    required this.date,
    required this.status,
    this.inTime = '',
    this.outTime = '',
    this.workedMin = 0,
    this.otMin = 0,
    this.note = '',
  });

  final String date;
  final String status;
  final String inTime;
  final String outTime;
  final int workedMin;
  final int otMin;
  final String note;

  String get label {
    switch (status) {
      case 'late':
        return 'Late';
      case 'half_day':
        return 'Half day';
      case 'absent':
        return 'Absent';
      case 'leave':
        return 'On leave';
      case 'wfh':
        return 'Work from home';
      case 'field':
        return 'On field';
      default:
        return 'Present';
    }
  }
}

class HrLeave {
  const HrLeave({
    required this.id,
    required this.employeeId,
    required this.type,
    required this.from,
    required this.to,
    required this.days,
    required this.reason,
    required this.status,
    required this.appliedAt,
    this.contact = '',
  });

  final int id;
  final int employeeId;
  final String type;
  final String from;
  final String to;
  final int days;
  final String reason;
  final String status;
  final String appliedAt;
  final String contact;

  String get typeLabel {
    switch (type) {
      case 'sick':
        return 'Sick leave';
      case 'earned':
        return 'Earned leave';
      case 'comp_off':
        return 'Comp off';
      case 'unpaid':
        return 'Unpaid leave';
      case 'maternity':
        return 'Maternity leave';
      default:
        return 'Casual leave';
    }
  }

  String get statusLabel {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  }

  HrLeave copyWith({String? status}) => HrLeave(
        id: id,
        employeeId: employeeId,
        type: type,
        from: from,
        to: to,
        days: days,
        reason: reason,
        status: status ?? this.status,
        appliedAt: appliedAt,
        contact: contact,
      );
}

class HrLeaveBalance {
  const HrLeaveBalance({
    required this.type,
    required this.label,
    required this.total,
    required this.used,
  });

  final String type;
  final String label;
  final int total;
  final int used;

  int get left => (total - used).clamp(0, total).toInt();
}

class HrPayslip {
  const HrPayslip({
    required this.month,
    required this.monthLabel,
    required this.status,
    required this.daysPaid,
    required this.basic,
    required this.hra,
    required this.conveyance,
    required this.special,
    required this.pf,
    required this.esi,
    required this.professionalTax,
    required this.tds,
    required this.lopAmount,
    required this.gross,
    required this.deductions,
    required this.net,
  });

  final String month;
  final String monthLabel;
  final String status;
  final int daysPaid;
  final double basic;
  final double hra;
  final double conveyance;
  final double special;
  final double pf;
  final double esi;
  final double professionalTax;
  final double tds;
  final double lopAmount;
  final double gross;
  final double deductions;
  final double net;

  String get statusLabel {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'processed':
        return 'Processed';
      default:
        return 'Draft';
    }
  }
}

class HrDocument {
  const HrDocument({
    required this.type,
    required this.number,
    this.expiresOn = '',
    this.status = 'valid',
  });

  final String type;
  final String number;
  final String expiresOn;
  final String status;

  String get typeLabel {
    switch (type) {
      case 'aadhaar':
        return 'Aadhaar card';
      case 'pan':
        return 'PAN card';
      case 'offer':
        return 'Offer letter';
      case 'contract':
        return 'Employment contract';
      case 'licence':
        return 'Driving licence';
      case 'insurance':
        return 'Health insurance';
      default:
        return type;
    }
  }

  String get statusLabel {
    switch (status) {
      case 'expiring':
        return 'Expiring';
      case 'expired':
        return 'Expired';
      default:
        return 'Valid';
    }
  }
}

class HrMonthSummary {
  const HrMonthSummary({
    required this.working,
    required this.present,
    required this.late,
    required this.halfDay,
    required this.leave,
    required this.absent,
    required this.otMin,
  });

  final int working;
  final int present;
  final int late;
  final int halfDay;
  final int leave;
  final int absent;
  final int otMin;

  double get presentDays => present.toDouble() + halfDay * 0.5;

  int get attendancePct => working == 0 ? 0 : ((presentDays / working) * 100).round();
}
