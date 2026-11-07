import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

typedef PickedPhoto = ({Uint8List bytes, String mimeType});

/// Takes or chooses a receipt photo, scaled down so uploads stay around half a megabyte.
Future<PickedPhoto?> pickReceiptPhoto({required bool camera}) async {
  final file = await ImagePicker().pickImage(
    source: camera ? ImageSource.camera : ImageSource.gallery,
    maxWidth: 1600,
    maxHeight: 2400,
    imageQuality: 80,
  );
  if (file == null) return null;
  return (bytes: await file.readAsBytes(), mimeType: file.mimeType ?? _mimeFromName(file.name));
}

String _mimeFromName(String name) {
  final lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}
