"""Log a browser page into a throwaway account so first person can be entered without the account dialog."""
import random

PASSWORD = 'check-password-1'

LOGIN_JS = '''async ([name, password]) => {
  await terrain3d.shop.whenReady;
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1];
  const request = path => fetch(path, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-CSRFToken': csrf}, body: JSON.stringify({name, password})});
  const registered = await request('/api/account/register');
  if (!registered.ok && !(await request('/api/account/login')).ok) throw Error('check account login failed');
  await terrain3d.shop.refresh();
  return terrain3d.shop.state.name;
}'''


def random_name(prefix='검사'):
    return prefix + str(random.randint(100000, 999999))


def login(page, name=None):
    """Register (or log back in) and return the account name; call after window.terrain3d is ready."""
    return page.evaluate(LOGIN_JS, [name or random_name(), PASSWORD])
