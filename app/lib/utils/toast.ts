import { toast as baseToast, type ToastOptions } from 'react-toastify';

const defaultOptions: ToastOptions = {
  position: 'bottom-right',
  autoClose: 3000,
};

function mergeOptions(options?: ToastOptions) {
  return { ...defaultOptions, ...options };
}

export function showSuccess(message: string, options?: ToastOptions) {
  baseToast.success(message, mergeOptions(options));
}

export function showError(message: string, options?: ToastOptions) {
  baseToast.error(message, mergeOptions(options));
}

export function showInfo(message: string, options?: ToastOptions) {
  baseToast.info(message, mergeOptions(options));
}

export function showWarning(message: string, options?: ToastOptions) {
  baseToast.warning(message, mergeOptions(options));
}
