(() => {
  const CONTACT_ENDPOINT = '';
  const header = document.querySelector('[data-header]');
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-navigation');
  const navLinks = [...document.querySelectorAll('.main-nav a')];

  const closeMenu = () => {
    header?.classList.remove('menu-open');
    document.body.classList.remove('menu-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Abrir menu');
  };

  menuToggle?.addEventListener('click', () => {
    const willOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
    header?.classList.toggle('menu-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
    menuToggle.setAttribute('aria-expanded', String(willOpen));
    menuToggle.setAttribute('aria-label', willOpen ? 'Fechar menu' : 'Abrir menu');
  });
  navLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  const revealItems = [...document.querySelectorAll('.reveal')];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    revealItems.forEach(item => item.classList.add('visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -40px' });
    revealItems.forEach(item => revealObserver.observe(item));
  }

  const sections = [...document.querySelectorAll('main section[id]')];
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver(entries => {
      const current = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!current) return;
      navLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${current.target.id}`;
        link.toggleAttribute('aria-current', active);
      });
    }, { threshold: [.2, .45, .65], rootMargin: '-20% 0px -55%' });
    sections.forEach(section => navObserver.observe(section));
  }

  document.querySelector('#footer-year').textContent = new Date().getFullYear();

  const form = document.querySelector('#contact-form');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('.form-submit');

  const showError = (field, message) => {
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    const error = field.parentElement.querySelector('.field-error');
    if (error) error.textContent = message;
  };

  const validate = () => {
    let valid = true;
    form.querySelectorAll('input, textarea').forEach(field => {
      let message = '';
      const value = field.value.trim();
      if (field.required && !value) message = 'Preencha este campo.';
      if (!message && field.name === 'channel') {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isPhone = value.replace(/\D/g, '').length >= 10;
        if (!isEmail && !isPhone) message = 'Informe um e-mail ou WhatsApp válido.';
      }
      showError(field, message);
      if (message) valid = false;
    });
    return valid;
  };

  form.querySelectorAll('input, textarea').forEach(field => field.addEventListener('input', () => showError(field, '')));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.className = 'form-status';
    status.textContent = '';
    if (!validate()) {
      status.classList.add('error');
      status.textContent = 'Revise os campos destacados.';
      return;
    }
    if (!CONTACT_ENDPOINT) {
      status.classList.add('error');
      status.textContent = 'O envio online ainda não está configurado. Nenhum dado foi enviado.';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Enviando…';
    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (!response.ok) throw new Error('Falha no envio');
      form.reset();
      status.classList.add('success');
      status.textContent = 'Mensagem enviada. Em breve a Trivium entra em contato.';
    } catch {
      status.classList.add('error');
      status.textContent = 'Não foi possível enviar agora. Tente novamente em alguns instantes.';
    } finally {
      submit.disabled = false;
      submit.textContent = submit.dataset.defaultLabel;
    }
  });
})();
