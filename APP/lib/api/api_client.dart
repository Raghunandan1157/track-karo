import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;

  /// HTTP status, or null when the request never reached the server.
  final int? status;

  bool get isOffline => status == null;

  @override
  String toString() => message;
}

/// Thin JSON client for the Track_karo backend (see API.md).
class Api {
  Api._();
  static final Api instance = Api._();

  String? token;

  /// Called on any 401 (except /login) so the app can log out.
  void Function()? onUnauthorized;

  final http.Client _client = http.Client();
  static const Duration _timeout = Duration(seconds: 25);

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final q = <String, String>{};
    query?.forEach((k, v) {
      if (v != null && '$v'.isNotEmpty) q[k] = '$v';
    });
    final u = Uri.parse('$kApiBase$path');
    return q.isEmpty ? u : u.replace(queryParameters: q);
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _send('GET', path, query: query);

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _send('POST', path, body: body ?? const {});

  Future<dynamic> put(String path, [Map<String, dynamic>? body]) =>
      _send('PUT', path, body: body ?? const {});

  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path,
      {Map<String, dynamic>? query, Map<String, dynamic>? body}) async {
    http.Response res;
    try {
      final req = http.Request(method, _uri(path, query));
      req.headers.addAll(_headers);
      if (body != null) req.body = jsonEncode(body);
      res = await http.Response.fromStream(
          await _client.send(req).timeout(_timeout));
    } on TimeoutException {
      throw ApiException('The server took too long to answer. Try again.');
    } on SocketException {
      throw ApiException('No internet connection.');
    } on http.ClientException {
      throw ApiException('No internet connection.');
    } catch (_) {
      throw ApiException('Could not reach the server.');
    }

    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = null;
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data ?? <String, dynamic>{};
    }

    String msg = 'Something went wrong (${res.statusCode}).';
    if (data is Map && data['error'] != null) msg = '${data['error']}';
    if (res.statusCode == 401 && path != '/login') {
      onUnauthorized?.call();
      msg = 'Please log in again.';
    }
    throw ApiException(msg, status: res.statusCode);
  }
}
