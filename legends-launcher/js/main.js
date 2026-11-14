/* Legend Launcher — интерактив */

/* =========================================================
   СКАЧИВАНИЕ КЛИЕНТА (для статики / GitHub Pages)
   Вставь сюда прямую ссылку на файл лаунчера, например на
   GitHub Release: https://github.com/user/repo/releases/download/v1/legend-setup.exe
   На сервере с Node.js файл отдаётся защищённо из папки private/.
   ========================================================= */
const CLIENT_DOWNLOAD_URL = '';

const THEME_KEY = 'legend_theme';

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- шапка при скролле ---------- */
  const header = document.getElementById('header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- мобильное меню ---------- */
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');

  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      nav.classList.remove('is-open');
      burger.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  });

  /* ---------- появление блоков при скролле ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;

      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      const index = siblings.indexOf(el);
      el.style.transitionDelay = `${Math.min(index, 5) * 80}ms`;

      el.classList.add('is-visible');
      revealObserver.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  /* ---------- анимация чисел ---------- */
  const animateCounter = (el) => {
    const target = parseFloat(el.dataset.target);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix = el.dataset.prefix || '';
    const duration = 1600;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      el.textContent = prefix + (target * eased).toFixed(decimals).replace('.', ',');
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('.counter').forEach((el) => counterObserver.observe(el));

  /* ---------- живой FPS-счётчик в макете ---------- */
  const fps = document.getElementById('fpsCounter');
  if (fps) {
    let value = 243;
    setInterval(() => {
      const drift = Math.round((Math.random() - 0.45) * 14);
      value = Math.max(198, Math.min(261, value + drift));
      fps.textContent = value;
    }, 900);
  }

  /* ---------- 3D-наклон макета лаунчера ---------- */
  const launcher = document.getElementById('launcher');
  const visual = document.querySelector('.hero__visual');

  if (launcher && visual && window.matchMedia('(pointer: fine)').matches) {
    visual.addEventListener('mousemove', (e) => {
      const rect = visual.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      launcher.style.transform = `rotateY(${-9 + x * 10}deg) rotateX(${3 - y * 8}deg)`;
    });

    visual.addEventListener('mouseleave', () => {
      launcher.style.transform = 'rotateY(-9deg) rotateX(3deg)';
    });
  }

  /* ---------- «прожектор» на карточках возможностей ---------- */
  document.querySelectorAll('.feature').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  /* ---------- переключение ОС в блоке скачивания ---------- */
  const osData = {
    windows: { label: 'Скачать для Windows', size: '.exe · 42 МБ', note: 'Windows 7 / 8 / 10 / 11 · 64-bit · 4 ГБ ОЗУ' },
    macos:   { label: 'Скачать для macOS',   size: '.dmg · 48 МБ', note: 'macOS 11 Big Sur и новее · Intel / Apple Silicon' },
    linux:   { label: 'Скачать для Linux',   size: '.AppImage · 45 МБ', note: 'Ubuntu 20.04+, Fedora, Arch · 64-bit · 4 ГБ ОЗУ' }
  };

  const tabs = document.querySelectorAll('.os__tab');
  const btnLabel = document.querySelector('.download__btn-label');
  const btnSize = document.querySelector('#downloadBtn .btn__size');
  const osNote = document.getElementById('osNote');

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) setActive('macos');
  else if (ua.includes('linux') && !ua.includes('android')) setActive('linux');

  tabs.forEach((tab) => tab.addEventListener('click', () => setActive(tab.dataset.os)));

  function setActive(os) {
    tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.os === os));
    const data = osData[os];
    btnLabel.textContent = data.label;
    btnSize.textContent = data.size;
    osNote.textContent = data.note;
  }

  /* ---------- тосты ---------- */
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.innerHTML = '<span class="toast__dot"></span><span class="toast__text"></span>';
  document.body.appendChild(toastEl);
  let toastTimer;
  const showToast = (text) => {
    toastEl.querySelector('.toast__text').textContent = text;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3200);
  };

  /* ---------- модалки ---------- */
  const authModal = document.getElementById('authModal');
  const cabinetModal = document.getElementById('cabinetModal');

  const openModal = (modal) => {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = (modal) => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.is-open')) document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => closeModal(el.closest('.modal')));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal.is-open').forEach(closeModal);
  });

  /* =========================================================
     АВТОРИЗАЦИЯ — два режима работы:
     1) Серверный (server.js): коды приходят письмами на почту,
        пароли в scrypt-хешах, скачивание защищено на сервере.
     2) Статический (GitHub Pages): без сервера письма отправить
        нельзя, поэтому код показывается прямо в окне «письма»,
        аккаунты хранятся в браузере. Выглядит и работает так же.
     ========================================================= */

  let localMode = false;   // определяется при загрузке
  let pendingEmail = '';
  let wantDownload = false;

  /* --- локальное хранилище (статический режим) --- */
  const USERS_KEY = 'legend_users';
  const SESSION_KEY = 'legend_session';
  const CODES_KEY = 'legend_codes';

  const getUsers = () => JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const saveUsers = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));
  const getCodes = () => JSON.parse(localStorage.getItem(CODES_KEY) || '{}');
  const saveCodes = (c) => localStorage.setItem(CODES_KEY, JSON.stringify(c));

  const hashText = async (text) => {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return text; // крайний случай (небезопасный контекст вроде file://)
  };

  const makeCode = () => String(Math.floor(100000 + Math.random() * 900000));

  const publicUser = (u) => ({ nickname: u.nickname, email: u.email, joined: u.joined });

  /* --- показ «письма» с кодом (статический режим) --- */
  const codeHints = document.querySelectorAll('.code-hint');
  const showCodeHint = (code) => {
    codeHints.forEach((el) => {
      el.hidden = false;
      el.querySelector('.code-hint__code').textContent = code;
    });
  };
  const hideCodeHints = () => codeHints.forEach((el) => { el.hidden = true; });

  document.querySelectorAll('.code-hint__copy').forEach((btn) =>
    btn.addEventListener('click', () => {
      const code = btn.closest('.code-hint').querySelector('.code-hint__code').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(code);
      showToast('Код скопирован');
    }));

  const issueLocalCode = async (email, type) => {
    const code = makeCode();
    const codes = getCodes();
    codes[`${type}:${email}`] = {
      hash: await hashText(code),
      expiresAt: Date.now() + 10 * 60 * 1000,
      tries: 0
    };
    saveCodes(codes);
    showCodeHint(code);
    return code;
  };

  const checkLocalCode = async (email, type, code) => {
    const codes = getCodes();
    const key = `${type}:${email}`;
    const rec = codes[key];
    if (!rec) return 'Код не найден или уже использован';
    if (rec.expiresAt < Date.now()) {
      delete codes[key];
      saveCodes(codes);
      return 'Срок действия кода истёк — запроси новый';
    }
    if (rec.tries >= 5) {
      delete codes[key];
      saveCodes(codes);
      return 'Слишком много попыток — запроси новый код';
    }
    rec.tries += 1;
    const valid = (await hashText(code)) === rec.hash;
    if (!valid) {
      saveCodes(codes);
      return `Неверный код, попыток осталось: ${5 - rec.tries}`;
    }
    delete codes[key];
    saveCodes(codes);
    return null;
  };

  /* --- общий API: выбирает сервер или браузер --- */
  const authAPI = {
    async me() {
      if (localMode) {
        const email = localStorage.getItem(SESSION_KEY);
        const user = getUsers().find((u) => u.email === email && u.verified);
        return user ? publicUser(user) : null;
      }
      const data = await api('GET', '/api/me');
      return data.loggedIn ? data.user : null;
    },

    async register({ nickname, email, password }) {
      if (localMode) {
        const users = getUsers();
        if (users.some((u) => u.email === email)) throw new Error('Такой e-mail уже зарегистрирован');
        if (users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) throw new Error('Такой никнейм уже занят');
        users.push({
          nickname,
          email,
          hash: await hashText(password),
          verified: false,
          joined: new Date().toISOString()
        });
        saveUsers(users);
        await issueLocalCode(email, 'verify');
        return { email };
      }
      return api('POST', '/api/register', { nickname, email, password });
    },

    async verify({ email, code }) {
      if (localMode) {
        const error = await checkLocalCode(email, 'verify', code);
        if (error) throw new Error(error);
        const users = getUsers();
        const user = users.find((u) => u.email === email);
        if (!user) throw new Error('Код не найден или уже использован');
        user.verified = true;
        saveUsers(users);
        localStorage.setItem(SESSION_KEY, email);
        return { user: publicUser(user) };
      }
      return api('POST', '/api/verify', { email, code });
    },

    async login({ email, password }) {
      if (localMode) {
        const users = getUsers();
        const user = users.find((u) => u.email === email);
        const hash = await hashText(password);
        if (!user || user.hash !== hash) throw new Error('Неверный e-mail или пароль');
        if (!user.verified) {
          await issueLocalCode(email, 'verify');
          const err = new Error('Почта ещё не подтверждена — код отправлен ещё раз');
          err.needVerify = true;
          err.email = email;
          throw err;
        }
        localStorage.setItem(SESSION_KEY, email);
        return { user: publicUser(user) };
      }
      return api('POST', '/api/login', { email, password });
    },

    async logout() {
      if (localMode) {
        localStorage.removeItem(SESSION_KEY);
        return;
      }
      await api('POST', '/api/logout', {});
    },

    async resetRequest({ email }) {
      if (localMode) {
        const user = getUsers().find((u) => u.email === email);
        if (user) await issueLocalCode(email, 'reset');
        return; // одинаковый ответ — не раскрываем, есть ли аккаунт
      }
      return api('POST', '/api/reset/request', { email });
    },

    async resetConfirm({ email, code, password }) {
      if (localMode) {
        const error = await checkLocalCode(email, 'reset', code);
        if (error) throw new Error(error);
        const users = getUsers();
        const user = users.find((u) => u.email === email);
        if (!user) throw new Error('Код не найден или уже использован');
        user.hash = await hashText(password);
        user.verified = true;
        saveUsers(users);
        localStorage.setItem(SESSION_KEY, email);
        return { user: publicUser(user) };
      }
      return api('POST', '/api/reset/confirm', { email, code, password });
    },

    async resend({ email, type }) {
      if (localMode) {
        const user = getUsers().find((u) => u.email === email);
        if (user) {
          if (type === 'verify' && user.verified) return;
          await issueLocalCode(email, type);
        }
        return;
      }
      return api('POST', '/api/resend', { email, type });
    }
  };

  /* --- транспорт к серверу --- */
  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Что-то пошло не так');
      err.needVerify = data.needVerify;
      err.email = data.email;
      throw err;
    }
    return data;
  }

  /* ---------- скачивание клиента (нужна регистрация) ---------- */
  const startDownload = () => {
    if (localMode) {
      if (CLIENT_DOWNLOAD_URL) window.location.href = CLIENT_DOWNLOAD_URL;
      else showToast('Ссылка на скачивание появится совсем скоро');
      return;
    }
    window.location.href = '/api/download';
  };

  document.querySelectorAll('.js-download').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentUser()) {
        wantDownload = true;
        setAuthView('register');
        openModal(authModal);
        showToast('Скачать сможешь после регистрации — это бесплатно');
        return;
      }
      startDownload();
    });
  });

  /* ---------- сообщения после редиректа скачивания ---------- */
  const dlStatus = new URLSearchParams(location.search).get('dl');
  if (dlStatus) {
    const messages = {
      auth: 'Скачивание доступно после входа в аккаунт',
      missing: 'Файл клиента ещё не загружен на сервер',
      limit: 'Слишком много скачиваний — подожди немного'
    };
    if (dlStatus === 'auth') {
      wantDownload = true;
      setAuthView('login');
      openModal(authModal);
    }
    showToast(messages[dlStatus] || 'Что-то пошло не так');
    history.replaceState(null, '', location.pathname);
  }

  /* ---------- окна авторизации ---------- */
  const authTabs = document.getElementById('authTabs');
  const authViews = document.querySelectorAll('[data-auth-view]');

  function setAuthView(name) {
    const isMain = name === 'login' || name === 'register';
    authTabs.style.display = isMain ? '' : 'none';
    authTabs.querySelectorAll('.auth__tab').forEach((t) =>
      t.classList.toggle('is-active', t.dataset.authTab === name));
    authViews.forEach((v) => {
      const active = v.dataset.authView === name;
      v.classList.toggle('is-active', active);
      if (active) clearErrors(v);
    });
    if (name === 'verify') {
      authModal.querySelector('[data-verify-email]').textContent = pendingEmail || 'твою почту';
    }
    if (isMain || name === 'forgot') hideCodeHints();
  }

  authTabs.querySelectorAll('.auth__tab').forEach((tab) =>
    tab.addEventListener('click', () => setAuthView(tab.dataset.authTab)));

  document.querySelectorAll('[data-go]').forEach((btn) =>
    btn.addEventListener('click', () => setAuthView(btn.dataset.go)));

  document.querySelectorAll('[data-resend]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await authAPI.resend({ email: pendingEmail, type: btn.dataset.resend });
        showToast('Код отправлен ещё раз');
      } catch (e) {
        showToast(e.message);
      }
    }));

  /* ---------- валидация ---------- */
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const setError = (input, message) => {
    const field = input.closest('.field');
    field.classList.toggle('has-error', Boolean(message));
    field.querySelector('.field__error').textContent = message || '';
    return !message;
  };

  const clearErrors = (form) => {
    form.querySelectorAll('.field').forEach((f) => {
      f.classList.remove('has-error');
      f.querySelector('.field__error').textContent = '';
    });
    const agreeError = form.querySelector('[data-agree-error]');
    if (agreeError) agreeError.textContent = '';
  };

  const busy = (form, on, text = 'Отправка...') => {
    const btn = form.querySelector('.auth__submit');
    btn.disabled = on;
    if (on) {
      btn.dataset.label = btn.textContent;
      btn.textContent = text;
    } else if (btn.dataset.label) {
      btn.textContent = btn.dataset.label;
    }
  };

  /* ---------- шапка и кабинет ---------- */
  const authOpenBtn = document.getElementById('authOpenBtn');
  const profileBtn = document.getElementById('profileBtn');
  let user = null;
  const currentUser = () => user;

  const updateHeader = () => {
    profileBtn.hidden = !user;
    authOpenBtn.hidden = Boolean(user);
    if (user) {
      profileBtn.querySelector('.profile__avatar').textContent = user.nickname[0].toUpperCase();
      profileBtn.querySelector('.profile__name').textContent = user.nickname;
    }
  };

  function renderCabinet() {
    if (!user) return;
    document.getElementById('cabinetAvatar').textContent = user.nickname[0].toUpperCase();
    document.getElementById('cabinetName').textContent = user.nickname;
    document.getElementById('cabinetMail').textContent = user.email;
    document.getElementById('cabinetSince').textContent = 'Участник с ' +
      new Date(user.joined).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const afterLogin = (loggedIn, message) => {
    user = loggedIn;
    closeModal(authModal);
    updateHeader();
    renderCabinet();
    openModal(cabinetModal);
    showToast(message);
    if (wantDownload) {
      wantDownload = false;
      setTimeout(startDownload, 600);
    }
  };

  authOpenBtn.addEventListener('click', () => {
    setAuthView('login');
    openModal(authModal);
  });

  profileBtn.addEventListener('click', () => {
    renderCabinet();
    openModal(cabinetModal);
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await authAPI.logout(); } catch { /* даже при ошибке выходим на клиенте */ }
    user = null;
    closeModal(cabinetModal);
    updateHeader();
    showToast('Ты вышел из аккаунта');
  });

  /* ---------- регистрация ---------- */
  const registerForm = document.querySelector('[data-auth-view="register"]');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(registerForm);

    const nickname = registerForm.nickname.value.trim();
    const email = registerForm.email.value.trim().toLowerCase();
    const password = registerForm.password.value;
    const password2 = registerForm.password2.value;
    const agree = registerForm.agree.checked;

    let ok = true;
    ok &= setError(registerForm.nickname, nickname.length < 3 || nickname.length > 16 ? 'От 3 до 16 символов' : '');
    ok &= setError(registerForm.email, !emailOk(email) ? 'Проверь e-mail' : '');
    ok &= setError(registerForm.password, password.length < 6 ? 'Минимум 6 символов' : '');
    ok &= setError(registerForm.password2, !password2 ? 'Повтори пароль' : (password2 !== password ? 'Пароли не совпадают' : ''));
    if (!agree) {
      registerForm.querySelector('[data-agree-error]').textContent = 'Нужно согласиться с правилами';
      ok = false;
    }
    if (!ok) return;

    busy(registerForm, true);
    try {
      const data = await authAPI.register({ nickname, email, password });
      pendingEmail = data.email;
      setAuthView('verify');
      showToast('Код подтверждения отправлен');
    } catch (err) {
      if (err.message.includes('e-mail уже')) setError(registerForm.email, err.message);
      else if (err.message.includes('никнейм')) setError(registerForm.nickname, err.message);
      else showToast(err.message);
    } finally {
      busy(registerForm, false);
    }
  });

  /* ---------- подтверждение кода ---------- */
  const verifyForm = document.querySelector('[data-auth-view="verify"]');
  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(verifyForm);

    const code = verifyForm.code.value.trim();
    if (!/^\d{6}$/.test(code)) return setError(verifyForm.code, 'Код — 6 цифр из письма');

    busy(verifyForm, true, 'Проверяем...');
    try {
      const data = await authAPI.verify({ email: pendingEmail, code });
      verifyForm.reset();
      hideCodeHints();
      afterLogin(data.user, `Почта подтверждена. Добро пожаловать, ${data.user.nickname}!`);
    } catch (err) {
      setError(verifyForm.code, err.message);
    } finally {
      busy(verifyForm, false);
    }
  });

  /* ---------- вход ---------- */
  const loginForm = document.querySelector('[data-auth-view="login"]');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(loginForm);

    const email = loginForm.email.value.trim().toLowerCase();
    const password = loginForm.password.value;

    let ok = true;
    ok &= setError(loginForm.email, !emailOk(email) ? 'Проверь e-mail' : '');
    ok &= setError(loginForm.password, !password ? 'Введи пароль' : '');
    if (!ok) return;

    busy(loginForm, true, 'Входим...');
    try {
      const data = await authAPI.login({ email, password });
      loginForm.reset();
      afterLogin(data.user, `С возвращением, ${data.user.nickname}!`);
    } catch (err) {
      if (err.needVerify) {
        pendingEmail = err.email || email;
        setAuthView('verify');
        showToast(err.message);
      } else {
        setError(loginForm.password, err.message);
      }
    } finally {
      busy(loginForm, false);
    }
  });

  /* ---------- сброс пароля, шаг 1 ---------- */
  const forgotForm = document.querySelector('[data-auth-view="forgot"]');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(forgotForm);

    const email = forgotForm.email.value.trim().toLowerCase();
    if (!emailOk(email)) return setError(forgotForm.email, 'Проверь e-mail');

    busy(forgotForm, true, 'Отправляем...');
    try {
      await authAPI.resetRequest({ email });
      pendingEmail = email;
      setAuthView('reset');
      showToast('Если аккаунт существует — код уже у тебя');
    } catch (err) {
      showToast(err.message);
    } finally {
      busy(forgotForm, false);
    }
  });

  /* ---------- сброс пароля, шаг 2 ---------- */
  const resetForm = document.querySelector('[data-auth-view="reset"]');
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(resetForm);

    const code = resetForm.code.value.trim();
    const password = resetForm.password.value;
    const password2 = resetForm.password2.value;

    let ok = true;
    ok &= setError(resetForm.code, !/^\d{6}$/.test(code) ? 'Код — 6 цифр из письма' : '');
    ok &= setError(resetForm.password, password.length < 6 ? 'Минимум 6 символов' : '');
    ok &= setError(resetForm.password2, !password2 ? 'Повтори пароль' : (password2 !== password ? 'Пароли не совпадают' : ''));
    if (!ok) return;

    busy(resetForm, true, 'Сохраняем...');
    try {
      const data = await authAPI.resetConfirm({ email: pendingEmail, code, password });
      resetForm.reset();
      hideCodeHints();
      afterLogin(data.user, 'Пароль обновлён, ты в аккаунте');
    } catch (err) {
      setError(resetForm.code, err.message);
    } finally {
      busy(resetForm, false);
    }
  });

  /* ---------- темы оформления ---------- */
  const themes = document.querySelectorAll('.theme');

  const applyTheme = (value) => {
    const theme = value || 'lime';
    if (theme === 'lime') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    themes.forEach((t) => t.classList.toggle('is-active', t.dataset.themeValue === theme));
  };

  themes.forEach((btn) => btn.addEventListener('click', () => {
    applyTheme(btn.dataset.themeValue);
    showToast(`Тема «${btn.textContent.trim()}» применена`);
  }));

  applyTheme(localStorage.getItem(THEME_KEY));

  /* ---------- определяем режим и проверяем сессию ---------- */
  (async () => {
    try {
      const data = await api('GET', '/api/me');
      localMode = !(data && typeof data.loggedIn === 'boolean');
    } catch {
      localMode = true; // сервера нет — работаем как статический сайт (GitHub Pages)
    }
    try {
      const loggedIn = await authAPI.me();
      if (loggedIn) {
        user = loggedIn;
        renderCabinet();
      }
    } catch { /* пусто */ }
    updateHeader();
  })();

});
