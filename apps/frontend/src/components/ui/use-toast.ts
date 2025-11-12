type ToastOptions = {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    const message = description ? `${title} — ${description}` : title;

    if (variant === 'destructive') {
      console.error(`[toast:error] ${message}`);
    } else {
      console.info(`[toast] ${message}`);
    }
  };

  return { toast };
}


