from functools import wraps
from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied
from django.urls import reverse


def office_required(permission=None):
    """Staff only; an optional Django permission (e.g. 'webapp.change_item') gates write pages.

    Anonymous visitors go to the office login; signed-in users without the permission get 403.
    """
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated:
                return redirect_to_login(request.get_full_path(), reverse('office:login'))
            if not user.is_active or not user.is_staff:
                raise PermissionDenied
            if permission and not user.has_perm(permission):
                raise PermissionDenied
            return view(request, *args, **kwargs)
        return wrapped
    return decorator
