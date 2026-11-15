(() => {
  const CONTACT_ENDPOINT = '';
  const header = document.querySelector('[data-header]');
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-navigation');
  const navLinks = [...document.querySelectorAll('.main-nav a')];
  const scrollProgress = document.querySelector('.scroll-progress');
  const scrollProgressBar = scrollProgress?.querySelector('span');
  let syncSolutionMotion = null;
  let setSolutionRendering = () => {};

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

  let pageStateFrame = null;
  const updatePageState = () => {
    pageStateFrame = null;
    header?.classList.toggle('scrolled', window.scrollY > 12);
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
    if (scrollProgressBar) scrollProgressBar.style.transform = `scaleX(${progress})`;
    scrollProgress?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  };
  const schedulePageState = () => {
    if (pageStateFrame !== null) return;
    pageStateFrame = window.requestAnimationFrame(updatePageState);
  };
  updatePageState();
  window.addEventListener('scroll', schedulePageState, { passive: true });
  window.addEventListener('resize', schedulePageState, { passive: true });

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

    setSolutionRendering = active => coverflow.classList.toggle('is-transforming', active);

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
        card.dataset.coverflowOffset = String(offset);
        card.dataset.selected = String(index === selected && distance < .5);
        card.setAttribute('aria-current', index === selected ? 'true' : 'false');
      });

      syncSolutionMotion?.();
    };

    const settle = next => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      target = next;
      setSolutionRendering(true);

      if (reducedMotion) {
        position = target;
        paint();
        setSolutionRendering(false);
        return;
      }

      const step = () => {
        const remaining = target - position;
        if (Math.abs(remaining) < .0004) {
          position = target;
          paint();
          animationFrame = null;
          setSolutionRendering(false);
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
      setSolutionRendering(true);
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
    document.documentElement.classList.toggle('motion-disabled', reduceMotion || !gsap || !ScrollTrigger);

    if (reduceMotion || !gsap || !ScrollTrigger) {
      revealItems.forEach(item => item.classList.add('visible'));
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const backdropLogo = document.querySelector('.site-backdrop-logo');
    const backdropBand = document.querySelector('.site-backdrop-band');
    const backdropDots = [...document.querySelectorAll('.site-backdrop-dots')];
    if (backdropLogo && backdropBand) {
      gsap.to(backdropLogo, {
        yPercent: -8,
        rotation: 2,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true }
      });
      gsap.to(backdropBand, {
        xPercent: 5,
        rotation: 17,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true }
      });
      backdropDots.forEach((dot, index) => gsap.to(dot, {
        y: index ? -54 : 54,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.2, invalidateOnRefresh: true }
      }));
    }

    const mainTitleSelector = [
      '#hero-title',
      '#solutions-title',
      '#project-title',
      '#team-title',
      '#contact-title'
    ].join(',');

    revealItems.forEach(item => {
      if (item.closest('.hero')) {
        item.classList.add('visible');
        gsap.set(item, { opacity: 1, x: 0, y: 0, transition: 'none' });
        return;
      }

      const containsMainTitle = Boolean(item.matches(mainTitleSelector) || item.querySelector(mainTitleSelector));
      if (containsMainTitle) {
        item.classList.add('visible');
        gsap.set(item, { opacity: 1, x: 0, y: 0, transition: 'none' });
        return;
      }

      if (item.matches('.solution-coverflow')) {
        item.classList.add('visible');
        gsap.set(item, { opacity: 1, x: 0, y: 0, transition: 'none' });
        return;
      }

      const isLargeBlock = item.matches([
        '.solution-coverflow',
        '.project-showcase',
        '.person'
      ].join(','));
      const initialY = isLargeBlock ? 78 : 54;

      item.classList.add('visible');
      gsap.fromTo(item, {
        opacity: .16,
        y: initialY,
        force3D: true,
        transition: 'none',
        willChange: 'transform, opacity'
      }, {
        opacity: 1,
        y: 0,
        ease: 'none',
        overwrite: 'auto',
        scrollTrigger: {
          trigger: item,
          start: 'top 96%',
          end: 'top 58%',
          scrub: true,
          invalidateOnRefresh: true
        }
      });
    });

    const hero = document.querySelector('.hero');
    if (hero) {
      const heroTitleLines = [...hero.querySelectorAll('.hero-title-line > span')];
      const heroEyebrow = hero.querySelector('.eyebrow');
      const heroCopy = hero.querySelector('.hero-copy');
      const heroActions = hero.querySelector('.hero-actions');
      const heroAccent = hero.querySelector('.hero-copy-accent');
      const heroLaptop = hero.querySelector('.hero-project-laptop');
      const heroPhone = hero.querySelector('.hero-project-phone');
      const heroCards = [...hero.querySelectorAll('.hero-feature-card')];
      const heroDecor = [...hero.querySelectorAll('.dashboard-backdrop,.hero-visual-glow,.hero-visual-orbit')];
      const heroIntro = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroIntro
        .from(heroEyebrow, { opacity: 0, y: 18, duration: .62 }, 0)
        .from(heroTitleLines, { yPercent: 118, duration: .9, stagger: .1, force3D: true }, .08)
        .from(heroCopy, { opacity: 0, y: 24, duration: .72 }, .28)
        .from(heroActions, { opacity: 0, y: 20, duration: .68 }, .38)
        .from(heroAccent, { opacity: 0, scaleX: .35, transformOrigin: 'left center', duration: .6 }, .5)
        .from(heroLaptop, { opacity: 0, y: 46, scale: .975, duration: .95, force3D: true }, .16)
        .from(heroPhone, { opacity: 0, x: 20, y: 34, duration: .82, force3D: true }, .36)
        .from(heroCards, { opacity: 0, x: -18, y: 12, duration: .68, stagger: .1, force3D: true }, .42)
        .from(heroDecor, { opacity: 0, scale: .96, duration: .85, stagger: .07 }, .24);

      const heroCopyColumn = hero.querySelector('.hero-copy-column');
      const heroVisualScroll = hero.querySelector('[data-hero-scroll]');
      const atmosphereLines = [...hero.querySelectorAll('.hero-atmosphere-line')];
      if (heroCopyColumn && heroVisualScroll) {
        gsap.timeline({
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: .85,
            invalidateOnRefresh: true
          }
        })
          .to(heroCopyColumn, { y: () => window.innerWidth <= 650 ? -14 : -34, ease: 'none' }, 0)
          .to(heroCopy, { y: () => window.innerWidth <= 650 ? -4 : -12, ease: 'none' }, 0)
          .to(heroActions, { y: () => window.innerWidth <= 650 ? -2 : -7, ease: 'none' }, 0)
          .to(heroVisualScroll, { y: () => window.innerWidth <= 650 ? -8 : -18, scale: () => window.innerWidth <= 650 ? 1.01 : 1.025, ease: 'none', force3D: true }, 0)
          .to(atmosphereLines, { xPercent: index => index ? -5 : 6, y: index => index ? -16 : 20, ease: 'none' }, 0);
      }

      const heroCursor = hero.querySelector('[data-hero-cursor]');
      const heroPreview = hero.querySelector('.hero-login-preview');
      if (heroCursor && heroPreview) {
        const heroPointerMedia = gsap.matchMedia();
        heroPointerMedia.add('(min-width: 1001px) and (hover: hover) and (pointer: fine)', () => {
          const rotateX = gsap.quickTo(heroCursor, 'rotationX', { duration: .55, ease: 'power3.out' });
          const rotateY = gsap.quickTo(heroCursor, 'rotationY', { duration: .55, ease: 'power3.out' });
          const moveX = gsap.quickTo(heroCursor, 'x', { duration: .55, ease: 'power3.out' });
          const moveY = gsap.quickTo(heroCursor, 'y', { duration: .55, ease: 'power3.out' });
          const onPointerMove = event => {
            const bounds = heroPreview.getBoundingClientRect();
            const normalizedX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - .5) * 2));
            const normalizedY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - .5) * 2));
            rotateX(-normalizedY * 2);
            rotateY(normalizedX * 3);
            moveX(normalizedX * 8);
            moveY(normalizedY * 8);
          };
          const resetPointer = () => { rotateX(0); rotateY(0); moveX(0); moveY(0); };
          heroPreview.addEventListener('pointermove', onPointerMove);
          heroPreview.addEventListener('pointerleave', resetPointer);
          return () => {
            heroPreview.removeEventListener('pointermove', onPointerMove);
            heroPreview.removeEventListener('pointerleave', resetPointer);
            gsap.set(heroCursor, { clearProps: 'transform' });
          };
        });
      }
    }
    const splitTitleWords = title => {
      const textNodes = [];
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.textContent.trim()) textNodes.push(walker.currentNode);
      }

      const words = [];
      textNodes.forEach(textNode => {
        const fragment = document.createDocumentFragment();
        textNode.textContent.split(/(\s+)/).forEach(part => {
          if (!part.trim()) {
            fragment.append(document.createTextNode(part));
            return;
          }

          const word = document.createElement('span');
          word.className = 'scroll-title-word';
          word.textContent = part;
          word.style.display = 'inline-block';
          word.style.color = 'inherit';
          fragment.append(word);
          words.push(word);
        });
        textNode.replaceWith(fragment);
      });
      return words;
    };

    document.querySelectorAll(mainTitleSelector).forEach(title => {
      if (title.id === 'hero-title') return;
      const words = splitTitleWords(title);
      if (!words.length) return;

      const isContactTitle = title.id === 'contact-title';
      if (isContactTitle) gsap.set(title, { perspective: 900 });

      gsap.set(words, {
        opacity: isContactTitle ? .04 : .15,
        y: isContactTitle ? 70 : 20,
        rotationX: isContactTitle ? -16 : 0,
        transformOrigin: '50% 100%',
        force3D: true,
        willChange: 'transform, opacity'
      });

      gsap.timeline({
        scrollTrigger: {
          trigger: title,
          start: isContactTitle ? 'top 92%' : 'top 82%',
          end: isContactTitle ? 'top 34%' : 'top 48%',
          scrub: true,
          invalidateOnRefresh: true
        }
      }).to(words, {
        opacity: 1,
        y: 0,
        rotationX: 0,
        duration: 1,
        stagger: isContactTitle ? .34 : .48,
        ease: 'none'
      });
    });

    const solutionCoverflow = document.querySelector('[data-solution-coverflow]');
    const solutionSection = document.querySelector('.solutions');
    const solutionCardMotions = [...document.querySelectorAll('.solution-card-motion')];
    const solutionCardInners = [...document.querySelectorAll('.solution-card-inner')];
    if (solutionSection && solutionCoverflow && solutionCardMotions.length && solutionCardInners.length) {
      const desktopSolutions = window.matchMedia('(min-width: 1001px)').matches;
      let solutionProgress = 0;
      let solutionRenderTimer = null;

      const markSolutionRendering = () => {
        setSolutionRendering(true);
        window.clearTimeout(solutionRenderTimer);
        solutionRenderTimer = window.setTimeout(() => setSolutionRendering(false), 140);
      };

      const clampProgress = value => Math.max(0, Math.min(1, value));
      const renderSolutionMotion = () => {
        const movementProgress = clampProgress(solutionProgress / .46);

        solutionCardMotions.forEach(motion => {
          const card = motion.closest('.solution-card');
          const offset = Number(card?.dataset.coverflowOffset || 0);
          const side = Math.sign(offset);
          const distance = Math.min(1, Math.abs(offset));
          const remaining = 1 - movementProgress;

          gsap.set(motion, {
            xPercent: desktopSolutions ? -side * 88 * distance * remaining : 0,
            y: (desktopSolutions ? 8 + 46 * distance : 24) * remaining,
            rotationZ: desktopSolutions ? side * 16 * distance * remaining : 0,
            transformOrigin: '50% 50%',
            force3D: 'auto'
          });
        });

        solutionCardInners.forEach((inner, index) => {
          const flipStart = .46 + index * .11;
          const flipProgress = clampProgress((solutionProgress - flipStart) / .14);
          gsap.set(inner, {
            rotationY: 180 * (1 - flipProgress),
            transformOrigin: '50% 50%',
            force3D: 'auto'
          });
        });
      };

      syncSolutionMotion = renderSolutionMotion;
      ScrollTrigger.create({
        trigger: solutionSection,
        start: desktopSolutions ? 'top top' : 'top 90%',
        end: desktopSolutions ? 'bottom bottom' : 'bottom 28%',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          markSolutionRendering();
          solutionProgress = self.progress;
          renderSolutionMotion();
        },
        onScrubComplete: () => setSolutionRendering(false),
        onLeave: () => setSolutionRendering(false),
        onLeaveBack: () => setSolutionRendering(false),
        onRefresh: self => {
          solutionProgress = self.progress;
          renderSolutionMotion();
        }
      });
      renderSolutionMotion();
    }

    const choreography = document.querySelector('[data-scroll-choreography]');
    const mainScreen = choreography?.querySelector('[data-choreo-main]');
    const stockScreen = choreography?.querySelector('[data-choreo-piece="stock"]');
    const reportsScreen = choreography?.querySelector('[data-choreo-piece="reports"]');
    const fleetScreen = choreography?.querySelector('[data-choreo-piece="fleet"]');
    const choreographyTrack = choreography?.closest('.project-choreography-track');

    if (choreography && choreographyTrack && mainScreen && stockScreen && reportsScreen && fleetScreen) {
      const choreographyMedia = gsap.matchMedia();
      choreographyMedia.add('(min-width: 651px)', () => {
        const choreographyScreens = [mainScreen, stockScreen, reportsScreen, fleetScreen];
        const setChoreographyRendering = active => choreographyScreens.forEach(screen => screen.classList.toggle('is-transforming', active));
        const centerX = element => choreography.clientWidth / 2 - (element.offsetLeft + element.offsetWidth / 2);
        const centerY = element => choreography.clientHeight / 2 - (element.offsetTop + element.offsetHeight / 2);
        const heroScale = () => Math.min(
          choreography.clientWidth * .96 / mainScreen.offsetWidth,
          choreography.clientHeight * .92 / mainScreen.offsetHeight
        );

        gsap.set(choreographyScreens, {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          force3D: 'auto'
        });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: choreographyTrack,
            start: () => `top top+=${(document.querySelector('.site-header')?.offsetHeight || 78) + 18}`,
            end: 'bottom bottom',
            scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: () => setChoreographyRendering(true),
            onScrubComplete: () => setChoreographyRendering(false),
            onLeave: () => setChoreographyRendering(false),
            onLeaveBack: () => setChoreographyRendering(false)
          }
        });

        timeline
          .to(stockScreen, {
            y: () => reportsScreen.offsetTop - stockScreen.offsetTop,
            duration: .25,
            ease: 'power2.inOut'
          }, 0)
          .to(fleetScreen, {
            y: () => mainScreen.offsetTop - fleetScreen.offsetTop,
            duration: .25,
            ease: 'power2.inOut'
          }, 0)
          .to([stockScreen, reportsScreen, fleetScreen], {
            x: index => centerX([stockScreen, reportsScreen, fleetScreen][index]),
            y: index => centerY([stockScreen, reportsScreen, fleetScreen][index]),
            duration: .25,
            ease: 'power2.inOut'
          }, .4)
          .to(mainScreen, {
            x: () => centerX(mainScreen),
            y: () => centerY(mainScreen),
            duration: .25,
            ease: 'power2.inOut'
          }, .4)
          .to([stockScreen, reportsScreen, fleetScreen], {
            opacity: 0,
            duration: .18,
            ease: 'power1.out'
          }, .82)
          .to(mainScreen, {
            scale: heroScale,
            duration: .25,
            ease: 'power2.inOut'
          }, 1.2);

        return () => {
          setChoreographyRendering(false);
          timeline.scrollTrigger?.kill();
          timeline.kill();
        };
      });
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
