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

  const initScrollReveals = () => {
    const { gsap, ScrollTrigger } = window;
    const revealItems = [...document.querySelectorAll('.reveal')];
    const motionSetting = new URLSearchParams(window.location.search).get('motion');
    const reduceMotion = motionSetting === 'off' || (
      motionSetting !== 'on' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    if (reduceMotion || !gsap || !ScrollTrigger) {
      revealItems.forEach(item => item.classList.add('visible'));
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    revealItems.forEach(item => {
      if (item.matches('.project-showcase')) return;

      const isFeaturedCard = item.matches([
        '.hero-dashboard-wrap',
        '.solution-coverflow',
        '.project-showcase',
        '.person'
      ].join(','));
      const isCard = isFeaturedCard || item.matches('.contact-form');
      const isMainTitle = item.matches([
        '#hero-title',
        '#solutions-title',
        '#project-title',
        '#team-title',
        '#contact-title'
      ].join(','));
      const initialY = isFeaturedCard ? 64 : isCard ? 36 : isMainTitle ? 30 : 20;
      const duration = isFeaturedCard ? .95 : isMainTitle ? .65 : .85;

      gsap.set(item, {
        opacity: 0,
        y: initialY,
        force3D: true,
        transition: 'none',
        willChange: 'transform, opacity'
      });
      item.classList.add('visible');

      gsap.to(item, {
        opacity: 1,
        y: 0,
        duration,
        ease: 'power2.out',
        overwrite: 'auto',
        scrollTrigger: {
          trigger: item,
          start: 'top 88%',
          once: true,
          toggleActions: 'play none none none'
        },
        onComplete: () => gsap.set(item, {
          clearProps: 'opacity,transform,transition,willChange'
        })
      });
    });

    const projectShowcase = document.querySelector('.project-showcase');
    const projectMedia = projectShowcase?.querySelector('.project-media');
    const projectTextItems = projectShowcase ? [
      projectShowcase.querySelector('.project-category'),
      projectShowcase.querySelector('.project-copy h3'),
      projectShowcase.querySelector('.project-description'),
      ...projectShowcase.querySelectorAll('.project-benefits li'),
      projectShowcase.querySelector('.project-link')
    ].filter(Boolean) : [];

    if (projectShowcase && projectMedia && projectTextItems.length) {
      gsap.set(projectShowcase, {
        opacity: 1,
        y: 0,
        transition: 'none'
      });
      projectShowcase.classList.add('visible');

      gsap.set(projectMedia, {
        opacity: 0,
        y: 28,
        force3D: true,
        willChange: 'transform, opacity'
      });
      gsap.set(projectTextItems, {
        opacity: 0,
        y: 24,
        force3D: true,
        willChange: 'transform, opacity'
      });

      gsap.timeline({
        scrollTrigger: {
          trigger: projectShowcase,
          start: 'top 82%',
          once: true,
          toggleActions: 'play none none none'
        },
        onComplete: () => gsap.set([projectShowcase, projectMedia, ...projectTextItems], {
          clearProps: 'opacity,transform,transition,willChange'
        })
      })
        .to(projectMedia, {
          opacity: 1,
          y: 0,
          duration: .9,
          ease: 'power2.out'
        })
        .to(projectTextItems, {
          opacity: 1,
          y: 0,
          duration: .72,
          stagger: .11,
          ease: 'power2.out'
        }, '-=.34');
    }
  };

  initScrollReveals();

  document.querySelector('#footer-year').textContent = new Date().getFullYear();

  const CHAT_EMAIL = 'triviumgestao@outlook.com';
  const chatWidget = document.querySelector('[data-chat-widget]');
  const chatLauncher = chatWidget?.querySelector('.chat-launcher');
  const chatPanel = chatWidget?.querySelector('.chat-panel');
  const chatClose = chatWidget?.querySelector('.chat-close');
  const chatForm = chatWidget?.querySelector('[data-chat-form]');
  const chatName = chatWidget?.querySelector('#chat-name');
  const chatEmail = chatWidget?.querySelector('#chat-email');
  const chatMessage = chatWidget?.querySelector('#chat-message');
  const chatStatus = chatWidget?.querySelector('.chat-status');
  const chatOptions = [...(chatWidget?.querySelectorAll('[data-chat-option]') || [])];

  const setChatOpen = open => {
    if (!chatWidget || !chatLauncher || !chatPanel) return;
    chatWidget.classList.toggle('is-open', open);
    chatLauncher.setAttribute('aria-expanded', String(open));
    chatLauncher.setAttribute('aria-label', open ? 'Atendimento aberto' : 'Abrir atendimento');
    chatPanel.setAttribute('aria-hidden', String(!open));
    if (open) window.setTimeout(() => chatName?.focus(), 180);
  };

  chatLauncher?.addEventListener('click', () => setChatOpen(!chatWidget.classList.contains('is-open')));
  chatClose?.addEventListener('click', () => {
    setChatOpen(false);
    chatLauncher?.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && chatWidget?.classList.contains('is-open')) {
      setChatOpen(false);
      chatLauncher?.focus();
    }
  });
  const clearChatStatus = () => {
    if (!chatStatus) return;
    chatStatus.textContent = '';
    chatStatus.classList.remove('is-success');
  };

  chatOptions.forEach(option => option.addEventListener('click', () => {
    chatOptions.forEach(item => item.classList.toggle('is-selected', item === option));
    if (chatMessage) {
      chatMessage.value = option.dataset.chatOption || '';
      chatMessage.dispatchEvent(new Event('input'));
    }
    chatName?.focus();
  }));

  [chatName, chatEmail].forEach(field => field?.addEventListener('input', clearChatStatus));
  chatMessage?.addEventListener('input', () => {
    clearChatStatus();
    chatMessage.style.height = '42px';
    chatMessage.style.height = `${Math.min(chatMessage.scrollHeight, 96)}px`;
  });
  chatForm?.addEventListener('submit', event => {
    event.preventDefault();
    const name = chatName?.value.trim();
    const email = chatEmail?.value.trim();
    const message = chatMessage?.value.trim();
    if (!message) {
      if (chatStatus) chatStatus.textContent = 'Escreva uma mensagem para continuar.';
      chatMessage?.focus();
      return;
    }
    const subject = 'Mensagem pelo site da Triaxis Solutions';
    const body = `Olá, equipe Triaxis Solutions!\n\nNome: ${name}\nE-mail: ${email}\n\nMensagem:\n${message}\n\nMensagem preparada pelo atendimento do site.`;
    if (chatStatus) {
      chatStatus.textContent = 'Mensagem preparada. Conclua o envio no seu aplicativo de e-mail.';
      chatStatus.classList.add('is-success');
    }
    window.location.href = `mailto:${CHAT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

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
      status.textContent = 'Mensagem enviada. Em breve a Triaxis Solutions entra em contato.';
    } catch {
      status.classList.add('error');
      status.textContent = 'Não foi possível enviar agora. Tente novamente em alguns instantes.';
    } finally {
      submit.disabled = false;
      submit.textContent = submit.dataset.defaultLabel;
    }
  });
})();
