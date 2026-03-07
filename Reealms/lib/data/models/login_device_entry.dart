class LoginDeviceEntry {
  final String id;
  final String deviceLabel;
  final String platform;
  final DateTime loggedAt;

  const LoginDeviceEntry({
    required this.id,
    required this.deviceLabel,
    required this.platform,
    required this.loggedAt,
  });

  factory LoginDeviceEntry.fromJson(Map<String, dynamic> json) {
    final rawDate = (json['logged_at'] ?? '').toString();
    final parsedDate = DateTime.tryParse(rawDate)?.toLocal();
    return LoginDeviceEntry(
      id: (json['id'] ?? '').toString(),
      deviceLabel: (json['device_label'] ?? 'Perangkat tidak dikenal')
          .toString(),
      platform: (json['platform'] ?? 'unknown').toString(),
      loggedAt: parsedDate ?? DateTime.now(),
    );
  }
}
