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

  const coverflow = document.querySelector('[data-solution-coverflow]');
  if (coverflow) {
    const cards = [...coverflow.querySelectorAll('.solution-card')];
    const count = cards.length;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let position = count > 1 ? 1 : 0;
    let target = position;
    let cardWidth = 0;
    let animationFrame = null;
    let drag = null;

    const selectedIndex = value => ((Math.round(value) % count) + count) % count;

    const paint = () => {
      if (!cardWidth || !count) return;
      const pitch = cardWidth * 1.08;
      const selected = selectedIndex(position);

      cards.forEach((card, index) => {
        let offset = index - position;
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;

        const distance = Math.abs(offset);
        const ramp = Math.pow(distance, .62);
        const tilt = Math.min(28 * ramp, 78) * Math.sign(offset);
        const edge = Math.min(1, Math.max(0, (count / 2 - distance) * 2));

        card.style.transform = `translateX(calc(-50% + ${offset * pitch}px)) translateZ(${-cardWidth * .42 * ramp}px) rotateY(${-tilt}deg)`;
        card.style.opacity = String(Math.max(0, 1 - .12 * distance) * edge);
        card.style.zIndex = String(100 - Math.round(distance * 10));
        card.dataset.selected = String(index === selected && distance < .5);
        card.setAttribute('aria-current', index === selected ? 'true' : 'false');
      });
    };

    const settle = next => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      target = next;

      if (reducedMotion) {
        position = target;
        paint();
        return;
      }

      const step = () => {
        const remaining = target - position;
        if (Math.abs(remaining) < .0004) {
          position = target;
          paint();
          animationFrame = null;
          return;
        }
        position += remaining * .16;
        paint();
        animationFrame = requestAnimationFrame(step);
      };
      animationFrame = requestAnimationFrame(step);
    };

    const goTo = index => settle(index + Math.round((target - index) / count) * count);
    const nudge = amount => settle(Math.round(target) + amount);

    coverflow.addEventListener('pointerdown', event => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      coverflow.setPointerCapture(event.pointerId);
      target = position;
      drag = { id: event.pointerId, x: event.clientX, start: position, velocity: 0, time: performance.now(), moved: false };
    });

    coverflow.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || !cardWidth) return;
      const now = performance.now();
      const previous = position;
      const movement = event.clientX - drag.x;
      position = drag.start - movement / (cardWidth * 1.08);
      drag.velocity = ((position - previous) / Math.max(now - drag.time, 1)) * 1000;
      drag.time = now;
      drag.moved = drag.moved || Math.abs(movement) > 6;
      paint();
    });

    const finishDrag = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const carried = Math.max(-2, Math.min(2, drag.velocity * .18));
      settle(Math.round(position + carried));
      window.setTimeout(() => { drag = null; }, 0);
    };

    coverflow.addEventListener('pointerup', finishDrag);
    coverflow.addEventListener('pointercancel', finishDrag);
    coverflow.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudge(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudge(1);
      }
    });

    cards.forEach((card, index) => {
      card.addEventListener('click', event => {
        if (drag?.moved) {
          event.preventDefault();
          return;
        }
        if (selectedIndex(position) !== index) {
          event.preventDefault();
          goTo(index);
        }
      });
    });

    const measure = () => {
      cardWidth = cards[0]?.offsetWidth || 0;
      paint();
    };
    measure();
    new ResizeObserver(measure).observe(coverflow);
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
      if (!message && field.name === 'email') {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!isEmail) message = 'Informe um e-mail válido.';
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
