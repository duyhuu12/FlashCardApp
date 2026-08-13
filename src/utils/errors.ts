export function friendlyError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Email này đã được sử dụng.',
    'auth/invalid-email': 'Email không hợp lệ.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.',
    'auth/network-request-failed': 'Không thể kết nối mạng. Vui lòng thử lại.',
    'permission-denied': 'Bạn không có quyền thực hiện thao tác này.',
    unavailable: 'Dịch vụ đang tạm gián đoạn. Vui lòng thử lại.',
  };

  if (messages[code]) return messages[code];
  if (error instanceof Error) return error.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
