export function NotifierMiddlewareProvider(Notifier) {
  const notifier = new Notifier();

  return () => (next) => (action) => {
    if (action.error) {
      notifier.error(action.payload);
    }

    return next(action);
  };
}
