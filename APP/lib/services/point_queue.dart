import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../config.dart';

/// Location points waiting to be uploaded. Kept in memory and mirrored to a
/// JSON-lines file so they survive app restarts and long offline periods.
class PointQueue {
  final List<Map<String, dynamic>> _items = [];
  File? _file;
  bool _loaded = false;
  bool _dirty = false;
  bool _saving = false;
  Timer? _saveTimer;

  int get length => _items.length;
  bool get isEmpty => _items.isEmpty;

  Future<void> init() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final dir = await getApplicationSupportDirectory();
      _file = File('${dir.path}/point_queue.jsonl');
      if (await _file!.exists()) {
        final lines = await _file!.readAsLines();
        for (final line in lines) {
          if (line.trim().isEmpty) continue;
          try {
            final m = jsonDecode(line);
            if (m is Map) _items.add(Map<String, dynamic>.from(m));
          } catch (_) {
            // skip a half-written line
          }
        }
      }
    } catch (_) {
      // Storage unavailable: keep working from memory.
    }
  }

  void add(Map<String, dynamic> point) {
    _items.add(point);
    if (_items.length > kMaxQueuedPoints) {
      _items.removeRange(0, _items.length - kMaxQueuedPoints);
    }
    _markDirty();
  }

  /// Oldest [max] points (not removed).
  List<Map<String, dynamic>> peek(int max) =>
      _items.take(max).toList(growable: false);

  /// Drop exactly the points that were uploaded (matched by identity).
  void removeUploaded(List<Map<String, dynamic>> sent) {
    final set = Set<Map<String, dynamic>>.identity()..addAll(sent);
    _items.removeWhere(set.contains);
    _markDirty();
  }

  Future<void> clear() async {
    _items.clear();
    await saveNow();
  }

  void _markDirty() {
    _dirty = true;
    _saveTimer ??= Timer(const Duration(seconds: 2), () {
      _saveTimer = null;
      saveNow();
    });
  }

  Future<void> saveNow() async {
    final f = _file;
    if (f == null || _saving) return;
    _saving = true;
    _dirty = false;
    try {
      final tmp = File('${f.path}.tmp');
      final sb = StringBuffer();
      for (final m in List<Map<String, dynamic>>.of(_items)) {
        sb.writeln(jsonEncode(m));
      }
      await tmp.writeAsString(sb.toString(), flush: true);
      await tmp.rename(f.path);
    } catch (_) {
      _dirty = true;
    } finally {
      _saving = false;
    }
    if (_dirty) _markDirty();
  }
}
